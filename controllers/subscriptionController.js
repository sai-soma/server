const Subscription = require("../models/Subscription");

const subscribeUser = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  try {
    const existingUser = await Subscription.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already subscribed." });
    }

    const newSubscription = new Subscription({ email });
    await newSubscription.save();
    res.status(201).json({ success: true, message: "Subscription successful!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};



module.exports = { subscribeUser };
