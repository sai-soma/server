const nodemailer = require('nodemailer');
require('dotenv').config(); // To load .env file

// Create a transporter using your email credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Use 'gmail' or any other email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,  // App Password from Google
  },
});

// Setup email options
const mailOptions = {
  from: process.env.EMAIL_USER,
  to: process.env.EMAIL_USER,  // Send the email to your own address for testing
  subject: 'Test Email from Node.js',
  text: 'This is a test email to check if the credentials are working.',
};

// Send email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
   //console.log('Error:', error);
  } else {
   //console.log('Email sent:', info.response);
  }
});
