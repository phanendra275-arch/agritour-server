const express = require('express');
const User = require('../models/User');
const Farm = require('../models/Farm');
const Booking = require('../models/Booking');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ created_at: -1 });
    res.json({ users: users.map(u => ({ ...u.toObject(), id: u._id })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all farms
router.get('/farms', async (req, res) => {
  try {
    const farms = await Farm.find()
      .populate('farmer_id', 'username full_name email')
      .sort({ created_at: -1 });

    const result = farms.map(f => ({
      ...f.toObject(),
      id: f._id,
      farmer_username: f.farmer_id?.username,
      farmer_name: f.farmer_id?.full_name,
    }));
    res.json({ farms: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate({
        path: 'farm_id',
        select: 'name location farmer_id',
        populate: { path: 'farmer_id', select: 'username full_name' }
      })
      .populate('tourist_id', 'username full_name email')
      .sort({ created_at: -1 });

    const result = bookings.map(b => ({
      ...b.toObject(),
      id: b._id,
      farm_name: b.farm_id?.name,
      farm_location: b.farm_id?.location,
      tourist_username: b.tourist_id?.username,
      tourist_name: b.tourist_id?.full_name,
      farmer_username: b.farm_id?.farmer_id?.username,
      farmer_name: b.farm_id?.farmer_id?.full_name,
    }));
    res.json({ bookings: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } }
    ]);

    const total_farms = await Farm.countDocuments();

    const bookingsByStatus = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);

    const revenueResult = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$total_price' } } }
    ]);
    const total_revenue = revenueResult[0]?.total || 0;

    const recentBookings = await Booking.find()
      .populate('farm_id', 'name')
      .populate('tourist_id', 'username')
      .sort({ created_at: -1 })
      .limit(10);

    const recent = recentBookings.map(b => ({
      ...b.toObject(),
      id: b._id,
      farm_name: b.farm_id?.name,
      tourist_username: b.tourist_id?.username,
    }));

    res.json({
      stats: {
        users_by_role: usersByRole,
        total_farms,
        bookings_by_status: bookingsByStatus,
        total_revenue,
        recent_bookings: recent,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;