const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  yearOfPassing: { type: Number, required: true },
  resume: { type: String, required: true }, // Resume file path
  
  userId: { type: String, ref: "User", required: true }, // Changed to ObjectId
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true }, // Link to the job
  
  status: {
    type: String,
    enum: ["pending", "inProgress", "rejected", "selected", "joined", "resigned"], // Status field added
    default: "pending",
  },
  
  appliedAt: { type: Date, default: Date.now },
});

const Application = mongoose.model("Application", applicationSchema);
module.exports = Application;