const { safeJson } = require("../../shared/utils/http");

class TelegramService {
  constructor({ botToken, defaultChatId }) {
    this.botToken = botToken;
    this.defaultChatId = defaultChatId;
  }

  async sendMessage({ chatId, text }) {
    const finalChatId = chatId || this.defaultChatId;

    if (!this.botToken) {
      return {
        success: false,
        skipped: true,
        reason: "Missing TELEGRAM_BOT_TOKEN",
      };
    }

    if (!finalChatId) {
      return {
        success: false,
        skipped: true,
        reason: "Missing Telegram chat id",
      };
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: finalChatId,
        text,
      }),
    });

    const payload = await safeJson(response);
    const success = response.ok && payload?.ok === true;

    return {
      success,
      skipped: false,
      statusCode: response.status,
      messageId: payload?.result?.message_id || null,
      error:
        success
          ? null
          : payload?.description ||
            `Telegram sendMessage failed with status ${response.status}`,
      raw: payload,
    };
  }
}

module.exports = {
  TelegramService,
};
