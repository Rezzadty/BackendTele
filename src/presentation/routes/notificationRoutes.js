const express = require("express");

function validateSendPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Body request is required";
  }

  if (!payload.title || typeof payload.title !== "string") {
    return "title is required and must be string";
  }

  if (!payload.body || typeof payload.body !== "string") {
    return "body is required and must be string";
  }

  return null;
}

function createNotificationRoutes({ sendTelegramNotification }) {
  const router = express.Router();

  router.post("/send", async (req, res, next) => {
    try {
      const validationError = validateSendPayload(req.body);

      if (validationError) {
        return res.status(400).json({
          ok: false,
          message: validationError,
        });
      }

      const result = await sendTelegramNotification.execute(req.body);
      const statusCode = result.telegram.success ? 200 : 500;

      return res.status(statusCode).json({
        ok: result.telegram.success,
        result,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createNotificationRoutes,
};
