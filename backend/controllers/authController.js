const handle = require('../utils/handle');
const authService = require('../services/authService');
const twoFactorService = require('../services/twoFactorService');
const accountService = require('../services/accountService');

const register = handle(async (req, res) => {
  res.status(201).json(await authService.register(req.body));
}, 'Server error during registration.');

const verifyOtp = handle(async (req, res) => {
  const { email, otp } = req.body;
  res.json(await authService.verifyOtp({ email, otp }));
}, 'Server error during OTP verification.');

const sendPhoneOtp = handle(async (req, res) => {
  const { email, phoneNumber } = req.body;
  res.json(await authService.sendPhoneVerificationOtp({ email, phoneNumber }));
}, 'Server error sending phone OTP.');

const verifyPhoneOtp = handle(async (req, res) => {
  const { email, otp } = req.body;
  res.json(await authService.verifyPhoneOtp({ email, otp }));
}, 'Server error verifying phone OTP.');

const login = handle(async (req, res) => {
  const { email, password } = req.body;
  res.json(await authService.login({ email, password }));
}, 'Server error during login.');

const verify2fa = handle(async (req, res) => {
  const { email, code } = req.body;
  res.json(await authService.verifyLogin2fa({ email, code }));
}, 'Server error during 2FA verification.');

const googleLogin = handle(async (req, res) => {
  const { role, credential } = req.body;
  res.json(await authService.googleLogin({ role, credential }));
}, 'Server error during Google login.');

const googleConfig = (req, res) => res.json(authService.googleConfig());

const twoFactorSetup = handle(async (req, res) => {
  const user = await twoFactorService.getAuthedUser(req.headers.authorization);
  res.json(await twoFactorService.setup(user));
}, 'Server error creating authenticator setup.');

const twoFactorEnable = handle(async (req, res) => {
  const user = await twoFactorService.getAuthedUser(req.headers.authorization);
  res.json(await twoFactorService.enable(user, req.body.code));
}, 'Server error enabling authenticator.');

const twoFactorDisable = handle(async (req, res) => {
  const user = await twoFactorService.getAuthedUser(req.headers.authorization);
  res.json(await twoFactorService.disable(user, req.body.code));
}, 'Server error disabling authenticator.');

const demoLogin = handle(async (req, res) => {
  const { role } = req.body;
  res.json(await authService.demoLogin({ role }));
}, 'Server error during demo login.');

const me = handle(async (req, res) => {
  res.json(await accountService.getCurrentUser(req.user));
}, 'Server error loading account.');

const onboarding = handle(async (req, res) => {
  res.json(await accountService.saveOnboarding(req.user, req.body));
}, 'Server error saving onboarding.');

const updateProfile = handle(async (req, res) => {
  res.json(await accountService.updateProfile(req.user, req.body));
}, 'Server error updating profile.');

const changePassword = handle(async (req, res) => {
  res.json(await accountService.changePassword(req.user, req.body));
}, 'Server error changing password.');

const forgotPassword = handle(async (req, res) => {
  const { email } = req.body;
  res.json(await authService.forgotPassword({ email }));
}, 'Server error starting password reset.');

const resetPassword = handle(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  res.json(await authService.resetPassword({ email, otp, newPassword }));
}, 'Server error resetting password.');

const deleteAccount = handle(async (req, res) => {
  res.json(await accountService.deleteAccount(req.user, req.body || {}));
}, 'Server error deleting account.');

const reauthChallenge = handle(async (req, res) => {
  res.json(await accountService.startReauthChallenge(req.user));
}, 'Server error starting re-auth challenge.');

const changeEmail = handle(async (req, res) => {
  res.json(await accountService.startEmailChange(req.user, req.body));
}, 'Server error starting email change.');

const confirmEmailChange = handle(async (req, res) => {
  res.json(await accountService.confirmEmailChange(req.user, req.body.otp));
}, 'Server error confirming email change.');

const changePhone = handle(async (req, res) => {
  res.json(await accountService.startPhoneChange(req.user, req.body));
}, 'Server error starting phone change.');

const confirmPhoneChange = handle(async (req, res) => {
  res.json(await accountService.confirmPhoneChange(req.user, req.body.otp));
}, 'Server error confirming phone change.');

module.exports = {
  register,
  verifyOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  login,
  verify2fa,
  googleLogin,
  googleConfig,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
  demoLogin,
  me,
  onboarding,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
  reauthChallenge,
  changeEmail,
  confirmEmailChange,
  changePhone,
  confirmPhoneChange
};
