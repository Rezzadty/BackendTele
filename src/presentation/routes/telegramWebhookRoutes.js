const express = require("express");

function extractTelegramMessage(update) {
  if (!update || typeof update !== "object") {
    return null;
  }

  return (
    update.message ||
    update.edited_message ||
    update.channel_post ||
    update.edited_channel_post ||
    null
  );
}

function isStatusCommand(text) {
  const normalized = String(text || "").trim().toLowerCase();

  return normalized === "/status" || normalized.startsWith("/status@");
}

function isInfoCommand(text) {
  const normalized = String(text || "").trim().toLowerCase();

  return normalized === "/info" || normalized.startsWith("/info@");
}

function buildStatusErrorMessage(error) {
  const detail = error?.message ? String(error.message).trim() : "";

  return detail
    ? `Status unavailable. ${detail}`
    : "Status unavailable.";
}

function createTelegramWebhookRoutes({ firebasePollingWorker, sendTelegramNotification }) {
  const router = express.Router();

  router.post("/webhook", async (req, res, next) => {
    try {
      const message = extractTelegramMessage(req.body);

      if (!message || (!isStatusCommand(message.text) && !isInfoCommand(message.text))) {
        return res.json({
          ok: true,
          ignored: true,
        });
      }

      const chatId = message.chat?.id;

      if (!chatId) {
        return res.status(400).json({
          ok: false,
          message: "Missing chat id",
        });
      }

      if (isInfoCommand(message.text)) {
        const result = await sendTelegramNotification.execute({
          text: firebasePollingWorker.buildInfoMessage(),
          telegramChatId: chatId,
        });

        return res.json({
          ok: result.telegram.success,
          result,
        });
      }

      try {
        const sensorData = await firebasePollingWorker.fetchSensorData();
        const statusText = firebasePollingWorker.buildStatusMessage(sensorData);

        const result = await sendTelegramNotification.execute({
          text: statusText,
          telegramChatId: chatId,
        });

        return res.json({
          ok: result.telegram.success,
          result,
        });
      } catch (error) {
        const result = await sendTelegramNotification.execute({
          text: buildStatusErrorMessage(error),
          telegramChatId: chatId,
        });

        return res.status(200).json({
          ok: false,
          result,
        });
      }
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createTelegramWebhookRoutes,
};
