import express from "express";
import connectDB from "./config/database";

const app = express();

app.listen(3000, async () => {
  try {
    await connectDB();
    console.log("Server is running on port 3000");
  } catch (err) {
    console.log(err);
  }
});

export default app;
