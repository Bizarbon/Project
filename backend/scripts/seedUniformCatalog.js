const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { syncUniformCatalog, uniformCatalog } = require('../src/utils/catalogSync');

async function seed() {
    try {
        console.log('Connecting to MongoDB...');
        await connectDB();
        console.log('Connected!');

        console.log('Seeding standardized 55-product catalog...');
        const result = await syncUniformCatalog({ force: true });
        console.log(`Successfully seeded: ${result.count} products.`);

        await mongoose.disconnect();
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    seed();
}

module.exports = { seed, uniformCatalog };
