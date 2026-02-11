import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import ProductProfit from '../models/ProductProfit.model.js';

const buildDateRange = (period, year) => {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom-year': {
      const targetYear = Number(year) || now.getFullYear();
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      break;
    }
    default:
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
};

const buildDateMatch = (period, year) => {
  const { startDate, endDate } = buildDateRange(period, year);
  return { createdAt: { $gte: startDate, $lte: endDate } };
};

// GET DASHBOARD STATS
export const getStats = async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const year = req.query.year;
    const dateMatch = buildDateMatch(period, year);

    const stats = await Promise.all([
      // Total users
      User.countDocuments(),
      // New users in period
      User.countDocuments({ ...dateMatch }),
      // Total orders
      Order.countDocuments(dateMatch),
      // Pending orders
      Order.countDocuments({ orderStatus: 'pending', ...dateMatch }),
      // Total revenue
      Order.aggregate([
        { $match: { orderStatus: 'delivered', ...dateMatch } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Total delivered orders
      Order.countDocuments({ orderStatus: 'delivered', ...dateMatch }),
      // Active products
      Product.countDocuments({ status: 'active' })
    ]);

    const deliveredOrders = stats[5];
    const ordersForProfit = await Order.find({
      orderStatus: 'delivered',
      ...dateMatch,
    }).select('items');

    const productIds = [
      ...new Set(
        ordersForProfit.flatMap((o) => o.items.map((i) => i.productId.toString()))
      ),
    ];
    const [products, overrides] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('sellingPrice'),
      ProductProfit.find({ productId: { $in: productIds } }),
    ]);
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const overrideMap = new Map(overrides.map((p) => [p.productId.toString(), p]));

    let totalProfit = 0;
    for (const order of ordersForProfit) {
      for (const item of order.items) {
        const key = item.productId.toString();
        const override = overrideMap.get(key);
        const product = productMap.get(key);
        const selling = override?.sellingPrice || product?.sellingPrice || 0;
        const buying = override?.buyingPrice || 0;
        const profitPerUnit = selling - buying;
        totalProfit += profitPerUnit * item.quantity;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalUsers: stats[0],
        newUsers: stats[1],
        totalOrders: stats[2],
        pendingOrders: stats[3],
        totalRevenue: stats[4][0]?.total || 0,
        totalDeliveredOrders: deliveredOrders,
        totalProfit,
        activeProducts: stats[6]
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
    const period = req.query.period || 'today';
    const year = req.query.year;
    const dateMatch = buildDateMatch(period, year);

    const products = await Order.aggregate([
      { $match: { orderStatus: 'delivered', ...dateMatch } },
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

export const getProfitInsights = async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const year = req.query.year;
    const dateMatch = buildDateMatch(period, year);

    const sales = await Order.aggregate([
      { $match: { orderStatus: 'delivered', ...dateMatch } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          soldQuantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        },
      },
    ]);

    const productIds = sales.map((s) => s._id);
    const [products, overrides] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('name sku sellingPrice'),
      ProductProfit.find({ productId: { $in: productIds } }),
    ]);
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    const overrideMap = new Map(overrides.map((p) => [p.productId.toString(), p]));

    const enriched = sales.map((s) => {
      const key = s._id.toString();
      const product = productMap.get(key);
      const override = overrideMap.get(key);
      const selling = override?.sellingPrice || product?.sellingPrice || 0;
      const buying = override?.buyingPrice || 0;
      const profitPerUnit = selling - buying;
      const totalProfit = profitPerUnit * s.soldQuantity;
      return {
        productId: key,
        sku: product?.sku || '',
        name: product?.name || '',
        soldQuantity: s.soldQuantity || 0,
        revenue: s.revenue || 0,
        profitPerUnit,
        totalProfit,
      };
    });

    const mostSold = [...enriched].sort((a, b) => b.soldQuantity - a.soldQuantity)[0] || null;
    const mostProfitable = [...enriched].sort((a, b) => b.totalProfit - a.totalProfit)[0] || null;
    const leastProfitable = [...enriched].sort((a, b) => a.totalProfit - b.totalProfit)[0] || null;
    const totalProfit = enriched.reduce((sum, p) => sum + p.totalProfit, 0);

    const orders = await Order.find({
      orderStatus: 'delivered',
      ...dateMatch,
    }).select('items createdAt');

    const trendMap = new Map();
    for (const order of orders) {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      const current = trendMap.get(dateKey) || 0;
      let orderProfit = 0;
      for (const item of order.items) {
        const key = item.productId.toString();
        const product = productMap.get(key);
        const override = overrideMap.get(key);
        const selling = override?.sellingPrice || product?.sellingPrice || 0;
        const buying = override?.buyingPrice || 0;
        orderProfit += (selling - buying) * item.quantity;
      }
      trendMap.set(dateKey, current + orderProfit);
    }

    const profitTrend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, totalProfitValue]) => ({ date, totalProfit: totalProfitValue }));

    res.status(200).json({
      success: true,
      data: {
        totalProfit,
        mostSoldProduct: mostSold,
        mostProfitableProduct: mostProfitable,
        leastProfitableProduct: leastProfitable,
        profitTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};