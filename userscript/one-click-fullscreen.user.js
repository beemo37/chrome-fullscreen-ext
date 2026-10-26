// ==UserScript==
// @name         页面全屏（Alt+Shift+G）
// @namespace    https://github.com/beemo37/chrome-fullscreen-ext
// @version      1.2
// @description  按 Alt+Shift+G 让当前网页全屏 / 退出；Esc 原生退出，窗口尺寸天然还原
// @author       beemo37
// @homepageURL  https://github.com/beemo37/chrome-fullscreen-ext
// @supportURL   https://github.com/beemo37/chrome-fullscreen-ext/issues
// @updateURL    https://cdn.jsdelivr.net/gh/beemo37/chrome-fullscreen-ext@main/userscript/one-click-fullscreen.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/beemo37/chrome-fullscreen-ext@main/userscript/one-click-fullscreen.user.js
// @match        *://*/*
// @include      file:///*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// 这是扩展那套逻辑的「用户脚本版」，走的是同一条主路径：
// 在真实按键的处理过程中调用 element.requestFullscreen()。
//
// 元素全屏在 macOS 上不新建 Space，所以瞬切、无过渡动画；Esc 由浏览器原生
// 处理；窗口 frame 自始至终没被改过，退出后尺寸和进全屏前一模一样。
//
// 相比扩展少了两件事（用户脚本做不到）：
//   1. 没有工具栏图标入口；
//   2. Fullscreen API 被页面禁用（Permissions-Policy）时，没法退回
//      chrome.windows 的窗口全屏兜底，只能告警。

(function () {
  'use strict';

  const KEY_CODE = 'KeyG'; // 物理按键 G，与键盘布局无关
  const NEEDS_ALT = true;
  const NEEDS_SHIFT = true;

  function isPageFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // 同一次按键可能被多个处理器看到：扩展和油猴脚本同时装了、或者装了两份扩展。
  // 各自都 toggle 一遍会互相抵消 —— 一个调 exitFullscreen() 之后
  // document.fullscreenElement 立刻变 null，另一个读到「不是全屏」又去
  // requestFullscreen()，表现为快捷键失灵。用 DOM 上的时间戳认领，
  // 保证一次按键只动作一次。DOM 属性跨执行环境共享，扩展那边也认这同一个 key。
  const CLAIM_KEY = 'oneClickPageFullscreenAt'; // 与扩展的 G 键共用一个认领标记
  const CLAIM_WINDOW_MS = 300;

  function claimKeypress() {
    const el = document.documentElement;
    const now = Date.now();
    const last = Number(el.dataset[CLAIM_KEY] || 0);
    if (now - last < CLAIM_WINDOW_MS) return false;
    el.dataset[CLAIM_KEY] = String(now);
    return true;
  }

  document.addEventListener(
    'keydown',
    async (event) => {
      if (event.repeat || event.code !== KEY_CODE) return;
      if (event.altKey !== NEEDS_ALT || event.shiftKey !== NEEDS_SHIFT) return;
      if (event.metaKey || event.ctrlKey) return;

      // 先拦住，别让快捷键在输入框里变成字符，也别让页面自己的处理重复响应
      event.preventDefault();
      event.stopPropagation();

      if (!claimKeypress()) return; // 已经被另一个处理器认领，别重复 toggle

      if (isPageFullscreen()) {
        try {
          await document.exitFullscreen();
        } catch (error) {
          console.warn('[一键全屏] 退出全屏失败：', error);
        }
        return;
      }

      try {
        await document.documentElement.requestFullscreen();
      } catch (error) {
        // 最常见的两种原因：页面用 Permissions-Policy 禁了 fullscreen，
        // 或者这个文档不是顶层文档。用户脚本没有窗口全屏可退，只能到此为止。
        console.warn('[一键全屏] 当前页面不允许全屏：', error);
      }
    },
    true // 捕获阶段，先于页面自己的处理拿到按键
  );
})();
