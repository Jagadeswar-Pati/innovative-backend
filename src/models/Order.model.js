import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
	productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
	quantity: { type: Number, required: true },
	price: { type: Number, required: true },
	name: { type: String },
	image: { type: String },
});

const addressSchema = new mongoose.Schema({
	fullName: { type: String, required: true },
	mobile: { type: String, required: true },
	street: { type: String },
	addressLine1: { type: String },
	addressLine2: { type: String },
	city: { type: String, required: true },
	state: { type: String, required: true },
	postalCode: { type: String },
	pincode: { type: String },
	country: { type: String, default: 'India' }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
	invoiceNumber: { type: String },
	invoiceUrl: { type: String },
	/** Cloudinary public_id for 7-day cleanup */
	publicId: { type: String },
	/** When invoice was generated/uploaded (for cleanup) */
	invoiceGeneratedAt: { type: Date },
	sentOnEmail: { type: Boolean, default: false },
	sentOnWhatsapp: { type: Boolean, default: false },
});

const orderSchema = new mongoose.Schema(
	{
		trackingLink: { type: String },
		trackingToken: { type: String },
		trackingMessage: { type: String },
		customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		customerName: { type: String },
		items: [orderItemSchema],
		itemsCount: { type: Number, default: 0 },
		totalAmount: { type: Number },
		pricing: {
			subtotal: { type: Number, required: true },
			deliveryCharge: { type: Number, default: 0 },
			taxAmount: { type: Number, default: 0 },
			couponDiscount: { type: Number, default: 0 },
			totalAmount: { type: Number, required: true }
		},
		coupon_code: { type: String },
		coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
		coupon_discount_amount: { type: Number, default: 0 },
		paymentMethod: { type: String },
		paymentStatus: { type: String, enum: ['paid', 'unpaid', 'failed'], default: 'unpaid' },
		orderStatus: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'confirmed'], default: 'pending' },
		isCompleted: { type: Boolean, default: false },
		completedAt: { type: Date },
		delivery: {
			partnerName: { type: String },
			trackingId: { type: String },
			trackingLink: { type: String }
		},
		addressSnapshot: addressSchema,
		invoice: invoiceSchema,
		// Delivery system fields
		delivery_method: { type: String, enum: ['default', 'manual'], default: 'default' },
		delivery_charge: { type: Number, default: 0 },
		delivery_agreement: { type: Boolean, default: false },
		delivery_mobile_number: { type: String },
		delivery_status: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered'], default: 'pending' },
		delivery_platform: { type: String, default: '' },
		state: { type: String },
	},
	{ timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
