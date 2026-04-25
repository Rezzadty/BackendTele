function buildTelegramBackupText({ title, body, eventType, userId, expoResult }) {
  const lines = [
    "[Backup Notification]",
    `eventType: ${eventType || "general"}`,
    userId ? `userId: ${userId}` : null,
    `title: ${title}`,
    `message: ${body}`,
    "",
    "expo result:",
    expoResult.success ? "status: success" : "status: failed",
    expoResult.error ? `error: ${expoResult.error}` : null,
  ];

  return lines.filter(Boolean).join("\n");
}

class SendNotificationWithBackupUseCase {
  constructor({ expoService, telegramService, telegramBackupMode }) {
    this.expoService = expoService;
    this.telegramService = telegramService;
    this.telegramBackupMode = telegramBackupMode || "on-failure";
  }

  shouldSendTelegramBackup({ expoResult, forceTelegramBackup }) {
    if (forceTelegramBackup) {
      return true;
    }

    if (this.telegramBackupMode === "off") {
      return false;
    }

    if (this.telegramBackupMode === "always") {
      return true;
    }

    return !expoResult.success;
  }

  async execute(payload) {
    const {
      title,
      body,
      data,
      expoPushToken,
      telegramChatId,
      forceTelegramBackup,
      eventType,
      userId,
    } = payload;

    const expoResult = await this.expoService.sendNotification({
      expoPushToken,
      title,
      body,
      data,
    });

    const shouldSendTelegram = this.shouldSendTelegramBackup({
      expoResult,
      forceTelegramBackup,
    });

    let telegramResult = {
      success: false,
      skipped: true,
      reason: "Backup rule did not trigger",
    };

    if (shouldSendTelegram) {
      const text = buildTelegramBackupText({
        title,
        body,
        eventType,
        userId,
        expoResult,
      });

      telegramResult = await this.telegramService.sendMessage({
        chatId: telegramChatId,
        text,
      });
    }

    return {
      backupMode: this.telegramBackupMode,
      expo: expoResult,
      telegram: telegramResult,
    };
  }
}

module.exports = {
  SendNotificationWithBackupUseCase,
};
