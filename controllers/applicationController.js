const Application = require("../models/Application");
const ReferralStatus = require("../models/ReferralStatus");
const Notification = require("../models/Notification");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const AddFriendResume = require("../models/AddFriendsResume");
const mongoose = require("mongoose");

// Create reusable transporter object
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Email templates
const emailTemplates = {
  candidate: {
    applied: (name, jobTitle, companyName) => `
      <p>Dear <strong>${name}</strong>,</p>

      <p>Thank you for applying for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> through our Refer & Earn program.</p>

      <p>We have received your application and will review it carefully. You'll be notified about the status of your application via email.</p>

      <p>Best regards,<br/>
      Recruitment Team<br/>
      Refer & Earn App</p>
    `,
    selected: (name, jobTitle, companyName) => `
      <p>Dear <strong>${name}</strong>,</p>

      <p>Congratulations! We are pleased to inform you that you have been <strong>selected</strong> for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>

      <p>Our HR team will contact you shortly with further details regarding the next steps in the onboarding process.</p>

      <p>Best regards,<br/>
      Recruitment Team<br/>
      Refer & Earn App</p>
    `,
    rejected: (name, jobTitle, companyName) => `
      <p>Dear <strong>${name}</strong>,</p>

      <p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>

      <p>After careful consideration, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>

      <p>We appreciate the time and effort you invested in your application and encourage you to apply for future opportunities.</p>

      <p>Best regards,<br/>
      Recruitment Team<br/>
      Refer & Earn App</p>
    `,
    joined: (name, jobTitle, companyName) => `
      <p>Dear <strong>${name}</strong>,</p>

      <p>Welcome to <strong>${companyName}</strong>!</p>

      <p>We are excited to have you join us as <strong>${jobTitle}</strong>. Your first day marks the beginning of an exciting journey, and we look forward to your contributions to our team.</p>

      <p>Please check your email for onboarding details and don't hesitate to reach out if you have any questions.</p>

      <p>Best regards,<br/>
      HR Team<br/>
      ${companyName}</p>
    `,
    resigned: (name, jobTitle, companyName) => `
      <p>Dear <strong>${name}</strong>,</p>

      <p>We acknowledge your resignation from the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>

      <p>We appreciate your contributions during your time with us and wish you success in your future endeavors.</p>

      <p>Please complete the exit formalities as outlined in the separate email sent to you.</p>

      <p>Best regards,<br/>
      HR Team<br/>
      ${companyName}</p>
    `
  },
  referrer: {
    selected: (username, candidateName, jobTitle, companyName) => `
      <p>Dear <strong>${username}</strong>,</p>
      <p>We are pleased to inform you that the candidate you referred, <strong>${candidateName}</strong>, has been <strong>selected</strong> for the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
      <p>Thank you for your referral and continued support.</p>
      <p>Best regards,<br/>Recruitment Team<br/>Refer & Earn App</p>
    `,
    rejected: (username, candidateName, jobTitle, companyName) => `
      <p>Dear <strong>${username}</strong>,</p>
      <p>We regret to inform you that your referral, <strong>${candidateName}</strong>, for the role of <strong>${jobTitle}</strong> at <strong>${companyName}</strong> was not selected.</p>
      <p>We appreciate your effort and encourage you to continue referring suitable candidates.</p>
      <p>Best regards,<br/>Recruitment Team<br/>Refer & Earn App</p>
    `,
    joined: (username, candidateName, jobTitle, companyName) => `
      <p>Dear <strong>${username}</strong>,</p>
      <p>We are delighted to inform you that your referred candidate, <strong>${candidateName}</strong>, has officially <strong>joined</strong> <strong>${companyName}</strong> for the position of <strong>${jobTitle}</strong>.</p>
      <p>Thank you for your valuable contribution. Your referral reward will be processed shortly.</p>
      <p>Best regards,<br/>Recruitment Team<br/>Refer & Earn App</p>
    `,
    resigned: (username, candidateName, jobTitle, companyName) => `
      <p>Dear <strong>${username}</strong>,</p>
      <p>We would like to inform you that your referred candidate, <strong>${candidateName}</strong>, has <strong>resigned</strong> from <strong>${companyName}</strong>.</p>
      <p>Thank you for your contributions to the Refer & Earn platform.</p>
      <p>Best regards,<br/>Recruitment Team<br/>Refer & Earn App</p>
    `
  }
};

