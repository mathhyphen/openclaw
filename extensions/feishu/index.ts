import type { MoltbotPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import crypto from "node:crypto";

class FeishuCipher {
  encryptKey: string;
  constructor(encryptKey: string) {
    this.encryptKey = encryptKey;
  }
  decrypt(encrypted: string) {
    const key = crypto.createHash("sha256").update(this.encryptKey).digest();
    const encryptedBuffer = Buffer.from(encrypted, "base64");
    const iv = encryptedBuffer.subarray(0, 16);
    const content = encryptedBuffer.subarray(16);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(content);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const pad = decrypted[decrypted.length - 1];
    if (pad < 1 || pad > 32) {
      return decrypted.toString("utf8");
    }
    return decrypted.subarray(0, decrypted.length - pad).toString("utf8");
  }
}

async function getFeishuAccessToken(appId: string, appSecret: string) {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  if (!response.ok) throw new Error(`Feishu token error: ${response.status}`);
  const data = await response.json() as any;
  return data.tenant_access_token;
}

async function sendMessageFeishu(chatId: string, text: string, appId: string, appSecret: string) {
  const accessToken = await getFeishuAccessToken(appId, appSecret);
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      receive_id: chatId,
      content: JSON.stringify({ text }),
      msg_type: "text",
    }),
  });
  return await response.json();
}

export default {
  id: "feishu",
  name: "Feishu Channel",
  description: "Feishu/Lark messaging integration",
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    api.registerHttpRoute({
      path: "/feishu/events",
      handler: async (req, res) => {
        const config = api.runtime.config.loadConfig();
        const feishuConfig = config.channels?.feishu;
        if (!feishuConfig) {
          res.writeHead(404);
          res.end("Feishu not configured");
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            let body = JSON.parse(raw);

            if (body.challenge) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ challenge: body.challenge }));
              return;
            }

            if (body.encrypt && feishuConfig.encryptKey) {
              const cipher = new FeishuCipher(feishuConfig.encryptKey);
              body = JSON.parse(cipher.decrypt(body.encrypt));
            }

            const event = body.event || {};
            const message = event.message;
            const sender = event.sender;

            if (message && sender && (body.header?.event_type === "im.message.receive_v1" || body.event?.type === "im.message.receive_v1")) {
              const senderId = sender.sender_id.user_id || sender.sender_id.open_id;
              const text = JSON.parse(message.content).text || "";
              const chatId = message.chat_id;

              const ctxPayload = {
                From: senderId,
                To: chatId,
                Body: text,
                BodyForAgent: text,
                RawBody: text,
                CommandBody: text,
                BodyForCommands: text,
                SessionKey: `feishu:${chatId}`,
                MessageSid: message.message_id,
                MessageSidFull: message.message_id,
                ChatType: message.chat_type === "p2p" ? "direct" : "group",
                Provider: "feishu",
                Surface: "feishu",
                OriginatingChannel: "feishu",
                OriginatingTo: chatId,
                AccountId: "default",
                SenderId: senderId,
                BodyStripped: text,
                IsCommand: false,
                CommandSource: "native",
                CommandTargetSessionKey: `feishu:${chatId}`,
              };

              await api.runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                ctx: ctxPayload as any,
                cfg: config,
                dispatcherOptions: {
                  responsePrefix: api.runtime.channel.reply.resolveEffectiveMessagesConfig(config, "default").responsePrefix,
                  deliver: async (payload: any) => {
                    if (payload.text && feishuConfig.appId && feishuConfig.appSecret) {
                      await sendMessageFeishu(chatId, payload.text, feishuConfig.appId, feishuConfig.appSecret);
                    }
                  },
                  onError: (err: any) => console.error("[Feishu] Reply error:", err),
                },
              });
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            console.error("[Feishu] Error:", err);
            res.writeHead(500);
            res.end(err.message);
          }
        });
      },
    });
  },
};
