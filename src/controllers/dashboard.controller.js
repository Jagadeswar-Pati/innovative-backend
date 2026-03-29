import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import ProductProfit from '../models/ProductProfit.model.js';
import DashboardAdjustment from '../models/DashboardAdjustment.model.js';
import OfflineOrder from '../models/OfflineOrder.model.js';

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
  if (period === 'all') return {};
  const { startDate, endDate } = buildDateRange(period, year);
  return { createdAt: { $gte: startDate, $lte: endDate } };
};

const buildOfflineOrderDateMatch = (period, year) => {
  if (period === 'all') return {};
  const { startDate, endDate } = buildDateRange(period, year);
  return { orderDate: { $gte: startDate, $lte: endDate } };
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

    const offlineDateMatch = buildOfflineOrderDateMatch(period, year);
    const offlineStats = await OfflineOrder.aggregate([
      { $match: offlineDateMatch },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0],
            },
          },
          deliveredOrders: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0],
            },
          },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'delivered'] }, '$totalAmount', 0],
            },
          },
          totalProfit: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus', 'delivered'] }, '$profitAmount', 0],
            },
          },
        },
      },
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

    const rawRevenue = stats[4][0]?.total || 0;
    const rawOrders = stats[2];
    const rawDelivered = deliveredOrders;
    const offline = offlineStats[0] || {
      totalOrders: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      totalRevenue: 0,
      totalProfit: 0,
    };

    const adj = await DashboardAdjustment.findOne({ name: 'default' }).lean();
    const manualOrders = adj?.manualOrders ?? 0;
    const manualRevenue = adj?.manualRevenue ?? 0;
    const manualProfit = adj?.manualProfit ?? 0;
    const manualCompletedOrders = adj?.manualCompletedOrders ?? 0;

    res.status(200).json({
      success: true,
      data: {
        totalUsers: stats[0],
        newUsers: stats[1],
        totalOrders: rawOrders + offline.totalOrders + manualOrders,
        pendingOrders: stats[3] + offline.pendingOrders,
        totalRevenue: rawRevenue + offline.totalRevenue + manualRevenue,
        totalDeliveredOrders: rawDelivered + offline.deliveredOrders + manualCompletedOrders,
        totalProfit: totalProfit + offline.totalProfit + manualProfit,
        activeProducts: stats[6],
        online: {
          totalOrders: rawOrders,
          deliveredOrders: rawDelivered,
          totalRevenue: rawRevenue,
          totalProfit,
        },
        offline: {
          totalOrders: offline.totalOrders,
          pendingOrders: offline.pendingOrders,
          deliveredOrders: offline.deliveredOrders,
          totalRevenue: offline.totalRevenue,
          totalProfit: offline.totalProfit,
        },
        adjustments: {
          manualOrders,
          manualRevenue,
          manualProfit,
          manualCompletedOrders,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET DASHBOARD ADJUSTMENTS (manual add/remove values for orders, revenue, profit, completed orders)
export const getAdjustments = async (req, res, next) => {
  try {
    let doc = await DashboardAdjustment.findOne({ name: 'default' });
    if (!doc) {
      doc = await DashboardAdjustment.create({ name: 'default' });
    }
    res.status(200).json({
      success: true,
      data: {
        manualOrders: doc.manualOrders ?? 0,
        manualRevenue: doc.manualRevenue ?? 0,
        manualProfit: doc.manualProfit ?? 0,
        manualCompletedOrders: doc.manualCompletedOrders ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH DASHBOARD ADJUSTMENTS — set or add. Body: manualOrders, manualRevenue, manualProfit, manualCompletedOrders (set values), or addOrders, addRevenue, addProfit, addCompletedOrders (deltas to add).
export const updateAdjustments = async (req, res, next) => {
  try {
    const {
      manualOrders,
      manualRevenue,
      manualProfit,
      manualCompletedOrders,
      addOrders,
      addRevenue,
      addProfit,
      addCompletedOrders,
    } = req.body;

    let doc = await DashboardAdjustment.findOne({ name: 'default' });
    if (!doc) {
      doc = await DashboardAdjustment.create({ name: 'default' });
    }

    if (addOrders != null) doc.manualOrders = (doc.manualOrders ?? 0) + Number(addOrders);
    else if (manualOrders != null) doc.manualOrders = Number(manualOrders);
    if (addRevenue != null) doc.manualRevenue = (doc.manualRevenue ?? 0) + Number(addRevenue);
    else if (manualRevenue != null) doc.manualRevenue = Number(manualRevenue);
    if (addProfit != null) doc.manualProfit = (doc.manualProfit ?? 0) + Number(addProfit);
    else if (manualProfit != null) doc.manualProfit = Number(manualProfit);
    if (addCompletedOrders != null) doc.manualCompletedOrders = (doc.manualCompletedOrders ?? 0) + Number(addCompletedOrders);
    else if (manualCompletedOrders != null) doc.manualCompletedOrders = Number(manualCompletedOrders);

    await doc.save();

    res.status(200).json({
      success: true,
      data: {
        manualOrders: doc.manualOrders ?? 0,
        manualRevenue: doc.manualRevenue ?? 0,
        manualProfit: doc.manualProfit ?? 0,
        manualCompletedOrders: doc.manualCompletedOrders ?? 0,
      },
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

    const offlineProfitMatch = {
      ...buildOfflineOrderDateMatch(period, year),
      orderStatus: 'delivered',
    };
    const offlineProfitAgg = await OfflineOrder.aggregate([
      { $match: offlineProfitMatch },
      { $group: { _id: null, total: { $sum: '$profitAmount' } } },
    ]);
    const offlineProfitTotal = offlineProfitAgg[0]?.total || 0;

    const offlineForTrend = await OfflineOrder.find(offlineProfitMatch)
      .select('orderDate profitAmount')
      .lean();

    for (const o of offlineForTrend) {
      const d = o.orderDate;
      if (!d) continue;
      const dateKey = new Date(d).toISOString().slice(0, 10);
      const current = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, current + (Number(o.profitAmount) || 0));
    }

    const profitTrend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, totalProfitValue]) => ({ date, totalProfit: totalProfitValue }));

    res.status(200).json({
      success: true,
      data: {
        totalProfit: totalProfit + offlineProfitTotal,
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