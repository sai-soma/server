const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    image: String,
    review: String,
    rating: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
