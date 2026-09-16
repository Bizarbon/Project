const mongoose = require('mongoose');

let connectionPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return mongoose.connection;

    const uri = process.env.MONGO_URI
        || (process.env.NODE_ENV !== 'production' ? 'mongodb://localhost:27017/ecommerce_mini' : '');

    if (!uri) throw new Error('MONGO_URI chưa được cấu hình.');

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000
        }).then(conn => {
            console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
            return conn.connection;
        }).catch(error => {
            connectionPromise = null;
            throw error;
        });
    }

    return connectionPromise;
};

module.exports = connectDB;
