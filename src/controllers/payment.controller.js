import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import DeliveryState from '../models/DeliveryState.model.js';
import DeliverySettings from '../models/DeliverySettings.model.js';
import { generateInvoice } from '../utils/invoice.js';
import { sendOrderFailedEmail, sendOrderSuccessEmail } from '../utils/mailer.js';
import { createNotification } from '../utils/notificationHelpers.js';
import { resolveCouponForPayment, incrementCouponUsageIfNeeded } from '../services/coupon.service.js';
import { normalizeIndianMobile, isValidIndianMobile10 } from '../utils/mobileOtp.util.js';

const GST_RATE = 0.18;

function parseDeliveryMobile(value) {
  const digits = normalizeIndianMobile(value || '');
  if (!isValidIndianMobile10(digits)) return null;
  return digits;
}

async function getDeliveryChargeForState(stateName) {
  if (!stateName || typeof stateName !== 'string') return 0;
  const normalized = String(stateName).trim();
  const doc = await DeliveryState.findOne({
    state: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    enabled: true,
  });
  return doc ? Number(doc.defaultShippingCharge) || 0 : 0;
}

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

const decrementStock = async (items, session = null) => {
  for (const item of items) {
    let q = Product.findById(item.productId);
    if (session) q = q.session(session);
    const product = await q;
    if (!product) continue;
    const prevQty = Number(product.stockQuantity || 0);
    const nextQty = Math.max(0, (product.stockQuantity || 0) - item.quantity);
    product.stockQuantity = nextQty;
    product.stockStatus = nextQty > 0 ? 'in_stock' : 'out_of_stock';
    await product.save(session ? { session } : {});

    if (prevQty > 0 && nextQty === 0) {
      void createNotification({
        type: 'system',
        title: 'Out of Stock',
        message: `${product.name} is now out of stock.`,
        entityType: 'Product',
        entityId: product._id,
      });
    } else if (prevQty >= 10 && nextQty < 10) {
      void createNotification({
        type: 'system',
        title: 'Low Stock Alert',
        message: `${product.name} stock is low (${nextQty} left).`,
        entityType: 'Product',
        entityId: product._id,
      });
    }
  }
};

