const Product = require('../models/Product');
const Counter = require('../models/Counter');
const uniformCatalog = require('../data/uniformCatalog');

let syncPromise = null;

async function syncUniformCatalog({ force = false } = {}) {
    const count = await Product.countDocuments();
    const missingVideoCount = count > 0 ? await Product.countDocuments({
        $or: [
            { videoUrl: { $exists: false } },
            { videoUrl: '' },
            { videoUrl: null }
        ]
    }) : 0;
    const isOutdated = count !== uniformCatalog.length || missingVideoCount > 0;

    // Nếu cơ sở dữ liệu đã có sản phẩm, đủ số lượng chuẩn và không thiếu video, và không yêu cầu cưỡng chế (force: true), giữ nguyên dữ liệu
    if (!force && count > 0 && !isOutdated) {
        return {
            synced: false,
            message: 'Catalog đã có dữ liệu sản phẩm đầy đủ và cập nhật.',
            count
        };
    }

    console.log(`[CatalogSync] Khởi tạo catalog sản phẩm mẫu (force=${force}, count=${count}). Đang nạp ${uniformCatalog.length} sản phẩm chuẩn...`);

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