// Helper function to send email with error handling
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"Refer & Earn App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending error:", error.message);
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const { status } = req.body;
    const validStatuses = ["pending", "inProgress", "rejected", "selected", "joined", "resigned"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const application = await Application.findById(applicationId).populate("jobId", "jobTitle companyCode");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const previousStatus = application.status;

    if (previousStatus === status) {
      return res.status(200).json({ message: "Status unchanged", updatedApplication: application });
    }

    application.status = status;
    await application.save();

    const user = await User.findOne({ userId: application.userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Notification message
    const candidateName = application.name || "The candidate";
    const jobTitle = application.jobId?.jobTitle || "the position";
    const companyName = application.jobId?.companyCode || "the company";
    const username = user?.fullName?.split(" ")[0] || user?.email || "there";
    const message = `${candidateName}'s application for ${jobTitle} at ${companyName} has been ${status}.`;

    const notification = new Notification({
      message,
      type: "application_status",
      jobId: application.jobId._id,
      userId: application.userId,
      isGlobal: false,
    });

    // Send response immediately before handling email
    res.status(200).json({
      message: "Application status updated",
      updatedApplication: application,
    });

    // After sending response, handle notification and email operations
    if (["selected", "rejected", "joined", "resigned"].includes(status)) {
      // Send email to referrer immediately
      const referrerHtml = emailTemplates.referrer[status](username, candidateName, jobTitle, companyName);
      await sendEmail(user.email, `Application Status Update – ${jobTitle}`, referrerHtml);

      // Send email to candidate after 2 minutes
      setTimeout(async () => {
        const candidateHtml = emailTemplates.candidate[status](candidateName, jobTitle, companyName);
        await sendEmail(application.email, `Application Status Update – ${jobTitle}`, candidateHtml);
      }, 2 * 60 * 1000); // 2 minutes delay

      // Save notification
      await notification.save().catch(err => console.error("Notification save error:", err.message));
    } else {
      // Just save notification if no mail is needed
      await notification.save().catch(err => console.error("Notification save error:", err.message));
    }
  } catch (error) {
    console.error("Update error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.submitApplication = async (req, res) => {
  try {
    const { name, email, mobile, yearOfPassing, jobId, resume, userId } = req.body;

    if (!resume) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    // Check if application already exists
    const existingApplication = await Application.findOne({ email, jobId });
    if (existingApplication) {
      return res.status(409).json({ message: "Application already submitted for this job" });
    }

    const application = new Application({
      name,
      email,
      mobile,
      yearOfPassing,
      resume,
      jobId,
      userId,
      status: "pending",
      appliedDate: new Date(),
    });

    await application.save();

    let referralStatus = await ReferralStatus.findOne({ userId });
    if (!referralStatus) {
      referralStatus = new ReferralStatus({ userId });
    }
    referralStatus.inProgress += 1;
    await referralStatus.save();

    // Send confirmation email to candidate after application submission
    const job = await mongoose.model("Job").findById(jobId).select("jobTitle companyCode");
    if (job) {
      const candidateHtml = emailTemplates.candidate.applied(name, job.jobTitle, job.companyCode);
      await sendEmail(email, `Application Submitted – ${job.jobTitle}`, candidateHtml);
    }

    res.status(201).json({ message: "Application submitted successfully" });
  } catch (error) {
    console.error("Error in submitApplication:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getApplications = async (req, res) => {
  try {
    const applications = await Application.find().populate("jobId", "jobTitle companyCode");
    res.status(200).json({ applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getApplicationsByUser = async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.params.userId });
    res.status(200).json({ applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getJoinedCandidatesCount = async (req, res) => {
  try {
    const joinedCount = await Application.countDocuments({ status: "joined" });
    res.status(200).json({ joinedCount });
  } catch (error) {
    console.error("Error fetching joined candidates count:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllResumes = async (req, res) => {
  try {
    const resumes = await Application.find({ resume: { $exists: true, $ne: "" } }).select("name email mobile resume appliedAt");

    if (!resumes.length) {
      return res.status(404).json({ message: "No resumes found." });
    }

    // Convert relative paths to full URLs
    const updatedResumes = resumes.map((resume) => ({
      ...resume._doc,
      resume: resume.resume.startsWith("http") ? resume.resume : `${BASE_URL}${resume.resume}`,
    }));

    res.status(200).json({ resumes: updatedResumes });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getResumesCount = async (req, res) => {
  try {
    // Count from AddFriendResume collection
    const friendResumesCount = await AddFriendResume.countDocuments();

    // Count users with uploaded resumes in User collection
    const userResumesCount = await User.countDocuments({ resumes: { $exists: true, $ne: "", $ne: null } });

    const totalResumes = friendResumesCount + userResumesCount;

    res.status(200).json(totalResumes);
  } catch (error) {
    console.error("Error fetching resumes count:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getInProgressCandidatesCount = async (req, res) => {
  try {
    const inProgressCount = await Application.countDocuments({ status: "inProgress" });
    res.status(200).json({ inProgressCount });
  } catch (error) {
    console.error("Error fetching in-progress candidates count:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getApplicationCounts = async (req, res) => {
  try {
    const { jobIds } = req.query;

    if (!jobIds) {
      return res.status(200).json({});
    }

    const jobIdArray = jobIds
      .split(",")
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id.trim());
        } catch (err) {
          console.log(`Error converting ID ${id}:`, err.message);
          return null;
        }
      })
      .filter((id) => id !== null);

    if (jobIdArray.length === 0) {
      return res.status(200).json({});
    }

    const appCount = await Application.countDocuments({ jobId: { $in: jobIdArray } });

    const counts = await Application.aggregate([
      { $match: { jobId: { $in: jobIdArray } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } }
    ]);

    const countsObject = {};
    counts.forEach((item) => {
      const jobIdStr = item._id.toString();
      countsObject[jobIdStr] = item.count;
    });

    res.status(200).json(countsObject);
  } catch (error) {
    console.error("Error getting application counts:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};