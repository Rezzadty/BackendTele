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

function createNotificationRoutes({ sendNotificationWithBackup }) {
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

      const result = await sendNotificationWithBackup.execute(req.body);

      let statusCode = 200;
      if (!result.expo.success && result.telegram.success) {
        statusCode = 202;
      }

      if (!result.expo.success && !result.telegram.success) {
        statusCode = 500;
      }

      return res.status(statusCode).json({
        ok: statusCode < 500,
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
