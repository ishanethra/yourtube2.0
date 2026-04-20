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
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials missing");
  }

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    body: `Your YourTube OTP is ${otp}`,
    from: "+918838733794",
    to: mobile,
  });
};

export const startLogin = async (req, res) => {
  const { email, name, image, state, city, mobile, otpPreference } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  const cleanEmail = email.toLowerCase().trim();

  const detectedOtpMode = getOtpMode(state);
  const otpMode = otpPreference || detectedOtpMode;
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
    await otpModel.deleteMany({ email: cleanEmail });
    await otpModel.create({
      email: cleanEmail,
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
          to: cleanEmail,
          subject: "YourTube Login OTP",
          text: `Your OTP is ${otp}. It expires in 5 minutes.`,
          html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
        });
      } else {
        await sendMobileOtp(effectiveMobile, otp);
      }
    } catch (deliveryError) {
      console.error(`ERROR: OTP delivery failed for ${otpMode} mode. Details:`, deliveryError.message);
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
        email: cleanEmail,
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
  const cleanEmail = email.toLowerCase().trim();
  console.log(`DEBUG: Verifying OTP for ${cleanEmail}, provided OTP: ${otp}`);

  try {
    const otpDoc = await otpModel.findOne({ email: cleanEmail }).sort({ createdAt: -1 });
    if (!otpDoc) {
      console.log(`DEBUG: No OTP document found for ${cleanEmail}`);
      return res.status(400).json({ message: "No active OTP session found. Request a new one." });
    }
    if (otpDoc.expiresAt < new Date()) {
      console.log(`DEBUG: OTP expired for ${cleanEmail}. Exp: ${otpDoc.expiresAt}`);
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }
    
    if (otpDoc.otp !== otp) {
      console.log(`DEBUG: OTP mismatch for ${cleanEmail}. Expected: ${otpDoc.otp}, Got: ${otp}`);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const nextState = state || otpDoc.state || "";
    const nextCity = city || otpDoc.city || "";
    const otpMode = getOtpMode(nextState);

    let existingUser = await users.findOne({ email: cleanEmail });
    if (!existingUser) {
      existingUser = await users.create({
        email: cleanEmail,
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

    await otpModel.deleteMany({ email: cleanEmail });

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

  const cleanEmail = email.toLowerCase().trim();
  try {
    const existingUser = await users.findOne({ email: cleanEmail });

    if (!existingUser) {
      const newUser = await users.create({ email: cleanEmail, name, image });
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

export const subscribeChannel = async (req, res) => {
  const { id: channelId } = req.params;
  const { userId } = req.body;

  const isSampleChannel = !mongoose.Types.ObjectId.isValid(channelId);
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    const subscriber = await users.findById(userId);

    if (!subscriber) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isSampleChannel) {
      // Handle Sample Channel Subscription
      await users.findByIdAndUpdate(userId, { $addToSet: { subscribedChannels: channelId } });
      return res.status(200).json({ message: "Subscribed to sample channel successfully" });
    }

    const channel = await users.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    if (channel.subscribers.includes(userId)) {
      return res.status(200).json({ message: "Already subscribed", subscribed: true });
    }

    await users.findByIdAndUpdate(channelId, { $addToSet: { subscribers: userId } });
    await users.findByIdAndUpdate(userId, { $addToSet: { subscribedChannels: channelId } });

    return res.status(200).json({ message: "Subscribed successfully", subscribed: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const unsubscribeChannel = async (req, res) => {
  const { id: channelId } = req.params;
  const { userId } = req.body;

  const isSampleChannel = !mongoose.Types.ObjectId.isValid(channelId);
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    if (isSampleChannel) {
      await users.findByIdAndUpdate(userId, { $pull: { subscribedChannels: channelId } });
      return res.status(200).json({ message: "Unsubscribed from sample channel successfully", subscribed: false });
    }

    await users.findByIdAndUpdate(channelId, { $pull: { subscribers: userId } });
    await users.findByIdAndUpdate(userId, { $pull: { subscribedChannels: channelId } });

    return res.status(200).json({ message: "Unsubscribed successfully", subscribed: false });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const updateWatchTime = async (req, res) => {
  const { id } = req.params;
  const { incrementSeconds } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid user id" });
  }

  try {
    const user = await users.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const today = new Date().toISOString().split("T")[0];
    let update = {};

    if (user.lastWatchDate !== today) {
      // It's a new day! Reset watch time
      update = {
        $set: {
          lastWatchDate: today,
          watchedSecondsToday: incrementSeconds || 0,
        },
      };
    } else {
      // Increment existing watch time
      update = {
        $inc: { watchedSecondsToday: incrementSeconds || 0 },
      };
    }

    const updatedUser = await users.findByIdAndUpdate(id, update, { new: true });
    
    const limitMinutes = updatedUser.watchLimitMinutes;
    // If limitMinutes is null, it's unlimited. Return a large number (100 years).
    const limitSeconds = limitMinutes === null ? 3153600000 : limitMinutes * 60;
    const remainingSeconds = Math.max(0, limitSeconds - updatedUser.watchedSecondsToday);

    return res.status(200).json({ 
      watchedSecondsToday: updatedUser.watchedSecondsToday,
      remainingSeconds
    });
  } catch (error) {
    console.error("Update Watch Time error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  const { channelId, userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(200).json({ isSubscribed: false });
  }

  try {
    const user = await users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isSubscribed = user.subscribedChannels.includes(channelId);
    return res.status(200).json({ isSubscribed });
  } catch (error) {
    console.error("Get Subscription Status error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const subscribeChannelBody = async (req, res) => {
  const { channelId, userId } = req.body;
  
  if (!channelId || !userId) {
    return res.status(400).json({ message: "Missing channel or user ID" });
  }

  // Wrap internal call
  req.params.id = channelId;
  return subscribeChannel(req, res);
};

export const updateWatchTimeBody = async (req, res) => {
  const { userId, incrementSeconds } = req.body;
  if (!userId) return res.status(400).json({ message: "Missing user ID" });

  // Wrap internal call
  req.params.id = userId;
  return updateWatchTime(req, res);
};
