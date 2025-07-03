const Notification = require("../models/Notification");

// Create a new notification
exports.createNotification = async (req, res) => {
  try {
    const { message, type, jobId, userId, isGlobal = true } = req.body;

    if (!message || !type) {
      return res.status(400).json({ message: "Message and type are required!" });
    }

    const newNotification = new Notification({
      message,
      type,
      jobId,
      userId,
      isGlobal,
    });

    await newNotification.save();
    res.status(201).json({ message: "Notification created successfully", notification: newNotification });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
// Get all global notifications
exports.getGlobalNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ isGlobal: true })
      .sort({ createdAt: -1 }) // Most recent first
      .limit(20); // Limit to 20 notifications

    res.status(200).json({ message: "Global notifications fetched successfully", notifications });
  } catch (error) {
    console.error("Error fetching global notifications:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// Get all notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.query.userId;
    let query = {};

    // If userId is provided, get user-specific notifications plus global ones
    if (userId) {
      query = { $or: [{ userId }, { isGlobal: true }] };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .limit(20); // Limit to 20 notifications

    res.status(200).json({ message: "Notifications fetched successfully", notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ message: "Notification marked as read", notification: updatedNotification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.query.userId;
    let query = {};

    // If userId is provided, only mark user-specific notifications as read
    if (userId) {
      query = { $or: [{ userId }, { isGlobal: true }] };
    }

    await Notification.updateMany(query, { isRead: true });

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedNotification = await Notification.findByIdAndDelete(id);

    if (!deletedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
