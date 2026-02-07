import express from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from '../controllers/profile.controller.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.get('/', userAuth, getProfile);
router.put('/', userAuth, updateProfile);
router.put('/change-password', userAuth, changePassword);
router.post('/addresses', userAuth, addAddress);
router.put('/addresses/:addressId', userAuth, updateAddress);
router.delete('/addresses/:addressId', userAuth, deleteAddress);
router.put('/addresses/:addressId/default', userAuth, setDefaultAddress);

export default router;
