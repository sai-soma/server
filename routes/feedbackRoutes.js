const express = require("express");
const router = express.Router();
const Feedback = require("../models/feedbackModel");

router.post("/feedback", async (req, res) => {
    try {
     //console.log("Incoming Data:", req.body); // Debugging Log
  
      const { fullName, email, feedback, priority } = req.body;

      if (!fullName || !email || !feedback || !priority) {
        return res.status(400).json({ error: "All fields are required" });
      }
  
      const newFeedback = new Feedback({ fullName, email, feedback, priority });
      await newFeedback.save();
  
      res.status(201).json({ message: "Feedback submitted successfully" });
    } catch (error) {
      console.error("Error Saving Feedback:", error); // Logs actual error
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  

router.get("/totalfeedback", async (req, res) => {
  try {
    const feedbackList = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbackList);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
