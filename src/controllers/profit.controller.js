import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';
import ProductProfit from '../models/ProductProfit.model.js';

export const getProfitProducts = async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim().toLowerCase();
    const productFilter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const products = await Product.find(productFilter).select('name sku sellingPrice gstMode gstPercentage');
    const productIds = products.map((p) => p._id);

    const [overrides, sales] = await Promise.all([
      ProductProfit.find({ productId: { $in: productIds } }),
      Order.aggregate([
        { $match: { orderStatus: 'delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.productId': { $in: productIds } } },
        {
          $group: {
            _id: '$items.productId',
            soldQuantity: { $sum: '$items.quantity' },
          },
        },
      ]),
    ]);

    const overrideMap = new Map(overrides.map((p) => [p.productId.toString(), p]));
    const salesMap = new Map(sales.map((s) => [s._id.toString(), s]));

    const data = products.map((p) => {
      const override = overrideMap.get(p._id.toString());
      const sale = salesMap.get(p._id.toString());
      const baseSelling = Number(p.sellingPrice || 0);
      const gstMode = p.gstMode || 'including';
      const gstPercentage = Number(p.gstPercentage || 0);
      const productFinal = gstMode === 'excluding' ? baseSelling * (1 + gstPercentage / 100) : baseSelling;
      const selling = override?.sellingPrice ?? productFinal;
      const normalizedSelling = Math.round(Number(selling || 0) * 100) / 100;
      const buying = override?.buyingPrice || 0;
      const profitPerUnit = normalizedSelling - buying;
      const soldQuantity = sale?.soldQuantity || 0;
      const totalProfit = profitPerUnit * soldQuantity;
      return {
        productId: p._id,
        sku: p.sku || '',
        name: p.name || '',
        buyingPrice: buying,
        sellingPrice: normalizedSelling,
        profitPerUnit,
        soldQuantity,
        totalProfit,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateProfitPricing = async (req, res, next) => {
  try {
    const { buyingPrice, sellingPrice } = req.body;
    const productId = req.params.productId;
    const update = {};
    if (buyingPrice != null) update.buyingPrice = Number(buyingPrice);
    if (sellingPrice != null) update.sellingPrice = Number(sellingPrice);

    const doc = await ProductProfit.findOneAndUpdate(
      { productId },
      { $set: update },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};
