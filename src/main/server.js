const { env, getRuntimeWarnings } = require("../shared/config/env");
const { TelegramService } = require("../infrastructure/telegram/telegramService");
const {
  SendTelegramNotificationUseCase,
} = require("../application/usecases/sendNotificationWithBackup");
const { createApp } = require("./createApp");
const {
  FirebasePollingWorker,
} = require("../presentation/workers/firebasePollingWorker");

function bootstrap() {
  const telegramService = new TelegramService({
    botToken: env.TELEGRAM_BOT_TOKEN,
    defaultChatId: env.TELEGRAM_DEFAULT_CHAT_ID,
  });

  const sendTelegramNotification = new SendTelegramNotificationUseCase({
    telegramService,
  });

  const firebasePollingWorker = new FirebasePollingWorker({
    env,
    sendTelegramNotification,
  });

  const app = createApp({ sendTelegramNotification });

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
