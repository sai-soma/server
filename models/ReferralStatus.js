const mongoose = require("mongoose");

const referralStatusSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Unique per user
  inProgress: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 },
  hired: { type: Number, default: 0 },
}, { timestamps: true });

const ReferralStatus = mongoose.model("ReferralStatus", referralStatusSchema);
module.exports = ReferralStatus;