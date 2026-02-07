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
			totalAmount: { type: Number, required: true }
		},
		paymentMethod: { type: String },
		paymentStatus: { type: String, enum: ['paid', 'unpaid', 'failed'], default: 'unpaid' },
		orderStatus: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'confirmed'], default: 'pending' },
		delivery: {
			partnerName: { type: String },
			trackingId: { type: String },
			trackingLink: { type: String }
		},
		addressSnapshot: addressSchema,
		invoice: invoiceSchema
	},
	{ timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
