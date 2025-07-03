const mongoose = require('mongoose');

const addFriendsResumeSchema = new mongoose.Schema({
  userId: { type: String, required: true }, 
  firstName: { type: String, required: true },
  surname: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
  },
  phone: { 
    type: String, 
    required: true, 
    unique: true, 
    match: [/^\d{10}$/, "Phone number must be exactly 10 digits"], 
  },
  location: { type: String, required: true },
  aadharNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    },
  dateOfBirth: { type: Date, required: true, immutable: false },

  resumeFile: { type: String, required: true }, 
  createdAt: { type: Date, default: Date.now },
  yearOfPassing: { type: Number, default: 2020 },
  highestQualification: { type: String, required: true },
  CId: { type: String, unique: true, required: true }, 
  specialization: { type: String, required: true }, 
  skills: {
    type: [String], // Array of strings for storing skills
    default: [],
  },
  experience: { type: Number, required: false } ,
  experienceType: { type: String, enum: ["Fresher", "Experienced"], required: true }, // Added enum
});

addFriendsResumeSchema.index({ email: 1, phone: 1, aadharNumber: 1 }, { unique: true });

module.exports = mongoose.model('addfriendsresumes', addFriendsResumeSchema);