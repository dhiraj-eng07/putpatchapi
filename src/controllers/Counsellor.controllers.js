import { User } from "../models/User.models.js"
import { Counsellor } from "../models/Counsellor.models.js"
import { ImagekitFileUploader } from "../services/imagekit.services.js"
import { CounsellorLoginValiation, CounsellorValidation } from "../validator/Counsellor.validation.js"
import bcrypt from "bcryptjs"

export const CounsellorSignup = async (req, res) => {
    try {
        const data = CounsellorValidation.parse(req.body);

        // Check if email exists
        const existing = await User.findOne({ email: data.email });
        if (existing) {
            return res.status(400).json({ msg: "Email already registered" });
        }

        const user = await User.create({
            fullname: data.fullname,
            email: data.email,
            Password: data.Password,
            phone_number: data.contact_number,
            dob: data.dob,
            gender: data.gender,
            preferred_language: data.preferred_language,
            timezone: data.timezone,
            role: "counsellor"
        });

        /* ---------------------------------------------------------
       HANDLE FILES UPLOAD VIA MULTER
    --------------------------------------------------------- */
        const f = req.files;

        console.log("BODY:", req.body);
        console.log("FILES:", req.files);


        const uploadIfExists = async (file) => {
            return file ? await ImagekitFileUploader(file.path, file.originalname) : null;
        };

        const governmentID = await uploadIfExists(f?.government_id?.[0]);
        const profilePicture = await uploadIfExists(f?.profile_picture?.[0]);
        const qualificationCert = await uploadIfExists(f?.qualification_certificates?.[0]);
        const licenceDoc = await uploadIfExists(f?.licence?.[0]);
        const experienceLetter = await uploadIfExists(f?.experince_letter?.[0]);
        const additionalDocs = await uploadIfExists(f?.additional_documents?.[0]);

        /* ---------------------------------------------------------
           CREATE COUNSELLOR PROFILE
        --------------------------------------------------------- */
        const profile = await Counsellor.create({
            user_id: user._id,
            fullname: data.fullname,
            email: data.email,
            dob: data.dob,
            gender: data.gender,
            contact_number: data.contact_number,
            counselling_type: data.counselling_type,
            specialties: data.specialties,
            bio: data.bio,
            qualifications: data.qualifications,
            years_experience: data.years_experience,
            languages: data.languages,
            hourly_rate: data.hourly_rate,
            availability: data.availability,
            session_type: data.session_type,
            calendar_integration: data.calendar_integration || false,

            // STORE DOCUMENTS IN PROPER NESTED STRUCTURE
            documents: {
                government_id: governmentID?.url,
                profile_picture: profilePicture?.url,
                qualification_certificates: qualificationCert?.url,
                licence: licenceDoc?.url,
                experince_letter: experienceLetter?.url || null,
                additional_documents: additionalDocs?.url || null,
            },
        });

        return res.status(201).json({
            msg: "Counsellor registered successfully",
            user,
            profile,
        });


    } catch (error) {
        console.log(error)
    }
}

export const CounsellorLogin = async (req, res) => {
    try {
        const data = CounsellorLoginValiation.parse(req.body);

        const userExisted = await User.findOne({ email: data.email });
        const counsellor = await Counsellor.findOne({ email: data.email })

        if (!userExisted) {
            return res.status(404).json({ msg: "user not found" })
        }

        if (userExisted.role != "counsellor") {
            return res.status(402).json({ msg: "only counsellor can login" })
        }

        if (!counsellor.Admin_approved) {
            return res.status(403).json({ msg: "Your profile is not approved by admin yet after approved you can login" });
        }

        const user = await userExisted.comparePassword(data.Password);

        if (!user) {
            return res.status(400).json({ msg: "email or password maybe not correct" })
        }
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
        console.log(error)
    }
}

export const getallCounsellor = async (req, res) => {
    try {
        const counsellor = await Counsellor.find().select("-documents -history -Admin_approved")

        if (!counsellor) {
            return res.status(400).json({ msg: "counsellor not found" })
        }

        return res.status(200).json({ msg: "all counsellor fetch ", counsellor })

    } catch (error) {

    }
}

export const getCounsellorByEmail = async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(404).json({ msg: " email is requied" })
        }

        const counsellor = await Counsellor.findOne({ email: email });

        if (!counsellor) {
            return res.status(404).json({ msg: "counsellor not found" })
        }

        return res.status(200).json({ msg: "counsellor is found", counsellor })
    } catch (error) {
        console.log(error)
    }
}

