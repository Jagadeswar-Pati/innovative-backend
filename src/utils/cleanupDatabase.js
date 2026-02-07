import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import Admin from '../models/Admin.model.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';
import Cart from '../models/Cart.model.js';
import Review from '../models/Review.model.js';
import Notification from '../models/Notification.model.js';
import Payment from '../models/Payment.model.js';
import NotificationLog from '../models/NotificationLog.model.js';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

const cleanupDatabase = async () => {
  try {
    console.log('Starting database cleanup...');

    // Drop all documents to remove dummy data (keep collections intact)
    await Admin.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Review.deleteMany({});
    await Notification.deleteMany({});
    await NotificationLog.deleteMany({});
    await Payment.deleteMany({});

    console.log('All dummy data removed successfully');

    // Create default admin if it doesn't exist
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@innovativehub.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminRole = process.env.ADMIN_ROLE || 'admin';
    const adminIsActive = process.env.ADMIN_IS_ACTIVE
      ? process.env.ADMIN_IS_ACTIVE.toLowerCase() === 'true'
      : true;

    await Admin.create({
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      role: adminRole,
      isActive: adminIsActive
    });
    console.log('Default admin account created');

    console.log('Database cleanup completed successfully');
  } catch (error) {
    console.error('Database cleanup failed:', error.message);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

// Run cleanup if this script is executed directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('cleanupDatabase.js')) {
  connectDB().then(cleanupDatabase);
}

export { cleanupDatabase };