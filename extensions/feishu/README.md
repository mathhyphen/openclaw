# Feishu (Lark) Channel Plugin

此插件将 **飞书 (Feishu/Lark)** 集成到 OpenClaw 中，使您能够通过飞书机器人与 AI 助手进行对话。

## 🛠 安装步骤

由于 OpenClaw 支持多种运行模式，您可以选择以下任一方式安装：

### 方式 A：通过 OpenClaw 命令行安装 (推荐用于生产)
在终端中运行以下命令，将插件安装到全局配置目录：

```bash
openclaw plugins install ./extensions/feishu
```

### 方式 B：本地开发模式 (推荐用于调试)
如果您在 OpenClaw 源码目录下开发，插件会自动从 `extensions/` 目录加载。只需运行：

```bash
node openclaw.mjs gateway
```

---

## ⚙ 配置文件说明

编辑您的 OpenClaw 配置文件（通常位于 `~/.openclaw/openclaw.json`），添加以下内容：

### 1. 频道配置 (`channels`)
在 `channels` 对象下添加 `feishu` 字段：

```json
"channels": {
  "feishu": {
    "enabled": true,
    "appId": "cli_xxxxxxxx",          // 飞书应用的 App ID
    "appSecret": "xxxxxxxx",          // 飞书应用的 App Secret
    "encryptKey": "xxxxxxxx",         // 飞书事件订阅的 Encrypt Key (如未开启可省略)
    "verificationToken": "xxxxxxx",   // 飞书事件订阅的 Verification Token
    "webhookPath": "/feishu/events",  // 必须与代码中注册的路径一致
    "dmPolicy": "open"                // 消息策略：open (任何人), pairing (需配对)
  }
}
```

### 2. 插件启用 (`plugins`)
确保在插件列表中启用了 `feishu`：

```json
"plugins": {
  "enabled": true,
  "entries": {
    "feishu": {
      "enabled": true
    }
  }
}
```

---

## 🚀 飞书后台设置指南

1.  **创建应用**：在 [飞书开放平台](https://open.feishu.cn/app) 创建一个“企业自建应用”。
2.  **开启机器人**：在“应用功能”中开启“机器人”功能。
3.  **配置权限**：在“权限管理”中勾选以下权限：
    *   `im:message` (读取消息)
    *   `im:message.p2p_msg:readonly` (读取用户发给机器人的单聊消息)
    *   `im:message:send_as_bot` (以机器人身份发送消息)
4.  **设置 Webhook**：在“事件订阅”中：
    *   **请求地址**：填写 `http://您的公网IP:18789/feishu/events` (或使用 Tailscale Funnel 提供的 HTTPS 地址)。
    *   **添加事件**：添加“接收消息 V1.0” (`im.message.receive_v1`)。
5.  **发布应用**：修改权限或事件后，必须在“版本管理与发布”中创建一个新版本并发布，设置才会生效。

---

## 📝 使用说明

*   **私聊**：直接向机器人发送消息，它会调用 OpenClaw 配置的主模型进行回复。
*   **群聊**：将机器人拉入群聊，@机器人 即可触发对话。

## 🔍 故障排查

*   **收到消息不回复**：检查飞书后台是否开启了 `im:message:send_as_bot` 权限，并确保已发布版本。
*   **Webhook 验证失败**：确保 `webhookPath` 在配置和飞书后台完全一致（默认为 `/feishu/events`）。
*   **日志调试**：查看 OpenClaw Gateway 的控制台输出，寻找以 `[Feishu]` 开头的日志信息。