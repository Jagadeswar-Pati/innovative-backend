import mongoose from 'mongoose';

const invoiceCounterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, default: 'invoice' },
    lastNumber: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const InvoiceCounter = mongoose.model('InvoiceCounter', invoiceCounterSchema);

export default InvoiceCounter;
