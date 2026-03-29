import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
	{
		coupon_code: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			uppercase: true,
		},
		discount_type: {
			type: String,
			enum: ['flat', 'percentage'],
			required: true,
		},
		discount_value: { type: Number, required: true, min: 0 },
		expiry_date: { type: Date, required: true },
		usage_limit: { type: Number, required: true, min: 1 },
		used_count: { type: Number, default: 0, min: 0 },
		min_order_value: { type: Number, default: null, min: 0 },
		active_status: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

couponSchema.index({ coupon_code: 1 });
couponSchema.index({ active_status: 1, expiry_date: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
