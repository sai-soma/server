const express = require("express");
const {
  upsertReferralStatus,
  getReferralStatus,
  incrementReferralStatus,
  resetReferralStatus
} = require("../controllers/referralStatusController");

const router = express.Router();

// ✅ Get Referral Status for a User
router.get("/:userId", getReferralStatus);

// ✅ Create or Update Referral Status
router.post("/update", upsertReferralStatus);

// ✅ Increment a Referral Count (inProgress, rejected, hired)
router.put("/increment", incrementReferralStatus);

// ✅ Reset Referral Counts to Zero
router.put("/reset/:userId", resetReferralStatus);

module.exports = router;
