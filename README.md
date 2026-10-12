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

### 方式三：篡改猴用户脚本（最省事，不装扩展）

不想装扩展的话，仓库里有逻辑等价的用户脚本 [userscript/one-click-fullscreen.user.js](userscript/one-click-fullscreen.user.js)。装好 [篡改猴](https://www.tampermonkey.net/) 后，直接打开下面任一链接就会弹出安装确认：

**推荐（jsDelivr CDN，国内可达）：**

```
https://cdn.jsdelivr.net/gh/beemo37/chrome-fullscreen-ext@main/userscript/one-click-fullscreen.user.js
```

**备选（GitHub raw，国内经常超时）：**

```
https://raw.githubusercontent.com/beemo37/chrome-fullscreen-ext/main/userscript/one-click-fullscreen.user.js
```

> 如果打开链接只看到篡改猴的 `SCRIPT INSTALLATION` 白页、没有安装确认框，就是脚本没下载下来（raw 域名在国内常年不稳）。换上面的 jsDelivr 链接，或者手动导入：打开任一链接把内容复制下来，在篡改猴面板里点"添加新脚本"，全选粘贴后 `Ctrl+S` 保存。

> 维护提示：jsDelivr 对 `@main` 这种分支引用有缓存（最长 12 小时），推了新版本可能取到旧的。要立刻生效可以清缓存
> `curl https://purge.jsdelivr.net/gh/beemo37/chrome-fullscreen-ext@main/userscript/one-click-fullscreen.user.js`，
> 或者把链接里的 `@main` 换成具体的 commit hash / tag，那是不可变的、不会取到旧内容。

它实现的是同一条主路径（`Alt+Shift+F` + `Esc` + 尺寸天然还原），但少两件事：没有工具栏图标入口；页面禁用 Fullscreen API 时没有窗口全屏兜底。本地 `file://` 页面需要在篡改猴设置里打开 **"允许访问文件网址"**。

> 新版 Chrome 对用户脚本有额外限制：需要在 `chrome://extensions` 打开 **开发者模式**（部分版本显示为"允许用户脚本"开关），否则篡改猴装了脚本也不会执行。

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
userscript/          篡改猴用户脚本版（等价主路径，不需要装扩展）
```

## 版本

- **1.0** —— 第一版。主路径改为 Fullscreen API，`Esc` 原生退出，窗口尺寸天然还原。
