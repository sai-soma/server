const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    companyCode: { type: String, required: true },
    jobTitle: { type: String, required: true },
    jobDescription: { type: String, required: true },
    package: { type: String, required: true },
    referralAmount: { type: Number, required: true },
    additionalDetails: { type: String }, // Optional field

    // New fields
    qualification: { type: String, required: true }, 
    employmentType: { 
    type: String, 
    enum: ["Fulltime", "Parttime", "Contract", "Freelance", "Fulltime/Parttime"],
    required: true 
  }, // Full-time, Part-time, Contract
    jobLocation: { type: String, required: true },
    noticePeriod: { type: String, required: true }, // Immediate, 1 Month, 3 Months
    experience: { type: Number, required: true }, // Years of experience required
    postedDate: { type: Date, default: Date.now }, // Defaults to the current date
    skills: { type: [String], required: true }, // Array of skills
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
