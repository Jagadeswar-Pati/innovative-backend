import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
	{
		orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
		amount: { type: Number, required: true },
		status: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
		method: { type: String },
		transactionId: { type: String },
	},
	{ timestamps: true }
);

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
