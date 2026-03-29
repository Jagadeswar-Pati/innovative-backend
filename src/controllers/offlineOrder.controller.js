import OfflineOrder from '../models/OfflineOrder.model.js';
import { buildOfflineOrderPdfBuffer, buildOfflineOrderDocHtml } from '../utils/offlineOrderBill.js';

const buildDateRange = (period, year) => {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week': {
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    }
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom-year': {
      const targetYear = Number(year) || now.getFullYear();
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      break;
    }
    default:
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

const buildFilter = (query) => {
  const { status, paymentStatus, search, period, year } = query;
  const filter = {};

  if (status) filter.orderStatus = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (search) {
    filter.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { customerPhone: { $regex: search, $options: 'i' } },
    ];
  }
  // Omit date range for "all" / missing — so any orderDate (past or future) is visible
  if (period && period !== 'all') {
    const { startDate, endDate } = buildDateRange(period, year);
    filter.orderDate = { $gte: startDate, $lte: endDate };
  }

  return filter;
};

export const getOfflineOrders = async (req, res, next) => {
  try {
    const filter = buildFilter(req.query);
    const rows = await OfflineOrder.find(filter).sort({ orderDate: -1, createdAt: -1 });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const createOfflineOrder = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const created = await OfflineOrder.create({
      invoiceNumber: payload.invoiceNumber,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone || '',
      totalAmount: Number(payload.totalAmount) || 0,
      profitAmount: Number(payload.profitAmount) || 0,
      paymentStatus: payload.paymentStatus || 'paid',
      orderStatus: payload.orderStatus || 'delivered',
      billImageUrl: payload.billImageUrl || '',
      billPdfUrl: payload.billPdfUrl || '',
      billDocUrl: payload.billDocUrl || '',
      notes: payload.notes || '',
      orderDate: payload.orderDate ? new Date(payload.orderDate) : new Date(),
      deliveredAt: payload.deliveredAt ? new Date(payload.deliveredAt) : undefined,
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateOfflineOrder = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const updated = await OfflineOrder.findByIdAndUpdate(
      req.params.id,
      {
        ...(payload.invoiceNumber != null ? { invoiceNumber: payload.invoiceNumber } : {}),
        ...(payload.customerName != null ? { customerName: payload.customerName } : {}),
        ...(payload.customerPhone != null ? { customerPhone: payload.customerPhone } : {}),
        ...(payload.totalAmount != null ? { totalAmount: Number(payload.totalAmount) || 0 } : {}),
        ...(payload.profitAmount != null ? { profitAmount: Number(payload.profitAmount) || 0 } : {}),
        ...(payload.paymentStatus != null ? { paymentStatus: payload.paymentStatus } : {}),
        ...(payload.orderStatus != null ? { orderStatus: payload.orderStatus } : {}),
        ...(payload.billImageUrl != null ? { billImageUrl: payload.billImageUrl } : {}),
        ...(payload.billPdfUrl != null ? { billPdfUrl: payload.billPdfUrl } : {}),
        ...(payload.billDocUrl != null ? { billDocUrl: payload.billDocUrl } : {}),
        ...(payload.notes != null ? { notes: payload.notes } : {}),
        ...(payload.orderDate != null ? { orderDate: new Date(payload.orderDate) } : {}),
        ...(payload.deliveredAt != null ? { deliveredAt: payload.deliveredAt ? new Date(payload.deliveredAt) : null } : {}),
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Offline order not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteOfflineOrder = async (req, res, next) => {
  try {
    const deleted = await OfflineOrder.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Offline order not found' });
    res.json({ success: true, message: 'Offline order deleted' });
  } catch (error) {
    next(error);
  }
};

/** GET /:id/bill?format=pdf|doc — admin download receipt */
export const streamOfflineBill = async (req, res, next) => {
  try {
    const order = await OfflineOrder.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Offline order not found' });

    const format = String(req.query.format || 'pdf').toLowerCase();
    const safeName = String(order.invoiceNumber || order._id || 'receipt').replace(/[^\w\-]+/g, '_');

    if (format === 'doc' || format === 'docx') {
      const html = buildOfflineOrderDocHtml(order);
      res.setHeader('Content-Type', 'application/msword; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="offline-receipt-${safeName}.doc"`);
      return res.send(Buffer.from(html, 'utf8'));
    }

    const buffer = await buildOfflineOrderPdfBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="offline-receipt-${safeName}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/** GET /:id/uploaded-bill/:type — force-download uploaded Cloudinary file */
export const streamUploadedOfflineBill = async (req, res, next) => {
  try {
    const order = await OfflineOrder.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Offline order not found' });

    const type = String(req.params.type || '').toLowerCase();
    const typeConfig = {
      image: { url: order.billImageUrl, ext: 'jpg' },
      pdf: { url: order.billPdfUrl, ext: 'pdf' },
      doc: { url: order.billDocUrl, ext: 'doc' },
    };
    const selected = typeConfig[type];
    if (!selected) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Use image, pdf, or doc.' });
    }
    if (!selected.url) {
      return res.status(404).json({ success: false, message: `No uploaded ${type} file found for this order` });
    }
    if (!String(selected.url).includes('res.cloudinary.com/')) {
      return res.status(400).json({ success: false, message: 'Unsupported file source' });
    }

    const upstream = await fetch(String(selected.url));
    if (!upstream.ok) {
      return res.status(502).json({ success: false, message: 'Failed to fetch uploaded file' });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const safeName = String(order.invoiceNumber || order._id || 'offline-bill').replace(/[^\w\-]+/g, '_');

    if (type === 'pdf') contentType = 'application/pdf';
    if (type === 'doc') contentType = 'application/msword';
    if (type === 'image' && !contentType.startsWith('image/')) contentType = 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="uploaded-${type}-${safeName}.${selected.ext}"`
    );
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};
