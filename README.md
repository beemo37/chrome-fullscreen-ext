# 一键全屏（chrome-fullscreen-ext）

一个极简的 Chrome 扩展：按 `Alt+Shift+F` 让当前**网页**全屏，再按一次或按 `Esc` 退出。

## 为什么不是 F11

`chrome://` 的窗口全屏（F11 / ⌃⌘F）在 macOS 上会新建一个原生全屏 Space：有过渡动画（开了台前调度更明显），退出时浏览器还会写回窗口尺寸，导致窗口先缩成"还原尺寸"再还原，而且 `Esc` 根本不管用。

这个扩展走的是网页自己的 **Fullscreen API**（`element.requestFullscreen()`），和网页 PPT 按 F 全屏是同一套机制：

- 瞬切，没有 Space 过渡动画
- `Esc` 原生就能退出，不需要扩展补
- 窗口 frame 自始至终没被改过，退出后尺寸和进全屏前**完全一致**

## 安装

### 方式一：下载 Release 压缩包（推荐）

1. 到本仓库的 [Releases](../../releases) 页面，下载 `chrome-fullscreen-ext-1.0.zip`
2. 解压得到一个 `chrome-fullscreen-ext-1.0` 文件夹
3. 打开 Chrome，地址栏输入 `chrome://extensions`
4. 打开右上角的 **开发者模式**
5. 点 **加载已解压的扩展程序**，选中刚解压出来的那个文件夹

> Chrome 不允许直接安装 `.zip` 或 `.crx`（除非企业策略），所以必须解压后"加载已解压的扩展程序"。

### 方式二：克隆仓库

```bash
git clone <本仓库地址>
```

然后把仓库目录本身作为"已解压的扩展程序"加载即可。

## 使用

| 操作 | 效果 |
| --- | --- |
| `Alt+Shift+F` | 当前页面全屏 / 退出全屏 |
| `Esc` | 退出全屏（浏览器原生行为） |
| 点工具栏图标 | 兜底：内容脚本进不去的页面用窗口全屏接管 |

快捷键可在 `page-fullscreen.js` 顶部的 `KEY_CODE` / `NEEDS_ALT` / `NEEDS_SHIFT` 里改。

## 已知限制

- **`chrome://` 页面、新标签页、Chrome 应用商店、内置 PDF 查看器**：内容脚本无法注入，`Alt+Shift+F` 无反应。这些页面请用 `⌃⌘F` / `F11`，或点工具栏图标走兜底路径。
- **本地 `file://` 页面**：需要在 `chrome://extensions` → 本扩展 → 详情里打开 **"允许访问文件网址"**。
- **页面自身禁用全屏**（`Permissions-Policy: fullscreen=()`）：会自动退回窗口全屏兜底，会有动画。

## 文件结构

```
manifest.json        扩展清单（MV3）
page-fullscreen.js   内容脚本：捕获按键，调用 Fullscreen API（主路径）
background.js        service worker：窗口全屏兜底路径 + 尺寸还原
icons/               图标
```

## 版本

- **1.0** —— 第一版。主路径改为 Fullscreen API，`Esc` 原生退出，窗口尺寸天然还原。
