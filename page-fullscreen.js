// 页面级全屏（Fullscreen API），和 hedwig PPT 里按 F 是同一套机制。
//
// 为什么不用 chrome.windows.update({state:'fullscreen'})：
// 那是「窗口状态全屏」，在 macOS 上会新建一个原生全屏 Space —— 有过渡动画
// （开了台前调度更明显），退出时 Chrome 还会 setBounds 去写窗口尺寸，于是
// 窗口会先缩成 Chrome 记的「还原尺寸」再还原，且 Esc 也不管用。
//
// 而 element.requestFullscreen() 是「元素全屏」：在同一个 Space 里就把画面
// 铺满，窗口 frame 自始至终没被改过，所以
//   - 瞬切，没有动画
//   - Esc 原生就能退出，不需要我们补
//   - 退出后尺寸一定和进全屏前一模一样
//
// requestFullscreen 需要「用户手势激活」，这里的调用发生在真实 keydown 的
// 处理过程中，激活是有的，浏览器认。

const KEY_CODE = 'KeyF'; // 物理按键 F，跟键盘布局无关
const NEEDS_ALT = true;
const NEEDS_SHIFT = true;

function matchesShortcut(event) {
  return (
    event.code === KEY_CODE &&
    event.altKey === NEEDS_ALT &&
    event.shiftKey === NEEDS_SHIFT &&
    !event.metaKey &&
    !event.ctrlKey
  );
}

function isPageFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// 同一次按键可能被多个处理器看到：扩展和油猴脚本同时装了、或者装了两份扩展。
// 各自都 toggle 一遍会互相抵消 —— 一个调 exitFullscreen() 之后
// document.fullscreenElement 立刻变 null，另一个读到「不是全屏」又去
// requestFullscreen()，表现为快捷键失灵。用 DOM 上的时间戳认领，
// 保证一次按键只动作一次。DOM 属性跨执行环境共享，油猴那边也认这同一个 key。
const CLAIM_KEY = 'oneClickFullscreenAt';
const CLAIM_WINDOW_MS = 300;

function claimKeypress() {
  const el = document.documentElement;
  const now = Date.now();
  const last = Number(el.dataset[CLAIM_KEY] || 0);
  if (now - last < CLAIM_WINDOW_MS) return false;
  el.dataset[CLAIM_KEY] = String(now);
  return true;
}

async function togglePageFullscreen() {
  try {
    if (isPageFullscreen()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      return;
    }

    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) throw new Error('当前环境没有 Fullscreen API');
    await request.call(el);
  } catch (error) {
    // 页面里用不了 Fullscreen API（Permissions-Policy 拦了、非顶层文档、
    // 或者浏览器判定没有用户激活）。退回让 background 用 chrome.windows
    // 那套窗口全屏，好用但会慢、会有动画。
    chrome.runtime.sendMessage({ type: 'page-fullscreen-failed' });
  }
}

document.addEventListener(
  'keydown',
  (event) => {
    if (event.repeat || !matchesShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!claimKeypress()) return; // 已经被另一个处理器认领，别重复 toggle
    togglePageFullscreen();
  },
  true // 捕获阶段，先于页面自己的处理拿到按键
);

// Esc：元素全屏时浏览器自己就会退出，不用管；只有走窗口全屏兜底时
// 才需要上报给 background。是不是我们自己进的全屏，由 background 记账。
document.addEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape' || event.repeat) return;
    if (isPageFullscreen()) return;
    chrome.runtime.sendMessage({ type: 'escape-pressed' });
  },
  true
);
