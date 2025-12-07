import { User } from "../models/User.models.js";
import bcrypt from "bcryptjs";

//otp service imports
import { sendOtpEmail } from "../services/OtpEmailVerification.js";

// validator imports
import { SignupValidation, LoginValidation } from "../validator/User.validation.js";

// signup user controller function //
export const SignUp = async (req, res) => {
    try {
        const data = SignupValidation.parse(req.body);

        // chaeking for user already existed in database
        const oldUser = await User.findOne({ email: data.email });

        if (oldUser) {
            return res.status(409).json({ msg: "user already existed", oldUser })
        }

        const newUser = await User.create({
            fullname: data.fullname,
            email: data.email,
            phone_number: data.phone_number,
            Password: data.Password,
        })

        if (!newUser) {
            return res.status(400).json({ msg: "user not created" })
        }

        return res.status(200).json({
            msg: " user created",
            newUser: {
                fullname: data.fullname,
                email: data.email,
                phone_number: data.phone_number
            }
        })
    } catch (error) {
        // Zod Validation Error Handling
        if (error.name === "ZodError") {
            return res.status(400).json({
                msg: "Validation error",
                errors: error.errors,
            });
        }

        console.log("Controller Error:", error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
}

// login user controller function //
export const Login = async (req, res) => {
    try {
        const data = LoginValidation.parse(req.body);

        // get existed user 

        const userExisted = await User.findOne({ email: data.email });
        const user = await userExisted.comparePassword(data.Password);

        await User.updateOne(
            { _id: userExisted._id },
            { $set: { last_login: new Date() } }
        );


        const token = userExisted.generateAuthToken();

        // cookie option
        const option = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            // secure: false, // Set to true if using HTTPS
        };

        if (user) {
            res
                .status(200)
                .cookie("authToken", token, option)
                .json({
                    message: "Login successful",
                    token,
                    user: {
                        id: userExisted._id,
                        fullname: userExisted.fullname,
                        email: userExisted.email,
                        role: userExisted.role
                    }
                });
        } else {
            res.status(401).json({ message: "Invalid email or password." });
        }

    } catch (error) {
        // Zod Validation Error Handling
        if (error.name === "ZodError") {
            return res.status(400).json({
                msg: "Validation error",
                errors: error.errors,
            });
        }

        console.log("Controller Error:", error);
        return res.status(500).json({ msg: "Internal Server Error" });
    }
}

// function for send verify otp using nodemailer 
export const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.params; // use lowercase standard

    if (!email) {
      return res.status(400).json({
        success: false,
        msg: "Email is required",
      });
    }

    // ✅ Find user by email
    const userFound = await User.findOne({ email });

    if (!userFound) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    // ✅ Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // ✅ Hash OTP
    const hashedOtp = await bcrypt.hash(otp, 10);

    // ✅ Expiry time (5 minutes)
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // ✅ Save OTP in DB
    userFound.otp = hashedOtp;
    userFound.otpExpiry = otpExpiry;
    await userFound.save();

    // ✅ Send OTP email
    await sendOtpEmail(userFound.fullname, userFound.email, otp);

    return res.status(200).json({
      success: true,
      msg: "OTP sent successfully to your email",
    });

  } catch (error) {
    console.error("Send OTP Error:", error);

    return res.status(500).json({
      success: false,
      msg: "Internal Server Error",
    });
  }
};