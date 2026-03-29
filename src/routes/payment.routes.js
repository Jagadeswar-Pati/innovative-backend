import express from 'express';
import {
  getAllPayments,
  getPaymentById,
  createRazorpayOrder,
  verifyRazorpayPayment,
  reportRazorpayFailure,
} from '../controllers/payment.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.post('/razorpay/order', userAuth, createRazorpayOrder);
router.post('/razorpay/verify', userAuth, verifyRazorpayPayment);
router.post('/razorpay/failure', userAuth, reportRazorpayFailure);

router.use(adminAuth);
router.get('/', getAllPayments);
router.get('/:id', getPaymentById);

export default router;