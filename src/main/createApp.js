const express = require("express");
const {
  createNotificationRoutes,
} = require("../presentation/routes/notificationRoutes");
const {
  createTelegramWebhookRoutes,
} = require("../presentation/routes/telegramWebhookRoutes");

function createApp({ sendTelegramNotification, firebasePollingWorker }) {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "Testing endpoint for backend-tele",
      time: new Date().toISOString(),
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "backend-tele",
      time: new Date().toISOString(),
    });
  });

  app.use(
    "/api/notifications",
    createNotificationRoutes({ sendTelegramNotification })
  );

  app.use(
    "/api/telegram",
    createTelegramWebhookRoutes({
      firebasePollingWorker,
      sendTelegramNotification,
    })
  );

  app.use((error, _req, res, _next) => {
    const statusCode = error.statusCode || error.status || 500;

    console.error("Unhandled error:", error);

    res.status(statusCode).json({
      ok: false,
      message:
        statusCode >= 500
          ? "Internal server error"
          : error.message || "Request failed",
    });
  });

  return app;
}

module.exports = {
  createApp,
};
