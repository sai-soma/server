const express = require("express");
const router = express.Router();
const multer = require("multer");
const path =require("path");
const resumeController = require("../controllers/addFriendsResumeController");

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Routes
router.post("/uploadResume/:userId", upload.single("resume"), resumeController.uploadResume);
router.get("/resumes/:userId", resumeController.getUserResumes);
router.get("/all-friends-resumes", resumeController.getAllResumes);
router.put('/resumes/:id', upload.single('resume'), resumeController.updateResume);
router.delete("/resumes/:id", resumeController.deleteResume);

module.exports = router;