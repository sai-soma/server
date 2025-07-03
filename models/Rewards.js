const mongoose = require("mongoose");

const RewardSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    jobId: { type: String, required: true },  
    candidateName: { type: String, required: true },  
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Reward", RewardSchema);