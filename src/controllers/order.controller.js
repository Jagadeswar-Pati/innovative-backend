// Create order (user)
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import { createNotification } from '../utils/notificationHelpers.js';
import { generateInvoice, generateInvoiceBuffer, safeInvoicePdfFilename } from '../utils/invoice.js';
import {
  sendOrderConfirmedEmail,
  sendOrderPackedEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
} from '../utils/mailer.js';

export const createOrder = async (req, res, next) => {
	try {
		const { products, address, totalAmount, trackingLink } = req.body;
		if (!products?.length || !address || totalAmount == null) {
			return res.status(400).json({ success: false, message: 'products, address, and totalAmount are required' });
		}
		const productIds = products.map((p) => p.productId);
		const productDocs = await Product.find({ _id: { $in: productIds } }).select('name images sku');
		const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));
		// Map frontend address (addressLine1, pincode) to backend format
		const addressSnapshot = {
			fullName: address.fullName,
			mobile: address.mobile || address.phone,
			street: address.addressLine1 || address.street || '',
			addressLine1: address.addressLine1,
			addressLine2: address.addressLine2,
			city: address.city,
			state: address.state,
			postalCode: address.pincode || address.postalCode,
			pincode: address.pincode,
			country: address.country || 'India'
		};
		const order = await Order.create({
			customerId: req.user._id,
			customerName: req.user.name,
			items: products.map((p) => {
				const doc = productMap.get(p.productId?.toString());
				return {
					productId: p.productId,
					quantity: p.qty,
					price: p.price,
					name: doc?.name || '',
					image: doc?.images?.[0]?.url || '',
				};
			}),
			itemsCount: products.length,
			pricing: {
				subtotal: totalAmount,
				deliveryCharge: 0,
				taxAmount: 0,
				totalAmount
			},
			totalAmount,
			paymentStatus: 'unpaid',
			orderStatus: 'pending',
			trackingLink: trackingLink || '',
			addressSnapshot,
			delivery: {}
		});
		void createNotification({
			type: 'order',
			title: 'New Order Created',
			message: `New order ${order._id} placed by ${order.customerName || 'customer'}.`,
			entityType: 'Order',
			entityId: order._id,
		});
		res.json({ success: true, data: order });
	} catch (err) {
		next(err);
	}
};

// Get orders for current user
export const getMyOrders = async (req, res, next) => {
	try {
		const orders = await Order.find({ customerId: req.user._id }).sort({ createdAt: -1 });
		res.json({ success: true, data: orders });
	} catch (err) {
		next(err);
	}
};
export const getAllOrders = async (req, res, next) => {
	try {
		const orders = await Order.find().sort({ createdAt: -1 });
		res.json({ success: true, data: orders });
	} catch (err) {
		next(err);
	}
};

/**
 * Get the registered customer's email and name for an order.
 * Always uses the User account linked by order.customerId (the account that placed the order).
 * @returns {{ email: string, name: string } | null} null if user not found or has no email
 */
const getRegisteredCustomerForOrder = async (order) => {
	if (!order?.customerId) return null;
	const user = await User.findById(order.customerId).select('email name').lean();
	const email = typeof user?.email === 'string' ? user.email.trim() : '';
	if (!email) return null;
	return {
		email: email.toLowerCase(),
		name: (user?.name || order.customerName || 'Customer').trim() || 'Customer',
	};
};

/**
 * Send order status email to the registered customer only.
 * Recipient is always the email of the User account that placed the order (order.customerId).
 */
