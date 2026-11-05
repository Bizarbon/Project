const Product = require('../models/Product');
const Counter = require('../models/Counter');
const uniformCatalog = require('../data/uniformCatalog');

let syncPromise = null;

async function repairCanonicalProductAssets() {
    const iphone16ProMax = uniformCatalog.find(item => item.name === 'iPhone 16 Pro Max 256GB');
    if (!iphone16ProMax?.image) return 0;

    const result = await Product.updateOne(
        {
            name: iphone16ProMax.name,
            $or: [
                { image: { $ne: iphone16ProMax.image } },
                { images: { $ne: iphone16ProMax.images } }
            ]
        },
        {
            $set: {
                image: iphone16ProMax.image,
                images: iphone16ProMax.images || [iphone16ProMax.image]
            }
        }
    );

    return result.modifiedCount || 0;
}

async function syncAllProductVariantsAndAssets() {
    let updatedCount = 0;
    try {
        const itemsWithVariants = uniformCatalog.filter(item => item && item.name && Array.isArray(item.variants) && item.variants.length > 0);
        if (itemsWithVariants.length === 0) return 0;

        const dbProds = await Product.find({
            name: { $in: itemsWithVariants.map(i => i.name) }
        }).select('_id name variants image images');

        const dbMap = new Map();
        for (const p of dbProds) {
            dbMap.set(p.name, p);
        }

        const bulkOps = [];
        for (const item of itemsWithVariants) {
            const dbProd = dbMap.get(item.name);
            if (!dbProd) continue;

            const dbVariantsLen = Array.isArray(dbProd.variants) ? dbProd.variants.length : 0;
            const catalogVariantsLen = item.variants.length;

            if (dbVariantsLen !== catalogVariantsLen || dbProd.image !== item.image) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: dbProd._id },
                        update: {
                            $set: {
                                variants: item.variants,
                                image: item.image,
                                images: item.images || [item.image]
                            }
                        }
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            const res = await Product.bulkWrite(bulkOps);
            updatedCount = res.modifiedCount || bulkOps.length;
            console.log(`[CatalogSync] Tự động đồng bộ variants cho ${updatedCount} sản phẩm từ catalog chuẩn via bulkWrite.`);
        }
    } catch (err) {
        console.warn('[CatalogSync] syncAllProductVariantsAndAssets warning:', err.message);
    }
    return updatedCount;
}

async function syncUniformCatalog({ force = false } = {}) {
    const variantUpdatedCount = await syncAllProductVariantsAndAssets();
    const repairedAssetCount = (await repairCanonicalProductAssets()) + variantUpdatedCount;
    const count = await Product.countDocuments();
    const missingVideoCount = count > 0 ? await Product.countDocuments({
        $or: [
            { videoUrl: { $exists: false } },
            { videoUrl: '' },
            { videoUrl: null }
        ]
    }) : 0;
    const hasRelativeImages = count > 0 ? await Product.countDocuments({
        image: { $regex: '^assets/' }
    }) : 0;
    // Nếu cơ sở dữ liệu đã có sản phẩm, đủ số lượng chuẩn và không yêu cầu cưỡng chế (force: true), giữ nguyên dữ liệu
    if (!force && count >= uniformCatalog.length) {
        return {
            synced: false,
            message: 'Catalog đã có dữ liệu sản phẩm đầy đủ và cập nhật.',
            count,
            repairedAssetCount
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
        count: inserted.length,
        repairedAssetCount
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
