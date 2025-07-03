const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    type: { type: String, required: true }, // job_post, application_status, etc.
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    userId: { type: String }, // Optional: specific user this notification is for
    isGlobal: { type: Boolean, default: true }, // If true, show to all users
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);