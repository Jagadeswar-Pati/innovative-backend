import express from 'express';
import {
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  updateTracking,
  getOrderById,
  createOrder,
  getMyOrders,
} from '../controllers/order.controller.js';

import userAuth from '../middleware/userAuth.middleware.js';
import adminAuth from '../middleware/adminAuth.middleware.js';
import adminOrUserAuth from '../middleware/adminOrUserAuth.middleware.js';

const router = express.Router();

// User-wise order APIs (must come before :id)
router.post('/create', userAuth, createOrder);
router.get('/my-orders', userAuth, getMyOrders);

// Admin APIs
router.get('/', adminAuth, getAllOrders);
router.patch('/:id/status', adminAuth, updateOrderStatus);
router.patch('/:id/payment-status', adminAuth, updatePaymentStatus);
router.patch('/:id/tracking', adminAuth, updateTracking);

// Admin or user can view specific order
router.get('/:id', adminOrUserAuth, getOrderById);

export default router;
