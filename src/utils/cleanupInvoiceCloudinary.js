/**
 * Delete invoice PDFs from Cloudinary that are older than 1 hour.
 * Orders keep invoiceNumber so users can still download (we generate on-the-fly).
 */
import cloudinary from '../config/cloudinary.js';
import Order from '../models/Order.model.js';

const INVOICE_RETENTION_HOURS = 1;

export async function cleanupOldInvoiceUploads() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - INVOICE_RETENTION_HOURS);

  const orders = await Order.find({
    'invoice.publicId': { $exists: true, $ne: '' },
    'invoice.invoiceGeneratedAt': { $lt: cutoff },
  }).select('invoice');

  const deleted = [];
  const errors = [];

  for (const order of orders) {
    const publicId = order.invoice?.publicId;
    if (!publicId) continue;

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
      await Order.updateOne(
        { _id: order._id },
        { $unset: { 'invoice.publicId': 1, 'invoice.invoiceUrl': 1 } }
      );
      deleted.push(publicId);
    } catch (err) {
      errors.push({ publicId, error: err?.message || String(err) });
    }
  }

  return { deleted: deleted.length, errors };
}
