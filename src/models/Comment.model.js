import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    comment: { type: String, required: true },
    status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

commentSchema.index({ productId: 1, userId: 1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
