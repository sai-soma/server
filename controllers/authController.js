const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Application = require("../models/Application");
const AddFriendsResume = require("../models/AddFriendsResume");
const path = require("path");
const fs = require("fs");
// other imports...
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const otpStorage = {};
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Decode Google JWT token
    const decoded = jwt.decode(token);
    //console.log("Decoded Google User:", decoded);

    if (!decoded || !decoded.email) {
      return res.status(400).json({ message: "Invalid Google token" });
    }

    // ✅ Find or Create User
    let user = await User.findOne({ email: decoded.email });
    let resetToken = null;
    if (!user) {
      // ✅ Generate Reset Token for New User
      resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

      user = new User({
        userId: "GOOGLE_" + decoded.sub, // ✅ Generate unique userId
        fullName: decoded.name, // ✅ Get full name from Google
        email: decoded.email,
        phone: "", // ✅ Set phone as optional
        password: "", // ✅ Set password as optional
        googleId: decoded.sub,
        profilePic: decoded.picture,
        authType: "google",
        resetToken: hashedToken, // ✅ Store hashed token in DB
        resetTokenExpires: Date.now() + 10 * 60 * 1000, // ✅ Token valid for 10 minutes
      });

      await user.save();
    } else if (!user.password) {
      // ✅ Generate Reset Token for Existing User Without Password
      resetToken = crypto.randomBytes(32).toString("hex");
      user.resetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.resetTokenExpires = Date.now() + 10 * 60 * 1000;
      await user.save();
    }

    // ✅ Generate JWT for frontend (user already exists)
    const authToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Google login successful",
      token: authToken,
      user,
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 📌 Set Password
exports.setPassword = async (req, res) => {
  try {
    const { email, userId, newPassword, resetToken } = req.body;

    if (!email || !userId || !newPassword) {
      return res.status(400).json({ message: "Email, User ID, and password are required" });
    }

    const existingUser = await User.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ message: "User ID already exists. Please choose a different one." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.googleId) {
      user.password = await bcrypt.hash(newPassword, 10);
      user.userId = userId; // Store the new userId
      await user.save();
      return res.status(200).json({ message: "Password set successfully" });
    }

    if (!resetToken || user.resetToken !== resetToken || user.resetTokenExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.userId = userId; // Store the new userId
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error setting password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { fullName, phone, email, password, userId } = req.body;

    // Check if email already exists
    let userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      // If user exists but is unverified and token expired, delete and allow re-signup
      if (!userExists.isVerified && userExists.verificationTokenExpires < Date.now()) {
        await User.deleteOne({ _id: userExists._id });
        console.log('Deleted expired unverified user:', email);
      } else {
        return res.status(400).json({ message: "Email already registered" });
      }
    }

    // Check if userId already exists
    let userIdExists = await User.findOne({ userId: userId.toLowerCase() });
    if (userIdExists) {
      // Same logic for userId
      if (!userIdExists.isVerified && userIdExists.verificationTokenExpires < Date.now()) {
        await User.deleteOne({ _id: userIdExists._id });
        console.log('Deleted expired unverified user with userId:', userId);
      } else {
        return res.status(400).json({ message: "User ID already taken" });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(verificationToken).digest("hex");

    // Create new user
    const newUser = new User({
      fullName,
      phone,
      email: email.toLowerCase(),
      password: hashedPassword,
      userId: userId.toLowerCase(),
      verificationToken: hashedToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      isVerified: false // Explicitly set this
    });

    await newUser.save();

    // Send verification email
    const verificationURL = `https://client-1-t9ar.onrender.com/verify-email?token=${verificationToken}&email=${email}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your email - Action Required",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Our Platform!</h2>
          <p>Thank you for signing up. Please verify your email address to activate your account.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${verificationURL}" 
               style="background-color: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p><strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, your account will be automatically removed and you'll need to sign up again.</p>
          <p>If the button doesn't work, copy and paste this link: ${verificationURL}</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error("Email Sending Failed:", emailErr);
      // Delete the user if email fails to send
      await User.deleteOne({ _id: newUser._id });
      return res.status(500).json({ message: "Failed to send verification email. Please try again." });
    }

    // Generate JWT Token (but user still needs to verify email to login)
    const token = jwt.sign({ userId: newUser.userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "Signup successful. Please check your email to verify your account.",
      user: {
        id: newUser._id,
        userId: newUser.userId,
        fullName: newUser.fullName,
        phone: newUser.phone,
        email: newUser.email,
        isVerified: newUser.isVerified
      },
      token,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      //console.log("User not found with email:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: "Email not verified. Please check your inbox." });
    }

    // ✅ Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      //console.log("Password does not match for:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign({ userId: user.userId, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    //console.log("Login successful for:", email);

    // If user is an admin, include role in the response
    if (user.role === "admin" || user.role === "superadmin") {
      return res.json({
        message: "Login successful",
        token, // The JWT token
        user: {
          // User data that will be sent back
          email,
          role: user.role, // ✅ Use actual role dynamically
          fullName: user.fullName,
          profilePic: user.profilePic,
        },
      });
    }

    // For regular users
    return res.json({
      message: "Login successful",
      token,
      user: { email, role: user.role, fullName: user.fullName, userId: user.userId },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP (4-digit code)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    //console.log("Generated OTP:", otp);
    otpStorage[email] = { otp, expiresAt: Date.now() + 300000 }; // Expires in 5 minutes

    // Send OTP via email using Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    //console.log(`OTP sent to ${email}`);

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// 📌 Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  //console.log(`Received OTP for ${email}:`, otp);

  if (!otpStorage[email] || otpStorage[email].expiresAt < Date.now()) {
    //console.log(`OTP expired or invalid for ${email}`);
    return res.status(400).json({ message: "OTP expired or invalid" });
  }

  if (otpStorage[email].otp !== otp) {
    //console.log(`OTP mismatch for ${email}:`, otpStorage[email].otp);
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // OTP is valid, allow user to reset password
  delete otpStorage[email];
  //console.log(`OTP verified successfully for ${email}`);
  return res.status(200).json({ message: "OTP verified successfully" });
};

// 📌 Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne({ email }, { password: hashedPassword });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Resend OTP
exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStorage[email] = { otp, expiresAt: Date.now() + 300000 }; // Expires in 5 minutes

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "New OTP for Verification",
      text: `Your new OTP is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// 📌 Upload Resume (Allows unlimited resumes)
exports.uploadResume = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const BASE_URL = process.env.REACT_APP_API_URL;

    const filePath = `${BASE_URL}uploads/${req.file.filename}`;

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.resumes.push(filePath);
    await user.save();

    res.status(200).json({ message: "Resume uploaded successfully", resumes: user.resumes });
  } catch (error) {
    console.error("Error uploading resume:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const { userId, resumePath } = req.body;

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.resumes = user.resumes.filter((resume) => resume !== resumePath);
    await user.save();

    // Delete file from server
    const absolutePath = path.join(__dirname, "..", resumePath);

    fs.unlink(absolutePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err); // Log the error
        return res.status(500).json({ message: "Error deleting file", error: err.message });
      }

      //console.log(`File ${resumePath} deleted successfully`); // Log successful deletion
      res.status(200).json({ message: "Resume deleted successfully", resumes: user.resumes });
    });
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 📌 Update Wallet Balance (Reward system)
exports.updateWalletBalance = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const user = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } }, { new: true });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Wallet updated successfully", walletBalance: user.walletBalance });
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Get All Users Function
exports.getAllUsers = async (req, res) => {
  try {
    //console.log('API hit for getting users'); // This will help confirm if the API is being accessed
    const users = await User.find().select("-password"); // Exclude password for security
    res.json({ message: "Users fetched successfully", users });
  } catch (error) {
    console.error("Error in fetching users:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Function to get user data by ID
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params; // This is actually the userId
    const user = await User.findOne({ userId: id }); // Find by userId, not _id

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    // Hardcoded primary admin userId
    const primaryAdminId = "6819e6c1bf729ec6f50d0553"; // Replace with the actual primary admin's _id

    // Validate input role
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'user' or 'admin'." });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user is a primary admin
    if (user._id.toString() === primaryAdminId) {
      return res.status(403).json({ message: "Primary admin role cannot be changed." });
    }

    // Check if the user is marked as primary admin in the database
    if (user.isPrimaryAdmin) {
      return res.status(403).json({ message: "Primary admin role cannot be changed." });
    }

    // Update the user role if not the primary admin
    user.role = role;
    await user.save();

    res.status(200).json({
      message: `User role updated to ${role}`,
      user: { ...user.toObject(), password: undefined },
    });
  } catch (error) {
    console.error("Error updating user role:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.uploadProfilePic = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) {
      return res.status(400).json({ message: "User ID and file are required." });
    }

    const user = await User.findOne({ userId }); // Find user by custom userId
    if (!user) return res.status(404).json({ message: "User not found." });

    user.profilePic = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ profilePic: user.profilePic });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { userId, fullName, email, phone, highestQualification, specialization, experienceLevel, totalYearsOfExperience, dateOfBirth, skills, aadhaarNumber } = req.body;

    // Convert dateOfBirth to YYYY-MM-DD format
    const formattedDateOfBirth = dateOfBirth ? new Date(dateOfBirth).toISOString().split("T")[0] : null;

    const updatedUser = await User.findOneAndUpdate(
      { userId },
      {
        $set: {
          fullName,
          email,
          phone,
          highestQualification,
          specialization,
          experienceLevel,
          totalYearsOfExperience,
          dateOfBirth: formattedDateOfBirth, // Store only YYYY-MM-DD
          skills,
          aadhaarNumber,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Ensure the API response only includes YYYY-MM-DD for dateOfBirth
    updatedUser.dateOfBirth = updatedUser.dateOfBirth.toISOString().split("T")[0];

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUser = async (req, res) => {
  try {
    const users = await User.find({}, "userId");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
};

// Get user profile (applications & resumes)
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user details
    const user = await User.findOne({ userId }, "fullName email phone walletBalance bankDetails");
    if (!user) return res.status(404).json({ error: "User not found" });

    // Fetch applications related to the user
    const applications = await Application.find({ userId }, "name email mobile yearOfPassing resume status jobId appliedAt");

    // Fetch resumes shared with friends
    const addFriendsResume = await AddFriendsResume.find({ userId }, "firstName surname email phone location aadharNumber resumeFile yearOfPassing highestQualification specialization experience createdAt");

    //console.log("Fetched Applications:", applications.length > 0 ? applications : "No applications found");
    //console.log("Fetched Resumes:", addFriendsResume.length > 0 ? addFriendsResume : "No resumes found");

    res.json({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      walletBalance: user.walletBalance,
      bankDetails: user.bankDetails,
      applications,
      addFriendsResume,
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Error fetching user details" });
  }
};

// Get bank details
exports.getBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ userId }, "bankDetails");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ bankDetails: user.bankDetails });
  } catch (error) {
    console.error("Error fetching bank details:", error);
    res.status(500).json({ error: "Error fetching bank details" });
  }
};

