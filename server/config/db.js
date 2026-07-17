const mongoose = require('mongoose');
const log = require('../utils/logger');

// Modified connectDB to accept the URI as an argument
const connectDB = async (mongoUri) => {
  if (!mongoUri) {
      log.error('DB', 'MongoDB Connection Error: URI is missing.');
      process.exit(1);
  }
  try {
    // [Optimization] Explicit pool settings — Mongoose default (5) is too low for 50+ concurrent users
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize:    parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 20,  // concurrent request throughput
      minPoolSize:    parseInt(process.env.MONGO_MIN_POOL_SIZE, 10) || 2,   // keep warm connections
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 10) || 45000, // match LLM call duration
      serverSelectionTimeoutMS: 5000,  // fail fast if MongoDB is unreachable
    });

    log.success('DB', `MongoDB Connected Successfully (pool: ${conn.connection.config?.maxPoolSize || 20})`);
    return conn;
  } catch (error) {
    log.error('DB', 'MongoDB Connection Error', error);
    process.exit(1);
  }
};

module.exports = connectDB;

