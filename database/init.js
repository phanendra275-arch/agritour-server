const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/agritour';

const initializeDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Atlas');
    await createDefaultAdmin();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

const createDefaultAdmin = async () => {
  const User = require('../models/User');
  const existing = await User.findOne({ username: 'admin' });
  if (!existing) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      email: 'admin@agrotourism.com',
      password: hashedPassword,
      role: 'admin',
      full_name: 'System Administrator'
    });
    console.log('Default admin created (username: admin, password: admin123)');
  }
};

module.exports = { initializeDatabase };