const sendOrderStatusEmailToCustomer = async (order, status, options = {}) => {
	const customer = await getRegisteredCustomerForOrder(order);
	if (!customer) {
		console.warn(`Order status email skipped (no registered email for customer): order=${order._id}, status=${status}`);
		return;
	}
	const { email, name } = customer;
	const orderPayload = {
		_id: order._id != null ? String(order._id) : order._id,
		totalAmount: order.totalAmount,
	};
	try {
		if (status === 'confirmed') {
			await sendOrderConfirmedEmail({ email, name, order: orderPayload });
			console.log(`Order status email (confirmed) sent to registered email ${email}, order ${order._id}`);
		} else if (status === 'processing') {
			await sendOrderPackedEmail({ email, name, order: orderPayload });
			console.log(`Order status email (packed) sent to registered email ${email}, order ${order._id}`);
		} else if (status === 'shipped') {
			await sendOrderShippedEmail({
				email,
				name,
				order: orderPayload,
				trackingLink: order.trackingLink || options.trackingLink,
				trackingMessage: order.trackingMessage || options.trackingMessage,
			});
			console.log(`Order status email (shipped) sent to registered email ${email}, order ${order._id}`);
		} else if (status === 'delivered') {
			const sent = await sendOrderDeliveredEmail({ email, name, order: orderPayload });
			if (sent) {
				console.log(`Order status email (delivered) sent to registered email ${email}, order ${order._id}`);
			} else {
				console.warn(`Order delivered email not sent (mail not configured or send failed): order=${order._id}`);
			}
		}
	} catch (err) {
		console.error(`Order ${status} email failed (registered email ${email}):`, err?.message || err);
	}
};

const VALID_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export const updateOrderStatus = async (req, res, next) => {
	try {
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		const nextStatus = req.body?.status;
		if (!nextStatus || !VALID_ORDER_STATUSES.includes(nextStatus)) {
			return res.status(400).json({ success: false, message: `Invalid status. Use one of: ${VALID_ORDER_STATUSES.join(', ')}` });
		}
		const previousStatus = order.orderStatus;

		order.orderStatus = nextStatus;
		// Sync delivery_status with order status when applicable
		if (['processing', 'shipped', 'delivered'].includes(nextStatus)) {
			order.delivery_status = nextStatus;
		}
		if (nextStatus === 'delivered') {
			order.isCompleted = true;
			order.completedAt = new Date();
		} else if (previousStatus === 'delivered' && nextStatus !== 'delivered') {
			order.isCompleted = false;
			order.completedAt = null;
		}
		await order.save();

		if (previousStatus !== 'delivered' && nextStatus === 'delivered') {
			await User.findByIdAndUpdate(order.customerId, {
				$inc: {
					totalOrders: 1,
					totalAmountSpent: Number(order.totalAmount || 0),
				},
			});
			createNotification({
				type: 'order',
				title: 'Order Delivered',
				message: `Order ${order._id} marked as delivered.`,
				entityType: 'Order',
				entityId: order._id,
			}).catch(() => {});
		} else if (previousStatus === 'delivered' && nextStatus !== 'delivered') {
			await User.findByIdAndUpdate(order.customerId, {
				$inc: {
					totalOrders: -1,
					totalAmountSpent: -Number(order.totalAmount || 0),
				},
			});
		}

		// Send status email in background (don't block response — keeps admin UI smooth)
		if (previousStatus !== nextStatus && ['confirmed', 'processing', 'shipped', 'delivered'].includes(nextStatus)) {
			void sendOrderStatusEmailToCustomer(order, nextStatus).catch((err) =>
				console.error('Order status email (background):', err?.message || err)
			);
		}

		if (previousStatus !== nextStatus) {
			void createNotification({
				type: 'order',
				title: 'Order Status Updated',
				message: `Order ${order._id} status changed to ${nextStatus}.`,
				entityType: 'Order',
				entityId: order._id,
			});
		}
		res.json({ success: true, data: order });
	} catch (err) {
		next(err);
	}
};

export const updatePaymentStatus = async (req, res, next) => {
	try {
		const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus: req.body.status }, { new: true });
		res.json({ success: true, data: order });
	} catch (err) {
		next(err);
	}
};

export const updateTracking = async (req, res, next) => {
	try {
		const updates = {
			trackingLink: req.body.trackingLink,
			trackingMessage: req.body.trackingMessage,
		};
		const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true });
		res.json({ success: true, data: order });
	} catch (err) {
		next(err);
	}
};

