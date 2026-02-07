import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';

// GET DASHBOARD STATS
export const getStats = async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    let startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const stats = await Promise.all([
      // Total users
      User.countDocuments(),
      // New users in period
      User.countDocuments({ createdAt: { $gte: startDate } }),
      // Total orders
      Order.countDocuments(),
      // Pending orders
      Order.countDocuments({ orderStatus: 'pending' }),
      // Total revenue
      Order.aggregate([
        { $match: { orderStatus: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Active products
      Product.countDocuments({ status: 'active' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers: stats[0],
        newUsers: stats[1],
        totalOrders: stats[2],
        pendingOrders: stats[3],
        totalRevenue: stats[4][0]?.total || 0,
        activeProducts: stats[5]
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET RECENT ORDERS
export const getRecentOrders = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const orders = await Order.find()
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// GET ACTIVITY ALERTS
export const getActivityAlerts = async (req, res, next) => {
  try {
    const alerts = [];

    // Check for low stock products
    const lowStockProducts = await Product.find({
      stockQuantity: { $lt: 10 },
      status: 'active'
    }).select('name stockQuantity');

    if (lowStockProducts.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Low Stock Alert',
        message: `${lowStockProducts.length} products have low stock`,
        data: lowStockProducts
      });
    }

    // Check for pending orders
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    if (pendingOrders > 0) {
      alerts.push({
        type: 'info',
        title: 'Pending Orders',
        message: `${pendingOrders} orders are pending`,
        data: { count: pendingOrders }
      });
    }

    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
};

// GET MOST DEMANDING PRODUCTS
export const getMostDemandingProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const products = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 1,
          name: '$product.name',
          totalQuantity: 1,
          totalRevenue: 1,
          image: { $arrayElemAt: ['$product.images.url', 0] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};