export const resetPassword = async (req, res) => {
    const { Email, newPassword } = req.body;

    try {
        // Find the user by Email
        const counsellor = await Counsellor.findOne({ email: Email });
        const user = await User.findOne({ email: Email })

        // 1️⃣ If neither exists
        if (!user && !counsellor) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // 2️⃣ Allow only counsellor
        if (!counsellor || counsellor.role !== "counsellor") {
            return res.status(400).json({
                success: false,
                message: "Only counsellor can change password",
            });
        }
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        await User.findOneAndUpdate({ email: Email }, { Password: hashedPassword });

        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
        });
    } catch (error) {
        console.error(`Error during password reset: ${error}`);
        return res.status(500).json({
            success: false,
            message: "Password reset failed",
            error: error.message,
        });
    }
};
/**
 * @desc    Update counsellor profile (PATCH - partial update)
 * @route   PATCH /api/counsellors/:id
 * @access  Private (Counsellor/Admin)
 */
export const updateCounsellor = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid counsellor ID'
      });
    }
    
    // Validate request body (partial validation)
    const validatedData = updateCounsellorSchema.parse(req.body);
    
    // Check if email is being updated and if it's already taken
    if (validatedData.email) {
      const existingCounsellor = await Counsellor.findOne({
        email: validatedData.email,
        _id: { $ne: id }
      });
      
      if (existingCounsellor) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered to another counsellor'
        });
      }
    }
    
    // Check if license number is being updated and if it's already taken
    if (validatedData.licenseNumber) {
      const existingLicense = await Counsellor.findOne({
        licenseNumber: validatedData.licenseNumber,
        _id: { $ne: id }
      });
      
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'License number already registered to another counsellor'
        });
      }
    }
    
    // Update counsellor
    const counsellor = await Counsellor.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true, runValidators: true }
    );
    
    if (!counsellor) {
      return res.status(404).json({
        success: false,
        message: 'Counsellor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Counsellor updated successfully',
      data: counsellor
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating counsellor',
      error: error.message
    });
  }
};
/**
 * @desc    Update counsellor status (verification/active status)
 * @route   PUT /api/counsellors/:id/status
 * @access  Private/Admin
 */
export const updateCounsellorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid counsellor ID'
      });
    }
    
    // Validate status update data
    const validatedData = updateCounsellorStatusSchema.parse(req.body);
    
    const counsellor = await Counsellor.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true }
    );
    
    if (!counsellor) {
      return res.status(404).json({
        success: false,
        message: 'Counsellor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Counsellor ${validatedData.isActive ? 'activated' : 'deactivated'} successfully`,
      data: counsellor
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating counsellor status',
      error: error.message
    });
  }
};

/**
 * @desc    Update counsellor's availability (working hours/days)
 * @route   PUT /api/counsellors/:id/availability
 * @access  Private (Counsellor)
 */
export const updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { workingHours, workingDays } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid counsellor ID'
      });
    }
    
    // Validate working hours format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (workingHours && (!timeRegex.test(workingHours.start) || !timeRegex.test(workingHours.end))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:mm format'
      });
    }
    
    const updateData = {};
    if (workingHours) updateData.workingHours = workingHours;
    if (workingDays) updateData.workingDays = workingDays;
    
    const counsellor = await Counsellor.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!counsellor) {
      return res.status(404).json({
        success: false,
        message: 'Counsellor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: counsellor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating availability',
      error: error.message
    });
  }
};

/**
 * @desc    Add qualification to counsellor
 * @route   POST /api/counsellors/:id/qualifications
 * @access  Private (Counsellor)
 */
export const addQualification = async (req, res) => {
  try {
    const { id } = req.params;
    const { degree, institution, year } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid counsellor ID'
      });
    }
    
    // Validate qualification data
    if (!degree || !institution || !year) {
      return res.status(400).json({
        success: false,
        message: 'Degree, institution, and year are required'
      });
    }
    
    if (year < 1900 || year > new Date().getFullYear()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year'
      });
    }
    
    const counsellor = await Counsellor.findByIdAndUpdate(
      id,
      { $push: { qualifications: { degree, institution, year } } },
      { new: true }
    );
    
    if (!counsellor) {
      return res.status(404).json({
        success: false,
        message: 'Counsellor not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Qualification added successfully',
      data: counsellor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding qualification',
      error: error.message
    });
  }
};