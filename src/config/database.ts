import mongoose from "mongoose";
import { env } from "./env";

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("DB connected");
  } catch (error) {
    console.error("Database connection failed", error);
    process.exit(1);
  }
};

export default connectDB;
