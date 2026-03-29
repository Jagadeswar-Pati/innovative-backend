import User from '../models/User.model.js';
import bcryptjs from 'bcryptjs';
import { normalizeIndianMobile, isValidIndianMobile10 } from '../utils/mobileOtp.util.js';

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { name, mobile } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name != null && String(name).trim() !== '') {
      user.name = String(name).trim();
    }

    if (mobile !== undefined && mobile !== null) {
      const trimmed = String(mobile || '').trim();
      if (trimmed) {
        const n = normalizeIndianMobile(trimmed);
        if (!isValidIndianMobile10(n)) {
          return res.status(400).json({
            success: false,
            message: 'Enter a correct 10-digit Indian mobile. Wrong numbers can affect delivery and refunds.',
          });
        }
        const dup = await User.findOne({ mobile: n, _id: { $ne: user._id } });
        if (dup) {
          return res.status(409).json({ success: false, message: 'This mobile number is already in use.' });
        }
        user.mobile = n;
        user.mobileVerified = false;
      }
    }

    await user.save();

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      mobileVerified: user.mobileVerified === true,
      profileImage: user.profileImage,
      addresses: user.addresses,
    };
    res.json({ success: true, data: userResponse });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    const user = await User.findById(req.user._id);
    if (!user?.password) {
      return res.status(400).json({
        success: false,
        message: 'No password is set for this account. Sign in with Google or use Forgot password to set one.',
      });
    }
    const isMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
};

// Add address
export const addAddress = async (req, res) => {
  try {
    const address = req.body;
    const user = await User.findById(req.user._id);
    user.addresses.push(address);
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error adding address' });
  }
};

// Update address (use .id() which accepts string or ObjectId)
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(addressId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
    Object.assign(addr, updates);
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating address' });
  }
};

// Delete address (remove from DB; compare _id as string so filter matches)
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);
    user.addresses = user.addresses.filter((addr) => String(addr._id) !== String(addressId));
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting address' });
  }
};

// Set default address (compare _id as string so correct address is set)
export const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);
    user.addresses.forEach((addr) => {
      addr.isDefault = String(addr._id) === String(addressId);
    });
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error setting default address' });
  }
};