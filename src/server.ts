import express from "express";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./config/database";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import authRouter from "./routes/auth.route";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/auth", authRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, async () => {
  try {
    await connectDB();
    console.log(`Server is running on port ${env.PORT}`);
  } catch (err) {
    console.log(err);
  }
});

export default app;
