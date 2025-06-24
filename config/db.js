const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017,localhost:27018,localhost:27019/fantsy11?replicaSet=rs0");
    console.log('✅ MongoDB Connected:', process.env.MONGO_URI);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
