import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.model.js';
import User from '../models/User.model.js';

const adminOrUserAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (decoded?.email) {
      const admin = await Admin.findOne({ email: decoded.email }).select('-password');
      if (!admin) return res.status(401).json({ success: false, message: 'Invalid token' });
      req.admin = {
        id: admin._id.toString(),
        name: admin.email.split('@')[0],
        email: admin.email,
        role: admin.role || 'admin',
      };
      req.isAdmin = true;
      return next();
    }

    if (decoded?.id) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });
      req.user = user;
      req.userId = decoded.id;
      req.isAdmin = false;
      return next();
    }

    return res.status(401).json({ success: false, message: 'Invalid token' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

export default adminOrUserAuth;
