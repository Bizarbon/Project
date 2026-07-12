const mongoose = require('mongoose');
const Counter = require('../models/Counter');

// Mapping model name to its counter ID
const counterMap = {
  'Customer': 'customerId',
  'Product': 'productId',
  'Supplier': 'supplierId',
  'Order': 'orderId'
};

/**
 * Generic renumber function for any model in MongoDB
 * Since _id is immutable, we must: Clone -> Delete -> Insert New -> Update Refs
 */
async function renumberModel(Model, refsToUpdate = []) {
  // We avoid using sessions/transactions here because they require a Replica Set
  // which may not be available in local development environments.
  
  try {
    // Step 1: Get all remaining records sorted by current _id
    const records = await Model.find().sort({ _id: 1 });
    
    const idMap = []; // Stores { oldId, newId }
    
    // Step 2: Process each record to see if it needs a new ID
    for (let i = 0; i < records.length; i++) {
        const oldId = records[i]._id;
        const newId = i + 1;

        if (oldId !== newId) {
            // 1. Clone data (exclude _id)
            const data = records[i].toObject();
            delete data._id;
            data._id = newId;

            // 2. Delete original document
            await Model.deleteOne({ _id: oldId });

            // 3. Create new document with new _id using native driver to bypass hooks
            await Model.collection.insertOne(data);

            idMap.push({ oldId, newId });
        }
    }

    // Step 3: Update referencing foreign keys in other collections
    for (const ref of refsToUpdate) {
        const RefModel = mongoose.model(ref.model);
        const field = ref.field;

        for (const mapping of idMap) {
            // Update the referencing field with the new ID
            if (field.includes('.')) {
                // Handle nested array fields (e.g., 'products.product')
                const parts = field.split('.');
                const parentField = parts[0];
                const subField = parts[1];
                const filterKey = 'elem';

                await RefModel.updateMany(
                    { [field]: mapping.oldId },
                    { $set: { [`${parentField}.$[${filterKey}].${subField}`]: mapping.newId } },
                    { arrayFilters: [{ [`${filterKey}.${subField}`]: mapping.oldId }] }
                );
            } else {
                // Simple top-level field
                await RefModel.updateMany(
                    { [field]: mapping.oldId },
                    { $set: { [field]: mapping.newId } }
                );
            }
        }
    }

    // Step 4: Update the Counter sequence to prevent collisions
    const counterId = counterMap[Model.modelName];
    if (counterId) {
        await Counter.findByIdAndUpdate(
            counterId,
            { seq: records.length },
            { upsert: true }
        );
    }

    console.log(`✅ Renumbered ${Model.modelName}: ${records.length} records, ${idMap.length} IDs changed.`);
    return idMap;

  } catch (error) {
    console.error(`❌ Renumber ${Model.modelName} failed:`, error);
    throw error;
  }
}

module.exports = { renumberModel };