export const updateDeliveryPlatform = async (req, res, next) => {
	try {
		const { deliveryPlatform } = req.body;
		const order = await Order.findByIdAndUpdate(
			req.params.id,
			{ $set: { delivery_platform: deliveryPlatform != null ? String(deliveryPlatform) : '' } },
			{ new: true }
		);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		res.json({ success: true, data: order });
	} catch (err) {
		next(err);
	}
};

export const getOrderById = async (req, res, next) => {
	try {
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		if (req.user && order.customerId?.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		res.json({ success: true, data: order });
	} catch (err) {
		next(err);
	}
};

/**
 * Generate PDF invoice for a confirmed/paid order (if not already generated).
 * User must own the order.
 */
export const generateInvoiceForOrder = async (req, res, next) => {
	try {
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		if (order.customerId?.toString() !== req.user._id.toString()) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		const isPaid = order.paymentStatus === 'paid';
		const isConfirmed = ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.orderStatus);
		if (!isPaid && !isConfirmed) {
			return res.status(400).json({ success: false, message: 'Invoice is available after order is confirmed or paid.' });
		}
		if (order.invoice?.invoiceUrl) {
			return res.json({
				success: true,
				data: { invoiceNumber: order.invoice.invoiceNumber, invoiceUrl: order.invoice.invoiceUrl },
				message: 'Invoice already exists',
			});
		}
		const invoice = await generateInvoice(order);
		order.invoice = {
			invoiceNumber: invoice.invoiceNumber,
			invoiceUrl: invoice.invoiceUrl,
			publicId: invoice.publicId || undefined,
			invoiceGeneratedAt: new Date(),
			sentOnEmail: order.invoice?.sentOnEmail,
			sentOnWhatsapp: order.invoice?.sentOnWhatsapp,
		};
		await order.save();
		res.json({ success: true, data: { invoiceNumber: invoice.invoiceNumber, invoiceUrl: invoice.invoiceUrl } });
	} catch (err) {
		next(err);
	}
};

/**
 * Generate invoice PDF in final bill format and stream for download.
 * Always generates from current order data (no Cloudinary fetch) so format is correct and works after 7-day cleanup.
 */
export const streamOrderInvoice = async (req, res, next) => {
	try {
		const order = await Order.findById(req.params.id).lean();
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

		const isAdmin = req.isAdmin === true;
		const isOwner = req.user && order.customerId?.toString() === req.user._id.toString();
		if (!isAdmin && !isOwner) return res.status(403).json({ success: false, message: 'Forbidden' });

		const isPaidOrConfirmed = order.paymentStatus === 'paid' || ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.orderStatus);
		if (!isPaidOrConfirmed) return res.status(400).json({ success: false, message: 'Invoice is available after order is confirmed or paid.' });

		const invoiceNumber = order.invoice?.invoiceNumber || `INV-IHB-${Date.now()}`;
		const buffer = await generateInvoiceBuffer(order, invoiceNumber);

		const filename = safeInvoicePdfFilename(invoiceNumber);
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		res.setHeader('Content-Length', buffer.length);
		res.send(buffer);
	} catch (err) {
		next(err);
	}
};

export const getProductSales = async (req, res, next) => {
	try {
		const productId = req.params.productId;
		const orders = await Order.find({
			orderStatus: 'delivered',
			'items.productId': productId,
		}).select('items createdAt customerName');

		const sales = [];
		for (const order of orders) {
			const items = order.items.filter((i) => i.productId.toString() === productId);
			for (const item of items) {
				sales.push({
					orderId: order._id,
					customerName: order.customerName || '',
					quantity: item.quantity,
					price: item.price,
					total: item.price * item.quantity,
					createdAt: order.createdAt,
				});
			}
		}

		res.json({ success: true, data: sales });
	} catch (err) {
		next(err);
	}
};

/**
 * Delete order (admin only). Permanently removes the order from the database.
 */
export const deleteOrder = async (req, res, next) => {
	try {
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		await order.deleteOne();
		res.json({ success: true, message: 'Order deleted successfully' });
	} catch (err) {
		next(err);
	}
};
