const mongoose = require("mongoose");
 
const BankDetailsSchema = new mongoose.Schema({
  accountHolderName: {
    type: String,
    required: true,
    sparse: true,
    match: [/^[A-Za-z\s]{3,50}$/, "Invalid account holder name. Only letters and spaces allowed."],
  },
  bankName: {
    type: String,
    required: true,
    sparse: true,
    match: [/^[A-Za-z\s]{3,50}$/, "Invalid bank name. Only letters and spaces allowed."],
  },
  accountNumber: {
    type: String,
    required: false,
    sparse: true, // Ensures that MongoDB won't enforce uniqueness on null or missing values
    match: [/^\d{9,18}$/, "Account number must be 9 to 18 digits."],
  },
  ifscCode: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
    match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code. Format should be like: HDFC0123456"],
  },
  branchName: {
    type: String,
    required: true,
    sparse: true,
    match: [/^[A-Za-z0-9\s]{3,50}$/, "Invalid branch name. Only letters, numbers and spaces allowed."],
  },
  upiId: {
    type: String,
    default: "",
    unique: true,
    sparse: true,
    match: [/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, "Invalid UPI ID format."],
  },
  phonepeNumber: {
    type: String,
    default: "",
    unique: true,
    sparse: true,
    match: [/^[6-9]\d{9}$/, "Invalid PhonePe number. Should be a 10-digit Indian mobile number starting with 6-9."],
  },
});
 
const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: "" },
    googleId: { type: String, unique: true, sparse: true },
    resumes: { type: String, default: null, trim: true },
    walletBalance: { type: Number, default: 0 },
    referredCandidates: { type: [String], default: [] },
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: String, default: null },
    highestQualification: { type: String, default: "" },
    specialization: { type: String, default: "" },
    experienceLevel: {
      type: String,
      enum: ["Fresher", "Experienced"],
      default: "Fresher",
    },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpires: Date,
    totalYearsOfExperience: { type: Number, default: 0 },
    dateOfBirth: {
      type: Date,
      get: (val) => val?.toISOString().split("T")[0],
      set: (val) => {
        if (!val) return val;
        return new Date(new Date(val).toISOString().split("T")[0]); // only the date part
      }
    },
    skills: { type: [String], default: [] },
    aadhaarNumber: { type: String, unique: true, sparse: true },
    bankDetails: {
      type: [BankDetailsSchema],
      default: [],
      required: false
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    isPrimaryAdmin: {
      type: Boolean,
      default: false,
    },
    profilePic: {
      type: String,
      default: "",
    },
    authType: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
    },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// ================================================================
// INDEXES FOR PERFORMANCE AND AUTOMATIC CLEANUP
// ================================================================

// TTL Index for automatic cleanup of unverified users
// This will automatically delete documents where:
// 1. isVerified is false
// 2. verificationTokenExpires date has passed
UserSchema.index(
  { verificationTokenExpires: 1 }, 
  { 
    expireAfterSeconds: 0,
    partialFilterExpression: { isVerified: false },
    name: 'ttl_unverified_users'
  }
);

// Additional indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ userId: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ isVerified: 1 });
UserSchema.index({ role: 1 });

// Compound index for cleanup queries
UserSchema.index({ 
  isVerified: 1, 
  verificationTokenExpires: 1 
});

// ================================================================
// MIDDLEWARE FOR ADDITIONAL VALIDATION
// ================================================================

// Pre-save middleware to ensure data consistency
UserSchema.pre('save', function(next) {
  // If this is a new user and no verification token is set, create one
  if (this.isNew && !this.verificationToken && this.authType === 'email') {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  }
  
  // Ensure verified users don't have verification tokens
  if (this.isVerified) {
    this.verificationToken = undefined;
    this.verificationTokenExpires = undefined;
  }
  
  next();
});

// ================================================================
// STATIC METHODS FOR USER MANAGEMENT
// ================================================================

