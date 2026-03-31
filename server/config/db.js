const mongoose = require('mongoose');
const log = require('../utils/logger');

// Modified connectDB to accept the URI as an argument
const connectDB = async (mongoUri) => {
  if (!mongoUri) {
      log.error('DB', 'MongoDB Connection Error: URI is missing.');
      process.exit(1);
  }
  try {
    const conn = await mongoose.connect(mongoUri);

    log.success('DB', 'MongoDB Connected Successfully');
    return conn;
  } catch (error) {
    log.error('DB', 'MongoDB Connection Error', error);
    process.exit(1);
  }
};

module.exports = connectDB;

