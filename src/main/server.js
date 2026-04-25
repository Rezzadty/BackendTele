const { env, getRuntimeWarnings } = require("../shared/config/env");
const { ExpoPushService } = require("../infrastructure/expo/expoPushService");
const { TelegramService } = require("../infrastructure/telegram/telegramService");
const {
  SendNotificationWithBackupUseCase,
} = require("../application/usecases/sendNotificationWithBackup");
const { createApp } = require("./createApp");
const {
  FirebasePollingWorker,
} = require("../presentation/workers/firebasePollingWorker");

function bootstrap() {
  const expoService = new ExpoPushService({
    expoPushUrl: env.EXPO_PUSH_URL,
  });

  const telegramService = new TelegramService({
    botToken: env.TELEGRAM_BOT_TOKEN,
    defaultChatId: env.TELEGRAM_DEFAULT_CHAT_ID,
  });

  const sendNotificationWithBackup = new SendNotificationWithBackupUseCase({
    expoService,
    telegramService,
    telegramBackupMode: env.TELEGRAM_BACKUP_MODE,
  });

  const firebasePollingWorker = new FirebasePollingWorker({
    env,
    sendNotificationWithBackup,
  });

  const app = createApp({ sendNotificationWithBackup });

  getRuntimeWarnings().forEach((warning) => {
    console.warn(`[config-warning] ${warning}`);
  });

  app.listen(env.PORT, () => {
    console.log(`[server] backend-tele listening at http://localhost:${env.PORT}`);
  });

  firebasePollingWorker.start();
}

module.exports = {
  bootstrap,
};
