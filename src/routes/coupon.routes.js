import express from 'express';
import {
	createCoupon,
	getAllCoupons,
	updateCoupon,
	deleteCoupon,
	applyCoupon,
} from '../controllers/coupon.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.post('/apply', userAuth, applyCoupon);

router.post('/create', adminAuth, createCoupon);
router.get('/all', adminAuth, getAllCoupons);
router.put('/update/:id', adminAuth, updateCoupon);
router.delete('/delete/:id', adminAuth, deleteCoupon);

export default router;
