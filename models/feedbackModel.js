const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  feedback: { type: String, required: true },
  priority: { type: String, enum: ["High", "Medium", "Low"], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Feedback", feedbackSchema);