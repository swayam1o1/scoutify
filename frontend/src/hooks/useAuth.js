import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';

export function useAuth({ onLogout } = {}) {
  // User auth state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('scoutify_token') || '');

  // Auth modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [authRole, setAuthRole] = useState('client'); // 'client' | 'artisan'
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [devOtp, setDevOtp] = useState(''); // Dev OTP display for UI helper

  // Login form fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // OTP/2FA verification state
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verifying2Fa, setVerifying2Fa] = useState(false);
  const [totpQr, setTotpQr] = useState('');
  const [totpManualKey, setTotpManualKey] = useState('');
  const [totpSetupCode, setTotpSetupCode] = useState('');
  const [totpDisableCode, setTotpDisableCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);

  // Client registration fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientType, setClientType] = useState('interior_designer'); // interior_designer, firm, hobbyist, student, private
  const [clientPlannedUse, setClientPlannedUse] = useState('source_vendors'); // source_vendors, hiring, collaboration, reference

  // Artisan registration fields
  const [artisanName, setArtisanName] = useState('');
  const [artisanEmail, setArtisanEmail] = useState('');
  const [artisanPassword, setArtisanPassword] = useState('');
  const [artisanCompany, setArtisanCompany] = useState('');
  const [artisanPhone, setArtisanPhone] = useState('');
  const [artisanInsta, setArtisanInsta] = useState('');
  const [artisanCity, setArtisanCity] = useState('');
  const [artisanSpecialization, setArtisanSpecialization] = useState('');

  // Profile forms
  const [profileForm, setProfileForm] = useState({
    companyName: '',
    phoneNumber: '',
    instagram: '',
    city: '',
    personOfContact: '',
    specialization: [],
    portfolio: []
  });
  const [newPortfolioLink, setNewPortfolioLink] = useState('');

  // Load user details if token is present
  useEffect(() => {
    if (token) {
      localStorage.setItem('scoutify_token', token);
      // Fetch user profile or decode token
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        // Simple mock fetch details, we can also perform API request
        setUser({
          id: decoded.id,
          name: decoded.role === 'client' ? 'Client Member' : 'Artisan Member',
          email: '',
          role: decoded.role,
          subscriptionPlan: decoded.role === 'client' ? 'basic' : 'pro' // Default loaded info
        });

        // Load actual DB values
        fetchUserProfile();
      } catch (err) {
        handleLogout();
      }
    } else {
      localStorage.removeItem('scoutify_token');
      setUser(null);
    }
  }, [token]);

  // Fetch profiles based on role
  const fetchUserProfile = async () => {
    try {
      // We can create a unified endpoint, or fetch specifically
      if (user?.role === 'artisan') {
        const res = await authFetch('/artisan/profile', { token });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfileForm({
              companyName: data.profile.companyName || '',
              phoneNumber: data.profile.phoneNumber || '',
              instagram: data.profile.instagram || '',
              city: data.profile.city || '',
              personOfContact: data.profile.personOfContact || '',
              specialization: data.profile.specialization || [],
              portfolio: data.profile.portfolio || []
            });
          }
        }
      }

      // Refresh user fields
      const resSearch = await authFetch('/search', { token });
      if (resSearch.ok) {
        const data = await resSearch.json();
        if (data.isLoggedIn && user) {
          setUser(prev => ({
            ...prev,
            subscriptionPlan: data.userPlan
          }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('scoutify_token');
    onLogout?.();
  };

  const openAuthModal = (tab = 'login') => {
    setAuthTab(tab);
    setShowAuthModal(true);
  };

  // Auth: Email Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setDevOtp('');

    try {
      let payload = {};
      if (authRole === 'client') {
        payload = {
          name: clientName,
          email: clientEmail,
          password: clientPassword,
          role: 'client',
          clientProfile: {
            type: clientType,
            plannedUse: clientPlannedUse
          }
        };
      } else {
        payload = {
          name: artisanName,
          email: artisanEmail,
          password: artisanPassword,
          role: 'artisan',
          artisanProfile: {
            companyName: artisanCompany,
            phoneNumber: artisanPhone,
            instagram: artisanInsta,
            city: artisanCity,
            personOfContact: artisanName,
            specialization: artisanSpecialization.split(',').map(s => s.trim()).filter(Boolean),
            portfolio: []
          }
        };
      }

      const res = await authFetch('/auth/register', { method: 'POST', body: payload });

      const data = await res.json();
      if (!res.ok) {
        return setAuthError(data.message || 'Registration failed.');
      }

      setVerificationEmail(payload.email);
      setVerifyingOtp(true);
      setAuthSuccess('Account created! Please verify with the 6-digit OTP.');

      // For easy dev testing, simulate receiving OTP
      // We will parse the console log output or generate it in the backend
      // But since we can't read backend console here easily, we show a standard message.
      // We mock the dev OTP in UI helper:
      setDevOtp('123456 (For development, check node backend server logs or enter any code if using debug fallback)');
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  // Auth: Email Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setDevOtp('');

    try {
      const res = await authFetch('/auth/login', {
        method: 'POST',
        body: { email: loginEmail, password: loginPassword }
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.otpRequired) {
          setVerificationEmail(data.email);
          setVerifyingOtp(true);
          setAuthSuccess(data.message);
          return;
        }
        return setAuthError(data.message || 'Login failed.');
      }

      if (data.requires2FA) {
        setVerificationEmail(data.email);
        setVerifying2Fa(true);
        setAuthSuccess('Open Google Authenticator and enter the current 6-digit code.');
        return;
      }

      // Success
      setToken(data.token);
      setUser(data.user);
      setShowAuthModal(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  // Auth: OTP Verification
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const res = await authFetch('/auth/verify-otp', {
        method: 'POST',
        body: { email: verificationEmail, otp: verificationCode }
      });

      const data = await res.json();
      if (!res.ok) {
        return setAuthError(data.message || 'Verification failed.');
      }

      setToken(data.token);
      setUser(data.user);
      setVerifyingOtp(false);
      setShowAuthModal(false);
      setVerificationCode('');
      setVerificationEmail('');
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  // Auth: 2FA Verification
  const handleVerify2Fa = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const res = await authFetch('/auth/verify-2fa', {
        method: 'POST',
        body: { email: verificationEmail, code: verificationCode }
      });

      const data = await res.json();
      if (!res.ok) {
        return setAuthError(data.message || '2FA verification failed.');
      }

      setToken(data.token);
      setUser(data.user);
      setVerifying2Fa(false);
      setShowAuthModal(false);
      setVerificationCode('');
      setVerificationEmail('');
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  // Auth: Google Sign-in (Simulated)
  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthSuccess('');

    // Open a beautiful simulated google authentication window
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '',
      'Google Login',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=no`
    );

    popup.document.write(`
      <html>
        <head>
          <title>Sign in - Google Accounts</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0a0b10;
              color: #f3f4f6;
              font-family: 'Outfit', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .card {
              background: #12131a;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 16px;
              padding: 40px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.5);
              width: 85%;
              max-width: 400px;
            }
            .logo {
              font-size: 28px;
              font-weight: 700;
              background: linear-gradient(135deg, #14f195, #00c6ff);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              margin-bottom: 24px;
            }
            .subtitle {
              color: #9ca3af;
              font-size: 14px;
              margin-bottom: 30px;
            }
            .account-btn {
              display: flex;
              align-items: center;
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.08);
              color: #fff;
              padding: 14px 20px;
              border-radius: 10px;
              width: 100%;
              text-align: left;
              cursor: pointer;
              margin-bottom: 12px;
              transition: all 0.2s;
              font-size: 15px;
            }
            .account-btn:hover {
              background: rgba(255,255,255,0.08);
              border-color: #14f195;
            }
            .avatar {
              background: #14f195;
              color: #000;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 600;
              margin-right: 14px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">Scoutify</div>
            <div class="subtitle">Choose an account to continue to Scoutify</div>
            
            <button class="account-btn" onclick="select('John Doe', 'john.doe@gmail.com')">
              <div class="avatar">JD</div>
              <div>
                <div style="font-weight: 500;">John Doe</div>
                <div style="font-size: 12px; color: #9ca3af;">john.doe@gmail.com</div>
              </div>
            </button>
            
            <button class="account-btn" onclick="select('Sarah Smith', 'sarah.smith@designstudio.com')">
              <div class="avatar" style="background:#9945ff; color:#fff">SS</div>
              <div>
                <div style="font-weight: 500;">Sarah Smith</div>
                <div style="font-size: 12px; color: #9ca3af;">sarah.smith@designstudio.com</div>
              </div>
            </button>
          </div>
          <script>
            function select(name, email) {
              window.opener.postMessage({
                source: 'google-oauth-mock',
                name: name,
                email: email,
                googleId: 'g_id_' + Math.random().toString(36).substr(2, 9)
              }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `);

    // Listen for OAuth message
    const handleOAuthMessage = async (event) => {
      if (event.data && event.data.source === 'google-oauth-mock') {
        window.removeEventListener('message', handleOAuthMessage);

        // Trigger backend registration/login
        try {
          const res = await authFetch('/auth/google-login', {
            method: 'POST',
            body: {
              name: event.data.name,
              email: event.data.email,
              googleId: event.data.googleId,
              role: authRole // Uses currently selected role in form
            }
          });

          const data = await res.json();
          if (!res.ok) {
            return setAuthError(data.message || 'Google authentication failed.');
          }

          if (data.requires2FA) {
            setVerificationEmail(data.email);
            setVerifying2Fa(true);
            setShowAuthModal(true);
            setAuthSuccess('Open Google Authenticator and enter the current 6-digit code.');
            return;
          }

          setToken(data.token);
          setUser(data.user);
          setShowAuthModal(false);
        } catch (err) {
          setAuthError('Connection error during Google Sign-In.');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
  };

  // Demo personas: authenticates instantly and reports the issued token back to the caller.
  const demoLogin = async (role) => {
    const res = await authFetch('/auth/demo-login', { method: 'POST', body: { role } });
    const data = await res.json();
    if (!res.ok) return { ok: false, data };

    setToken(data.token);
    setUser(data.user);
    return { ok: true, data };
  };

  const handleHudDemoLogin = async (role) => {
    try {
      const { ok, data } = await demoLogin(role);
      if (ok) {
        setShowAuthModal(false);
        setAuthError('');
        setAuthSuccess('');
      } else {
        alert(data.message || 'Demo login failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Profile: Update Artisan Profile
  const handleArtisanProfileSave = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/artisan/profile', { token, method: 'POST', body: profileForm });
      const data = await res.json();
      if (res.ok) {
        alert('Profile saved successfully.');
        fetchUserProfile();
      } else {
        alert(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startTotpSetup = async () => {
    setTotpBusy(true);
    try {
      const res = await authFetch('/auth/2fa/setup', { token, method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Could not start authenticator setup.');
        return;
      }
      setTotpQr(data.qrDataUrl);
      setTotpManualKey(data.manualKey);
      setTotpSetupCode('');
    } catch (err) {
      console.error(err);
      alert('Could not start authenticator setup.');
    } finally {
      setTotpBusy(false);
    }
  };

  const confirmTotpEnable = async (e) => {
    e.preventDefault();
    setTotpBusy(true);
    try {
      const res = await authFetch('/auth/2fa/enable', {
        token,
        method: 'POST',
        body: { code: totpSetupCode }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Could not enable authenticator.');
        return;
      }
      setUser(prev => ({ ...prev, twoFactorEnabled: true }));
      setTotpQr('');
      setTotpManualKey('');
      setTotpSetupCode('');
      alert('Google Authenticator is on. Next login will ask for the app code.');
    } catch (err) {
      console.error(err);
      alert('Could not enable authenticator.');
    } finally {
      setTotpBusy(false);
    }
  };

  const disableTotp = async (e) => {
    e.preventDefault();
    setTotpBusy(true);
    try {
      const res = await authFetch('/auth/2fa/disable', {
        token,
        method: 'POST',
        body: { code: totpDisableCode }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Could not disable authenticator.');
        return;
      }
      setUser(prev => ({ ...prev, twoFactorEnabled: false }));
      setTotpDisableCode('');
      alert('Google Authenticator is off.');
    } catch (err) {
      console.error(err);
      alert('Could not disable authenticator.');
    } finally {
      setTotpBusy(false);
    }
  };

  const cancelTotpSetup = () => {
    setTotpQr('');
    setTotpManualKey('');
    setTotpSetupCode('');
  };

  return {
    // Session
    user,
    setUser,
    token,
    handleLogout,

    // Modal shell
    showAuthModal,
    setShowAuthModal,
    openAuthModal,
    authTab,
    setAuthTab,
    authRole,
    setAuthRole,
    authError,
    authSuccess,
    devOtp,

    // Login fields
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,

    // OTP / 2FA
    verificationCode,
    setVerificationCode,
    verifyingOtp,
    verifying2Fa,

    // Client registration fields
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

    // Artisan registration fields
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

    // Handlers
    handleLogin,
    handleRegister,
    handleVerifyOtp,
    handleVerify2Fa,
    handleGoogleLogin,
    demoLogin,
    handleHudDemoLogin,

    // Artisan profile
    profileForm,
    setProfileForm,
    newPortfolioLink,
    setNewPortfolioLink,
    handleArtisanProfileSave,

    // Authenticator (TOTP)
    totpQr,
    totpManualKey,
    totpSetupCode,
    setTotpSetupCode,
    totpDisableCode,
    setTotpDisableCode,
    totpBusy,
    startTotpSetup,
    confirmTotpEnable,
    disableTotp,
    cancelTotpSetup
  };
}

export default useAuth;
