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
//
// 两种全屏各有一个快捷键：
//   Alt+Shift+F —— 元素全屏（这里）。瞬切，但绑在当前文档上：跳转页面、
//                  切标签就结束。适合看文档、翻 PPT。
//   Alt+Shift+G —— 窗口全屏（background 里用 chrome.windows 做）。跨页面、
//                  跨标签都保持，适合在 GitLab 这类会整页跳转的站点里长时间用。

const PAGE_KEY_CODE = 'KeyF'; // 元素全屏。物理按键，跟键盘布局无关
const WINDOW_KEY_CODE = 'KeyG'; // 窗口全屏（交给 background 处理）
const NEEDS_ALT = true;
const NEEDS_SHIFT = true;

function matchesShortcut(event, code) {
  return (
    event.code === code &&
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
// 保证一次按键只动作一次。DOM 属性跨执行环境共享，油猴那边也认这个 key。
//
// 两个组合用各自的 key：先按 F 再按 G（或反过来）不会互相吞掉。
const CLAIM_WINDOW_MS = 300;
const CLAIM_KEYS = {
  page: 'oneClickFullscreenAt', // 油猴脚本也用这个名字
  window: 'oneClickWindowFullscreenAt'
};

function claimKeypress(kind) {
  const el = document.documentElement;
  const key = CLAIM_KEYS[kind];
  const now = Date.now();
  const last = Number(el.dataset[key] || 0);
  if (now - last < CLAIM_WINDOW_MS) return false;
  el.dataset[key] = String(now);
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
    if (event.repeat) return;

    if (matchesShortcut(event, PAGE_KEY_CODE)) {
      event.preventDefault();
      event.stopPropagation();
      if (!claimKeypress('page')) return; // 已被另一个处理器认领，别重复 toggle
      togglePageFullscreen();
      return;
    }

    // 窗口全屏：跨页面、跨标签都保持。用 chrome.windows 那套，交给 background，
    // 因为它要记账（进全屏前的尺寸/状态）才能正确还原。
    if (matchesShortcut(event, WINDOW_KEY_CODE)) {
      event.preventDefault();
      event.stopPropagation();
      if (!claimKeypress('window')) return;
      chrome.runtime.sendMessage({ type: 'window-fullscreen-toggle' });
    }
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

// 让 background 能问「这个标签页里有没有内容脚本」。
// 没有就说明是 chrome:// 这类注入不了的页面，那边不应该用窗口全屏兜底 ——
// 进去之后 Esc 没人上报、工具栏图标又被全屏挡住，会卡在里面出不来。
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'ping') {
    sendResponse({ pong: true });
  }
});
