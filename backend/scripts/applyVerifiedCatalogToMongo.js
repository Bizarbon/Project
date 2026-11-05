const mongoose = require('mongoose');
const uniformCatalog = require('../src/data/uniformCatalog.js');
const Product = require('../src/models/Product.js');
const Counter = require('../src/models/Counter.js');

async function applyToMongo() {
    await mongoose.connect('mongodb://127.0.0.1:27017/ecommerce_mini');
    console.log('Connected to MongoDB.');

    console.log(`Applying updates for ${uniformCatalog.length} catalog items without changing IDs...`);

    let updatedCount = 0;
    let createdCount = 0;

    for (let i = 0; i < uniformCatalog.length; i++) {
        const item = uniformCatalog[i];
        const id = i + 1;

        const existing = await Product.findById(id);
        if (existing) {
            // Update existing record while preserving admin-set internal price & inventory if already customized
            await Product.findByIdAndUpdate(id, {
                $set: {
                    name: item.name,
                    brand: item.brand,
                    category: item.category,
                    image: item.image,
                    images: item.images,
                    sourceUrl: item.sourceUrl,
                    originalImageUrl: item.originalImageUrl,
                    sourceFetchedAt: item.sourceFetchedAt,
                    specs: item.specs,
                    description: item.description,
                    tags: item.tags,
                    videoUrl: item.videoUrl || existing.videoUrl,
                    variants: item.variants || []
                }
            });
            updatedCount++;
        } else {
            await Product.create({
                ...item,
                _id: id,
                sku: item.sku || `TECH-${String(id).padStart(5, '0')}`
            });
            createdCount++;
        }
    }

    await Counter.findByIdAndUpdate(
        'productId',
        { seq: Math.max(uniformCatalog.length, (await Product.countDocuments())) },
        { upsert: true }
    );

    const total = await Product.countDocuments();
    console.log(`\nApply complete!`);
    console.log(`  - Updated: ${updatedCount}`);
    console.log(`  - Created: ${createdCount}`);
    console.log(`  - Total in DB: ${total}`);

    await mongoose.disconnect();
}

applyToMongo().catch(err => {
    console.error('Failed to apply catalog:', err);
    process.exit(1);
});
