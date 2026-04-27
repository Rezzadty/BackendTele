function stringifyData(data) {
  if (data === undefined || data === null) {
    return "";
  }

  try {
    return JSON.stringify(data);
  } catch (_error) {
    return "";
  }
}

function normalizeCustomText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function buildTelegramNotificationText({ title, body, eventType, userId, data }) {
  const lines = [
    `[Notification] ${eventType || "general"}`,
    userId ? `userId: ${userId}` : null,
    `title: ${title}`,
    `message: ${body}`,
  ];

  const serializedData = stringifyData(data);
  if (serializedData) {
    lines.push("", `data: ${serializedData}`);
  }

  return lines.filter(Boolean).join("\n");
}

class SendTelegramNotificationUseCase {
  constructor({ telegramService }) {
    this.telegramService = telegramService;
  }

  async execute(payload) {
    const { title, body, telegramChatId, eventType, userId, data, text } = payload;

    const customText = normalizeCustomText(text);
    const messageText =
      customText ||
      buildTelegramNotificationText({
        title,
        body,
        eventType,
        userId,
        data,
      });

    const telegramResult = await this.telegramService.sendMessage({
      chatId: telegramChatId,
      text: messageText,
    });

    return {
      telegram: telegramResult,
    };
  }
}

module.exports = {
  SendTelegramNotificationUseCase,
};
