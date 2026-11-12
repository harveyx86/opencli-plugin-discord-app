# 参与贡献

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

使用 Node 22.4+ 和 OpenCLI 2.x。先运行 `npm ci --ignore-scripts`、`npm test`，
将源码目录安装为本地插件后运行 `opencli adapter check discord-app`。
CI 仅使用合成数据，不需要 Discord 账号或凭据。

根目录只放可发现的命令文件，公共辅助代码放在 `lib/`。
除非明确记录接口变更，否则保持命令名、参数和输出字段与删除前的上游接口一致。
修改对照数据必须说明公开接口变更原因，不能仅为了让失败测试通过。

报告选择器问题时，请包含命令、OpenCLI/Node/Discord 版本、操作系统、界面语言
和脱敏后的错误。不要附私人消息、令牌、原始应用数据，或含会话标识的 CDP URL。
测试中使用合成 DOM。

写操作变更必须测试目标身份、误点击保护、已有草稿和不确定结果。
不能自动重复发送或删除。真实写操作测试需要明确授权的临时测试频道和消息；
合成 CI 测试不能替代真实界面兼容性验证。

发布前同步更新 package.json、opencli-plugin.json 和 CHANGELOG.md，刷新锁文件，
运行测试，检查从 GitHub 干净安装的流程，并注明哪些命令已通过真实客户端验证。
保留 LICENSE/NOTICE 中的 Apache-2.0 归属说明。README 和贡献指南的中英文版本
应同步更新。
