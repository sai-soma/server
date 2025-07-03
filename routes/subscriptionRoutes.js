const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription"); // Import model
const { subscribeUser } = require("../controllers/subscriptionController");

router.post("/subscribe", subscribeUser);

router.get("/subscribers", async (req, res) => { // Fix route path
  try {
    const subscribers = await Subscription.find();
    ////console.log("Fetched Subscribers:", subscribers); // Debugging Log
    res.status(200).json(subscribers);
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    res.status(500).json({ error: "Error fetching subscribers" });
  }
});

router.delete("/subscribers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSubscriber = await Subscription.findByIdAndDelete(id);

    if (!deletedSubscriber) {
      return res.status(404).json({ success: false, message: "Subscriber not found" });
    }

    res.status(200).json({ success: true, message: "Subscriber deleted successfully" });
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
