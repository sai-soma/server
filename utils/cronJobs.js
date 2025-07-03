// utils/cronJobs.js
const cron = require("node-cron");
const User = require("../models/User");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to clean up expired unverified users
const cleanupExpiredUsers = async () => {
  try {
    console.log("🧹 Starting cleanup of expired unverified users...");

    const result = await User.cleanupExpiredUsers();

    if (result.deletedCount > 0) {
      console.log(`✅ Successfully deleted ${result.deletedCount} expired unverified users`);
    } else {
      console.log("✅ No expired unverified users found - database is clean");
    }

    return result;
  } catch (error) {
    console.error("❌ Error during user cleanup:", error);
    throw error;
  }
};

// Function to send reminder emails to ALL unverified users (every 6 hours)
const sendRegularReminders = async () => {
  try {
    console.log("📧 Sending regular reminders to all unverified users...");

    // Get all unverified users whose verification hasn't expired yet
    const unverifiedUsers = await User.find({
      isVerified: false,
      verificationTokenExpires: { $gt: new Date() },
      authType: "email", // Only send to email users
    });

    if (unverifiedUsers.length > 0) {
      console.log(`📬 Found ${unverifiedUsers.length} unverified users for regular reminders`);

      for (const user of unverifiedUsers) {
        const verificationToken = user.verificationToken;
        const verificationURL = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}&email=${user.email}`;

        // Calculate time remaining
        const timeRemaining = Math.ceil((user.verificationTokenExpires - new Date()) / (1000 * 60 * 60)); // hours

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: "📧 Regular Reminder: Please Verify Your Email (REFER & EARN)",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>🔔 Regular Reminder: Verify Your Email</h2>
              <p>Hi ${user.fullName},</p>
              <p>This is a friendly reminder to verify your email address. Your verification link will expire in approximately <strong>${timeRemaining} hours</strong>.</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${verificationURL}" 
                   style="background-color: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Verify Email Address Now
                </a>
              </div>
              <p><strong>Why verify?</strong></p>
              <ul>
                <li>✅ Activate your account fully</li>
                <li>✅ Access all platform features</li>
                <li>✅ Start earning through referrals</li>
                <li>✅ Secure your account</li>
              </ul>
              <p><strong>Note:</strong> If you do not verify your email before the link expires, your account will be permanently deleted and you will need to sign up again.</p>
              <p>If the button doesn't work, copy and paste this link: ${verificationURL}</p>
              <hr style="margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">You're receiving this because you signed up for REFER & EARN but haven't verified your email yet. We send these reminders every 6 hours to help you complete your registration.</p>
              <h4>Thanks & Regards,</h4>
              <h3>REFER & EARN Team</h3>
            </div>
          `,
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`✅ Regular reminder sent to ${user.email} (${timeRemaining}h remaining)`);
        } catch (err) {
          console.error(`❌ Failed to send regular reminder to ${user.email}:`, err);
        }
      }
    } else {
      console.log("📬 No unverified users found for regular reminders");
    }

    return unverifiedUsers;
  } catch (error) {
    console.error("❌ Error sending regular reminders:", error);
    throw error;
  }
};

// Function to send URGENT reminder emails to users about to expire (2 hours before)
const sendUrgentExpiryReminders = async () => {
  try {
    console.log("🚨 Checking for users who need URGENT expiry reminders...");

    const usersAboutToExpire = await User.findUsersAboutToExpire(2); // expires in 2 hours

    if (usersAboutToExpire.length > 0) {
      console.log(`🚨 Found ${usersAboutToExpire.length} users who need URGENT reminder emails`);

      for (const user of usersAboutToExpire) {
        const verificationToken = user.verificationToken;
        const verificationURL = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}&email=${user.email}`;

        // Calculate exact time remaining
        const timeRemainingMs = user.verificationTokenExpires - new Date();
        const timeRemainingMinutes = Math.ceil(timeRemainingMs / (1000 * 60));

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: "🚨 URGENT: Your Email Verification Expires Soon! (REFER & EARN)",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 3px solid #ff4444; padding: 20px;">
              <h2 style="color: #ff4444;">🚨 URGENT: Email Verification Expires Soon!</h2>
              <p>Hi ${user.fullName},</p>
              <div style="background-color: #ffe6e6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0; font-weight: bold; color: #cc0000;">
                  ⏰ Your email verification link will expire in approximately <strong>${timeRemainingMinutes} minutes</strong>!
                </p>
              </div>
              <p><strong>This is your FINAL reminder!</strong> Please verify your email immediately to avoid losing your account.</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${verificationURL}" 
                   style="background-color: #ff4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  🚨 VERIFY NOW - URGENT! 🚨
                </a>
              </div>
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0; font-weight: bold; color: #856404;">
                  ⚠️ <strong>What happens if you don't verify?</strong><br>
                  Your account will be permanently deleted and you'll need to register again from scratch.
                </p>
              </div>
              <p>If the button doesn't work, copy and paste this link immediately: ${verificationURL}</p>
              <hr style="margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">This is an urgent notification sent 2 hours before your verification expires.</p>
              <h4>Thanks & Regards,</h4>
              <h3>REFER & EARN Team</h3>
            </div>
          `,
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`🚨 URGENT reminder sent to ${user.email} (${timeRemainingMinutes} minutes remaining)`);
        } catch (err) {
          console.error(`❌ Failed to send urgent reminder to ${user.email}:`, err);
        }
      }
    } else {
      console.log("🚨 No users need urgent expiry reminders at this time");
    }

    return usersAboutToExpire;
  } catch (error) {
    console.error("❌ Error checking urgent expiry reminders:", error);
    throw error;
  }
};

