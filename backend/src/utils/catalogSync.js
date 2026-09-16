const Product = require('../models/Product');
const Counter = require('../models/Counter');
const uniformCatalog = require('../data/uniformCatalog');

let syncPromise = null;

async function syncUniformCatalog({ force = false } = {}) {
    const marker = await Product.findOne({ sku: 'TECH-00001' });
    const count = await Product.countDocuments();

    if (!force && marker && count >= 55) {
        return {
            synced: false,
            message: 'Catalog đã chuẩn hóa và đầy đủ.',
            count
        };
    }

    console.log(`[CatalogSync] Cần đồng bộ catalog. Hiện tại: ${count} sản phẩm. Đang cập nhật 55 sản phẩm chuẩn...`);

    // Chuẩn bị 55 sản phẩm với _id và sku chuẩn
    const productsToInsert = uniformCatalog.map((item, index) => {
        const id = index + 1;
        return {
            ...item,
            _id: id,
            sku: item.sku || `TECH-${String(id).padStart(5, '0')}`
        };
    });

    await Product.deleteMany({});
    const inserted = await Product.insertMany(productsToInsert);

    await Counter.findByIdAndUpdate(
        'productId',
        { seq: uniformCatalog.length },
        { upsert: true }
    );

    console.log(`[CatalogSync] Đồng bộ thành công ${inserted.length} sản phẩm chuẩn! Counter seq: ${uniformCatalog.length}`);

    return {
        synced: true,
        message: `Đã đồng bộ thành công ${inserted.length} sản phẩm chuẩn.`,
        count: inserted.length
    };
}

async function ensureCatalogSynchronized() {
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
        try {
            await syncUniformCatalog({ force: false });
        } catch (err) {
            console.error('[CatalogSync] Lỗi tự động đồng bộ catalog:', err.message);
        } finally {
            syncPromise = null;
        }
    })();
    return syncPromise;
}

module.exports = {
    syncUniformCatalog,
    ensureCatalogSynchronized,
    uniformCatalog
};