// Add bank details
exports.addBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountHolderName, bankName, accountNumber, ifscCode, branchName, upiId, phonepeNumber } = req.body;

    const errors = {};

    // Format validations
    if (!accountHolderName || !/^[A-Za-z\s]+$/.test(accountHolderName)) {
      errors.accountHolderName = "Invalid account holder name";
    }

    if (!bankName || typeof bankName !== "string") {
      errors.bankName = "Invalid bank name";
    }

    const accNumStr = accountNumber?.toString();
    if (!accNumStr || !/^\d{9,18}$/.test(accNumStr)) {
      errors.accountNumber = "Invalid account number";
    }

    if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      errors.ifscCode = "Invalid IFSC code. Format should be like: HDFC0123456";
    }

    if (upiId && !/^[\w.-]+@[\w]+$/.test(upiId)) {
      errors.upiId = "Invalid UPI ID format";
    }

    if (phonepeNumber && !/^\d{10}$/.test(phonepeNumber)) {
      errors.phonepeNumber = "Invalid PhonePe number format";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Duplicate check
    const duplicateUser = await User.findOne({
      userId: { $ne: userId },
      $or: [{ "bankDetails.accountNumber": accountNumber }, { "bankDetails.ifscCode": ifscCode }, { "bankDetails.upiId": upiId || null }, { "bankDetails.phonepeNumber": phonepeNumber || null }],
    });

    if (duplicateUser) {
      if (duplicateUser.bankDetails && duplicateUser.bankDetails.length > 0) {
        const bd = duplicateUser.bankDetails[0]; // Declare bd here

        // Check for duplicates only if bank details exist
        if (bd.accountNumber === accountNumber) errors.accountNumber = "Account number already exists";
        if (bd.ifscCode === ifscCode) errors.ifscCode = "IFSC code already exists";
        if (upiId && bd.upiId === upiId) errors.upiId = "UPI ID already exists";
        if (phonepeNumber && bd.phonepeNumber === phonepeNumber) errors.phonepeNumber = "PhonePe number already exists";
      } else {
        // Handle the case where no bank details are found
        //console.log("No bank details found for user:", duplicateUser.userId);
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log user and bankDetails to debug the issue
    //console.log("User fetched:", user);
    //console.log("User's bank details:", user.bankDetails);

    // Ensure bankDetails is an array if it doesn't exist
    if (!Array.isArray(user.bankDetails)) {
      //console.log("Initializing bankDetails as an empty array");
      user.bankDetails = []; // Initialize as an empty array if it's not an array
    }

    //console.log("Bank details after initialization:", user.bankDetails);

    user.bankDetails.push({
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      upiId,
      phonepeNumber,
    });

    await user.save();

    res.json({
      message: "Bank details added successfully",
      bankDetails: user.bankDetails,
    });
  } catch (error) {
    console.error("Error adding bank details:", error);
    res.status(500).json({ error: "Internal server error while adding bank details" });
  }
};

exports.updateBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountHolderName, bankName, accountNumber, ifscCode, branchName, upiId, phonepeNumber } = req.body;

    const errors = {};

    // Format validations
    if (!accountHolderName || !/^[A-Za-z\s]+$/.test(accountHolderName)) {
      errors.accountHolderName = "Invalid account holder name";
    }

    if (!bankName || typeof bankName !== "string") {
      errors.bankName = "Invalid bank name";
    }

    const accNumStr = accountNumber?.toString();
    if (!accNumStr || !/^\d{9,18}$/.test(accNumStr)) {
      errors.accountNumber = "Invalid account number";
    }

    if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      errors.ifscCode = "Invalid IFSC code. Format should be like: HDFC0123456";
    }

    if (upiId && !/^[\w.-]+@[\w]+$/.test(upiId)) {
      errors.upiId = "Invalid UPI ID format";
    }

    if (phonepeNumber && !/^\d{10}$/.test(phonepeNumber)) {
      errors.phonepeNumber = "Invalid PhonePe number format";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Duplicate check (exclude current user)
    const duplicateUser = await User.findOne({
      userId: { $ne: userId },
      $or: [{ "bankDetails.accountNumber": accountNumber }, { "bankDetails.ifscCode": ifscCode }, { "bankDetails.upiId": upiId || null }, { "bankDetails.phonepeNumber": phonepeNumber || null }],
    });

    if (duplicateUser) {
      const bd = duplicateUser.bankDetails[0];
      if (bd.accountNumber === accountNumber) errors.accountNumber = "Account number already exists";
      if (bd.ifscCode === ifscCode) errors.ifscCode = "IFSC code already exists";
      if (upiId && bd.upiId === upiId) errors.upiId = "UPI ID already exists";
      if (phonepeNumber && bd.phonepeNumber === phonepeNumber) errors.phonepeNumber = "PhonePe number already exists";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Proceed with update
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    const newDetails = {
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      upiId,
      phonepeNumber,
    };

    if (user.bankDetails.length > 0) {
      user.bankDetails[0] = newDetails;
    } else {
      user.bankDetails.push(newDetails);
    }

    await user.save();

    res.json({
      message: "Bank details updated successfully",
      bankDetails: user.bankDetails,
    });
  } catch (error) {
    console.error("Error updating bank details:", error);
    res.status(500).json({ error: "Internal server error while updating bank details" });
  }
};

exports.deleteBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    //console.log("Delete Bank Details Request for userId:", userId);

    const user = await User.findOne({ userId });
    if (!user) {
      //console.log("User not found for ID:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    //console.log("User found:", user.email);
    user.bankDetails = [];

    await user.save();
    //console.log("Bank details deleted successfully.");

    res.json({ message: "Bank details deleted successfully" });
  } catch (error) {
    console.error("Error deleting bank details:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Error deleting bank details" });
  }
};
// Inside controllers/authController.js
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({ verificationToken: hashedToken });

    if (!user) {
      return res.status(400).json({ message: "Invalid token" });
    }

    // Check if token is expired
    if (user.verificationTokenExpires < Date.now()) {
      // Delete unverified user with expired token
      await User.deleteOne({ _id: user._id });
      return res.status(400).json({ message: "Token has expired. Please sign up again." });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};