const express = require("express");
const { 
  getWallet, 
  addToWallet, 
  claimRewards, 
  updatePendingRewards, 
  deductReferralAmount, 
  getRewardHistory, 
  getAllUsersRewardHistory, 
  withdrawFunds, 
  approveWithdrawRequest, 
  getWithdrawStatus 
} = require("../controllers/walletController");
const router = express.Router();

// IMPORTANT: Put specific routes BEFORE parameterized routes
router.get("/all-rewards-history", getAllUsersRewardHistory); // Move this BEFORE /:userId
router.get("/reward-history/:userId", getRewardHistory);
router.get("/withdraw-status/:userId", getWithdrawStatus);

// Parameterized route should come after specific routes
router.get("/:userId", getWallet);

// Other routes
router.post("/add", addToWallet);
router.post("/claim-rewards", claimRewards);
router.post("/updatePending", updatePendingRewards);
router.post("/withdraw", withdrawFunds);
router.post("/approve-withdraw", approveWithdrawRequest);
router.put("/deduct", deductReferralAmount);

module.exports = router;