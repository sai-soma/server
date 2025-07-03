const ReferralStatus = require("../models/ReferralStatus");

// ✅ Create or Update Referral Status
exports.upsertReferralStatus = async (req, res) => {
  try {
    const { userId, inProgress, rejected, hired } = req.body;

    const updatedStatus = await ReferralStatus.findOneAndUpdate(
      { userId }, // Find by userId
      { inProgress, rejected, hired }, // Update fields
      { new: true, upsert: true } // Create if not exists
    );

    res.status(200).json({ message: "Referral status updated", updatedStatus });
  } catch (error) {
    console.error("Error updating referral status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Get Referral Status by userId
exports.getReferralStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const status = await ReferralStatus.findOne({ userId });

    if (!status) {
      return res.status(404).json({ message: "Referral status not found" });
    }

    res.status(200).json(status);
  } catch (error) {
    console.error("Error fetching referral status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Increment Referral Status Counts
exports.incrementReferralStatus = async (req, res) => {
  try {
    const { userId, type } = req.body; // type: "inProgress" | "rejected" | "hired"

    if (!["inProgress", "rejected", "hired"].includes(type)) {
      return res.status(400).json({ message: "Invalid status type" });
    }

    const updatedStatus = await ReferralStatus.findOneAndUpdate(
      { userId },
      { $inc: { [type]: 1 } }, // Increment dynamically
      { new: true, upsert: true }
    );

    res.status(200).json({ message: `${type} count incremented`, updatedStatus });
  } catch (error) {
    console.error("Error updating referral count:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Reset Referral Status
exports.resetReferralStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const updatedStatus = await ReferralStatus.findOneAndUpdate(
      { userId },
      { inProgress: 0, rejected: 0, hired: 0 },
      { new: true }
    );

    res.status(200).json({ message: "Referral status reset", updatedStatus });
  } catch (error) {
    console.error("Error resetting referral status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};