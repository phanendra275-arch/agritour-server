const express = require('express');
const { body, validationResult } = require('express-validator');
const Farm = require('../models/Farm');
const Booking = require('../models/Booking');
const { authenticateToken, requireRole, requireOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all farms (public)
router.get('/', async (req, res) => {
  try {
    const { search, location } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
    if (location) filter.location = { $regex: location, $options: 'i' };

    const farms = await Farm.find(filter)
      .populate('farmer_id', 'username full_name phone')
      .sort({ created_at: -1 });

    const result = farms.map(f => ({
      ...f.toObject(),
      id: f._id,
      farmer_username: f.farmer_id?.username,
      farmer_name: f.farmer_id?.full_name,
      farmer_phone: f.farmer_id?.phone,
    }));

    res.json({ farms: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get farmer's own farms
router.get('/farmer/my-farms', authenticateToken, requireRole('farmer'), async (req, res) => {
  try {
    const farms = await Farm.find({ farmer_id: req.user.id }).sort({ created_at: -1 });
    const result = await Promise.all(farms.map(async (f) => {
      const total_bookings = await Booking.countDocuments({
        farm_id: f._id, status: { $ne: 'cancelled' }
      });
      return { ...f.toObject(), id: f._id, total_bookings };
    }));
    res.json({ farms: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single farm
router.get('/:id', async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id)
      .populate('farmer_id', 'username full_name phone');
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    res.json({
      farm: {
        ...farm.toObject(),
        id: farm._id,
        farmer_username: farm.farmer_id?.username,
        farmer_name: farm.farmer_id?.full_name,
        farmer_phone: farm.farmer_id?.phone,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create farm
router.post('/', authenticateToken, requireRole('farmer'), [
  body('name').trim().notEmpty(),
  body('location').trim().notEmpty(),
  body('price_per_visitor').isFloat({ min: 0 }),
  body('daily_capacity').isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const farm = await Farm.create({ ...req.body, farmer_id: req.user.id });
    res.status(201).json({
      message: 'Farm created successfully',
      farm: { ...farm.toObject(), id: farm._id }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update farm
router.put('/:id', authenticateToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const farm = await Farm.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    res.json({
      message: 'Farm updated successfully',
      farm: { ...farm.toObject(), id: farm._id }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete farm
router.delete('/:id', authenticateToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const farm = await Farm.findByIdAndDelete(req.params.id);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    res.json({ message: 'Farm deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;