# OpenCLI 的 Discord Desktop 插件

[English](README.md) | [简体中文](README.zh-CN.md)

这是从 OpenCLI 原内置 `discord-app` 适配器拆分出来、独立维护的社区插件。
**OpenCLI 在 2.0 中移除了 Electron 桌面自动化功能，不再在主仓库中维护该适配器。**
本项目将原有适配器整理为可单独安装的插件，继续维护其功能。

插件保留原有 11 个命令接口，涵盖连接状态、服务器、频道、消息、搜索、成员、
导航、帖子、发送和删除。本项目不是 OpenCLI 或 Discord 官方插件；原始代码
归属 OpenCLI 贡献者，继续遵循 Apache-2.0 许可证。

> **实验性版本：**连接和基础列表功能已通过真实客户端验证。频道读取、搜索、
> 帖子和真实发送/删除仍待实测。使用写操作前请阅读[验证状态](#验证状态)。

## 环境要求

| 依赖 | 要求 |
| --- | --- |
| Node.js / npm | Node >=22.4；CI 覆盖 Node 22 和 24 |
| Git | 已加入 `PATH`，供 OpenCLI 克隆和更新插件 |
| OpenCLI | >=2.0.3 且 <3 |
| Discord Desktop | 已登录，并开启本机 CDP 调试端口 |

可从 [nodejs.org](https://nodejs.org/en/download) 安装仍受支持的 Node 版本。
使用 `node --version`、`npm --version` 和 `git --version` 检查环境。

## 快速开始

### 1. 安装 OpenCLI 和插件

已有兼容的 OpenCLI 时，跳过第一条命令。版本范围将 OpenCLI 保持在 2.x。

```bash
npm install --global '@jackwener/opencli@^2.0.3'
opencli plugin install github:harveyx86/opencli-plugin-discord-app
```

**普通用户无需克隆本仓库、在仓库中执行 `npm install`，也无需构建。**
OpenCLI 会处理插件安装，并链接自身的注册接口包。插件没有额外运行时依赖；
`jsdom` 和固定版本的 OpenCLI 仅用于开发与测试。不需要浏览器扩展或机器人令牌。

### 2. 开启 Discord 调试端口

macOS：先完全退出 Discord，再启动：

```bash
open -a Discord --args --remote-debugging-port=9232
```

Linux：退出 Discord 后执行 `discord --remote-debugging-port=9232`。
Windows：使用本机实际安装的 `Discord.exe`，添加 `--remote-debugging-port=9232` 参数启动。
插件代码可跨平台使用，但目前仅在 macOS 上进行过真实客户端验证。

如果希望在 macOS 中点击图标启动，可以在「脚本编辑器」中将以下脚本导出为
「应用程序」，再拖入 Dock：

```applescript
do shell script "/usr/bin/open -a Discord --args --remote-debugging-port=9232"
```

Discord 已运行时，再点击启动器不会给已有进程补上启动参数。

### 3. 验证连接

默认端点为 `http://127.0.0.1:9232`，无需设置环境变量：

```bash
curl --fail http://127.0.0.1:9232/json/version
opencli discord-app status
opencli discord-app servers -f table
```

使用其他端口时，可仅对一次调用指定端点，替换下方的 `PORT`：

```bash
OPENCLI_CDP_ENDPOINT="http://127.0.0.1:PORT" opencli discord-app status
```

插件只接受本机 HTTP 端点和 Discord HTTPS 页面。指定端口上应只有一个 Discord
页面。不要将调试端口暴露到网络；全局设置 `OPENCLI_CDP_ENDPOINT` 还会影响其他
OpenCLI 工作流。

## 命令

| 命令 | 参数 | 范围 |
| --- | --- | --- |
| `status` | 无 | CDP 连接、页面地址和标题，不代表已验证登录状态 |
| `servers` | 无 | 当前侧栏中已渲染的服务器 |
| `channels` | 无 | 当前已渲染的频道或私信会话链接 |
| `members` | 无 | 最多 50 个已渲染的成员条目 |
| `read` | `--count`、`--guild`、`--channel`、`--url` | 当前已渲染消息中的最后 N 条，可先导航 |
| `search` | `<query>` | 当前服务器/频道的搜索界面和已渲染结果 |
| `goto` | `--guild`、`--channel`、`--url`、`--timeout` | 在已有 Discord 窗口中导航 |
| `threads` | `--limit`、`--guild`、`--channel`、`--url` | 已渲染的论坛/帖子卡片 |
| `thread-read` | `--thread`、`--count`、`--guild`、`--channel`、`--url` | 指定帖子的消息 |
| `send` | `<text>` | **写操作：**向当前频道发送消息 |
| `delete` | `<message_id>` | **写操作：**通过 Discord 界面权限删除可见消息 |

```bash
opencli discord-app servers -f table
opencli discord-app channels
opencli discord-app read --count 20
opencli discord-app read --url 'https://discord.com/channels/GUILD_ID/CHANNEL_ID' --count 20
opencli discord-app goto --guild GUILD_ID --channel CHANNEL_ID
opencli discord-app search 'earnings'
opencli discord-app threads --limit 30
opencli discord-app thread-read --thread THREAD_ID --guild GUILD_ID --channel CHANNEL_ID --count 20

# 下列两个命令会修改 Discord 数据；先确认当前频道。
opencli discord-app send 'Hello from OpenCLI'
opencli discord-app delete MESSAGE_ID
```

将大写占位符替换为实际 ID。`--count` 是选项，不是位置参数。
使用 `opencli discord-app <command> --help` 查看准确参数。
支持 OpenCLI 标准 JSON 响应，以及 `-f table/json/yaml/md/csv` 输出格式。

## 兼容性与限制

对照版本为上游提交
[`2413694`](https://github.com/jackwener/OpenCLI/tree/24136945847afbfad266c6c46a8cd335377f9112/clis/discord-app)，
即移除 Electron 自动化的提交
[`f3e221f`](https://github.com/jackwener/OpenCLI/commit/f3e221f151336394452fc15f13922f82779dc404)
之前的版本。其适配器源码与 OpenCLI 1.8.8 发布包一致。仓库中的对照测试覆盖全部
**11 个命令的名称、读写标记、参数结构和输出字段**。

插件使用自己的本机 CDP 连接层，替代已移除的 Electron 启动层，不会自动启动
Discord。保留原有界面操作方式，并做了以下明确修正：

- 消息不再截断为 300 字符，搜索文本不再截断为 200 字符。
- 私信会话标记为 `DirectMessage`，而非 `Text`。
- 未知成员状态标记为 `Unknown`；成员面板为空时返回 `EMPTY_RESULT`。
- 校验消息数量和导航地址。
- 发送前检查已有文字/附件草稿，发送后检查是否出现新的匹配消息。
- 删除按钮限定在目标消息、菜单和对话框内，并检查消息是否移除。
- 写操作结果不确定时会报错，**不会自动重试**。提交后的错误不代表操作没有发生，
  重试前应先查看 Discord。
- 删除命令保留原有 `{status, message}` 输出，表示已确认成功或提交前失败。
  必须检查 `status`；返回 `failed` 不代表删除成功。

提取范围是当前已渲染的 DOM，不包含完整历史记录或自动翻页。附件、富文本格式
和隐藏内容不会完整导出。名称仅从可见侧栏解析，ID 和 URL 更可靠。
在「好友」页面执行 `channels` 会返回私信会话；执行 `members` 前应打开成员面板。
继承的搜索选择器/等待方式，以及四段式帖子 URL 模型，仍需在当前 Discord 版本
和不同界面语言下验证。

命令操作已有窗口；导航或搜索可能改变已读/未读状态。写操作期间不要手动操作
Discord，也不要并发执行其他命令。发送在提交前中止时可能留下草稿。
删除确认文本目前支持英文和简体中文。界面变化可能导致命令失败，尤其不要盲目
重试发送或删除。

## 验证状态

**实验性版本。** 在 macOS、Discord 0.0.421、OpenCLI 2.0.3 上，已验证连接、
服务器列表、私信分类、非法参数、无法连接的端点和空面板错误。
真实频道读取、搜索、帖子操作，以及真实发送/删除仍**未验证**。
开发过程中没有发送或删除真实消息。

自动测试使用合成 DOM 和模拟 CDP，覆盖接口对照、消息提取、目标检查、连接清理、
发送与草稿保护、频道切换、删除控件范围和不确定结果处理。
这些测试不能证明真实界面选择器兼容，也不能保证服务器端投递成功。

## 开发

仓库根目录是一个独立插件，遵循
[OpenCLI 插件目录规范](https://opencli.info/docs/guide/plugins.html)：

```text
opencli-plugin.json        # 插件名称、版本和 OpenCLI 版本范围
package.json              # ESM、宿主依赖和测试工具
*.js                      # 根目录下每个文件对应一个命令
lib/connection.js         # 本机 CDP 连接和命令注册适配
lib/utils.js              # 上游 DOM 提取和路由辅助函数
tests/                    # 合成测试和上游接口对照数据
.github/workflows/test.yml # 测试和插件注册检查
LICENSE / NOTICE          # Apache-2.0 许可证及上游归属
```

```bash
git clone https://github.com/harveyx86/opencli-plugin-discord-app.git
cd opencli-plugin-discord-app
npm ci --ignore-scripts
npm test
```

`npm ci` 使用已提交的锁文件安装开发依赖。应提交 `package-lock.json`，不要提交
`node_modules/`。无需构建步骤。

通过全局安装的 OpenCLI 运行本地源码：

```bash
# 仅在已经安装了另一份 discord-app 时先执行：
# opencli plugin uninstall discord-app
opencli plugin install "$PWD"
opencli adapter check discord-app
opencli discord-app status
```

本地安装创建目录链接，修改会在下一次调用时生效，因此不要移动或删除源码目录。
OpenCLI 安装插件时会省略开发依赖，恢复开发测试前重新运行
`npm ci --ignore-scripts`。从 GitHub 安装的是由 OpenCLI 管理的副本；长期维护请
使用自己的源码检出目录和本地链接。

`package.json` 中设置 `private` 是为了避免意外发布到 npm，不影响通过 GitHub
安装插件。社区分发使用 OpenCLI 插件安装器，而不是 `npm install` 本插件。

实现方式为本机 CDP 上的 DOM/界面提取，登录状态保留在 Discord 页面中，不提取
账号令牌，也不重放私有 HTTP API。Discord 界面变化时，修改相应命令或公共提取
函数，添加合成回归测试，并在获准使用的测试频道验证。
不要提交真实消息、账号数据、浏览器抓包或本机设置。再分发时保留 LICENSE 和
NOTICE。贡献流程见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)，
版本记录见 [CHANGELOG.md](CHANGELOG.md)。

## 更新与卸载

```bash
opencli plugin update discord-app
opencli plugin uninstall discord-app
```

本地开发安装跟随源码目录，使用 Git 管理源码。卸载本地插件只移除链接，
不会删除源码目录。

## 常见问题

| 现象 | 检查方式 |
| --- | --- |
| `Unknown command: discord-app` | 检查 `opencli --version`、`opencli plugin list` 和 `opencli list discord-app`；OpenCLI 2.x 不再内置该适配器。 |
| 插件已安装 | 更新现有 GitHub 安装，或先卸载再切换到本地源码。 |
| 连接被拒绝 | 完全退出 Discord，以调试参数启动，并用 `curl` 检查相同端口。 |
| 没有 Discord 页面或存在多个页面 | 指定 CDP 端口上仅保留一个 Discord 窗口/页面。 |
| 返回空结果 | 打开对应服务器、频道或面板；插件只能看到已渲染的内容。 |
| 发送/删除结果不确定 | 重试前查看 Discord；连接错误不代表操作失败。 |

通过 [GitHub Issues](https://github.com/harveyx86/opencli-plugin-discord-app/issues)
报告可复现问题，附版本号和脱敏错误信息，不要附令牌或私人消息。

## 许可证

[Apache-2.0](LICENSE)。命令实现源自 OpenCLI 贡献者，归属说明见 [NOTICE](NOTICE)。
本插件新增独立连接层、测试和相关修复。
