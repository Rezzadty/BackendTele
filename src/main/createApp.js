const express = require("express");
const {
  createNotificationRoutes,
} = require("../presentation/routes/notificationRoutes");

function createApp({ sendNotificationWithBackup }) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "backend-tele",
      time: new Date().toISOString(),
    });
  });

  app.use(
    "/api/notifications",
    createNotificationRoutes({ sendNotificationWithBackup })
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
