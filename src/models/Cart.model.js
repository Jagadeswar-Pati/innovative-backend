import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 },
    priceSnapshot: { type: Number, required: true },
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [CartItemSchema],
    status: { type: String, enum: ['active', 'ordered', 'abandoned'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('Cart', CartSchema);
