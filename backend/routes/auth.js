const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';
const TOTP_ISSUER = process.env.TOTP_ISSUER || 'Scoutify';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    subscriptionPlan: user.subscriptionPlan,
    twoFactorEnabled: user.twoFactorEnabled
  };
}

function verifyTotp(secret, code) {
  const token = String(code || '').replace(/\s/g, '');
  if (!secret || !/^\d{6}$/.test(token)) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1
  });
}

async function getAuthedUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'No token provided.' });
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return null;
    }
    return user;
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
    return null;
  }
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

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return res.json({
        message: 'Enter the 6-digit code from Google Authenticator.',
        email: user.email,
        requires2FA: true
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({
      message: 'Login successful.',
      token,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// 4. VERIFY 2FA (Google Authenticator TOTP)
router.post('/verify-2fa', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Authenticator login is not enabled for this account.' });
    }

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(400).json({ message: 'Invalid authenticator code. Try the current 6-digit number.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({
      message: '2FA verified successfully.',
      token,
      user: publicUser(user)
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

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      return res.json({
        message: 'Enter the 6-digit code from Google Authenticator.',
        email: user.email,
        requires2FA: true
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Google login successful.',
      token,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during Google login.' });
  }
});

// 6. GOOGLE AUTHENTICATOR SETUP (QR) — does not enable until /2fa/enable
router.post('/2fa/setup', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Authenticator is already enabled. Disable it first to set up again.' });
    }

    const generated = speakeasy.generateSecret({
      length: 20,
      name: `${TOTP_ISSUER} (${user.email})`,
      issuer: TOTP_ISSUER
    });

    user.twoFactorSecret = generated.base32;
    user.twoFactorEnabled = false;
    await user.save();

    const qrDataUrl = await QRCode.toDataURL(generated.otpauth_url);
    res.json({
      qrDataUrl,
      manualKey: generated.base32,
      otpauthUrl: generated.otpauth_url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating authenticator setup.' });
  }
});

router.post('/2fa/enable', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: 'Start authenticator setup first.' });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: 'Authenticator is already enabled.' });
    }

    if (!verifyTotp(user.twoFactorSecret, req.body.code)) {
      return res.status(400).json({ message: 'Invalid authenticator code. Scan the QR again if needed.' });
    }

    user.twoFactorEnabled = true;
    await user.save();
    res.json({
      message: 'Google Authenticator enabled for login.',
      twoFactorEnabled: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error enabling authenticator.' });
  }
});

router.post('/2fa/disable', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      await user.save();
      return res.json({ message: 'Authenticator is already off.', twoFactorEnabled: false });
    }

    if (!verifyTotp(user.twoFactorSecret, req.body.code)) {
      return res.status(400).json({ message: 'Invalid authenticator code.' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    res.json({
      message: 'Google Authenticator disabled.',
      twoFactorEnabled: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error disabling authenticator.' });
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

