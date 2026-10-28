# 一键全屏（chrome-fullscreen-ext）

一个极简的 Chrome 扩展，两种全屏各占一个快捷键：

| 快捷键 | 机制 | 特点 | 适合 |
| --- | --- | --- | --- |
| `Alt+Shift+F` | 窗口全屏（`chrome.windows`） | 跨页面、跨标签都保持；有 macOS Space 动画 | GitLab 这类会整页跳转的站点 |
| `Alt+Shift+G` | 元素全屏（`element.requestFullscreen()`） | 瞬切；但绑在当前文档上，跳转页面/切标签就结束 | 看文档、翻 PPT |

两者都可以用 `Esc` 退出。

## 为什么需要两种

`chrome://` 的窗口全屏（F11 / ⌃⌘F）在 macOS 上会新建一个原生全屏 Space：有过渡动画（开了台前调度更明显），退出时浏览器还会写回窗口尺寸，导致窗口先缩成"还原尺寸"再还原，而且 `Esc` 根本不管用。

所以 `Alt+Shift+G` 走的是网页自己的 **Fullscreen API**（`element.requestFullscreen()`），和网页 PPT 按 F 全屏是同一套机制：

- 瞬切，没有 Space 过渡动画
- `Esc` 原生就能退出，不需要扩展补
- 窗口 frame 自始至终没被改过，退出后尺寸和进全屏前**完全一致**

它的软肋是**生命周期绑在文档上**：整页导航（比如 GitLab 搜索）、新建/切换标签都会结束全屏。这种场景用 `Alt+Shift+F`——它就是 F11 那一套，只是补上了 `Esc` 退出和退出后的尺寸还原。

## 安装

### 方式一：下载 Release 压缩包（推荐）

1. 到本仓库的 [Releases](../../releases) 页面，下载最新版的 `chrome-fullscreen-ext-<版本>.zip`
2. 解压得到一个同名文件夹
3. 打开 Chrome，地址栏输入 `chrome://extensions`
4. 打开右上角的 **开发者模式**
5. 点 **加载已解压的扩展程序**，选中刚解压出来的那个文件夹

> Chrome 不允许直接安装 `.zip`，所以必须解压后"加载已解压的扩展程序"。

Release 里还附了 `.crx`（Chrome 的扩展打包格式）。它**只在 Linux 或企业策略分发时可用**：macOS / Windows 的 Chrome 自 75 版起禁止安装非 Chrome 应用商店来源的 crx（会报 `CRX_REQUIRED_PROOF_MISSING`），拖进去也装不上。

> 真要"一键安装"，只有上架 Chrome 应用商店这一条路；本地分发的正路就是解压 + 加载已解压。

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

它实现的是元素全屏那条路径，快捷键与扩展统一为 `Alt+Shift+G`（`Esc` + 尺寸天然还原），但少两件事：没有工具栏图标入口；页面禁用 Fullscreen API 时没有窗口全屏兜底。本地 `file://` 页面需要在篡改猴设置里打开 **"允许访问文件网址"**。

> 新版 Chrome 对用户脚本有额外限制：需要在 `chrome://extensions` 打开 **开发者模式**（部分版本显示为"允许用户脚本"开关），否则篡改猴装了脚本也不会执行。

## 使用

| 操作 | 效果 |
| --- | --- |
| `Alt+Shift+F` | 窗口全屏 / 退出。跨页面、跨标签都保持，进出有 Space 动画 |
| `Alt+Shift+G` | 页面全屏（元素全屏）/ 退出。瞬切，但跳转页面、切标签会结束 |
| `Esc` | 退出全屏（元素全屏浏览器原生处理；窗口全屏由扩展接管） |
| 点工具栏图标 | 窗口全屏兜底（仅普通网页；`chrome://` 页面不做，避免进得去出不来） |

快捷键可在 [page-fullscreen.js](page-fullscreen.js) 顶部的 `WINDOW_KEY_CODE`（`F`）/ `PAGE_KEY_CODE`（`G`）/ `NEEDS_ALT` / `NEEDS_SHIFT` 里改。

> **扩展和用户脚本只需装一个。** 两个同时启用时，1.1 起有按键认领机制兜底（一次按键只会有一个生效），但仍然建议只留一个，省得排查问题时混淆。

## 已知限制

- **`chrome://` 页面、新标签页、Chrome 应用商店、内置 PDF 查看器**：Chrome 禁止扩展向这些页面注入脚本，两个快捷键都无反应，工具栏图标也不再生效（1.2 起）。这些页面请用 `⌃⌘F` / `F11` 原生全屏。

  > 为什么图标在那里也不做：窗口全屏后 Esc 没有人上报（内容脚本不存在），工具栏图标又被全屏挡住，只能靠 `⌃⌘F` 才出得来。与其给个半成品入口，不如不做。

- **`chrome://` 页面上的 Esc**：同理，那些页面没有内容脚本，`⌃⌘F` 进去的全屏按 Esc 也退不出来。这些页面只能再用 `⌃⌘F` 退出。
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

- **1.5** —— 对调两个快捷键：`Alt+Shift+F` 窗口全屏（跨页面保持），`Alt+Shift+G` 页面全屏（瞬切）。用户脚本同步改为 `G`。
- **1.4** —— 拆成两个快捷键：`Alt+Shift+F` 页面全屏（瞬切），`Alt+Shift+G` 窗口全屏（跨页面、跨标签保持）。

- **1.3** —— Esc 恢复接管 `⌃⌘F` / `F11` 进的原生窗口全屏（1.2 收紧成只认自己进的全屏，导致原生全屏按 Esc 无反应）。
- **1.2** —— 工具栏图标只在有内容脚本的页面生效，`chrome://` 页面不再进入窗口全屏（避免进去之后 Esc 退不出来）。
- **1.1** —— 加了按键认领机制：扩展和用户脚本（或两份扩展）同时启用时，一次按键只允许一个处理器动作，避免互相抵消导致快捷键失灵。
- **1.0** —— 第一版。主路径改为 Fullscreen API，`Esc` 原生退出，窗口尺寸天然还原。
