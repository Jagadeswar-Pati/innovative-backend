import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { uploadBufferToCloudinary } from '../middleware/upload.middleware.js';
import InvoiceCounter from '../models/InvoiceCounter.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(__dirname, '../../assets/logo.png');

const formatNum = (amount) => Number(amount || 0).toFixed(2);
// Use "Rs." so it displays in PDF (default font may not have ₹ glyph)
const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatGstPct = (pct) => `${Number(pct || 0).toFixed(2)} %`;
const GST_PCT = 18;

// A4: 595.28 x 841.89 pt (PDFKit default)
const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 28, right: 28, bottom: 28, left: 28 };
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;
const CONTENT_HEIGHT = A4.height - MARGIN.top - MARGIN.bottom;

const COMPANY = {
  name: 'Innovative Hub',
  addressLines: [
    'Near Gothapatana Square ,',
    'Malipada , Bhubaneswar ,',
    'Odisha, India - 751003',
  ],
  gstin: '21HSRPP8072D1ZD',
  email: 'supportinnovativehub@gmail.com',
};

// Reserved Y space: totals box + gap + footer
const TOTALS_BOX_HEIGHT = 82;
const FOOTER_HEIGHT = 32;
const TABLE_BOTTOM_RESERVED = TOTALS_BOX_HEIGHT + 12 + FOOTER_HEIGHT;

/**
 * Build PDF buffer - Fits A4: header, Billing To, 9-column table, below part, footer. Paginates table if needed.
 */
