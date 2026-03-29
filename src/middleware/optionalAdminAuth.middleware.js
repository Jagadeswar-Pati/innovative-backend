/**
 * Optional admin auth: does not reject when missing or invalid token.
 * Sets req.admin only when Authorization header contains a valid admin JWT.
 * Used on GET /api/products so admin can request all data with ?all=1.
 */
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.model.js';

export default async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findOne({ email: decoded.email }).select('-password');
    if (admin) {
      req.admin = {
        id: admin._id.toString(),
        name: admin.email.split('@')[0],
        email: admin.email,
        role: admin.role || 'admin',
      };
    }
  } catch {
    // ignore invalid token
  }
  next();
};
