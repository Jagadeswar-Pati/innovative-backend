import mongoose from 'mongoose';

const offlineOrderSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    profitAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid', 'failed'],
      default: 'paid',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'confirmed'],
      default: 'delivered',
    },
    billImageUrl: { type: String, default: '' },
    billPdfUrl: { type: String, default: '' },
    billDocUrl: { type: String, default: '' },
    notes: { type: String, default: '' },
    orderDate: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

offlineOrderSchema.index({ orderDate: -1 });
offlineOrderSchema.index({ invoiceNumber: 1 });
offlineOrderSchema.index({ customerName: 1 });
offlineOrderSchema.index({ orderStatus: 1, orderDate: -1 });

const OfflineOrder = mongoose.model('OfflineOrder', offlineOrderSchema);

export default OfflineOrder;