// Static method to clean up expired users manually
UserSchema.statics.cleanupExpiredUsers = async function() {
  try {
    const result = await this.deleteMany({
      isVerified: false,
      verificationTokenExpires: { $lt: new Date() }
    });
    
    console.log(`🧹 Cleanup completed: ${result.deletedCount} expired users removed`);
    return result;
  } catch (error) {
    console.error('❌ Error during user cleanup:', error);
    throw error;
  }
};

// Static method to find users about to expire (for notifications)
UserSchema.statics.findUsersAboutToExpire = async function(hoursBeforeExpiry = 2) {
  const expiryThreshold = new Date(Date.now() + hoursBeforeExpiry * 60 * 60 * 1000);
  
  return await this.find({
    isVerified: false,
    verificationTokenExpires: { 
      $gte: new Date(), 
      $lte: expiryThreshold 
    }
  });
};

// Static method to get user statistics
UserSchema.statics.getUserStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: {
            $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
          },
          unverifiedUsers: {
            $sum: { $cond: [{ $eq: ['$isVerified', false] }, 1, 0] }
          },
          googleUsers: {
            $sum: { $cond: [{ $eq: ['$authType', 'google'] }, 1, 0] }
          },
          emailUsers: {
            $sum: { $cond: [{ $eq: ['$authType', 'email'] }, 1, 0] }
          },
          adminUsers: {
            $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
          }
        }
      }
    ]);
    
    return stats[0] || {
      totalUsers: 0,
      verifiedUsers: 0,
      unverifiedUsers: 0,
      googleUsers: 0,
      emailUsers: 0,
      adminUsers: 0
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
};

// ================================================================
// INSTANCE METHODS
// ================================================================

// Method to check if user verification is about to expire
UserSchema.methods.isVerificationAboutToExpire = function(hoursBeforeExpiry = 2) {
  if (this.isVerified || !this.verificationTokenExpires) return false;
  
  const expiryThreshold = new Date(Date.now() + hoursBeforeExpiry * 60 * 60 * 1000);
  return this.verificationTokenExpires <= expiryThreshold;
};

// Method to extend verification token expiry
UserSchema.methods.extendVerificationExpiry = function(additionalHours = 24) {
  if (!this.isVerified && this.verificationTokenExpires) {
    this.verificationTokenExpires = new Date(Date.now() + additionalHours * 60 * 60 * 1000);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to safely delete user data (for GDPR compliance)
UserSchema.methods.anonymizeUser = function() {
  this.fullName = 'Deleted User';
  this.email = `deleted_${this._id}@deleted.com`;
  this.phone = '';
  this.aadhaarNumber = undefined;
  this.bankDetails = [];
  this.skills = [];
  this.resumes = null;
  this.profilePic = '';
  return this.save();
};

// ================================================================
// VIRTUAL PROPERTIES
// ================================================================

// Virtual for user's full profile completion percentage
UserSchema.virtual('profileCompletionPercentage').get(function() {
  let completedFields = 0;
  const totalFields = 10;
  
  if (this.fullName) completedFields++;
  if (this.email) completedFields++;
  if (this.phone) completedFields++;
  if (this.dateOfBirth) completedFields++;
  if (this.highestQualification) completedFields++;
  if (this.specialization) completedFields++;
  if (this.skills && this.skills.length > 0) completedFields++;
  if (this.profilePic) completedFields++;
  if (this.experienceLevel) completedFields++;
  if (this.totalYearsOfExperience >= 0) completedFields++;
  
  return Math.round((completedFields / totalFields) * 100);
});

// Virtual for user's verification status text
UserSchema.virtual('verificationStatusText').get(function() {
  if (this.isVerified) return 'Verified';
  if (!this.verificationTokenExpires) return 'Not Applicable';
  if (this.verificationTokenExpires < new Date()) return 'Expired';
  return 'Pending Verification';
});

module.exports = mongoose.model("User", UserSchema);