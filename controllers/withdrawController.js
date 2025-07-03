const mongoose = require("mongoose");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const WithdrawRequest = require("../models/WithdrawRequest");
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "Gmail", // You can use other services like "Outlook", "Yahoo", or use host, port, secure manually
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🚀 GET: All Withdraw Requests (for admin)
const getWithdrawRequests = async (req, res) => {
  try {
    //console.log("🟢 HIT => GET /withdraw-requests");

    const withdrawRequests = await WithdrawRequest.find({});
    if (!withdrawRequests.length) {
      //console.log("⚠ No withdrawal requests found");
      return res.status(404).json({ message: "No withdrawal requests found" });
    }

    const userIds = withdrawRequests.map(req => req.userId.toString());

    const users = await User.find({ userId: { $in: userIds } }).lean();
    const wallets = await Wallet.find({ userId: { $in: userIds } });

    //console.log("🔍 Users Found:", users.length, users.map(u => u.userId));
    //console.log("💰 Wallets Found:", wallets.length, wallets.map(w => w.userId));
    //console.log("📥 Withdrawal Requests Found:", withdrawRequests.length);

    const formattedRequests = withdrawRequests.map(req => {
      const user = users.find(u => u.userId === req.userId);
      const wallet = wallets.find(w => w.userId === req.userId);

      return {
        _id: req._id,
        userId: req.userId,
        fullName: user ? user.fullName : "Unknown User",
        phone: user ? user.phone : "N/A",
        email: user ? user.email : "N/A",
        bankName: user?.bankDetails?.[0]?.bankName || "N/A",
        accountNumber: user?.bankDetails?.[0]?.accountNumber || "N/A",
        upiId: user?.bankDetails?.[0]?.upiId || "N/A",
        ifscCode: user?.bankDetails?.[0]?.ifscCode || "N/A",
        branchName: user?.bankDetails?.[0]?.branchName || "N/A",
        phonepeNumber: user?.bankDetails?.[0]?.phonepeNumber || "N/A",
        totalEarnings: wallet ? wallet.totalEarnings : 0,
        withdrawAmount: req.amount,
        requestDate: req.createdAt,
        status: req.status,
       paymentMode: req.modeOfPayment || "",
      };
    });

    //console.log("✅ Final Formatted Withdraw Requests:", formattedRequests);
    res.json(formattedRequests);
  } catch (error) {
    console.error("❌ Error in getWithdrawRequests:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ POST: Approve or Reject Withdraw Request
const updateWithdrawStatus = async (req, res) => {
  try {
    //console.log("🟡 HIT => POST /withdraw-status");
    //console.log("📦 Received Request Body:", req.body);

    const { userId, withdrawRequestId, action, withdrawAmount, modeOfPayment } = req.body;

    if (!userId || !withdrawRequestId || !action || !modeOfPayment) {
      //console.log("❌ Missing fields in request:", req.body);
      return res.status(400).json({ error: "Missing required fields" });
    }

    const withdrawRequest = await WithdrawRequest.findById(withdrawRequestId);
    if (!withdrawRequest) {
      return res.status(404).json({ error: "Withdrawal request not found" });
    }

    if (withdrawRequest.status.toLowerCase() !== "pending") {
      return res.status(400).json({ error: `Already processed (${withdrawRequest.status})` });
    }

    const wallet = await Wallet.findOne({ userId });
    const user = await User.findOne({ userId });

    if (!wallet || !user) {
      return res.status(404).json({ error: "User wallet or profile not found" });
    }

    let notificationMessage = "";
    let mailSubject = "";
    let mailHtml = "";

    if (action === "approve") {
      withdrawRequest.status = "Approved";
      withdrawRequest.modeOfPayment = modeOfPayment || "Bank Transfer";
      wallet.totalEarnings -= withdrawAmount;
      notificationMessage = `Your withdrawal request of ₹${withdrawAmount} via ${modeOfPayment} has been Approved and will be credited within 24 hours.`;

      mailSubject = "✅ Withdrawal Approved - Refer & Earn";
      mailHtml = `
        <p>Hi ${user.fullName},</p>
        <p>We're happy to inform you that your withdrawal request of <strong>₹${withdrawAmount}</strong> via <strong>${modeOfPayment}</strong> has been <strong>approved</strong>.</p>
        <p>The amount will be credited to your account within 24 hours.</p>
        <p><strong>Request Date:</strong> ${withdrawRequest.createdAt.toLocaleString()}</p>
        <p>Thank you for using <strong>Refer & Earn</strong>!</p>
        <p>Best regards,<br/>The Refer & Earn Team</p>
      `;

    } else if (action === "reject") {
      withdrawRequest.status = "Rejected";
      withdrawRequest.modeOfPayment = "N/A";
      notificationMessage = `Your withdrawal request of ₹${withdrawAmount} has been Rejected.`;

      mailSubject = "❌ Withdrawal Rejected - Refer & Earn";
      mailHtml = `
        <p>Hi ${user.fullName},</p>
        <p>We regret to inform you that your withdrawal request of <strong>₹${withdrawAmount}</strong> has been <strong>rejected</strong>.</p>
        <p><strong>Request Date:</strong> ${withdrawRequest.createdAt.toLocaleString()}</p>
        <p>Please contact support for further assistance.</p>
        <p>Best regards,<br/>The Refer & Earn Team</p>
      `;
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    withdrawRequest.notifications.push({ message: notificationMessage });

    await withdrawRequest.save();
    await wallet.save();

    // ✅ Send response immediately
    res.json({ message: `Withdrawal ${action}d successfully`, updatedRequest: withdrawRequest });

    // 📧 Send email after response
    setImmediate(async () => {
      try {
        await transporter.sendMail({
          from: `"Refer & Earn" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: mailSubject,
          html: mailHtml,
        });
        //console.log("📧 Email sent to:", user.email);
      } catch (emailErr) {
        console.error("❌ Failed to send email:", emailErr);
      }
    });

  } catch (error) {
    console.error("❌ Error in updateWithdrawStatus:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};




// ✅ GET: Withdrawal Notifications by userId
const getWithdrawalNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    //console.log("🟢 HIT => GET /withdrawal-notifications/" + userId);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const requests = await WithdrawRequest.find({ userId }).sort({ createdAt: -1 });

    //console.log("🗃 Raw WithdrawRequests Found:", requests.length);

    const notifications = requests
      .flatMap(request => 
        request.notifications.map(n => ({
          message: n.message,
          createdAt: n.createdAt,
          status: request.status || "Pending",
          paymentMethod: request.modeOfPayment || "N/A"
        }))
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    //console.log("📦 Final Notifications Payload:", notifications);

    res.status(200).json({ notifications });
  } catch (err) {
    console.error("❌ Error fetching withdrawal notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
};


module.exports = { 
  getWithdrawRequests, 
  updateWithdrawStatus, 
  getWithdrawalNotifications 
};