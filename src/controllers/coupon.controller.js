import mongoose from 'mongoose';
import Coupon from '../models/Coupon.model.js';
import { normalizeCouponCode, validateCouponForCheckout } from '../services/coupon.service.js';

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

export const createCoupon = async (req, res, next) => {
	try {
		const {
			coupon_code,
			discount_type,
			discount_value,
			expiry_date,
			usage_limit,
			min_order_value,
			active_status,
		} = req.body;

		const code = normalizeCouponCode(coupon_code);
		if (!code) {
			return res.status(400).json({ success: false, message: 'coupon_code is required' });
		}
		if (!['flat', 'percentage'].includes(discount_type)) {
			return res.status(400).json({ success: false, message: 'discount_type must be "flat" or "percentage"' });
		}
		const val = Number(discount_value);
		if (!Number.isFinite(val) || val < 0) {
			return res.status(400).json({ success: false, message: 'discount_value must be a non-negative number' });
		}
		if (discount_type === 'percentage' && val > 100) {
			return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100' });
		}
		const exp = expiry_date ? new Date(expiry_date) : null;
		if (!exp || Number.isNaN(exp.getTime())) {
			return res.status(400).json({ success: false, message: 'Valid expiry_date is required' });
		}
		const limit = Number(usage_limit);
		if (!Number.isFinite(limit) || limit < 1) {
			return res.status(400).json({ success: false, message: 'usage_limit must be at least 1' });
		}

		let minOrder = null;
		if (min_order_value != null && min_order_value !== '') {
			const m = Number(min_order_value);
			if (!Number.isFinite(m) || m < 0) {
				return res.status(400).json({ success: false, message: 'min_order_value must be a non-negative number' });
			}
			minOrder = roundMoney(m);
		}

		const doc = await Coupon.create({
			coupon_code: code,
			discount_type,
			discount_value: roundMoney(val),
			expiry_date: exp,
			usage_limit: Math.floor(limit),
			used_count: 0,
			min_order_value: minOrder,
			active_status: active_status !== false && active_status !== 'false',
		});

		res.status(201).json({ success: true, data: doc, message: 'Coupon created' });
	} catch (err) {
		if (err?.code === 11000) {
			return res.status(400).json({ success: false, message: 'A coupon with this code already exists' });
		}
		next(err);
	}
};

export const getAllCoupons = async (_req, res, next) => {
	try {
		const list = await Coupon.find().sort({ createdAt: -1 }).lean();
		res.json({ success: true, data: list });
	} catch (err) {
		next(err);
	}
};

export const updateCoupon = async (req, res, next) => {
	try {
		const { id } = req.params;
		if (!mongoose.isValidObjectId(id)) {
			return res.status(400).json({ success: false, message: 'Invalid coupon id' });
		}

		const updates = {};
		if (req.body.coupon_code != null) {
			const code = normalizeCouponCode(req.body.coupon_code);
			if (!code) return res.status(400).json({ success: false, message: 'coupon_code cannot be empty' });
			updates.coupon_code = code;
		}
		if (req.body.discount_type != null) {
			if (!['flat', 'percentage'].includes(req.body.discount_type)) {
				return res.status(400).json({ success: false, message: 'discount_type must be "flat" or "percentage"' });
			}
			updates.discount_type = req.body.discount_type;
		}
		if (req.body.discount_value != null) {
			const val = Number(req.body.discount_value);
			if (!Number.isFinite(val) || val < 0) {
				return res.status(400).json({ success: false, message: 'Invalid discount_value' });
			}
			updates.discount_value = roundMoney(val);
		}
		if (req.body.expiry_date != null) {
			const exp = new Date(req.body.expiry_date);
			if (Number.isNaN(exp.getTime())) {
				return res.status(400).json({ success: false, message: 'Invalid expiry_date' });
			}
			updates.expiry_date = exp;
		}
		if (req.body.usage_limit != null) {
			const limit = Number(req.body.usage_limit);
			if (!Number.isFinite(limit) || limit < 1) {
				return res.status(400).json({ success: false, message: 'usage_limit must be at least 1' });
			}
			const existing = await Coupon.findById(id).select('used_count').lean();
			if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found' });
			if (Math.floor(limit) < (existing.used_count || 0)) {
				return res.status(400).json({
					success: false,
					message: 'usage_limit cannot be less than current used_count',
				});
			}
			updates.usage_limit = Math.floor(limit);
		}
		if (req.body.min_order_value !== undefined) {
			if (req.body.min_order_value === null || req.body.min_order_value === '') {
				updates.min_order_value = null;
			} else {
				const m = Number(req.body.min_order_value);
				if (!Number.isFinite(m) || m < 0) {
					return res.status(400).json({ success: false, message: 'Invalid min_order_value' });
				}
				updates.min_order_value = roundMoney(m);
			}
		}
		if (req.body.active_status !== undefined) {
			updates.active_status = req.body.active_status === true || req.body.active_status === 'true';
		}

		const doc = await Coupon.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
		if (!doc) return res.status(404).json({ success: false, message: 'Coupon not found' });
		res.json({ success: true, data: doc, message: 'Coupon updated' });
	} catch (err) {
		if (err?.code === 11000) {
			return res.status(400).json({ success: false, message: 'A coupon with this code already exists' });
		}
		next(err);
	}
};

export const deleteCoupon = async (req, res, next) => {
	try {
		const { id } = req.params;
		if (!mongoose.isValidObjectId(id)) {
			return res.status(400).json({ success: false, message: 'Invalid coupon id' });
		}
		const doc = await Coupon.findByIdAndDelete(id);
		if (!doc) return res.status(404).json({ success: false, message: 'Coupon not found' });
		res.json({ success: true, message: 'Coupon deleted' });
	} catch (err) {
		next(err);
	}
};

export const applyCoupon = async (req, res, next) => {
	try {
		const { coupon_code, order_total } = req.body;
		const total = Number(order_total);
		if (!Number.isFinite(total) || total < 0) {
			return res.status(400).json({ success: false, message: 'Valid order_total is required' });
		}

		const result = await validateCouponForCheckout(coupon_code, total);
		if (!result.ok) {
			return res.status(400).json({
				success: false,
				message: result.message,
			});
		}

		res.json({
			success: true,
			discount_amount: result.discount_amount,
			final_price: result.final_price,
			message: 'Coupon applied successfully',
		});
	} catch (err) {
		next(err);
	}
};
