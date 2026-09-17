import { HelpCircle } from 'lucide-react';
import { PasswordInput } from './PasswordInput';

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
    verificationCode,
    setVerificationCode,
    handleVerifyOtp,
    handleVerify2Fa,
    handleGoogleLogin,
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

  const showMainForms = !verifyingOtp && !verifying2Fa && !forgotStage;

  const heading = verifyingOtp
    ? 'Account Verification'
    : verifying2Fa
      ? 'Two-Factor Login'
      : forgotStage
        ? 'Reset Password'
        : authTab === 'login' ? 'Welcome Back' : 'Get Started';

  const subheading = verifyingOtp
    ? 'Enter verification code'
    : verifying2Fa
      ? 'Use Google Authenticator'
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
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid var(--color-danger)', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
            {authError}
          </div>
        )}

        {authSuccess && (
          <div style={{ background: 'rgba(20,241,149,0.15)', border: '1px solid var(--color-primary)', color: '#a7f3d0', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
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
              <label className="form-label">6-digit OTP Code</label>
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
              <label className="form-label">Google Authenticator code</label>
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

        {forgotStage === 'request' && (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label className="form-label">Account Email</label>
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
              <label className="form-label">6-digit Reset Code</label>
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
              <label className="form-label">New Password</label>
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
            {/* Simulated Google Button */}
            <button className="btn btn-google" onClick={handleGoogleLogin}>
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>

            <div className="divider">or use email</div>

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
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
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
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={clientEmail}
                      onChange={e => setClientEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <PasswordInput
                      value={clientPassword}
                      onChange={e => setClientPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What best describes you?</label>
                    <select className="form-control form-select" value={clientType} onChange={e => setClientType(e.target.value)}>
                      <option value="interior_designer">Interior Designer</option>
                      <option value="architectural_firm">Architectural Firm</option>
                      <option value="hobbyist">Hobbyist</option>
                      <option value="student">Student</option>
                      <option value="private_client">Private Client</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Planned Usage</label>
                    <select className="form-control form-select" value={clientPlannedUse} onChange={e => setClientPlannedUse(e.target.value)}>
                      <option value="source_vendors">Source Vendors for active projects</option>
                      <option value="hiring">Direct hiring for short-term projects</option>
                      <option value="collaboration">Collaborations and partnership reference</option>
                      <option value="research">Research and database compilation</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Artisan Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanName}
                      onChange={e => setArtisanName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={artisanEmail}
                      onChange={e => setArtisanEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <PasswordInput
                      value={artisanPassword}
                      onChange={e => setArtisanPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanCompany}
                      onChange={e => setArtisanCompany(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
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
                    <label className="form-label">Base City</label>
                    <input
                      type="text"
                      className="form-control"
                      value={artisanCity}
                      onChange={e => setArtisanCity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specializations (comma separated)</label>
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
