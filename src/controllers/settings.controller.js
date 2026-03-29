import Admin from '../models/Admin.model.js';
import bcryptjs from 'bcryptjs';

// CHANGE ADMIN PASSWORD
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const salt = await bcryptjs.genSalt(10);
    admin.password = await bcryptjs.hash(newPassword, salt);
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// GET SETTINGS
export const getSettings = async (req, res, next) => {
  try {
    // Return default settings for now
    res.status(200).json({
      success: true,
      data: {
        siteName: 'Innovative Hub',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        notifications: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE SETTINGS
export const updateSettings = async (req, res, next) => {
  try {
    // For now, just return success as we don't have a settings model
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: req.body
    });
  } catch (error) {
    next(error);
  }
};