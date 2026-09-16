const Product = require('../models/Product');

const RESTORE_STATUSES = new Set(['cancelled', 'returned', 'boom']);
const ACTIVE_STATUSES = new Set(['pending', 'processing', 'shipping', 'completed']);

async function reserveStock(items) {
    const reserved = [];

    for (const item of items) {
        const quantity = Number(item.quantity);
        const result = await Product.updateOne(
            { _id: item.product, stock: { $gte: quantity } },
            { $inc: { stock: -quantity } }
        );

        if (result.modifiedCount !== 1) {
            await rollbackStock(reserved);
            const product = await Product.findById(item.product).select('name');
            const name = product ? product.name : `#${item.product}`;
            const error = new Error(`Sản phẩm ${name} không đủ tồn kho!`);
            error.statusCode = 400;
            throw error;
        }

        reserved.push({ product: item.product, quantity });
    }
}

async function rollbackStock(items) {
    for (const item of items) {
        await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: Number(item.quantity) } }
        );
    }
}

async function restoreOrderStock(order) {
    if (!order || order.stockRestored) return false;
    await rollbackStock(order.products || []);
    order.stockRestored = true;
    return true;
}

async function reReserveOrderStock(order) {
    if (!order || !order.stockRestored) return false;
    await reserveStock(order.products || []);
    order.stockRestored = false;
    return true;
}

function shouldRestore(status) {
    return RESTORE_STATUSES.has(status);
}

function shouldReserve(status) {
    return ACTIVE_STATUSES.has(status);
}

module.exports = {
    reserveStock,
    restoreOrderStock,
    reReserveOrderStock,
    shouldRestore,
    shouldReserve
};
