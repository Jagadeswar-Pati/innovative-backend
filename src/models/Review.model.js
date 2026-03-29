import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
	{
		productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
		productName: { type: String },
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
		userName: { type: String },
		orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
		rating: { type: Number, required: true },
		valueForMoney: { type: Number },
		durability: { type: Number },
		deliverySpeed: { type: Number },
		comment: { type: String },
		pros: { type: String },
		cons: { type: String },
		status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'pending' },
	},
	{ timestamps: true }
);

const Review = mongoose.model('Review', reviewSchema);

export default Review;
