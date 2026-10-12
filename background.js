// 全屏 / 退出全屏。
//
// 主路径是「元素全屏」：由内容脚本 (page-fullscreen.js) 在按键处理里调用
// element.requestFullscreen()，和 hedwig PPT 按 F 是同一套机制。它在 macOS 上
// 不新建 Space，瞬切、Esc 原生可退、窗口尺寸天然不变。
//
// 这个文件负责的是兜底路径：内容脚本进不去或页面不让用 Fullscreen API 时，
// 用 chrome.windows.update 的「窗口全屏」顶上去。它会慢、有动画，退出时还得
// 自己还原尺寸（见下面第 2 条），所以只当备用。
//
// 1. 兜底全屏后 Esc 要能退：窗口全屏不认 Esc，靠内容脚本上报。
//    只对「确实是我们自己用窗口全屏进的」窗口生效 —— 元素全屏时
//    chrome.windows 读到的 state 也可能是 fullscreen，无脑响应会误伤。
// 2. 兜底全屏退出后尺寸不对：update({state:'normal'}) 用的是窗口的
//    「还原尺寸」，不等于全屏前的尺寸。所以进全屏前把 bounds / 原 state
//    记下来，退出时按记录还原。
// 3. 原是最大化的窗口退出时「先缩再放大」：退全屏那一步直接带上记录到的
//    满屏 bounds，视觉上少一次缩小；REASSERT_MAXIMIZED 控制要不要补状态标记。

/** 排查用：设为 true 会在「检查视图 → Service Worker」控制台打印状态变化。 */
const DEBUG = false;

/** 是否在退全屏后补一次最大化标记。 */
const REASSERT_MAXIMIZED = true;

/** 退全屏动画期间读到的是中间值，补第二步前先等它落定。 */
const SETTLE_MS = 300;

/** windowId -> 进入窗口全屏前的 {state, left, top, width, height} */
const savedWindowState = new Map();

/** 我们自己用 chrome.windows 造成窗口全屏的 windowId（元素全屏不记在这里） */
const ourWindowFullscreen = new Set();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(...args) {
  if (DEBUG) console.log('[一键全屏]', ...args);
}

function describe(win) {
  if (!win) return '(窗口已不存在)';
  return `${win.state} ${win.width}x${win.height} @(${win.left},${win.top})`;
}

function sameBounds(a, b) {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

async function getWindow(windowId) {
  try {
    return await chrome.windows.get(windowId);
  } catch {
    return null; // 窗口已经关掉了
  }
}

/** 退出后的尺寸轨迹：看看它是先缩后放，还是一路缩到底 */
function traceBounds(windowId, label) {
  if (!DEBUG) return;
  [80, 200, 400, 800, 1500].forEach(async (ms) => {
    await wait(ms);
    log(`  ${label} +${ms}ms ->`, describe(await getWindow(windowId)));
  });
}

// ---------- 兜底路径：chrome.windows 窗口全屏 ----------

async function enterWindowFullscreen(win) {
  log('兜底：进入窗口全屏前', describe(win));
  savedWindowState.set(win.id, {
    state: win.state === 'maximized' ? 'maximized' : 'normal',
    left: win.left,
    top: win.top,
    width: win.width,
    height: win.height
  });
  ourWindowFullscreen.add(win.id);
  await chrome.windows.update(win.id, { state: 'fullscreen' });
  log('兜底：进入窗口全屏后', describe(await getWindow(win.id)));
}

async function exitWindowFullscreen(win) {
  const saved = savedWindowState.get(win.id);
  savedWindowState.delete(win.id);
  ourWindowFullscreen.delete(win.id);

  // 没有记录（比如窗口是被原生 F11 / ⌃⌘F 全屏的）：只退回普通状态。
  if (!saved) {
    log('兜底：退出，没有记录 -> normal');
    await chrome.windows.update(win.id, { state: 'normal' });
    traceBounds(win.id, '无记录');
    return;
  }

  log(
    '兜底：退出，记录的是',
    saved.state,
    `${saved.width}x${saved.height} @(${saved.left},${saved.top})`
  );

  const bounds = {
    left: saved.left,
    top: saved.top,
    width: saved.width,
    height: saved.height
  };

  if (saved.state === 'maximized') {
    log('  分支=最大化，第 1 步: normal + 记录到的 bounds');
    await chrome.windows.update(win.id, { state: 'normal', ...bounds });
    log('  第 1 步之后:', describe(await getWindow(win.id)));
    traceBounds(win.id, '第 1 步');

    await wait(SETTLE_MS);
    if (REASSERT_MAXIMIZED) {
      const now = await getWindow(win.id);
      if (now && now.state === 'normal') {
        log('  第 2 步: maximized');
        await chrome.windows.update(win.id, { state: 'maximized' });
        log('  第 2 步之后:', describe(await getWindow(win.id)));
      } else {
        log('  第 2 步跳过，窗口已经是', describe(now));
      }
    }
    return;
  }

  log('  分支=普通窗口，normal + 记录到的 bounds');
  await chrome.windows.update(win.id, { state: 'normal', ...bounds });
  log('  之后:', describe(await getWindow(win.id)));
  traceBounds(win.id, '普通还原');

  const now = await getWindow(win.id);
  if (now && !sameBounds(now, bounds)) {
    log('  尺寸没对上，补一次 update(bounds)');
    await chrome.windows.update(win.id, bounds);
  }
}

async function toggleWindowFullscreen(windowId) {
  const win = await getWindow(windowId);
  if (!win) return;
  if (win.state === 'fullscreen') {
    await exitWindowFullscreen(win);
  } else {
    await enterWindowFullscreen(win);
  }
}

// ---------- 入口 ----------

// 工具栏图标：进不去内容脚本的页面（chrome:// 等）只能靠它走兜底路径。
chrome.action.onClicked.addListener((tab) => {
  log('图标点击');
  if (tab && tab.windowId != null) toggleWindowFullscreen(tab.windowId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message) return;
  const windowId = sender.tab && sender.tab.windowId;

  // 元素全屏失败（Permissions-Policy 拦了、非顶层文档、没有用户激活等），
  // 改用窗口全屏兜底。
  if (message.type === 'page-fullscreen-failed') {
    log('元素全屏失败，改用窗口全屏兜底');
    if (windowId != null) toggleWindowFullscreen(windowId);
    return;
  }

  // 窗口全屏兜底状态下的 Esc。只认我们自己造成的窗口全屏。
  if (message.type === 'escape-pressed') {
    if (windowId == null || !ourWindowFullscreen.has(windowId)) return;
    log('Esc：退出窗口全屏兜底');
    getWindow(windowId).then((win) => {
      if (win && win.state === 'fullscreen') return exitWindowFullscreen(win);
    });
  }
});

// 窗口关掉时清掉记录，别让两个集合无限增长
chrome.windows.onRemoved.addListener((windowId) => {
  savedWindowState.delete(windowId);
  ourWindowFullscreen.delete(windowId);
});