export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { products, address, deliveryAgreement, deliveryMobileNumber, couponCode } = req.body;
    if (!products?.length || !address) {
      return res.status(400).json({ success: false, message: 'products and address are required' });
    }
    if (deliveryAgreement !== true) {
      return res.status(400).json({
        success: false,
        message: 'You must confirm the delivery mobile number and understand incorrect numbers may affect delivery and refunds.',
      });
    }
    const mobileDigits = parseDeliveryMobile(deliveryMobileNumber);
    if (!mobileDigits) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile for delivery contact.' });
    }

    const { items, totalAmount: subtotal } = await calculateOrderItems(products);
    const state = address.state || (address.addressSnapshot && address.addressSnapshot.state) || '';
    const deliveryCharge = await getDeliveryChargeForState(state);
    const gstAmount = Math.round(subtotal * GST_RATE * 100) / 100;
    const totalBeforeCoupon = Math.round((subtotal + gstAmount + Number(deliveryCharge)) * 100) / 100;

    const couponResult = await resolveCouponForPayment(couponCode, totalBeforeCoupon);
    if (!couponResult.ok) {
      return res.status(400).json({ success: false, message: couponResult.message });
    }

    const totalAmount = couponResult.final_price;
    const discountAmount = couponResult.discount_amount;

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
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        deliveryCharge: Number(deliveryCharge),
        totalBeforeCoupon,
        discountAmount,
        totalAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      products,
      address,
      deliveryAgreement,
      deliveryMobileNumber,
      couponCode,
    } = req.body;
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

    if (deliveryAgreement !== true) {
      return res.status(400).json({ success: false, message: 'Delivery confirmation is required.' });
    }
    const mobileDigits = parseDeliveryMobile(deliveryMobileNumber);
    if (!mobileDigits) {
      return res.status(400).json({ success: false, message: 'Valid delivery mobile number is required.' });
    }

    const { items, totalAmount: subtotal } = await calculateOrderItems(products);
    const state = address?.state || '';
    const deliveryCharge = await getDeliveryChargeForState(state);
    const gstAmount = Math.round(subtotal * GST_RATE * 100) / 100;
    const totalBeforeCoupon = Math.round((subtotal + gstAmount + Number(deliveryCharge)) * 100) / 100;

    const couponResult = await resolveCouponForPayment(couponCode, totalBeforeCoupon);
    if (!couponResult.ok) {
      return res.status(400).json({ success: false, message: couponResult.message });
    }

    const totalAmount = couponResult.final_price;
    const couponDiscount = couponResult.discount_amount || 0;
    const couponRef = couponResult.coupon;

    const addressSnapshot = buildAddressSnapshot(address);
    let defaultPlatform = 'Shiprocket';
    try {
      const settings = await DeliverySettings.findOne().lean();
      if (settings?.defaultPlatform) defaultPlatform = settings.defaultPlatform;
    } catch (_) {}

    const orderPayload = {
      customerId: req.user._id,
      customerName: req.user.name,
      items,
      itemsCount: items.length,
      pricing: {
        subtotal,
        deliveryCharge: Number(deliveryCharge),
        taxAmount: gstAmount,
        couponDiscount,
        totalAmount,
      },
      totalAmount,
      coupon_code: couponRef?.coupon_code,
      coupon_id: couponRef?._id,
      coupon_discount_amount: couponDiscount,
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      orderStatus: 'confirmed',
      addressSnapshot,
      delivery: {},
      delivery_method: 'default',
      delivery_charge: Number(deliveryCharge),
      delivery_agreement: true,
      delivery_mobile_number: mobileDigits,
      delivery_status: 'pending',
      delivery_platform: defaultPlatform,
      state: state || undefined,
    };

    let orderId;
    let paymentId;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [order] = await Order.create([orderPayload], { session });
        orderId = order._id;
        await decrementStock(items, session);
        if (couponRef?._id) {
          const { incremented } = await incrementCouponUsageIfNeeded(couponRef._id, session);
          if (!incremented) {
            throw new Error('COUPON_INVALID');
          }
        }
        const [payment] = await Payment.create(
          [
            {
              orderId: order._id,
              amount: totalAmount,
              status: 'success',
              method: 'razorpay',
              transactionId: razorpay_payment_id,
            },
          ],
          { session }
        );
        paymentId = payment._id;
      });
    } catch (err) {
      if (err?.message === 'COUPON_INVALID') {
        return res.status(400).json({
          success: false,
          message: 'Coupon is no longer valid or usage limit was reached',
        });
      }
      throw err;
    } finally {
      session.endSession();
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(500).json({ success: false, message: 'Order could not be loaded after payment' });
    }

    order.completedAt = new Date();
    const invoice = await generateInvoice(order);
    order.invoice = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceUrl: invoice.invoiceUrl,
      publicId: invoice.publicId || undefined,
      invoiceGeneratedAt: new Date(),
      sentOnEmail: false,
      sentOnWhatsapp: false,
    };
    await order.save();

    void sendOrderSuccessEmail({
      email: req.user.email,
      name: req.user.name,
      order,
      invoiceUrl: invoice.invoiceUrl,
      invoicePdfBuffer: invoice.buffer,
      invoiceFilename: invoice.filename,
    });

    void createNotification({
      type: 'order',
      title: 'New Paid Order',
      message: `Order ${order._id} was paid successfully.`,
      entityType: 'Order',
      entityId: order._id,
    });

    res.json({ success: true, data: { orderId: order._id, paymentId } });
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

export const getAllPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('orderId', 'customerId totalAmount')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('orderId', 'customerId totalAmount');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};
