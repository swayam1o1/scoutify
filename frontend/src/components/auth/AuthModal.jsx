import { HelpCircle } from 'lucide-react';
import { PasswordInput } from './PasswordInput';
import { DarkSelect } from '../ui/DarkSelect.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';

const CLIENT_TYPE_OPTIONS = [
  { value: 'interior_designer', label: 'Interior Designer (Individual)' },
  { value: 'architectural_firm', label: 'Architectural Firm / Company' },
  { value: 'hobbyist', label: 'Hobbyist' },
  { value: 'student', label: 'Student' },
  { value: 'private_client', label: 'Private Client' }
];

const PLANNED_USE_OPTIONS = [
  { value: 'source_vendors', label: 'Source Vendors for active projects' },
  { value: 'hiring', label: 'Direct hiring for short-term projects' },
  { value: 'collaboration', label: 'Collaborations and partnership reference' },
  { value: 'research', label: 'Research and database compilation' }
];

export function AuthModal({ auth }) {
  const {
    setShowAuthModal,
    authTab,
    setAuthTab,
    authRole,
    setAuthRole,
    authError,
    authSuccess,
    devOtp,
    verifyingOtp,
    verifying2Fa,
    verifyingPhone,
    pendingPhone,
    phoneOtp,
    setPhoneOtp,
    handleVerifyPhoneOtp,
    skipPhoneVerification,
    verificationCode,
    setVerificationCode,
    handleVerifyOtp,
    handleVerify2Fa,
    handleGoogleCredential,
    handleLogin,
    handleRegister,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    clientName,
    setClientName,
    clientEmail,
    setClientEmail,
    clientPassword,
    setClientPassword,
    clientType,
    setClientType,
    clientPlannedUse,
    setClientPlannedUse,
    clientCompany,
    setClientCompany,
    clientPhone,
    setClientPhone,
    artisanName,
    setArtisanName,
    artisanEmail,
    setArtisanEmail,
    artisanPassword,
    setArtisanPassword,
    artisanCompany,
    setArtisanCompany,
    artisanPhone,
    setArtisanPhone,
    artisanInsta,
    setArtisanInsta,
    artisanCity,
    setArtisanCity,
    artisanSpecialization,
    setArtisanSpecialization,
    forgotStage,
    forgotEmail,
    setForgotEmail,
    forgotOtp,
    setForgotOtp,
    forgotNewPassword,
    setForgotNewPassword,
    openForgotPassword,
    cancelForgotPassword,
    handleForgotPassword,
    handleResetPassword
  } = auth;

  const showMainForms = !verifyingOtp && !verifying2Fa && !verifyingPhone && !forgotStage;

  const heading = verifyingOtp
    ? 'Account Verification'
    : verifying2Fa
      ? 'Two-Factor Login'
      : verifyingPhone
        ? 'Verify Phone'
        : forgotStage
          ? 'Reset Password'
          : authTab === 'login' ? 'Welcome Back' : 'Get Started';

  const subheading = verifyingOtp
    ? 'Enter the email verification code'
    : verifying2Fa
      ? 'Use Google Authenticator'
      : verifyingPhone
        ? `Enter the OTP sent to ${pendingPhone || 'your phone'}`
        : forgotStage === 'request'
          ? 'We will send a 6-digit reset code to your email.'
          : forgotStage === 'reset'
            ? 'Enter the reset code and choose a new password.'
            : 'Unlock direct connections with verified artisans.';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>{heading}</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{subheading}</p>
        </div>

        {/* Error alerts */}
        {authError && (
          <div style={{ background: 'var(--tone-danger-bg)', border: '1px solid var(--color-danger)', color: 'var(--tone-danger-text)', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
            {authError}
          </div>
        )}

        {authSuccess && (
          <div style={{ background: 'var(--tone-success-bg)', border: '1px solid var(--color-primary)', color: 'var(--tone-success-text)', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
            {authSuccess}
          </div>
        )}

        {/* Dev tip helper */}
        {devOtp && (
          <div className="dev-helper">
            <HelpCircle size={16} />
            <span>{devOtp}</span>
          </div>
        )}

        {/* Tab forms */}
        {verifyingOtp && (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="form-label required">6-digit OTP Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Verify Account
            </button>
          </form>
        )}

        {verifying2Fa && (
          <form onSubmit={handleVerify2Fa}>
            <div className="form-group">
              <label className="form-label required">Google Authenticator code</label>
              <input
                type="text"
                className="form-control"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Current 6-digit code"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Verify Login
            </button>
          </form>
        )}

        {verifyingPhone && (
          <form onSubmit={handleVerifyPhoneOtp}>
            <div className="form-group">
              <label className="form-label required">6-digit Phone OTP</label>
              <input
                type="text"
                className="form-control"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter phone OTP"
                value={phoneOtp}
                onChange={e => setPhoneOtp(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Verify Phone
            </button>
            <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={skipPhoneVerification}>
              Skip for now
            </button>
          </form>
        )}

        {forgotStage === 'request' && (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label className="form-label required">Account Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="you@studio.com"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Send Reset Code
            </button>
            <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={cancelForgotPassword}>
              Back to Sign In
            </button>
          </form>
        )}

        {forgotStage === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label className="form-label required">6-digit Reset Code</label>
              <input
                type="text"
                className="form-control"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter code"
                value={forgotOtp}
                onChange={e => setForgotOtp(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label required">New Password</label>
              <PasswordInput
                value={forgotNewPassword}
                onChange={e => setForgotNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Set New Password
            </button>
            <button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }} onClick={cancelForgotPassword}>
              Back to Sign In
            </button>
          </form>
        )}

        {showMainForms && (
          <>
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              text={authTab === 'login' ? 'signin_with' : 'signup_with'}
            />

            {/* Role Selector during Register */}
            {authTab === 'register' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button
                  type="button"
                  className={`btn ${authRole === 'client' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => setAuthRole('client')}
                >
                  I am Sourcing Svc
                </button>
                <button
                  type="button"
                  className={`btn ${authRole === 'artisan' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => setAuthRole('artisan')}
                >
                  I am an Artisan
                </button>
              </div>
            )}

            {/* Form fields */}
            <form onSubmit={authTab === 'login' ? handleLogin : handleRegister}>
              {authTab === 'login' ? (
                <>
                  <div className="form-group">
                    <label className="form-label required">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Password</label>
                    <PasswordInput
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <span
                      style={{ color: 'var(--color-primary)', cursor: 'pointer', fontSize: '13px' }}
                      onClick={openForgotPassword}
                    >
                      Forgot password?
                    </span>
                  </div>
                </>
              ) : authRole === 'client' ? (
                <>
                  <div className="form-group">
                    <label className="form-label required">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={clientEmail}
                      onChange={e => setClientEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Password</label>
                    <PasswordInput
                      value={clientPassword}
                      onChange={e => setClientPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <DarkSelect
                    label="What best describes you?"
                    value={clientType}
                    onChange={setClientType}
                    options={CLIENT_TYPE_OPTIONS}
                    required
                  />
                  {(clientType === 'architectural_firm' || clientType === 'design_firm' || clientType === 'company' || clientType === 'firm') && (
                    <div className="form-group">
                      <label className="form-label required">Company Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={clientCompany}
                        onChange={e => setClientCompany(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Phone Number (optional)</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="10-digit mobile"
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                    />
                  </div>
                  <DarkSelect
                    label="Planned Usage"
                    value={clientPlannedUse}
                    onChange={setClientPlannedUse}
                    options={PLANNED_USE_OPTIONS}
                    required
                  />
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label required">Artisan Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanName}
                      onChange={e => setArtisanName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={artisanEmail}
                      onChange={e => setArtisanEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Password</label>
                    <PasswordInput
                      value={artisanPassword}
                      onChange={e => setArtisanPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanCompany}
                      onChange={e => setArtisanCompany(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanPhone}
                      onChange={e => setArtisanPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Instagram Handle</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="@handle"
                      value={artisanInsta}
                      onChange={e => setArtisanInsta(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Base City</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanCity}
                      onChange={e => setArtisanCity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Specializations (comma separated)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Architectural services, Painting..."
                      value={artisanSpecialization}
                      onChange={e => setArtisanSpecialization(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                {authTab === 'login' ? 'Sign In' : 'Register Account'}
              </button>
            </form>

            {/* Footer Switch toggle */}
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {authTab === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <span style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: '500' }} onClick={() => setAuthTab('register')}>
                    Register
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: '500' }} onClick={() => setAuthTab('login')}>
                    Sign In
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
