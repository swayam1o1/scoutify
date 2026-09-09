const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

// Helper to generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, clientProfile, artisanProfile } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !['client', 'artisan'].includes(role)) {
      return res.status(400).json({ message: 'Name, email, password, and a valid role are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = new User({
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      otp,
      otpExpires,
      isVerified: false,
      clientProfile: role === 'client' ? clientProfile : undefined,
      artisanProfile: role === 'artisan' ? artisanProfile : undefined
    });

    await user.save();

    // Log to console for development verification
    console.log(`\n==========================================`);
    console.log(`[DEV OTP] Verification OTP for ${email}: ${otp}`);
    console.log(`==========================================\n`);

    res.status(201).json({
      message: 'Registration successful. OTP sent.',
      email,
      otpRequired: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// 2. VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'OTP verified successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during OTP verification.' });
  }
});

// 3. LOGIN
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Account is linked with Google Sign-In. Use Google to log in.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    if (!user.isVerified) {
      // Re-trigger OTP
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      console.log(`\n==========================================`);
      console.log(`[DEV OTP] Verification OTP for ${email}: ${otp}`);
      console.log(`==========================================\n`);

      return res.status(403).json({
        message: 'Account not verified. OTP sent.',
        email,
        otpRequired: true
      });
    }

    // Check if Client 2FA is enabled
    if (user.role === 'client' && user.twoFactorEnabled) {
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      console.log(`\n==========================================`);
      console.log(`[DEV 2FA] 2FA Login Code for client ${email}: ${otp}`);
      console.log(`==========================================\n`);

      return res.json({
        message: '2FA code required.',
        email,
        requires2FA: true
      });
    }

    // Success login
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// 4. VERIFY 2FA
router.post('/verify-2fa', async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.role !== 'client') {
      return res.status(404).json({ message: 'Client account not found.' });
    }

    if (user.otp !== code || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired 2FA code.' });
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({
      message: '2FA verified successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during 2FA verification.' });
  }
});

// 5. GOOGLE LOGIN (SIMULATED)
router.post('/google-login', async (req, res) => {
  try {
    const { name, email, googleId, role } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      if (!role) {
        return res.status(400).json({
          message: 'Account not found. Please choose a role to register.',
          needsRegistration: true,
          email,
          name,
          googleId
        });
      }

      user = new User({
        name,
        email,
        googleId,
        role,
        isVerified: true // Google Sign-in accounts are verified automatically
      });
      await user.save();
    } else if (!user.googleId) {
      // Link Google Account
      user.googleId = googleId;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Google login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during Google login.' });
  }
});

// 6. TOGGLE 2FA (Requires Auth Middleware inside frontend, we verify JWT here)
router.post('/toggle-2fa', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { enabled } = req.body;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.twoFactorEnabled = enabled;
    await user.save();

    res.json({
      message: `2FA ${enabled ? 'enabled' : 'disabled'} successfully.`,
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating 2FA settings.' });
  }
});

// 7. DEMO LOGIN FOR YC HUD
router.post('/demo-login', async (req, res) => {
  try {
    const { role } = req.body;
    if (role !== 'client_basic' && role !== 'client_pro' && role !== 'artisan') {
      return res.status(400).json({ message: 'Invalid demo role.' });
    }

    let email, name, plan;
    if (role === 'client_basic') {
      email = 'john.basic@demo.scoutify.com';
      name = 'John (Basic Client)';
      plan = 'basic';
    } else if (role === 'client_pro') {
      email = 'john.pro@demo.scoutify.com';
      name = 'John (Pro Client)';
      plan = 'pro';
    } else {
      email = 'sarah.smith@demo.scoutify.com';
      name = 'Sarah Smith';
      plan = 'basic';
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name,
        email,
        role: role === 'artisan' ? 'artisan' : 'client',
        isVerified: true,
        subscriptionPlan: plan,
        twoFactorEnabled: false
      });
      if (role === 'artisan') {
        user.artisanProfile = {
          companyName: 'Apex Architectural Studio',
          phoneNumber: '9876543210',
          instagram: 'apex_studios',
          city: 'Tirupati',
          personOfContact: 'Sarah Smith',
          specialization: ['Architectural Services', 'Interior Designing'],
          portfolio: ['https://behance.net/apex-designs']
        };
      }
      await user.save();
    } else {
      // Ensure the plan is updated back to the requested role plan
      if (user.subscriptionPlan !== plan) {
        user.subscriptionPlan = plan;
        await user.save();
      }
    }



    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Demo login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during demo login.' });
  }
});

module.exports = router;

