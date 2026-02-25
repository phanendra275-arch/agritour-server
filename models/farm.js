const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  farmer_id:                   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:                        { type: String, required: true, trim: true },
  description:                 { type: String, default: null },
  location:                    { type: String, required: true },
  price_per_visitor:           { type: Number, required: true, min: 0 },
  daily_capacity:              { type: Number, required: true, min: 1 },
  seasonal_availability_start: { type: String, default: null },
  seasonal_availability_end:   { type: String, default: null },
  image_url:                   { type: String, default: null },
  pre_visit_orientation:       { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Farm', farmSchema);