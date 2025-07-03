const mongoose = require("mongoose");

const WithdrawRequestSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: "pending" }, 
    modeOfPayment: { type: String, default: null },

    // Notifications array inside withdrawal request schema
    notifications: [
      {
        message: { type: String, required: true },
        isRead: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawRequest", WithdrawRequestSchema);