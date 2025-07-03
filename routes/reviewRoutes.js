const express = require("express");
const router = express.Router();
const Review = require("../models/reviewModel");

// GET - Fetch all reviews (excluding low ratings > 1 min old)
// GET - Fetch all reviews (exclude low ratings older than 1 minute)
router.get("/", async (req, res) => {
  try {
    const allReviews = await Review.find().sort({ createdAt: -1 });

    const now = new Date();
    const filtered = allReviews.filter((review) => {
      const reviewDate = new Date(review.createdAt);
      const diffInMinutes = (now - reviewDate) / 60000;

      // Show all reviews with rating >= 3
      // Show reviews with rating < 3 only if it's within the last 1 minute
      return review.rating >= 3 || diffInMinutes <= 1;
    });
    ////console.log("filteredReviews",filtered);
    res.json(filtered);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ message: "Failed to fetch reviews", error: err.message });
  }
});

// POST or UPDATE - Save or update review based on name
router.post("/", async (req, res) => {
  const { name, image, review, rating } = req.body;

  try {
    let existing = await Review.findOne({ name });

    if (existing) {
      existing.image = image;
      existing.review = review;
      existing.rating = rating;
      existing.createdAt = new Date(); // Refresh timestamp
      await existing.save();
      return res.status(200).json({ message: "Review updated", review: existing });
    }

    const newReview = new Review({ name, image, review, rating });
    await newReview.save();
    res.status(201).json({ message: "Review created", review: newReview });
  } catch (err) {
    res.status(500).json({ message: "Failed to save review", error: err.message });
  }
});

// PUT /api/reviews/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating review", error: err });
  }
});

module.exports = router;
