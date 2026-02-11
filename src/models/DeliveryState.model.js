import mongoose from 'mongoose';

const deliveryStateSchema = new mongoose.Schema(
	{
		state: { type: String, required: true, trim: true, unique: true },
		defaultShippingCharge: { type: Number, required: true, min: 0, default: 0 },
		manualBaseCharge: { type: Number, required: true, min: 0, default: 0 },
		enabled: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

deliveryStateSchema.index({ state: 1 });
deliveryStateSchema.index({ enabled: 1 });

const DeliveryState = mongoose.model('DeliveryState', deliveryStateSchema);

export default DeliveryState;
