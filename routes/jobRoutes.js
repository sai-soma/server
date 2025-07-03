const express = require("express");
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
} = require("../controllers/jobController");
 // Middleware for admin authentication

// 📌 Create a new job (Only Admin)
router.post("/create", createJob);

// 📌 Get all job listings
router.get("/all", getAllJobs);

// 📌 Get a single job by ID
router.get("/:id", getJobById);

// 📌 Update a job listing (Only Admin)
router.put("/:id", updateJob);

// 📌 Delete a job listing (Only Admin)
router.delete("/:id", deleteJob);

module.exports = router;