function buildInvoicePdfBuffer(order, invoiceNumber) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);

    // Use order confirmed time: completedAt when set, else createdAt (24-hour IST)
    const orderConfirmedAt = order.completedAt || order.createdAt || new Date();
    const orderDate = new Date(orderConfirmedAt);
    const dateStr = orderDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).replace(/\//g, '-');
    const timeStr = orderDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    });

    // Column widths (pt): SL, Product, GST%, Qty, Rate, Amount, CGST, SGST, Total — sum = CONTENT_WIDTH
    const colWidths = [24, 234, 34, 30, 42, 42, 42, 42, 49];
    const colLeft = (i) => MARGIN.left + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    const tableTotalW = colWidths.reduce((a, b) => a + b, 0);
    const headerRowH = 18;
    const dataRowH = 26; // room for full product name (2–3 lines)
    const tableBottomY = A4.height - MARGIN.bottom - TABLE_BOTTOM_RESERVED;
    const maxRowsPerPage = Math.floor((tableBottomY - 212 - headerRowH - dataRowH) / dataRowH);

    const drawRow = (y, fill, h) => {
      const rowHeight = h || dataRowH;
      if (fill) doc.rect(MARGIN.left, y, tableTotalW, rowHeight).fill('#f9fafb');
      let x = MARGIN.left;
      for (let i = 0; i < 9; i++) {
        doc.strokeColor('#d1d5db').rect(x, y, colWidths[i], rowHeight).stroke();
        x += colWidths[i];
      }
    };

    const drawTableHeader = (atY) => {
      doc.rect(MARGIN.left, atY, tableTotalW, headerRowH).fill('#e5e7eb');
      let x = MARGIN.left;
      for (let i = 0; i < 9; i++) {
        doc.strokeColor('#9ca3af').rect(x, atY, colWidths[i], headerRowH).stroke();
        x += colWidths[i];
      }
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('SL', colLeft(0) + 4, atY + 5);
      doc.text('Product', colLeft(1) + 4, atY + 5);
      doc.text('GST %', colLeft(2) + 4, atY + 5);
      doc.text('Qty', colLeft(3) + 4, atY + 5);
      doc.text('Rate', colLeft(4) + 4, atY + 5);
      doc.text('Amount', colLeft(5) + 4, atY + 5);
      doc.text('CGST', colLeft(6) + 4, atY + 5);
      doc.text('SGST', colLeft(7) + 4, atY + 5);
      doc.text('Total', colLeft(8) + 4, atY + 5);
    };

    let sumAmount = 0, sumCGST = 0, sumSGST = 0, sumRowTotal = 0;
    const items = order.items || [];

    // ----- Page 1: Header (logo left, company name + address; Tax Invoice + Invoice + Date right-aligned) -----
    const headerY = MARGIN.top;
    // Fixed "slot" for logo so title X never drifts when asset aspect ratio changes (fit scales inside box).
    const LOGO_FIT = { w: 60, h: 50 };
    /** Pixels between right edge of scaled logo and title (0 = flush). */
    const LOGO_TITLE_GAP = 0;
    const COMPANY_TITLE_SIZE = 25;
    // Tax Invoice block: enough width and inset; each line on its own Y to avoid overlap
    const rightBlockWidth = 145;
    const rightBlockInset = 40;
    const rightBlockX = MARGIN.left + CONTENT_WIDTH - rightBlockWidth - rightBlockInset;
    const rightLineH = 16;

    let logoOk = false;
    let logoDrawW = LOGO_FIT.w;
    let logoDrawH = LOGO_FIT.h;
    try {
      const image = doc.openImage(logoPath);
      let iw = image.width;
      let ih = image.height;
      if (image.orientation > 4) {
        [iw, ih] = [ih, iw];
      }
      const bw = LOGO_FIT.w;
      const bh = LOGO_FIT.h;
      const bp = bw / bh;
      const ip = iw / ih;
      if (ip > bp) {
        logoDrawW = bw;
        logoDrawH = bw / ip;
      } else {
        logoDrawH = bh;
        logoDrawW = bh * ip;
      }
      doc.image(image, MARGIN.left, headerY, { fit: [LOGO_FIT.w, LOGO_FIT.h] });
      logoOk = true;
    } catch (_) {
      logoOk = false;
    }

    doc.fillColor('#000000').fontSize(COMPANY_TITLE_SIZE).font('Helvetica-Bold');
    const nameX = logoOk ? MARGIN.left + logoDrawW + LOGO_TITLE_GAP : MARGIN.left;
    const nameBaseline = logoOk
      ? headerY + logoDrawH / 2 - COMPANY_TITLE_SIZE * 0.34
      : headerY + 2;
    doc.text(COMPANY.name, nameX, nameBaseline);

    let y = logoOk
      ? headerY + Math.max(LOGO_FIT.h, logoDrawH) + 10
      : nameBaseline + COMPANY_TITLE_SIZE + 8;
    doc.fillColor('#1f2937').fontSize(8).font('Helvetica');
    (COMPANY.addressLines || []).forEach((line) => {
      doc.text(line, MARGIN.left, y);
      y += 11;
    });
    doc.text(`GSTIN: ${COMPANY.gstin}`, MARGIN.left, y);
    y += 11;
    doc.text(`Email: ${COMPANY.email}`, MARGIN.left, y);
    y += 16;

    // Right side: one line each so nothing overlaps (Tax Invoice, Invoice label + number, Date, Time)
    doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Tax Invoice', rightBlockX, headerY, { width: rightBlockWidth, align: 'right' });
    doc.fontSize(9).font('Helvetica');
    doc.text('Invoice:', rightBlockX, headerY + rightLineH, { width: rightBlockWidth, align: 'right' });
    doc.text(invoiceNumber, rightBlockX, headerY + rightLineH * 2, { width: rightBlockWidth, align: 'right' });
    doc.text(`Date: ${dateStr}`, rightBlockX, headerY + rightLineH * 3, { width: rightBlockWidth, align: 'right' });
    doc.text(`Time: ${timeStr} IST`, rightBlockX, headerY + rightLineH * 4, { width: rightBlockWidth, align: 'right' });

    let currentY = y;

    // ----- Billing To (clear spacing, black text) -----
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text('Billing To:', MARGIN.left, currentY);
    currentY += 14;
    doc.font('Helvetica').fontSize(9).text(order.customerName || 'Customer', MARGIN.left, currentY);
    currentY += 12;
    if (order.addressSnapshot) {
      const a = order.addressSnapshot;
      doc.fillColor('#1f2937');
      const addr1 = `${(a.addressLine1 || a.street || '').trim()} ${(a.addressLine2 || '').trim()}`.trim();
      const city = (a.city || '').trim();
      const statePincode = (a.state ? (a.state + ', ') : '') + 'India - ' + (a.pincode || '');
      if (addr1) { doc.text(addr1 + (addr1.endsWith(',') ? '' : ' ,'), MARGIN.left, currentY); currentY += 12; }
      if (city) { doc.text(city + (city.endsWith(',') ? '' : ' ,'), MARGIN.left, currentY); currentY += 12; }
      doc.text(statePincode || '—', MARGIN.left, currentY);
      currentY += 18;
    } else currentY += 12;
    doc.fillColor('#000000');
    doc.moveTo(MARGIN.left, currentY).lineTo(MARGIN.left + CONTENT_WIDTH, currentY).strokeColor('#9ca3af').stroke();
    currentY += 12;

    // ----- Table header -----
    drawTableHeader(currentY);
    let tableY = currentY + headerRowH;
    let rowIndex = 0;

    doc.fillColor('#000000').font('Helvetica').fontSize(7);
    const pad = 4;
    const numOpt = (colIdx) => ({ width: colWidths[colIdx] - pad * 2, align: 'right' });

    items.forEach((item, i) => {
      const rate = Number(item.price) || 0;
      const qty = item.quantity || 0;
      const amount = rate * qty;
      const cgst = amount * (GST_PCT / 200);
      const sgst = amount * (GST_PCT / 200);
      const rowTotal = amount + cgst + sgst;
      sumAmount += amount;
      sumCGST += cgst;
      sumSGST += sgst;
      sumRowTotal += rowTotal;

      if (rowIndex > 0 && rowIndex % maxRowsPerPage === 0) {
        doc.addPage({ size: 'A4', margin: 0 });
        tableY = MARGIN.top;
        drawTableHeader(tableY);
        tableY += headerRowH;
      }

      drawRow(tableY, rowIndex % 2 === 1, dataRowH);
      doc.fillColor('#000000');
      doc.text(String(i + 1), colLeft(0) + pad, tableY + 6);
      doc.text((item.name || 'Product').trim(), colLeft(1) + pad, tableY + 4, {
        width: colWidths[1] - pad * 2,
        height: dataRowH - 8,
        ellipsis: true,
        lineGap: 2,
      });
      doc.text(formatGstPct(GST_PCT), colLeft(2) + pad, tableY + 6, numOpt(2));
      doc.text(String(qty), colLeft(3) + pad, tableY + 6, numOpt(3));
      doc.text(formatCurrency(rate), colLeft(4) + pad, tableY + 6, numOpt(4));
      doc.text(formatCurrency(amount), colLeft(5) + pad, tableY + 6, numOpt(5));
      doc.text(formatCurrency(cgst), colLeft(6) + pad, tableY + 6, numOpt(6));
      doc.text(formatCurrency(sgst), colLeft(7) + pad, tableY + 6, numOpt(7));
      doc.text(formatCurrency(rowTotal), colLeft(8) + pad, tableY + 6, numOpt(8));
      tableY += dataRowH;
      rowIndex++;
    });

    doc.y = tableY + 10;

    // ----- Totals (right-aligned) and footer on last page -----
    const deliveryCharge = Number(order.pricing?.deliveryCharge ?? order.delivery_charge) || 0;
    const couponDiscount =
      Number(order.pricing?.couponDiscount ?? order.coupon_discount_amount) || 0;
    const grandTotal = Math.max(0, sumRowTotal + deliveryCharge - couponDiscount);
    const boxW = 180;
    const boxX = MARGIN.left + CONTENT_WIDTH - boxW;
    const totY = doc.y;

    doc.fillColor('#000000').fontSize(9).font('Helvetica');
    doc.text('Sub Total', boxX + 6, totY + 6);
    doc.text(formatCurrency(sumAmount), boxX + boxW - 50, totY + 6);
    doc.text('CGST Total(9%)', boxX + 6, totY + 18);
    doc.text(formatCurrency(sumCGST), boxX + boxW - 50, totY + 18);
    doc.text('SGST Total(9%)', boxX + 6, totY + 30);
    doc.text(formatCurrency(sumSGST), boxX + boxW - 50, totY + 30);
    doc.text('Delivery', boxX + 6, totY + 42);
    doc.text(formatCurrency(deliveryCharge), boxX + boxW - 50, totY + 42);
    let extraY = 0;
    if (couponDiscount > 0) {
      doc.fillColor('#000000').fontSize(9).font('Helvetica');
      doc.text('Coupon discount', boxX + 6, totY + 54);
      doc.text(`-${formatCurrency(couponDiscount)}`, boxX + boxW - 50, totY + 54);
      extraY = 12;
    }
    const lineY = totY + 52 + extraY;
    doc.moveTo(boxX, lineY).lineTo(boxX + boxW, lineY).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
    doc.text('Grand Total', boxX + 6, lineY + 10);
    doc.text(formatCurrency(grandTotal), boxX + boxW - 55, lineY + 10);
    doc.strokeColor('#374151').rect(boxX, totY, boxW, TOTALS_BOX_HEIGHT + extraY).stroke();

    // Footer: middle of page, at bottom (centered)
    const footerY = A4.height - MARGIN.bottom - 32;
    doc.moveTo(MARGIN.left, footerY - 14).lineTo(MARGIN.left + CONTENT_WIDTH, footerY - 14).strokeColor('#9ca3af').stroke();
    doc.fillColor('#374151').fontSize(9).font('Helvetica').text('Thank you for your order.', MARGIN.left, footerY - 4, { width: CONTENT_WIDTH, align: 'center' });
    doc.fillColor('#6b7280').fontSize(8).text('Innovative Hub', MARGIN.left, footerY + 8, { width: CONTENT_WIDTH, align: 'center' });
    doc.end();

    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const INVOICE_PREFIX = 'INV-IHB-';

