import crypto from 'crypto';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import { generateInvoice } from '../utils/invoice.js';
import { sendOrderFailedEmail, sendOrderSuccessEmail } from '../utils/mailer.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const buildAddressSnapshot = (address) => ({
  fullName: address.fullName,
  mobile: address.mobile || address.phone,
  street: address.addressLine1 || address.street || '',
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2,
  city: address.city,
  state: address.state,
  postalCode: address.pincode || address.postalCode,
  pincode: address.pincode,
  country: address.country || 'India',
});

const calculateOrderItems = async (products) => {
  const ids = products.map((p) => p.productId);
  const docs = await Product.find({ _id: { $in: ids } }).select('name images sellingPrice stockQuantity');
  const map = new Map(docs.map((p) => [p._id.toString(), p]));

  const items = products.map((p) => {
    const doc = map.get(p.productId.toString());
    const price = Number(doc?.sellingPrice || 0);
    return {
      productId: p.productId,
      quantity: p.qty,
      price,
      name: doc?.name || '',
      image: doc?.images?.[0]?.url || '',
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { items, totalAmount };
};

const decrementStock = async (items) => {
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;
    const nextQty = Math.max(0, (product.stockQuantity || 0) - item.quantity);
    product.stockQuantity = nextQty;
    product.stockStatus = nextQty > 0 ? 'in_stock' : 'out_of_stock';
    await product.save();
  }
};

export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { products, address } = req.body;
    if (!products?.length || !address) {
      return res.status(400).json({ success: false, message: 'products and address are required' });
    }

    const { totalAmount } = await calculateOrderItems(products);
    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid total amount' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    res.json({
      success: true,
      data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, products, address } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment payload' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      void sendOrderFailedEmail({ email: req.user.email, name: req.user.name, reason: 'Payment verification failed' });
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const { items, totalAmount } = await calculateOrderItems(products);
    const addressSnapshot = buildAddressSnapshot(address);

    const order = await Order.create({
      customerId: req.user._id,
      customerName: req.user.name,
      items,
      itemsCount: items.length,
      pricing: { subtotal: totalAmount, deliveryCharge: 0, taxAmount: 0, totalAmount },
      totalAmount,
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      orderStatus: 'confirmed',
      addressSnapshot,
      delivery: {},
    });

    await decrementStock(items);

    const payment = await Payment.create({
      orderId: order._id,
      amount: totalAmount,
      status: 'success',
      method: 'razorpay',
      transactionId: razorpay_payment_id,
    });

    const invoice = await generateInvoice(order);
    order.invoice = { ...invoice, sentOnEmail: false };
    await order.save();

    void sendOrderSuccessEmail({
      email: req.user.email,
      name: req.user.name,
      order,
      invoiceUrl: invoice.invoiceUrl,
    });

    res.json({ success: true, data: { orderId: order._id, paymentId: payment._id } });
  } catch (error) {
    next(error);
  }
};

export const reportRazorpayFailure = async (req, res, next) => {
  try {
    const { reason } = req.body;
    void sendOrderFailedEmail({ email: req.user.email, name: req.user.name, reason });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// GET ALL PAYMENTS
export const getAllPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('orderId', 'customerId totalAmount')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

// GET PAYMENT BY ID
export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('orderId', 'customerId totalAmount');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};