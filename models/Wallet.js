const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  pendingRewards: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  withdrawAmount: { type: Number, default: 0 }, // ✅ totalEarnings replaces totalRewards
}, { timestamps: true });

module.exports = mongoose.model("Wallet", walletSchema);