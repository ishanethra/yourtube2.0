import mongoose from "mongoose";
import twilio from "twilio";
import users from "../Modals/Auth.js";
import otpModel from "../Modals/otp.js";
import { SOUTH_STATES } from "../utils/plans.js";
import { sendEmail } from "../utils/notification.js";

const getOtpMode = (state = "") => {
  const normalized = state.toLowerCase().trim();
  return SOUTH_STATES.includes(normalized) ? "email" : "mobile";
};

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const sendMobileOtp = async (mobile, otp) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials missing");
  }
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your YourTube OTP is ${otp}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: mobile,
  });
};

export const startLogin = async (req, res) => {
  const { email, name, image, state, city, mobile } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const otpMode = getOtpMode(state);
  const effectiveMobile =
    mobile || process.env.DEFAULT_NON_SOUTH_TEST_MOBILE || "+918838733794";
  if (otpMode === "mobile" && !effectiveMobile) {
    return res
      .status(400)
      .json({ message: "Mobile number is required for this region" });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await otpModel.deleteMany({ email });
    await otpModel.create({
      email,
      mobile: effectiveMobile,
      otp,
      state,
      city,
      expiresAt,
    });

    let deliveryFailed = false;
    try {
      if (otpMode === "email") {
        await sendEmail({
          to: email,
          subject: "YourTube Login OTP",
          text: `Your OTP is ${otp}. It expires in 5 minutes.`,
          html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
        });
      } else {
        await sendMobileOtp(effectiveMobile, otp);
      }
    } catch (deliveryError) {
      console.error("OTP delivery failed:", deliveryError);
      deliveryFailed = true;
    }

    return res.status(200).json({
      otpSent: true,
      otpMode,
      deliveryFailed,
      debugOtp: deliveryFailed ? otp : undefined,
      message: deliveryFailed
        ? "OTP delivery failed, use fallback OTP shown for testing"
        : otpMode === "email"
        ? "OTP sent to email"
        : "OTP sent to mobile",
      profilePreview: {
        email,
        name,
        image,
        state,
        city,
        mobile: effectiveMobile,
      },
    });
  } catch (error) {
    console.error("start login error:", error);
    return res.status(500).json({ message: "Unable to start login" });
  }
};

export const verifyLoginOtp = async (req, res) => {
  const { email, otp, name, image, state, city, mobile } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const otpDoc = await otpModel.findOne({ email }).sort({ createdAt: -1 });
    if (!otpDoc || otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }
    if (otpDoc.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const nextState = state || otpDoc.state || "";
    const nextCity = city || otpDoc.city || "";
    const otpMode = getOtpMode(nextState);

    let existingUser = await users.findOne({ email });
    if (!existingUser) {
      existingUser = await users.create({
        email,
        mobile: mobile || otpDoc.mobile,
        name,
        image,
        state: nextState,
        city: nextCity,
        loginOtpMode: otpMode,
      });
    } else {
      existingUser = await users.findByIdAndUpdate(
        existingUser._id,
        {
          $set: {
            name: name || existingUser.name,
            image: image || existingUser.image,
            mobile: mobile || otpDoc.mobile || existingUser.mobile,
            state: nextState || existingUser.state,
            city: nextCity || existingUser.city,
            loginOtpMode: otpMode,
          },
        },
        { new: true }
      );
    }

    await otpModel.deleteMany({ email });

    return res.status(200).json({
      verified: true,
      result: existingUser,
    });
  } catch (error) {
    console.error("verify login error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const login = async (req, res) => {
  const { email, name, image } = req.body;

  try {
    const existingUser = await users.findOne({ email });

    if (!existingUser) {
      const newUser = await users.create({ email, name, image });
      return res.status(201).json({ result: newUser });
    }
    return res.status(200).json({ result: existingUser });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { channelname, description, city, state, mobile } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(500).json({ message: "User unavailable..." });
  }
  try {
    const updatedata = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          channelname,
          description,
          city,
          state,
          mobile,
        },
      },
      { new: true }
    );
    return res.status(201).json(updatedata);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid user id" });
  }

  try {
    const user = await users.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
