const Wallet = require("../models/Wallet");
const Application = require("../models/Application");
const Job = require("../models/jobModel");
const Reward = require("../models/rewards");
const WithdrawRequest = require("../models/WithdrawRequest");
const User = require("../models/User");
// ✅ Get Wallet by userId
exports.getWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      // Auto-create a new wallet if not found
      wallet = await Wallet.create({ userId, pendingRewards: 0, totalEarnings: 0 });
    }
    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Update balance in the wallet collection
    wallet.balance = wallet.totalEarnings;
    await wallet.save();

    // ✅ Update walletBalance in the users collection
    user.walletBalance = wallet.balance;
    await user.save();

    res.json({ success: true, wallet });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ✅ Add Referral Reward to Wallet
exports.addToWallet = async (req, res) => {
  try {
    //console.log("📢 Received request from:", req.headers.origin);
    //console.log("🔹 Full request body:", req.body);

    const { userId, applicationId } = req.body;

    if (!userId || !applicationId) {
      //console.log("❌ Missing input:", { userId, applicationId });
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      //console.log("❌ Application not found for ID:", applicationId);
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const job = await Job.findById(application.jobId);
    if (!job || !job.referralAmount || job.referralAmount <= 0) {
      //console.log("❌ Invalid job referral amount:", job);
      return res.status(400).json({ success: false, message: "Invalid referral amount" });
    }

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      //console.log("🛠 Creating new wallet for user:", userId);
      wallet = await Wallet.create({ userId, pendingRewards: 0, totalEarnings: 0 });
    }

    wallet.pendingRewards += job.referralAmount;
    await wallet.save();

    // ✅ Save reward entry to database
    const newReward = new Reward({
      userId,
      candidateName: application.name || "Unknown", // 🔹 FIX: Using application.name
      jobId: job._id,
      amount: job.referralAmount,
      date: new Date(),
    });

    const savedReward = await newReward.save();
    //console.log("✅ Reward successfully saved:", savedReward);

    res.json({
      success: true,
      message: "Referral amount added",
      wallet: {
        totalEarnings: wallet.totalEarnings,
        pendingRewards: wallet.pendingRewards,
      },
    });
  } catch (error) {
    console.error("❌ Error adding to wallet:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Move Pending Rewards to Total Earnings
exports.claimRewards = async (req, res) => {
  try {
    const { userId } = req.body;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    if (wallet.pendingRewards > 0) {
      wallet.totalEarnings += wallet.pendingRewards; // ✅ Move pending to totalEarnings
      wallet.pendingRewards = 0; // ✅ Reset pending rewards
      await wallet.save(); // ✅ Save changes to DB
    }
    const updatedUser = await User.findOneAndUpdate({ userId }, { $set: { walletBalance: wallet.totalEarnings } }, { new: true });

    //console.log("✅ Updated User Wallet Balance:", updatedUser.walletBalance);

    res.json({
      success: true,
      message: "Rewards claimed successfully",
      wallet,
    });
  } catch (error) {
    console.error("❌ Error claiming rewards:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Auto-Transfer Pending Rewards to Total Earnings After 6 Sec
exports.updatePendingRewards = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    wallet.pendingRewards += amount;
    await wallet.save();

    setTimeout(async () => {
      let updatedWallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { totalEarnings: wallet.pendingRewards },
          $set: { pendingRewards: 0, updatedAt: new Date() },
        },
        { new: true }
      );

      //console.log("✅ Pending rewards moved to total earnings:", updatedWallet);
    }, 6000);

    res.json({
      success: true,
      message: `₹${amount} added to pending rewards. It will be moved to total earnings in 6 seconds.`,
      wallet: {
        pendingRewards: wallet.pendingRewards,
        totalEarnings: wallet.totalEarnings,
      },
    });
  } catch (error) {
    console.error("❌ Error updating rewards:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Deduct Referral Amount
exports.deductReferralAmount = async (req, res) => {
  try {
    const { userId, applicationId } = req.body;

    if (!userId || !applicationId) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    // Fetch the application to get the job ID
    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    // Fetch the job to get the referral amount
    const job = await Job.findById(application.jobId);
    if (!job || !job.referralAmount || job.referralAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid referral amount" });
    }

    // Fetch the user's wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    const referralAmount = job.referralAmount; // Get referral amount from job
    //console.log("Deducting referral amount:", referralAmount);

    if (wallet.pendingRewards >= referralAmount) {
      wallet.pendingRewards -= referralAmount;
      await wallet.save();

      // ✅ Save deduction entry to Reward schema
      const newReward = new Reward({
        userId,
        candidateName: application.name || "Unknown",
        jobId: job._id,
        amount: -referralAmount, // Negative amount to indicate deduction
        date: new Date(),
        type: "deduction", // Optional: add a type to distinguish deductions
        applicationId: applicationId,
      });

      const savedReward = await newReward.save();
      //console.log("✅ Deduction reward entry saved:", savedReward);

      res.json({
        success: true,
        message: "Referral amount deducted successfully",
        wallet,
        deduction: savedReward,
      });
    } else {
      res.status(400).json({ success: false, message: "Insufficient referral amount in pending rewards" });
    }
  } catch (error) {
    console.error("❌ Error in deducting referral amount:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRewardHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    //console.log("Fetching reward history for user:", userId); // Log to see userId being passed

    const rewardHistory = await Reward.find({ userId })
      .populate({
        path: "jobId",
        model: "Job", // Explicitly specifying the model
        select: "jobTitle", // Selecting jobTitle from Job schema
      })
      .select("candidateName jobId amount createdAt userId"); // Select relevant fields

    //console.log("Fetched reward history:", rewardHistory); // Log the fetched data

    if (!rewardHistory || rewardHistory.length === 0) {
      return res.json({ success: true, rewardHistory: [] });
    }

    res.json({
      success: true,
      rewardHistory: rewardHistory.map((reward) => ({
        referName: reward.candidateName || "Unknown", // Set a default value if no candidate name
        jobTitle: reward.jobId && reward.jobId.jobTitle ? reward.jobId.jobTitle : "Unknown Job", // Ensure jobTitle is retrieved from Job schema
        amount: reward.amount,
        date: reward.createdAt,
        userId: reward.userId,
      })),
    });
  } catch (error) {
    console.error("❌ Error fetching reward history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllUsersRewardHistory = async (req, res) => {
  try {
    console.log("Fetching reward history for all users");

    const allRewards = await Reward.find({})
      .populate({
        path: "jobId",
        model: "Job",
        select: "jobTitle",
      })
      .select("candidateName jobId amount createdAt userId")
      .sort({ createdAt: -1 });

    console.log("Fetched all rewards count:", allRewards.length);

    if (!allRewards || allRewards.length === 0) {
      return res.json({ success: true, data: [], allRewards: [] });
    }

    // Group rewards by userId
    const groupedByUser = allRewards.reduce((acc, reward) => {
      const userId = reward.userId;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push({
        _id: reward._id,
        referName: reward.candidateName || "Unknown",
        jobTitle: reward.jobId && reward.jobId.jobTitle ? reward.jobId.jobTitle : "Unknown Job",
        amount: reward.amount,
        date: reward.createdAt,
        userId: reward.userId,
      });
      return acc;
    }, {});

    // Convert grouped data to array format
    const formattedData = Object.keys(groupedByUser).map(userId => ({
      userId: userId,
      rewardHistory: groupedByUser[userId]
    }));

    res.json({
      success: true,
      data: formattedData,
      allRewards: allRewards.map((reward) => ({
        _id: reward._id,
        referName: reward.candidateName || "Unknown",
        jobTitle: reward.jobId && reward.jobId.jobTitle ? reward.jobId.jobTitle : "Unknown Job",
        amount: reward.amount,
        date: reward.createdAt,
        userId: reward.userId,
      }))
    });
  } catch (error) {
    console.error("❌ Error fetching all users reward history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.withdrawFunds = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    // Fetch wallet and update the balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.totalEarnings < amount) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const withdrawRequest = new WithdrawRequest({
      userId,
      amount,
      status: "pending",
      modeOfPayment: null,
      createdAt: new Date(),
    });
    await withdrawRequest.save();
    return res.json({ message: "Withdrawal successful", newBalance: wallet.totalEarnings });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.approveWithdrawRequest = async (req, res) => {
  try {
    const { userId, withdrawRequestId } = req.body;

    //console.log("🔵 Approve Request Received:", { userId, withdrawRequestId });

    // Fetch the withdrawal request
    const withdrawRequest = await WithdrawRequest.findById(withdrawRequestId);
    if (!withdrawRequest) {
      return res.status(404).json({ error: "Withdrawal request not found" });
    }

    //console.log("🔵 Current withdrawRequest status:", withdrawRequest.status);

    // Prevent approving the same request multiple times
    if (withdrawRequest.status !== "pending") {
      return res.status(400).json({ error: `Withdrawal request already processed (Current Status: ${withdrawRequest.status})` });
    }

    // Fetch user's wallet and use "findOneAndUpdate" to avoid race conditions
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ error: "User wallet not found" });
    }

    // Ensure totalEarnings is a valid number
    const withdrawAmount = Number(withdrawRequest.amount) || 0;
    wallet.totalEarnings = Number(wallet.totalEarnings) || 0;

    // Check if the user has enough balance before deducting
    if (wallet.totalEarnings < withdrawAmount) {
      return res.status(400).json({ error: "Insufficient balance for withdrawal" });
    }

    // Deduct the withdraw amount safely using atomic update
    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { totalEarnings: -Number(withdrawAmount) },
      },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(500).json({ error: "Wallet update failed" });
    }
    // ✅ Update User Schema to match Wallet's totalEarnings
    const updatedUser = await User.findOneAndUpdate({ userId }, { $set: { walletBalance: wallet.totalEarnings } }, { new: true });
    //console.log("✅ Updated User:", updatedUser);

    if (!updatedUser) {
      return res.status(500).json({ error: "Failed to update user wallet balance" });
    }
    //console.log("🟢 After Update: ", updatedUser.walletBalance);
    //console.log("✅ User Wallet Updated:", updatedUser.walletBalance);

    // Update the withdrawal request status to "Approved"
    const updatedRequest = await WithdrawRequest.findByIdAndUpdate(
      withdrawRequestId,
      { $set: { status: "Approved" } },
      { new: true } // ✅ Returns the updated document
    );

    if (!updatedRequest) {
      return res.status(500).json({ error: "Failed to update withdrawal request" });
    }

    //console.log("✅ After Updating: New withdrawRequest Status:", updatedRequest.status);

    res.json({
      message: "Withdrawal request approved successfully",
      updatedTotalEarnings: updatedWallet.totalEarnings,
      updatedWalletBalance: updatedUser.walletBalance,
      updatedRequest, // ✅ Return the updated request
    });
  } catch (error) {
    console.error("❌ Error approving withdrawal:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// ✅ Get the status of a user's withdrawal request
exports.getWithdrawStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the latest withdrawal request
    const withdrawRequest = await WithdrawRequest.find({ userId })
      .sort({ createdAt: -1 }) // ✅ Get the latest request
      .limit(1) // Fetch only the most recent one
      .select("status createdAt"); // Log status and createdAt for debugging

    if (!withdrawRequest || withdrawRequest.length === 0) {
      return res.status(404).json({ message: "No withdrawal request found" });
    }

    //console.log("Latest withdrawal request:", withdrawRequest);
    res.json({ withdrawRequest: withdrawRequest[0] }); // Only send the most recent one
  } catch (error) {
    console.error("❌ Error fetching withdrawal status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};