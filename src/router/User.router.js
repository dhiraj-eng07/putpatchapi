import { Router } from "express";

import { SignUp ,Login ,sendEmailOtp } from "../controllers/index.js";

export const userRouter = Router();

userRouter.post("/signup" , SignUp);
userRouter.post("/login",Login);
userRouter.post("/otp-for-password/:email" , sendEmailOtp);