import PDFDocument from 'pdfkit';

const formatCurrency = (amount) =>
  `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * @param {Record<string, unknown>} order - plain object from Mongoose .toObject() or lean
 */
export function buildOfflineOrderPdfBuffer(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Offline Sale Receipt', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#555555').text('Innovative Hub — offline sale record', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1.2);

    doc.fontSize(12);
    doc.text(`Invoice: ${order.invoiceNumber || '—'}`);
    doc.text(`Customer: ${order.customerName || '—'}`);
    if (order.customerPhone) doc.text(`Phone: ${order.customerPhone}`);
    doc.moveDown(0.4);
    doc.text(`Order status: ${order.orderStatus || '—'}`);
    doc.text(`Payment: ${order.paymentStatus || '—'}`);
    doc.moveDown(0.4);
    const od = order.orderDate || order.createdAt;
    if (od) {
      doc.text(
        `Order date: ${new Date(od).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
      );
    }
    if (order.deliveredAt) {
      doc.text(
        `Delivered: ${new Date(order.deliveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
      );
    }
    doc.moveDown(0.8);
    doc.fontSize(14).text(`Total: ${formatCurrency(order.totalAmount)}`);
    doc.fontSize(12).text(`Profit (recorded): ${formatCurrency(order.profitAmount)}`);
    if (order.notes) {
      doc.moveDown(0.6);
      doc.fontSize(11).text(`Notes: ${order.notes}`);
    }
    doc.fillColor('#000000');
    if (order.billImageUrl) {
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#2563eb').text(`Bill image: ${order.billImageUrl}`, {
        link: order.billImageUrl,
      });
    }
    if (order.billPdfUrl) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#2563eb').text(`Bill PDF: ${order.billPdfUrl}`, { link: order.billPdfUrl });
    }
    if (order.billDocUrl) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#2563eb').text(`Bill Word: ${order.billDocUrl}`, { link: order.billDocUrl });
    }
    doc.end();
  });
}

/**
 * Word-compatible HTML saved with .doc extension (opens in Microsoft Word).
 * @param {Record<string, unknown>} order
 */
export function buildOfflineOrderDocHtml(order) {
  const od = order.orderDate || order.createdAt;
  const orderDateStr = od
    ? escapeHtml(new Date(od).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
    : '—';
  const deliveredStr = order.deliveredAt
    ? escapeHtml(
        new Date(order.deliveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      )
    : '—';
  const inv = escapeHtml(order.invoiceNumber);
  const billUrl = order.billImageUrl ? String(order.billImageUrl) : '';
  const billPdf = order.billPdfUrl ? String(order.billPdfUrl) : '';
  const billDoc = order.billDocUrl ? String(order.billDocUrl) : '';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>Offline Receipt ${inv}</title>
</head>
<body>
<h2>Offline Sale Receipt</h2>
<p><strong>Invoice:</strong> ${inv}</p>
<p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
${order.customerPhone ? `<p><strong>Phone:</strong> ${escapeHtml(order.customerPhone)}</p>` : ''}
<p><strong>Order status:</strong> ${escapeHtml(order.orderStatus)}</p>
<p><strong>Payment:</strong> ${escapeHtml(order.paymentStatus)}</p>
<p><strong>Order date:</strong> ${orderDateStr}</p>
<p><strong>Delivered:</strong> ${deliveredStr}</p>
<p><strong>Total:</strong> ${escapeHtml(formatCurrency(order.totalAmount))}</p>
<p><strong>Profit (recorded):</strong> ${escapeHtml(formatCurrency(order.profitAmount))}</p>
${order.notes ? `<p><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}
${billUrl ? `<p><strong>Bill image:</strong> <a href="${escapeHtml(billUrl)}">${escapeHtml(billUrl)}</a></p>` : ''}
${billPdf ? `<p><strong>Bill PDF:</strong> <a href="${escapeHtml(billPdf)}">${escapeHtml(billPdf)}</a></p>` : ''}
${billDoc ? `<p><strong>Bill Word:</strong> <a href="${escapeHtml(billDoc)}">${escapeHtml(billDoc)}</a></p>` : ''}
</body>
</html>`;
}
