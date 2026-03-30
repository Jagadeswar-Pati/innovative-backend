import mongoose from 'mongoose';
import Coupon from '../models/Coupon.model.js';

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

export const normalizeCouponCode = (code) => {
	if (code == null || typeof code !== 'string') return '';
	return code.trim().toUpperCase();
};

/**
 * @param {import('../models/Coupon.model.js').default} doc - lean or doc
 * @param {number} orderTotal - payable before discount (subtotal + GST + delivery)
 */
export const computeDiscountAmount = (doc, orderTotal) => {
	const total = roundMoney(orderTotal);
	if (total <= 0) return 0;
	const type = doc.discount_type;
	const value = Number(doc.discount_value) || 0;
	if (type === 'percentage') {
		const raw = (total * value) / 100;
		return roundMoney(Math.min(raw, total));
	}
	if (type === 'flat') {
		return roundMoney(Math.min(value, total));
	}
	return 0;
};

/**
 * Validates coupon document against order total (does not load from DB).
 * @returns {{ ok: true, discount_amount: number, final_price: number, coupon: object } | { ok: false, message: string }}
 */
export const validateCouponDocument = (doc, orderTotal) => {
	if (!doc) {
		return { ok: false, message: 'Invalid coupon code' };
	}
	if (!doc.active_status) {
		return { ok: false, message: 'This coupon is not active' };
	}
	const now = new Date();
	const creation = doc.creation_date instanceof Date ? doc.creation_date : new Date(doc.creation_date);
	if (!Number.isNaN(creation.getTime()) && creation > now) {
		return { ok: false, message: 'This coupon is not active yet' };
	}
	const expiry = doc.expiry_date instanceof Date ? doc.expiry_date : new Date(doc.expiry_date);
	if (Number.isNaN(expiry.getTime()) || expiry < now) {
		return { ok: false, message: 'This coupon has expired' };
	}
	const used = Number(doc.used_count) || 0;
	const limit = Number(doc.usage_limit);
	if (!Number.isFinite(limit) || limit < 1 || used >= limit) {
		return { ok: false, message: 'Coupon usage limit has been reached' };
	}
	const total = roundMoney(orderTotal);
	if (total <= 0) {
		return { ok: false, message: 'Invalid order amount' };
	}
	const minOrder = doc.min_order_value;
	if (minOrder != null && Number(minOrder) > 0 && total < roundMoney(minOrder)) {
		return {
			ok: false,
			message: `Minimum order value of ₹${roundMoney(minOrder)} is required for this coupon`,
		};
	}
	const discount_amount = computeDiscountAmount(doc, total);
	const final_price = roundMoney(Math.max(0, total - discount_amount));
	return {
		ok: true,
		discount_amount,
		final_price,
		coupon: doc,
	};
};

/**
 * Load coupon by code and validate for checkout total.
 * @returns {Promise<{ ok: true, discount_amount: number, final_price: number, coupon: object } | { ok: false, message: string }>}
 */
export const validateCouponForCheckout = async (rawCode, orderTotal) => {
	const code = normalizeCouponCode(rawCode);
	if (!code) {
		return { ok: false, message: 'Coupon code is required' };
	}
	const doc = await Coupon.findOne({ coupon_code: code }).lean();
	return validateCouponDocument(doc, orderTotal);
};

/**
 * Payment flow: optional coupon; no used_count change.
 */
export const resolveCouponForPayment = async (rawCode, orderTotalBeforeDiscount) => {
	const code = normalizeCouponCode(rawCode);
	if (!code) {
		return {
			ok: true,
			discount_amount: 0,
			final_price: roundMoney(orderTotalBeforeDiscount),
			coupon: null,
		};
	}
	const doc = await Coupon.findOne({ coupon_code: code }).lean();
	const v = validateCouponDocument(doc, orderTotalBeforeDiscount);
	if (!v.ok) return { ok: false, message: v.message };
	return {
		ok: true,
		discount_amount: v.discount_amount,
		final_price: v.final_price,
		coupon: doc,
	};
};

/**
 * Atomically increment used_count when an order is successfully placed.
 */
export const incrementCouponUsageIfNeeded = async (couponId, session) => {
	if (!couponId || !mongoose.isValidObjectId(couponId)) return { incremented: false };
	const opts = { new: true, ...(session ? { session } : {}) };
	const updated = await Coupon.findOneAndUpdate(
		{
			_id: couponId,
			active_status: true,
			$expr: { $lt: ['$used_count', '$usage_limit'] },
		},
		{ $inc: { used_count: 1 } },
		opts
	);
	return { incremented: !!updated, coupon: updated };
};
