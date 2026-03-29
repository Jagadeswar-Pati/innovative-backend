import express from 'express';
import {
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  updateTracking,
  updateDeliveryPlatform,
  getOrderById,
  getProductSales,
  createOrder,
  getMyOrders,
  generateInvoiceForOrder,
  streamOrderInvoice,
  deleteOrder,
} from '../controllers/order.controller.js';

import userAuth from '../middleware/userAuth.middleware.js';
import adminAuth from '../middleware/adminAuth.middleware.js';
import adminOrUserAuth from '../middleware/adminOrUserAuth.middleware.js';

const router = express.Router();

// User-wise order APIs (must come before :id)
router.post('/create', userAuth, createOrder);
router.get('/my-orders', userAuth, getMyOrders);
router.post('/:id/generate-invoice', userAuth, generateInvoiceForOrder);
router.get('/:id/invoice', adminOrUserAuth, streamOrderInvoice);

// Admin APIs
router.get('/', adminAuth, getAllOrders);
router.get('/product/:productId/sales', adminAuth, getProductSales);
router.patch('/:id/status', adminAuth, updateOrderStatus);
router.patch('/:id/payment-status', adminAuth, updatePaymentStatus);
router.patch('/:id/tracking', adminAuth, updateTracking);
router.patch('/:id/delivery-platform', adminAuth, updateDeliveryPlatform);
router.delete('/:id', adminAuth, deleteOrder);

// Admin or user can view specific order
router.get('/:id', adminOrUserAuth, getOrderById);

export default router;
