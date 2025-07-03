const express = require("express");
const multer = require("multer");
const path = require("path");
const Application = require("../models/Application");
const { submitApplication , getApplications  , getApplicationsByUser, updateApplicationStatus, getJoinedCandidatesCount, getInProgressCandidatesCount, getAllResumes, getResumesCount, getApplicationCounts} = require("../controllers/applicationController");

const router = express.Router();

// Set up Multer for file uploads
const storage = multer.diskStorage({
  destination: "uploads/", // Save resumes in "uploads" folder
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file
  },
});

const upload = multer({ storage });

console.log("Imported controllers:", { 
  submitApplication, 
  getApplications,  
  getApplicationsByUser, 
  updateApplicationStatus, 
  getJoinedCandidatesCount, 
  getInProgressCandidatesCount, 
  getAllResumes, 
  getResumesCount 
});


// Route to submit job application
router.post("/apply", upload.single("resume"), submitApplication);
router.get("/all", getApplications); // Fetch all applications
router.get("/user/:userId", getApplicationsByUser);
router.put("/update/:id", updateApplicationStatus);
router.get("/joined-count", getJoinedCandidatesCount);
router.get("/in-progress-count", getInProgressCandidatesCount);
router.get("/resumes", getAllResumes);
router.get("/resumes/count", getResumesCount); // Add this line
router.get("/counts",getApplicationCounts)



module.exports = router;