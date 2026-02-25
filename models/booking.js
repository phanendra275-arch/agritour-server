const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tourist_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farm_id:            { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  booking_date:       { type: String, required: true },
  number_of_visitors: { type: Number, required: true, min: 1 },
  total_price:        { type: Number, required: true },
  status:             { type: String, enum: ['requested','confirmed','completed','cancelled'], default: 'requested' },
  notes:              { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Booking', bookingSchema);