const express = require('express');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// 1. REGISTER
router.post('/register', authController.register);
// 2. VERIFY OTP
router.post('/verify-otp', authController.verifyOtp);
// 2b. SEND PHONE OTP (optional verification after signup / from portal)
router.post('/send-phone-otp', authController.sendPhoneOtp);
// 2c. VERIFY PHONE OTP
router.post('/verify-phone-otp', authController.verifyPhoneOtp);
// 3. LOGIN
router.post('/login', authController.login);
// 4. VERIFY 2FA (Google Authenticator TOTP)
router.post('/verify-2fa', authController.verify2fa);
// 5. GOOGLE LOGIN
router.post('/google-login', authController.googleLogin);

// 6. GOOGLE AUTHENTICATOR SETUP / ENABLE / DISABLE — these check the Bearer token themselves.
router.post('/2fa/setup', authController.twoFactorSetup);
router.post('/2fa/enable', authController.twoFactorEnable);
router.post('/2fa/disable', authController.twoFactorDisable);

// 7. DEMO LOGIN FOR YC HUD
router.post('/demo-login', authController.demoLogin);

// 8. CURRENT USER + ONBOARDING WIZARD (SRS §4)
router.get('/me', requireAuth, authController.me);
router.post('/onboarding', requireAuth, authController.onboarding);

// 9-10. PROFILE + PASSWORD
router.put('/profile', requireAuth, authController.updateProfile);
router.post('/change-password', requireAuth, authController.changePassword);

// 11-12. FORGOT / RESET PASSWORD
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// 13. DELETE OWN ACCOUNT (SRS 3.4)
router.delete('/account', requireAuth, authController.deleteAccount);

// 14-16. RE-AUTH CHALLENGE + EMAIL / PHONE CHANGE
router.post('/reauth-challenge', requireAuth, authController.reauthChallenge);
router.post('/change-email', requireAuth, authController.changeEmail);
router.post('/confirm-email-change', requireAuth, authController.confirmEmailChange);
router.post('/change-phone', requireAuth, authController.changePhone);
router.post('/confirm-phone-change', requireAuth, authController.confirmPhoneChange);

module.exports = router;
