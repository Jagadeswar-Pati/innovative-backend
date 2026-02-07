import PDFDocument from 'pdfkit';
import { uploadBufferToCloudinary } from '../middleware/upload.middleware.js';

const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

export const generateInvoice = async (order) => {
  const invoiceNumber = `INV-IHB-${Date.now()}`;
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(20).text('Innovative Hub Invoice', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
  doc.text(`Order ID: ${order._id}`);
  doc.text(`Date: ${new Date().toLocaleString('en-IN')}`);
  doc.moveDown();

  doc.fontSize(12).text('Billing Details', { underline: true });
  doc.text(order.customerName || '');
  if (order.addressSnapshot) {
    const a = order.addressSnapshot;
    doc.text(`${a.addressLine1 || a.street || ''} ${a.addressLine2 || ''}`.trim());
    doc.text(`${a.city}, ${a.state} - ${a.pincode}`);
    doc.text(`Mobile: ${a.mobile}`);
  }
  doc.moveDown();

  doc.fontSize(12).text('Items', { underline: true });
  doc.moveDown(0.5);
  order.items.forEach((item) => {
    doc.text(`${item.name || 'Product'} x${item.quantity} — ${formatCurrency(item.price * item.quantity)}`);
  });
  doc.moveDown();

  doc.text(`Subtotal: ${formatCurrency(order.pricing?.subtotal ?? order.totalAmount)}`);
  doc.text(`Delivery: ${formatCurrency(order.pricing?.deliveryCharge ?? 0)}`);
  doc.text(`Tax: ${formatCurrency(order.pricing?.taxAmount ?? 0)}`);
  doc.fontSize(13).text(`Total: ${formatCurrency(order.totalAmount)}`, { underline: true });

  doc.end();
  const buffer = await new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const uploaded = await uploadBufferToCloudinary({
    buffer,
    folder: 'innovative-hub/invoices',
    filename: invoiceNumber,
    resourceType: 'raw',
  });

  return {
    invoiceNumber,
    invoiceUrl: uploaded.secure_url || uploaded.url,
  };
};
