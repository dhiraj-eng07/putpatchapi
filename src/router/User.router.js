import { Router } from "express";

import { SignUp ,Login ,sendEmailOtp , getHistory } from "../controllers/index.js";
import { adminVerify, counsellorVerify } from "../middlewares/auth.middlewares.js";

export const userRouter = Router();

userRouter.post("/signup" , SignUp);
userRouter.post("/login",Login);
userRouter.post("/otp-for-password/:email" , sendEmailOtp);
userRouter.get("/getHistory",counsellorVerify,getHistory);
userRouter.get("/getHistoryByAdmin",adminVerify,getHistory);