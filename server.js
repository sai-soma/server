require("dotenv").config();
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const resumeRoutes = require("./routes/addFriendsResumeRoutes");
const referralStatusRoutes = require("./routes/referralStatusRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const walletRoutes = require("./routes/walletRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const feedbackRoutes =require("./routes/feedbackRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const { startUserCleanup } = require('./utils/cronJobs');



dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Fix CORS issues for frontend & OAuth
const cors = require("cors");

app.use(cors({
  origin: ["https://client-1-t9ar.onrender.com", "http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));


// ✅ Fix Cross-Origin-Opener-Policy issue
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});


console.log("MONGO_URI:", process.env.MONGO_URI);
startUserCleanup();

// Routes
app.use("/uploads", express.static("uploads"));
app.use("/uploads/resumes", express.static(path.join(__dirname, "uploads/resumes")));
app.use("/api/auth", authRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", resumeRoutes);
app.use("/api", notificationRoutes);
// job routes
app.use("/api/jobs", jobRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api", withdrawRoutes);
app.use("/api", feedbackRoutes);
app.use("/api/reviews", reviewRoutes);

// ✅ Referral Status Routes
app.use("/api/referral-status", referralStatusRoutes);

//application routes
app.use("/api/applications", applicationRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
