// Create order (user)
import Product from '../models/Product.model.js';

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
import Order from '../models/Order.model.js';

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
		const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.status }, { new: true });
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
