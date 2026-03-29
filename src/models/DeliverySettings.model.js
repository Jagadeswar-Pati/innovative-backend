import mongoose from 'mongoose';

const deliverySettingsSchema = new mongoose.Schema(
	{
		defaultPlatform: { type: String, default: 'Shiprocket' },
	},
	{ timestamps: true }
);

// Single document for app-wide delivery settings
const DeliverySettings = mongoose.model('DeliverySettings', deliverySettingsSchema);

export default DeliverySettings;