/**
 * Download / email attachment filename: `{invoiceNumber}.pdf` with only path-safe characters.
 */
export function safeInvoicePdfFilename(invoiceNumber) {
  const raw = String(invoiceNumber ?? '').trim();
  const base = (raw || 'invoice').replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${base}.pdf`;
}

/**
 * Get next sequential invoice number: INV-IHB-001, INV-IHB-002, ... INV-IHB-999, then INV-IHB-1000, etc.
 */
export async function getNextInvoiceNumber() {
  const doc = await InvoiceCounter.findOneAndUpdate(
    { name: 'invoice' },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true }
  );
  const num = doc.lastNumber;
  const padded = num < 1000 ? String(num).padStart(3, '0') : String(num);
  return `${INVOICE_PREFIX}${padded}`;
}

/**
 * Generate invoice PDF buffer only (for streaming when Cloudinary fetch fails).
 */
export const generateInvoiceBuffer = async (order, invoiceNumber) => {
  const num = invoiceNumber || (await getNextInvoiceNumber());
  return buildInvoicePdfBuffer(order, num);
};

/**
 * Build invoice PDF in final bill format. Optionally upload to Cloudinary (temporary; delete after 1 hour).
 * @param {Object} order - Full order with items, addressSnapshot, pricing, customerName
 * @param {Object} [options] - { invoiceNumber } use existing number; omit to get next sequential (INV-IHB-001, 002, ...)
 * @param {boolean} [options.uploadToCloudinary=true] - upload and return url/publicId
 * @returns {Promise<{ invoiceNumber, invoiceUrl?, publicId?, buffer, filename }>}
 */
export const generateInvoice = async (order, options = {}) => {
  const invoiceNumber = options.invoiceNumber || (await getNextInvoiceNumber());
  const uploadToCloudinary = options.uploadToCloudinary !== false;

  const buffer = await buildInvoicePdfBuffer(order, invoiceNumber);
  const safeFilename = safeInvoicePdfFilename(invoiceNumber);

  if (!uploadToCloudinary) {
    return { invoiceNumber, buffer, filename: safeFilename };
  }

  const uploaded = await uploadBufferToCloudinary({
    buffer,
    folder: 'innovative-hub/invoices',
    filename: safeFilename,
    resourceType: 'raw',
  });

  return {
    invoiceNumber,
    invoiceUrl: uploaded.secure_url || uploaded.url,
    publicId: uploaded.public_id || null,
    buffer,
    filename: safeFilename,
  };
};