// Function to log user statistics
const logUserStats = async () => {
  try {
    const stats = await User.getUserStats();

    // Additional stats for unverified users
    const unverifiedStats = await User.aggregate([
      {
        $match: {
          isVerified: false,
          verificationTokenExpires: { $gt: new Date() },
        },
      },
      {
        $group: {
          _id: null,
          activeUnverified: { $sum: 1 },
          aboutToExpire: {
            $sum: {
              $cond: [{ $lte: ["$verificationTokenExpires", new Date(Date.now() + 2 * 60 * 60 * 1000)] }, 1, 0],
            },
          },
        },
      },
    ]);

    const extendedStats = {
      ...stats,
      activeUnverified: unverifiedStats[0]?.activeUnverified || 0,
      aboutToExpire: unverifiedStats[0]?.aboutToExpire || 0,
    };

    console.log("📊 User Statistics:", {
      total: extendedStats.totalUsers,
      verified: extendedStats.verifiedUsers,
      unverified: extendedStats.unverifiedUsers,
      activeUnverified: extendedStats.activeUnverified,
      aboutToExpire: extendedStats.aboutToExpire,
      google: extendedStats.googleUsers,
      email: extendedStats.emailUsers,
      admin: extendedStats.adminUsers,
    });

    return extendedStats;
  } catch (error) {
    console.error("❌ Error getting user stats:", error);
    throw error;
  }
};

// Main function to start all cron jobs
const startUserCleanup = () => {
  console.log("🚀 Initializing enhanced user management cron jobs...");

  // Cleanup expired users every 6 hours (more frequent cleanup)
  cron.schedule("0 */6 * * *", async () => {
    console.log("\n🕛 Running user cleanup every 6 hours...");
    await cleanupExpiredUsers();
  });

  // Send regular reminders to ALL unverified users every 6 hours (4 times daily)
  cron.schedule("0 */6 * * *", async () => {
    console.log("\n📧 Running regular reminder campaign (every 6 hours)...");
    await sendRegularReminders();
  });

  // Check for urgent expiry reminders every hour (to catch 2-hour window)
  cron.schedule("0 * * * *", async () => {
    console.log("\n🚨 Checking for urgent expiry reminders (hourly check)...");
    await sendUrgentExpiryReminders();
  });

  // Log user statistics daily at 6:00 PM
  cron.schedule("0 18 * * *", async () => {
    console.log("\n📊 Logging daily user statistics...");
    await logUserStats();
  });

  console.log("✅ Enhanced user management cron jobs started successfully!");
  console.log("📋 Scheduled tasks:");
  console.log("   - User cleanup: Every day at 12:00 AM");
  console.log("   - Regular reminders: Every 6 hours (4 times daily)");
  console.log("   - Urgent reminders: Every hour (for 2-hour expiry window)");
  console.log("   - Statistics: Every day at 6:00 PM");
};

// Function to run cleanup immediately (for testing or manual execution)
const runImmediateCleanup = async () => {
  console.log("🔧 Running immediate user management tasks...");
  try {
    await cleanupExpiredUsers();
    await sendRegularReminders();
    await sendUrgentExpiryReminders();
    await logUserStats();
    console.log("✅ Immediate tasks completed successfully");
  } catch (error) {
    console.error("❌ Immediate tasks failed:", error);
    throw error;
  }
};

// Function to test reminder systems
const testReminderSystems = async () => {
  console.log("🧪 Testing reminder systems...");
  try {
    console.log("\n1. Testing regular reminders...");
    const regularResults = await sendRegularReminders();

    console.log("\n2. Testing urgent reminders...");
    const urgentResults = await sendUrgentExpiryReminders();

    console.log("\n3. Getting current stats...");
    await logUserStats();

    console.log("\n✅ Reminder system test completed");
    return { regularResults, urgentResults };
  } catch (error) {
    console.error("❌ Reminder system test failed:", error);
    throw error;
  }
};

// Function to stop all cron jobs (if needed)
const stopAllCronJobs = () => {
  cron.getTasks().forEach((task, name) => {
    task.stop();
    console.log(`⏹️ Stopped cron job: ${name}`);
  });
  console.log("🛑 All cron jobs stopped");
};

module.exports = {
  startUserCleanup,
  cleanupExpiredUsers,
  sendRegularReminders,
  sendUrgentExpiryReminders,
  logUserStats,
  runImmediateCleanup,
  testReminderSystems,
  stopAllCronJobs,

  // Backward compatibility (keeping old function name)
  sendExpiryReminders: sendUrgentExpiryReminders,
};
