// Create order (user)
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import { createNotification } from '../utils/notificationHelpers.js';
import { generateInvoice, generateInvoiceBuffer } from '../utils/invoice.js';
import { sendOrderDeliveredEmail } from '../utils/mailer.js';

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

export const updateOrderStatus = async (req, res, next) => {
	try {
		const order = await Order.findById(req.params.id);
		if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
		const previousStatus = order.orderStatus;
		const nextStatus = req.body.status;

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
			// Send "order delivered" email to customer
			User.findById(order.customerId).select('email name').lean().then((user) => {
				if (user?.email) {
					sendOrderDeliveredEmail({
						email: user.email,
						name: user.name || order.customerName || 'Customer',
						order: { _id: order._id, totalAmount: order.totalAmount },
					}).catch((err) => console.error('Delivered email failed:', err?.message || err));
				}
			}).catch(() => {});
		} else if (previousStatus === 'delivered' && nextStatus !== 'delivered') {
			await User.findByIdAndUpdate(order.customerId, {
				$inc: {
					totalOrders: -1,
					totalAmountSpent: -Number(order.totalAmount || 0),
				},
			});
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

		const filename = `invoice-${invoiceNumber}.pdf`;
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
