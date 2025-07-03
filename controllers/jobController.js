const Job = require("../models/jobModel");
const Subscriber = require("../models/Subscription");
const User = require("../models/User");
const JobApplication = require("../models/Application"); // Import Job Applications Model
const nodemailer = require("nodemailer");
const { default: mongoose } = require("mongoose");

// 📌 Configure Nodemailer (Use your credentials)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "surendrakori7929@gmail.com",
    pass: "ivdr ttly lbqo xszi", // ⚠ Replace with Gmail App Password
  },
});

// 📌 Create a New Job Posting
exports.createJob = async (req, res) => {
  try {
    const {
      companyCode, jobTitle, jobDescription, package, referralAmount,
      qualification, employmentType, jobLocation, noticePeriod,
      experience, postedDate, skills, additionalDetails
    } = req.body;

    if (
      !companyCode || !jobTitle || !jobDescription || !package || !referralAmount ||
      !qualification || !employmentType || !jobLocation || !noticePeriod ||
      !experience || !skills || skills.length === 0
    ) {
      return res.status(400).json({ message: "All required fields must be filled!" });
    }

    // ✅ Save job
    const newJob = new Job({
      companyCode, jobTitle, jobDescription, package, referralAmount,
      qualification, employmentType, jobLocation, noticePeriod,
      experience, postedDate: postedDate || Date.now(),
      skills, additionalDetails,
    });

    await newJob.save();

    // ✅ Respond immediately (client doesn't wait for emails)
    res.status(201).json({ message: "Job posted successfully!", job: newJob });

    // ✅ Email logic (runs after response is sent)
    process.nextTick(async () => {
      try {
        const users = await User.find({}, "email");
        const subscribers = await Subscriber.find({}, "email");
        const jobApplications = await JobApplication.find({}, "referredFriendEmail");

        const recipientEmails = [
          ...new Set([
            ...users.map((u) => u.email),
            ...subscribers.map((s) => s.email),
            ...jobApplications.map((a) => a.referredFriendEmail)
          ])
        ];

        if (recipientEmails.length > 0) {
          const jobLink = "https://yourdomain.com/jobs";
          const mailOptions = {
            from: '"Refer & Earn HR" <surendrakori7929@gmail.com>',
            to: "noreply@yourdomain.com",
            bcc: recipientEmails.join(","),
            subject: `New Job Opportunity at ${newJob.companyCode} - Apply Now!`,
            html: `
              <h2>🚀 Exciting Job Opportunity Just for You!</h2>
              <p>A new job has been posted that matches your profile. Here are the details:</p>

              <ul>
                <li><strong>Title:</strong> ${newJob.jobTitle}</li>
                <li><strong>Company:</strong> ${newJob.companyCode}</li>
                <li><strong>Location:</strong> ${newJob.jobLocation}</li>
                <li><strong>Experience:</strong> ${newJob.experience} years</li>
                <li><strong>Referral Bonus:</strong> ₹${newJob.referralAmount}</li>
              </ul>

              <h3>📄 Job Description:</h3>
              <p>${newJob.jobDescription}</p>

              <p>Apply now before it's too late! 🚀</p>

              <a href="${jobLink}">Apply Now</a>

              <br/><br/>
              <p>
                Best Regards,<br/>
                HR Recruiter<br/>
                Talent Acquisition Team<br/>
                Refer & Earn
              </p>

              <p>
                You are receiving this email because you are subscribed to job alerts from Refer & Earn.
              </p>
            `,
          };

          await transporter.sendMail(mailOptions);
          //console.log("Emails sent successfully");
        }
      } catch (emailErr) {
        console.error("Error in background email sending:", emailErr);
      }
    });

  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// 📌 Get All Jobs
exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find();
    res.status(200).json({ message: "Jobs fetched successfully", jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// 📌 Get a Single Job by ID
exports.getJobById = async (req, res) => {
  const jobId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return res.status(400).json({ message: "Invalid Job ID" });
  }

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json({ job });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Update a Job Listing
exports.updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const updatedJob = await Job.findByIdAndUpdate(jobId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedJob) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ message: "Job updated successfully", job: updatedJob });
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// 📌 Delete a Job Listing
exports.deleteJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const deletedJob = await Job.findByIdAndDelete(jobId);

    if (!deletedJob) return res.status(404).json({ message: "Job not found" });

    res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ message: "Server error", error });
  }
};