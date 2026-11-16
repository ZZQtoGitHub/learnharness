<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lh_banner_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/lh_banner_light.png">
    <img src="docs/assets/lh_banner_light.png" alt="LearnHarness" width="640">
  </picture>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center"><strong>面向学习的 Agent 运行框架。</strong></p>

<p align="center">
  <a href="https://learnharness.ai">下载</a> ·
  <a href="#工作原理">工作原理</a> ·
  <a href="docs/README.md">文档</a> ·
  <a href="https://github.com/amosblomqvist/learnharness/issues">问题反馈</a> ·
  <a href="https://discord.gg/5tCHHQEB2e">Discord</a>
</p>

LearnHarness 用 AI Agent 规划并教授课程，从你当前的理解一路带到你的目标。它为「你理解了什么、你如何推理」建立一幅细致的画像，并随着你的学习不断更新。

它不只是给你一段解释，而是用你的回答和思考来判断你下一步需要什么。教学一次只推进一个推理步骤，把理解搭起来；练习让它变得可用。一张持久化的知识图谱让这一切跨会话延续。

![LearnHarness 教学会话](docs/assets/teaching-session.png)

## 工作原理

1. **测量。** 教学开始前，Agent 会先找出：在本节课依赖的每一个环节上，你的理解到哪里为止。你的回答、信心程度和思考过程，告诉它该从哪里切入。
2. **规划。** 它从起点到目标画出一张依赖图。你可以看到这份计划；当实际理解与预期不符时，课程会随之调整。
3. **教学。** 每一步都建立在你已经理解的东西上。你先做预测，再听解释，然后检验自己的理解。迷惑要在往上堆任何东西之前先被修补。目标是让终点显得理所当然，而不只是眼熟。
4. **练习。** 独立会话给出各式各样的问题，需要你在题目没点名的情况下就想到该用的知识。题目和提示会随你的推理方式调整。

**把思路说出来。** 思考输入框让你用自己的话讲清推理、不确定和反应。Agent 正是靠这个建立细致画像，而不只是记录对错。你可以打字，也可以用语音输入。

**把文件带进来。** 桌面端可以用回形针附加 PDF、照片或任何文件，也可以直接拖进来。文件留在原处：消息里携带它的路径，Agent 从那里读取。

Agent 还能在后台查证问题、生成可视化解释、在课程中展示你自己的图片并用箭头和标注圈点，以及搭建可交互的演示。

## 会延续下去的知识

你被教过的内容以命题和推理链的形式累积：单条论断，以及通向它的前提。图谱呈现这一结构，并链接回来源会话。你也可以导入笔记。

后续教学会话可以读取图谱，而不必从零开始；练习会话也可以从中取材。它存的是想法及其关联，而不是对你能力的评分。

![LearnHarness 知识图谱](docs/assets/knowledge-graph.png)

## 下载与上手

**[从 learnharness.ai 下载](https://learnharness.ai)** · [GitHub Releases](https://github.com/amosblomqvist/learnharness/releases)

- **macOS（Apple Silicon）：** 已签名并公证的 DMG。把应用拖进「应用程序」。
- **Windows（x64）：** 运行安装程序。目前尚未签名，Windows 可能提示「未知发布者」或弹出 SmartScreen 警告。
- **Linux（x64）：** 给 AppImage 加上可执行权限后打开，或安装 Debian/Ubuntu 的 `.deb`。

选好模型，然后带着你想搞懂的东西开始一次会话。你可以使用各服务商的 API key、桌面端支持的订阅连接、已安装的 [Claude Code CLI](docs/claude-code.md)，或[自定义的 OpenAI 兼容端点](docs/custom-providers.md)（包括本地模型服务器）。可选的语音输入和网页搜索使用单独的服务 key。网页研究可以在 设置 → 服务商 → 搜索 中使用 Tavily、Brave、Exa、Firecrawl 或 Ollama 的 key。Ollama 搜索走它的托管服务，而不是本地模型服务器。

模型设置、语音输入、文件与笔记导入见[快速上手](docs/getting-started.md)；高级缓存偏好见[上下文、缓存与成本](docs/compaction-accounting.md)。

三个平台都支持应用内更新。

## 你的 key，你的数据

- **你的 key 与模型。** 没有 LearnHarness 订阅，也没有加价。花多少取决于你的服务商、CLI 配置、订阅或本地部署。实时费用表只估算已知的 API 成本，不含订阅、CLI 或自定义端点的花销。
- **本地存储。** 你的对话、图谱、设置和 API key 都在你自己的机器上。学习记录是纯文件，你可以自己查看。
- **外部服务。** 模型通过你配置的服务商运行。模型请求会发送完成任务所需的上下文；网页研究和语音输入也会访问外部服务。本地存储不等于离线处理。
- **行为可查。** 系统提示词可见且可编辑。应用以 AGPL-3.0 协议开源。

## 开发与支持

```bash
npm ci
npm run plugins:setup
npm run dev        # http://localhost:3000
npm test           # fixtures 与假服务商
```

全部指南见[文档索引](docs/README.md)，环境搭建与检查见[开发](docs/development.md)，运行时见[架构](docs/architecture.md)，另见[键盘快捷键](docs/keyboard.md)、[主题](docs/themes.md)（主题文件格式）与[桌面端构建与发布](docs/desktop-release.md)。

如需可信的本地插件，请从[编写指南与能力地图](docs/plugin-authoring.md)开始，它串联了提问、练习题目、提交、视图上下文和 UI 契约。[`examples/plugins/`](examples/plugins/) 是小巧可运行的模板，[`plugins/`](plugins/) 是功能源码工程，内部细节见[宿主架构](docs/plugin-architecture.md)。

问题、bug 报告与功能请求：[GitHub Issues](https://github.com/amosblomqvist/learnharness/issues)。

安全漏洞：请按 [SECURITY.md](SECURITY.md) 所述私下报告，不要发在公开 issue 里。

## 许可证

[AGPL-3.0](LICENSE)

应用永久免费且开源。如果将来我们收取任何费用，那也只为便利——托管 key、托管服务——绝不为你能在本地运行的功能收费。
