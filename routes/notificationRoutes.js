const express = require("express");
const router = express.Router();
const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getGlobalNotifications,
  deleteNotification,
} = require("../controllers/notificationController");

// Create a new notification
router.post("/notifications/create", createNotification);

// Get all notifications
router.get("/notifications", getNotifications);

// Mark a notification as read
router.put("/notifications/:id/read", markAsRead);

// Mark all notifications as read
router.put("/notifications/read-all", markAllAsRead);

// Delete a notification
router.delete("/notifications/:id", deleteNotification);

// Get global notifications
router.get("/notifications/global", getGlobalNotifications);


module.exports = router;
