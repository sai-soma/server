const express = require("express");
const WithdrawRequest = require("../models/WithdrawRequest"); // Adjust path if needed
const { getWithdrawRequests, updateWithdrawStatus, getWithdrawalNotifications} = require("../controllers/withdrawController");

const router = express.Router();

router.get("/withdraw-requests", getWithdrawRequests);
router.post("/update-withdraw-status", updateWithdrawStatus);
router.get("/withdraw-requests/notifications/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch withdrawal requests containing unread notifications
        const withdrawRequests = await WithdrawRequest.find({ 
            userId, 
            "notifications.isRead": false  // Filter unread notifications
        });

        if (!withdrawRequests.length) {
            return res.json({ message: "No unread notifications", notifications: [] });
        }

        // Extract unread notifications
        const notifications = withdrawRequests.flatMap(req =>
            req.notifications
                ?.filter(n => !n.isRead)  // Only unread ones
                .map(n => ({
                    _id: n._id, 
                    message: n.message,
                    isRead: n.isRead,
                    createdAt: n.createdAt,
                }))
        );

        res.json({ message: "Unread notifications fetched successfully", notifications });
    } catch (error) {
        console.error("❌ Error fetching unread withdrawal notifications:", error);
        res.status(500).json({ error: "Server error" });
    }
}); 
router.get('/notifications/:userId', getWithdrawalNotifications); 

module.exports = router;