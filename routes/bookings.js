const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Farm = require('../models/Farm');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Check availability
router.get('/availability/:farmId', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    const farm = await Farm.findById(req.params.farmId);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const bookings = await Booking.find({
      farm_id: req.params.farmId,
      booking_date: date,
      status: { $in: ['requested', 'confirmed'] }
    });

    const booked = bookings.reduce((sum, b) => sum + b.number_of_visitors, 0);
    const available = Math.max(0, farm.daily_capacity - booked);

    res.json({
      date,
      total_capacity: farm.daily_capacity,
      booked_visitors: booked,
      available_capacity: available
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tourist bookings
router.get('/tourist/my-bookings', authenticateToken, requireRole('tourist'), async (req, res) => {
  try {
    const bookings = await Booking.find({ tourist_id: req.user.id })
      .populate({
        path: 'farm_id',
        select: 'name location image_url farmer_id',
        populate: { path: 'farmer_id', select: 'username full_name' }
      })
      .sort({ booking_date: -1 });

    const result = bookings.map(b => ({
      ...b.toObject(),
      id: b._id,
      farm_name: b.farm_id?.name,
      farm_location: b.farm_id?.location,
      farm_image: b.farm_id?.image_url,
      farmer_username: b.farm_id?.farmer_id?.username,
      farmer_name: b.farm_id?.farmer_id?.full_name,
    }));

    res.json({ bookings: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get farmer bookings
router.get('/farmer/my-farm-bookings', authenticateToken, requireRole('farmer'), async (req, res) => {
  try {
    const farms = await Farm.find({ farmer_id: req.user.id });
    const farmIds = farms.map(f => f._id);

    const bookings = await Booking.find({ farm_id: { $in: farmIds } })
      .populate('farm_id', 'name location')
      .populate('tourist_id', 'username full_name email phone')
      .sort({ booking_date: -1 });

    const result = bookings.map(b => ({
      ...b.toObject(),
      id: b._id,
      farm_name: b.farm_id?.name,
      farm_location: b.farm_id?.location,
      tourist_username: b.tourist_id?.username,
      tourist_name: b.tourist_id?.full_name,
      tourist_email: b.tourist_id?.email,
      tourist_phone: b.tourist_id?.phone,
    }));

    res.json({ bookings: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking
router.post('/', authenticateToken, requireRole('tourist'), [
  body('farm_id').notEmpty(),
  body('booking_date').notEmpty(),
  body('number_of_visitors').isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { farm_id, booking_date, number_of_visitors, notes } = req.body;

    const farm = await Farm.findById(farm_id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    // Check availability
    const existingBookings = await Booking.find({
      farm_id, booking_date,
      status: { $in: ['requested', 'confirmed'] }
    });
    const booked = existingBookings.reduce((sum, b) => sum + b.number_of_visitors, 0);
    const available = farm.daily_capacity - booked;

    if (number_of_visitors > available) {
      return res.status(400).json({
        error: `Only ${available} visitor(s) available for this date`
      });
    }

    // Check past date
    const bookingDate = new Date(booking_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ error: 'Cannot book for past dates' });
    }

    // Check seasonal availability
    if (farm.seasonal_availability_start && farm.seasonal_availability_end) {
      const start = new Date(farm.seasonal_availability_start);
      const end = new Date(farm.seasonal_availability_end);
      if (bookingDate < start || bookingDate > end) {
        return res.status(400).json({
          error: `Farm available from ${farm.seasonal_availability_start} to ${farm.seasonal_availability_end}`
        });
      }
    }

    const total_price = farm.price_per_visitor * number_of_visitors;
    const booking = await Booking.create({
      tourist_id: req.user.id,
      farm_id, booking_date,
      number_of_visitors,
      total_price,
      notes: notes || null,
      status: 'requested'
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        ...booking.toObject(),
        id: booking._id,
        farm_name: farm.name,
        farm_location: farm.location
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
router.patch('/:id/status', authenticateToken, [
  body('status').isIn(['requested', 'confirmed', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const booking = await Booking.findById(req.params.id)
      .populate('farm_id', 'farmer_id');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isFarmer  = req.user.role === 'farmer' &&
        booking.farm_id?.farmer_id?.toString() === req.user.id;
    const isTourist = req.user.role === 'tourist' &&
        booking.tourist_id.toString() === req.user.id;
    const isAdmin   = req.user.role === 'admin';

    if (!isFarmer && !isTourist && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'tourist' && req.body.status !== 'cancelled') {
      return res.status(403).json({ error: 'Tourists can only cancel bookings' });
    }

    booking.status = req.body.status;
    await booking.save();

    res.json({
      message: 'Booking status updated',
      booking: { ...booking.toObject(), id: booking._id }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single booking
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('tourist_id', 'username full_name');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const farm = await Farm.findById(booking.farm_id)
      .populate('farmer_id', 'username full_name phone');

    res.json({
      booking: {
        ...booking.toObject(),
        id: booking._id,
        farm_id: farm._id,
        farm_name: farm.name,
        farm_location: farm.location,
        pre_visit_orientation: farm.pre_visit_orientation,
        farmer_name: farm.farmer_id?.full_name,
        farmer_phone: farm.farmer_id?.phone,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;