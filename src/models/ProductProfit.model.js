import mongoose from 'mongoose';

const productProfitSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    buyingPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productProfitSchema.index({ productId: 1 });

const ProductProfit = mongoose.model('ProductProfit', productProfitSchema);

export default ProductProfit;
