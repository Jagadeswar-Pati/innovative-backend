import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },

    shortDescription: {
      type: String,
      required: true
    },

    longDescription: {
      type: String
    },

    categories: [
      {
        type: String,
        required: true
      }
    ],

    mrp: {
      type: Number,
      required: true
    },

    sellingPrice: {
      type: Number,
      required: true
    },

    gstMode: {
      type: String,
      enum: ['including', 'excluding'],
      default: 'including'
    },

    gstPercentage: {
      type: Number,
      default: 18
    },

    stockQuantity: {
      type: Number,
      default: 0
    },

    stockStatus: {
      type: String,
      enum: ['in_stock', 'out_of_stock'],
      default: 'in_stock'
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },

    images: [
      {
        url: {
          type: String,
          required: true
        },
        publicId: {
          type: String,
          default: ''
        }
      }
    ],

    videos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' }
      }
    ]
  },
  { timestamps: true }
);

// Indexes for fast list queries: pagination, category filter, sort by newest (_id already indexed by MongoDB)
productSchema.index({ categories: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ categories: 1, createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, categories: 1, createdAt: -1 });

productSchema.pre('save', function (next) {
  this.stockStatus =
    this.stockQuantity > 0 ? 'in_stock' : 'out_of_stock';
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;
