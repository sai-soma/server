const AddFriendsResume = require("../models/AddFriendsResume");
const path = require("path");
const crypto = require('crypto');

const SECRET_KEY = crypto.createHash('sha256').update("helloworld").digest(); // 32-byte key
const IV_LENGTH = 16;

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) throw new Error("Encrypted text format invalid");

    const iv = Buffer.from(parts[0], 'hex');
    if (iv.length !== 16) throw new Error("Invalid IV length");

    const encryptedTextBuffer = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);

    let decrypted = decipher.update(encryptedTextBuffer, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err.message);
    return null;
  }
};


exports.uploadResume = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      surname,
      email,
      phone,
      location,
      aadharNumber,
      dob,
      dateOfBirth: dateOfBirthRaw,
      yearOfPassing,
      highestQualification,
      specialization,
      experienceType,
      experience,
      skills,
    } = req.body;

    console.log("Received Aadhaar Number:", aadharNumber);

    // Validate Aadhaar number before encryption
    const aadhaarRegex = /^[2-9]\d{11}$/; // Must be 12 digits and cannot start with 0 or 1
    if (!aadhaarRegex.test(aadharNumber)) {
      return res.status(400).json({
        message: "Invalid Aadhaar number. It must be 12 digits and cannot start with 0 or 1.",
      });
    }

    const dateOfBirth = dob || dateOfBirthRaw;
    if (!dateOfBirth || isNaN(Date.parse(dateOfBirth))) {
      return res.status(400).json({ message: "Invalid date of birth format. Use YYYY-MM-DD." });
    }
    const parsedDate = new Date(dateOfBirth).toISOString().split("T")[0];

    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required." });
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number. It must be exactly 10 digits." });
    }

    const existingFriend = await AddFriendsResume.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }, { aadharNumber }],
    });

    if (existingFriend) {
      return res.status(400).json({
        message: "A friend with this Email, Phone, or Aadhaar number already exists.",
      });
    }

    if (experienceType === "Experienced" && (!experience || isNaN(experience))) {
      return res.status(400).json({
        message: "Experience is required when experience type is 'Experienced'.",
      });
    }

    const lastFourAadhaar = aadharNumber.slice(-4);
    const fullName = firstName;
    const dobParts = parsedDate.split("-");
    const dobFormatted = `${dobParts[0]}${dobParts[1]}${dobParts[2]}`;
    const uniqueCId = `${fullName}${dobFormatted}${lastFourAadhaar}`;

    const resumeFileName = req.file.filename;
    const fileUrl = `uploads/${resumeFileName}`;

    // Encrypt the Aadhaar number before saving
    const encryptedAadhaarNumber = encrypt(aadharNumber);

    const newResume = new AddFriendsResume({
      userId,
      CId: uniqueCId,
      firstName,
      surname,
      email,
      phone,
      location,
      aadharNumber: encryptedAadhaarNumber, // Save encrypted Aadhaar number
      dateOfBirth: parsedDate,
      yearOfPassing,
      highestQualification,
      specialization,
      experienceType,
      experience: experienceType === "Fresher" ? null : experience,
      skills: skills ? skills.split(",").map(skill => skill.trim()) : [],
      resumeFile: fileUrl,
    });

    await newResume.save();

    return res.status(200).json({
      message: "Resume uploaded successfully",
      data: newResume,
    });
  } catch (error) {
    console.error("Error uploading resume:", error);
    return res.status(500).json({ message: "Error uploading resume" });
  }
};



// ✅ Get All Resumes for a User
exports.getUserResumes = async (req, res) => {
  try {
    const { userId } = req.params;

    const resumes = await AddFriendsResume.find({ userId });

    // Decrypt Aadhaar numbers before sending the response
    resumes.forEach((resume) => {
      resume.aadharNumber = decrypt(resume.aadharNumber);
    });

    res.status(200).json(resumes);
  } catch (error) {
    console.error("Error retrieving resumes:", error);
    res.status(500).json({ message: "Error retrieving resumes" });
  }
};
// Get all resumes and decrypt aadhar number before responding
exports.getAllResumes = async (req, res) => {
  try {
    const resumes = await AddFriendsResume.find();
    console.log("Fetched resumes:", resumes); // Log fetched resumes

    const decryptedResumes = resumes.map((resume) => {
      const resumeObj = resume.toObject();
      if (resumeObj.aadharNumber) {
        try {
          resumeObj.aadharNumber = decrypt(resumeObj.aadharNumber);
        } catch (err) {
          console.error("Decryption failed for resume ID:", resumeObj._id, err);
          resumeObj.aadharNumber = "Decryption Error";
        }
      }
      return resumeObj;
    });

    res.status(200).json(decryptedResumes);
  } catch (error) {
    console.error("Error retrieving all resumes:", error);
    res.status(500).json({ message: "Error retrieving all resumes" });
  }
};

// ✅ Update Resume by ID
exports.updateResume = async (req, res) => {
  try {
    const resumeId = req.params.id;
    const updateData = req.body;

    // If a file was uploaded, store the file path
    if (req.file) {
      updateData.resumeFile = path.join("uploads", req.file.filename);
    }

    // Validation for phone number (must be exactly 10 digits)
    const phoneRegex = /^\d{10}$/;
    if (updateData.phone && !phoneRegex.test(updateData.phone)) {
      return res.status(400).json({ message: "Invalid phone number. It must be exactly 10 digits." });
    }

    // Validation for Aadhaar number (must be 12 digits, not starting with 0 or 1)
    const aadhaarRegex = /^[2-9]\d{11}$/;
    if (updateData.aadharNumber && !aadhaarRegex.test(updateData.aadharNumber)) {
      return res.status(400).json({ message: "Invalid Aadhaar number. It must be 12 digits and cannot start with 0 or 1." });
    }

    // Check if email, phone, or Aadhaar number already exists
    const existingRecord = await AddFriendsResume.findOne({
      _id: { $ne: resumeId }, // Exclude current record
      $or: [{ email: updateData.email }, { phone: updateData.phone }, { aadharNumber: updateData.aadharNumber }],
    });

    if (existingRecord) {
      return res.status(400).json({ message: "Email, Phone, or Aadhaar number already exists." });
    }

    // Encrypt the Aadhaar number if it's being updated
    if (updateData.aadharNumber) {
      updateData.aadharNumber = encrypt(updateData.aadharNumber);
    }

    // Update the resume in the database
    const updatedResume = await AddFriendsResume.findByIdAndUpdate(resumeId, updateData, { new: true });

    if (!updatedResume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Decrypt Aadhaar number before sending the response
    updatedResume.aadharNumber = decrypt(updatedResume.aadharNumber);

    res.json(updatedResume);
  } catch (error) {
    console.error("Error updating resume:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Delete Resume by ID
exports.deleteResume = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedResume = await AddFriendsResume.findByIdAndDelete(id);
    if (!deletedResume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    res.status(200).json({ message: "Resume deleted successfully" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({ message: "Error deleting resume" });
  }
};