import DeliveryState from '../models/DeliveryState.model.js';
import DeliverySettings from '../models/DeliverySettings.model.js';
import Order from '../models/Order.model.js';

const DEFAULT_SHIPPING = 0;
const DEFAULT_MANUAL_CHARGE = 0;

/**
 * Get delivery charge for a state (for checkout).
 * Public/authenticated - used by frontend to display shipping.
 */
export const getStateCharges = async (req, res, next) => {
	try {
		const { state } = req.query;
		const normalized = (state != null && typeof state === 'string') ? String(state).trim() : '';
		if (!normalized) {
			return res.json({
				success: true,
				data: { state: '', defaultShippingCharge: DEFAULT_SHIPPING, manualBaseCharge: DEFAULT_MANUAL_CHARGE },
			});
		}
		const doc = await DeliveryState.findOne({ state: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, enabled: true });
		const defaultCharge = doc ? Number(doc.defaultShippingCharge) : DEFAULT_SHIPPING;
		const manualCharge = doc ? Number(doc.manualBaseCharge) : DEFAULT_MANUAL_CHARGE;
		res.json({
			success: true,
			data: {
				state: normalized,
				defaultShippingCharge: defaultCharge,
				manualBaseCharge: manualCharge,
			},
		});
	} catch (err) {
		next(err);
	}
};

/**
 * Get all state-wise charges (admin).
 */
export const getAllStateCharges = async (req, res, next) => {
	try {
		const list = await DeliveryState.find().sort({ state: 1 });
		res.json({ success: true, data: list });
	} catch (err) {
		next(err);
	}
};

/**
 * Create state-wise delivery pricing (admin).
 */
export const createStateCharge = async (req, res, next) => {
	try {
		const { state, defaultShippingCharge, manualBaseCharge, enabled } = req.body;
		if (!state || typeof state !== 'string' || !state.trim()) {
			return res.status(400).json({ success: false, message: 'state is required' });
		}
		const normalized = String(state).trim();
		const payload = {
			state: normalized,
			defaultShippingCharge: Number(defaultShippingCharge) >= 0 ? Number(defaultShippingCharge) : 0,
			manualBaseCharge: Number(manualBaseCharge) >= 0 ? Number(manualBaseCharge) : 0,
			enabled: enabled !== false,
		};
		const doc = await DeliveryState.findOneAndUpdate(
			{ state: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
			{ $set: payload },
			{ new: true, upsert: true }
		);
		res.json({ success: true, data: doc });
	} catch (err) {
		next(err);
	}
};

/**
 * Update state-wise delivery pricing by id (admin).
 */
export const updateStateCharge = async (req, res, next) => {
	try {
		const { stateId } = req.params;
		const { state, defaultShippingCharge, manualBaseCharge, enabled } = req.body;
		const update = {};
		if (state !== undefined && typeof state === 'string' && state.trim()) update.state = state.trim();
		if (defaultShippingCharge !== undefined) update.defaultShippingCharge = Math.max(0, Number(defaultShippingCharge));
		if (manualBaseCharge !== undefined) update.manualBaseCharge = Math.max(0, Number(manualBaseCharge));
		if (enabled !== undefined) update.enabled = enabled !== false;
		const doc = await DeliveryState.findByIdAndUpdate(stateId, { $set: update }, { new: true });
		if (!doc) return res.status(404).json({ success: false, message: 'State not found' });
		res.json({ success: true, data: doc });
	} catch (err) {
		next(err);
	}
};

/**
 * Delete state charge by id (admin).
 */
export const deleteStateCharge = async (req, res, next) => {
	try {
		const { stateId } = req.params;
		const doc = await DeliveryState.findByIdAndDelete(stateId);
		if (!doc) return res.status(404).json({ success: false, message: 'State not found' });
		res.json({ success: true, data: doc });
	} catch (err) {
		next(err);
	}
};

/**
 * Delivery tracking dashboard stats (admin).
 */
export const getDeliveryDashboard = async (req, res, next) => {
	try {
		const orders = await Order.find().select('delivery_method delivery_charge delivery_status state pricing createdAt').lean();
		const totalOrders = orders.length;
		const byMethod = { default: 0, manual: 0 };
		const byState = {};
		let totalShippingCollected = 0;
		let pendingDeliveries = 0;
		let completedDeliveries = 0;

		for (const o of orders) {
			const method = o.delivery_method || 'default';
			byMethod[method] = (byMethod[method] || 0) + 1;
			const state = o.state || o.addressSnapshot?.state || 'Unknown';
			byState[state] = (byState[state] || 0) + 1;
			const charge = Number(o.delivery_charge ?? o.pricing?.deliveryCharge ?? 0);
			totalShippingCollected += charge;
			const status = o.delivery_status || 'pending';
			if (status === 'delivered') completedDeliveries++;
			else pendingDeliveries++;
		}

		res.json({
			success: true,
			data: {
				totalOrders,
				ordersByDeliveryMethod: byMethod,
				ordersByState: byState,
				totalShippingCollected,
				pendingDeliveries,
				completedDeliveries,
			},
		});
	} catch (err) {
		next(err);
	}
};

/**
 * Get default delivery platform (admin).
 */
export const getDefaultPlatform = async (req, res, next) => {
	try {
		let doc = await DeliverySettings.findOne().lean();
		if (!doc) {
			await DeliverySettings.create({ defaultPlatform: 'Shiprocket' });
			doc = await DeliverySettings.findOne().lean();
		}
		res.json({ success: true, data: { defaultPlatform: doc?.defaultPlatform || 'Shiprocket' } });
	} catch (err) {
		next(err);
	}
};

/**
 * Set default delivery platform (admin).
 */
export const setDefaultPlatform = async (req, res, next) => {
	try {
		const { defaultPlatform } = req.body;
		const doc = await DeliverySettings.findOneAndUpdate(
			{},
			{ $set: { defaultPlatform: String(defaultPlatform || 'Shiprocket').trim() } },
			{ new: true, upsert: true }
		);
		res.json({ success: true, data: { defaultPlatform: doc.defaultPlatform } });
	} catch (err) {
		next(err);
	}
};
