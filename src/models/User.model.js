import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema(
	{
		wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true, lowercase: true },
		password: { type: String },
		mobile: { type: String },
		phone: { type: String },
		profileImage: { type: String },
		googleId: { type: String, unique: true, sparse: true },
		authProvider: { type: String, enum: ['email', 'google'], default: 'email' },
		emailVerified: { type: Boolean, default: false },
		emailVerifyToken: { type: String },
		emailVerifyExpires: { type: Date },
		resetPasswordToken: { type: String },
		resetPasswordExpires: { type: Date },
		status: { type: String, enum: ['active', 'blocked'], default: 'active' },
		isBlocked: { type: Boolean, default: false },
		totalOrders: { type: Number, default: 0 },
		totalAmountSpent: { type: Number, default: 0 },
		addresses: [
			{
				fullName: { type: String },
				phone: { type: String },
				mobile: { type: String },
				street: { type: String },
				addressLine1: { type: String },
				addressLine2: { type: String },
				city: { type: String },
				state: { type: String },
				postalCode: { type: String },
				pincode: { type: String },
				country: { type: String, default: 'India' },
				isDefault: { type: Boolean, default: false },
			}
		],
	},
	{ timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function(next) {
	if (!this.isModified('password')) {
		return next();
	}
	try {
		const salt = await bcryptjs.genSalt(10);
		this.password = await bcryptjs.hash(this.password, salt);
		next();
	} catch (err) {
		next(err);
	}
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
	return await bcryptjs.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
