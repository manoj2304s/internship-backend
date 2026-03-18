import express from "express";
import connectDB from "./config/database";
import authRouter from "./routes/auth.route";

const app = express();
app.use(express.json());

app.use("/auth", authRouter);

app.listen(3000, async () => {
  try {
    await connectDB();
    console.log("Server is running on port 3000");
  } catch (err) {
    console.log(err);
  }
});

export default app;
