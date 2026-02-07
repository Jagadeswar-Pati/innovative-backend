import dotenv from 'dotenv';
import connectDB from './config/db.js';
import app from './app.js';

dotenv.config();
connectDB();

// Create default admin if ADMIN_EMAIL and ADMIN_PASSWORD are provided
import Admin from './models/Admin.model.js';
const ensureAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminRole = process.env.ADMIN_ROLE || 'admin';
    const adminIsActive = process.env.ADMIN_IS_ACTIVE
      ? process.env.ADMIN_IS_ACTIVE.toLowerCase() === 'true'
      : true;
    if (adminEmail && adminPassword) {
      const existing = await Admin.findOne({ email: adminEmail.toLowerCase() });
      if (!existing) {
        await Admin.create({
          email: adminEmail.toLowerCase(),
          password: adminPassword,
          role: adminRole,
          isActive: adminIsActive
        });
        console.log('Default admin created');
      }
    }
  } catch (err) {
    console.error('Failed to ensure admin:', err.message || err);
  }
};
ensureAdmin();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`)
);