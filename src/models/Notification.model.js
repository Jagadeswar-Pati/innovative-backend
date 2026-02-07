import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
	{
		type: { type: String },
		title: { type: String, required: true },
		message: { type: String, required: true },
		read: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
