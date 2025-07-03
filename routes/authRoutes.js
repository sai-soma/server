const express = require("express");
const passport = require("passport");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const authController = require("../controllers/authController");
const {
  signup,
  login,
  verifyOtp,
  resetPassword,
  setPassword,
  resendOtp,
  forgotPassword,
  uploadResume,
  deleteResume,
  updateWalletBalance,
  getAllUsers,
  getUser,
  googleAuth,
  updateUser,
  getAllUser, 
  getUserProfile,
  getBankDetails,
  addBankDetails, 
  updateBankDetails, 
  deleteBankDetails,
  verifyEmail,
  updateUserRole
} = require("../controllers/authController");

const User = require("../models/User");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-otp", resendOtp);

// For ProfilePicture Set up storage for profile picture uploads
const profilePicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads/profiles");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const profilePicUpload = multer({ storage: profilePicStorage });

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/resumes/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// File filter (Only PDFs)
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed."), false);
  }
};

// Multer config with file size limit (5MB)
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload route
router.post("/upload-resume", (req, res) => {
  upload.single("resume")(req, res, async (err) => {
    try {
      // Multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large. Max size is 5MB." });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }

      // Custom validation
      if (!req.file || !req.body.userId) {
        return res.status(400).json({ message: "File and userId are required" });
      }

      const userId = req.body.userId;
      const resumePath = `uploads/resumes/${req.file.filename}`;

      const updatedUser = await User.findOneAndUpdate(
        { userId },
        { $set: { resumes: resumePath } },
        { new: true, upsert: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Resume uploaded successfully", resume: resumePath });
    } catch (error) {
      console.error("Upload Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
});
// 📌 Upload Profile Picture
router.post("/upload-profile", profilePicUpload.single("profilePic"), async (req, res) => {
  try {
   //console.log("Received File:", req.file); // Log the uploaded file
   //console.log("Received Body:", req.body); // Log the request body

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // If you want to find by the userId string field
    const user = await User.findOne({ userId: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete old profile picture
    if (user.profilePic) {
      const oldPicPath = path.join(__dirname, "../", user.profilePic);
      if (fs.existsSync(oldPicPath)) {
        fs.unlinkSync(oldPicPath);
      }
    }

    // Save new profile picture path
    const profilePicPath = `/uploads/profiles/${req.file.filename}`;
    user.profilePic = profilePicPath;
    await user.save();

    res.status(200).json({ profilePic: profilePicPath, message: "Profile picture updated successfully" });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/delete-resume", deleteResume);

// 📌 Update Wallet Balance (Rewards)
router.post("/update-wallet", updateWalletBalance);

// 📌 Get All Users Route
router.get("/all-users", getAllUsers);

// 📌 Get particular user data
router.get("/user/:id", getUser);

// 📌 Update User Profile Route
router.put("/update-user", async (req, res) => {
  try {
    const {
      userId,
      fullName,
      email,
      phone,
      profilePic,
      highestQualification,
      specialization,
      experienceLevel,
      totalYearsOfExperience,
      dateOfBirth,
      skills,
      aadhaarNumber,
    } = req.body;

    // Validate request
    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Construct update object dynamically to avoid setting undefined fields
    const updateData = {
      fullName,
      email,
      phone,
      highestQualification,
      specialization,
      experienceLevel,
      totalYearsOfExperience,
      dateOfBirth,
      skills,
      aadhaarNumber,
    };
    if (profilePic) updateData.profilePic = profilePic; // Only update profilePic if provided

    // Find and update user details
    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Server error." });
  }
});


// 📌 Google OAuth Routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), googleAuth);
router.post("/google-login", googleAuth);

// 📌 Set Password Route
router.post("/set-password", setPassword);

// 📌 Check if User ID is available
router.get("/check-userid/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const existingUser = await User.findOne({ userId });
    res.json({ available: !existingUser });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/users", getAllUser);
router.get("/all-users", getAllUsers);

router.get("/users/:userId/profile", getUserProfile); // ✅ Fix: Removed userId/ 

router.get("/users/:userId/bankDetails", getBankDetails);

// ✅ New: Route to add/update bank details
router.post("/users/:userId/bankDetails", addBankDetails);

router.put("/users/:userId/bankDetails", updateBankDetails);
router.put('/toggle-role/:id', updateUserRole);

router.delete("/users/:userId/bankDetails", deleteBankDetails);

// routes/auth.js
router.get("/verify-email", verifyEmail);



module.exports = router;