import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';

export function useAuth({ onLogout, onLoginSuccess } = {}) {
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
  const [clientType, setClientType] = useState('interior_designer'); // interior_designer, architectural_firm, hobbyist, student, private
  const [clientPlannedUse, setClientPlannedUse] = useState('source_vendors'); // source_vendors, hiring, collaboration, reference
  const [clientCompany, setClientCompany] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');

  // Artisan registration fields
  const [artisanName, setArtisanName] = useState('');
  const [artisanEmail, setArtisanEmail] = useState('');
  const [artisanPassword, setArtisanPassword] = useState('');
  const [artisanCompany, setArtisanCompany] = useState('');
  const [artisanPhone, setArtisanPhone] = useState('');
  const [artisanInsta, setArtisanInsta] = useState('');
  const [artisanCity, setArtisanCity] = useState('');
  const [artisanSpecialization, setArtisanSpecialization] = useState('');

  // Forgot / reset password flow
  const [forgotStage, setForgotStage] = useState(''); // '' | 'request' | 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');

  // Account settings (name + client profile + password + delete)
  const [accountForm, setAccountForm] = useState({
    name: '',
    clientType: 'interior_designer',
    plannedUse: 'source_vendors',
    companyName: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    totpCode: '',
    emailOtp: ''
  });
  const [reauthForm, setReauthForm] = useState({
    currentPassword: '',
    totpCode: '',
    emailOtp: ''
  });
  const [emailChangeForm, setEmailChangeForm] = useState({ newEmail: '', otp: '' });
  const [phoneChangeForm, setPhoneChangeForm] = useState({ newPhone: '', otp: '' });
  const [emailChangeStage, setEmailChangeStage] = useState(''); // '' | 'confirm'
  const [phoneChangeStage, setPhoneChangeStage] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [toastKey, setToastKey] = useState(0);
  const [accountBusy, setAccountBusy] = useState(false);
  const [reauthBusy, setReauthBusy] = useState(false);

  const clearAccountFeedback = () => {
    setAccountMessage('');
    setAccountError('');
  };

  const showAccountToast = (type, text) => {
    const msg = String(text || '').trim();
    if (!msg) return;
    if (type === 'error') {
      setAccountMessage('');
      setAccountError(msg);
    } else {
      setAccountError('');
      setAccountMessage(msg);
    }
    setToastKey(k => k + 1);
  };

  // Profile forms
  const [profileForm, setProfileForm] = useState({
    companyName: '',
    phoneNumber: '',
    email: '',
    instagram: '',
    city: '',
    personOfContact: '',
    website: '',
    serviceArea: '',
    description: '',
    specialization: [],
    products: [],
    customTags: [],
    portfolio: []
  });
  const [newPortfolioLink, setNewPortfolioLink] = useState('');
  const [artisanListingStatus, setArtisanListingStatus] = useState(null);

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setArtisanListingStatus(null);
    localStorage.removeItem('scoutify_token');
    onLogout?.();
  };

  const applyUserToForms = (nextUser) => {
    setAccountForm({
      name: nextUser.name || '',
      clientType: nextUser.clientProfile?.type || 'interior_designer',
      plannedUse: nextUser.clientProfile?.plannedUse || 'source_vendors',
      companyName: nextUser.clientProfile?.companyName || ''
    });

    const listing = nextUser.artisanProfile || {};
    setProfileForm({
      companyName: listing.companyName || '',
      phoneNumber: listing.phoneNumber || '',
      email: listing.email || nextUser.email || '',
      instagram: listing.instagram || '',
      city: listing.city || '',
      personOfContact: listing.personOfContact || '',
      website: listing.website || '',
      serviceArea: listing.serviceArea || '',
      description: listing.description || '',
      specialization: listing.specialization || [],
      products: listing.products || [],
      customTags: listing.customTags || [],
      portfolio: listing.portfolio || []
    });

    setArtisanListingStatus(nextUser.artisanListing?.contactStatus || null);
  };

  // Single source of truth for the session user.
  const refreshUser = async (activeToken = token) => {
    if (!activeToken) return null;
    try {
      const res = await authFetch('/auth/me', { token: activeToken });
      if (!res.ok) {
        // Expired token, or an account that was deleted/suspended while signed in.
        if ([401, 403, 404].includes(res.status)) {
          const data = await res.json().catch(() => ({}));
          handleLogout();
          if (data.message) setAuthError(data.message);
        }
        return null;
      }
      const data = await res.json();
      setUser(data.user);
      applyUserToForms(data.user);
      return data.user;
    } catch (err) {
      console.error('Could not load account details:', err);
      return null;
    }
  };

  // Load user details if token is present
  useEffect(() => {
    if (!token) {
      localStorage.removeItem('scoutify_token');
      setUser(null);
      setArtisanListingStatus(null);
      return;
    }
    localStorage.setItem('scoutify_token', token);
    refreshUser(token);
  }, [token]);

  // Used by the admin login screen, which issues its own token.
  const applySession = (nextToken, nextUser) => {
    setToken(nextToken);
    if (nextUser) {
      setUser(nextUser);
      onLoginSuccess?.(nextUser);
    }
  };

  const completeAuthSession = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    setShowAuthModal(false);
    setLoginEmail('');
    setLoginPassword('');
    setVerificationCode('');
    setVerificationEmail('');
    setVerifyingOtp(false);
    setVerifying2Fa(false);
    onLoginSuccess?.(nextUser);
  };

  const openAuthModal = (tab = 'login') => {
    setAuthTab(tab);
    setForgotStage('');
    setAuthError('');
    setAuthSuccess('');
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
          phoneNumber: clientPhone || undefined,
          role: 'client',
          clientProfile: {
            type: clientType,
            companyName: clientCompany || undefined,
            plannedUse: clientPlannedUse,
            phoneNumber: clientPhone || undefined
          }
        };
      } else {
        payload = {
          name: artisanName,
          email: artisanEmail,
          password: artisanPassword,
          phoneNumber: artisanPhone || undefined,
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
      setPendingPhone(data.phoneNumber || payload.phoneNumber || '');
      setVerifyingOtp(true);
      setAuthSuccess(data.message || 'Account created! Enter the email OTP.');
      setDevOtp(
        data.deliveryMode === 'console'
          ? 'Dev mode: copy the 6-digit OTP from the backend terminal (email).'
          : 'Check your email inbox for the 6-digit OTP.'
      );
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
      completeAuthSession(data.token, data.user);
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

      completeAuthSession(data.token, data.user);

      // Optional phone verification right after email verify when a phone was collected.
      if (pendingPhone) {
        setVerifyingPhone(true);
        setShowAuthModal(true);
        setAuthSuccess(`Email verified. Enter the OTP sent to ${pendingPhone}.`);
        setDevOtp('Dev mode: copy the phone OTP from the backend terminal.');
        await authFetch('/auth/send-phone-otp', {
          method: 'POST',
          body: { email: verificationEmail || data.user.email, phoneNumber: pendingPhone }
        });
      }
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await authFetch('/auth/verify-phone-otp', {
        method: 'POST',
        body: { email: verificationEmail || user?.email, otp: phoneOtp }
      });
      const data = await res.json();
      if (!res.ok) return setAuthError(data.message || 'Phone verification failed.');

      if (data.user) setUser(data.user);
      setVerifyingPhone(false);
      setPhoneOtp('');
      setPendingPhone('');
      setShowAuthModal(false);
      setAuthSuccess('Phone verified successfully.');
      onLoginSuccess?.(data.user || user);
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  const skipPhoneVerification = () => {
    setVerifyingPhone(false);
    setPhoneOtp('');
    setPendingPhone('');
    setShowAuthModal(false);
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

      completeAuthSession(data.token, data.user);
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
          onLoginSuccess?.(data.user);
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

  // Profile: Update Artisan Profile (re-enters admin moderation on every save)
  const handleArtisanProfileSave = async (e) => {
    e.preventDefault();
    clearAccountFeedback();
    try {
      const companyChanged =
        String(profileForm.companyName || '').trim().toLowerCase() !==
        String(user?.artisanProfile?.companyName || '').trim().toLowerCase();

      const body = { ...profileForm };
      if (companyChanged) {
        body.currentPassword = reauthForm.currentPassword;
        body.totpCode = reauthForm.totpCode;
        body.emailOtp = reauthForm.emailOtp;
      }

      const res = await authFetch('/artisan/profile', { token, method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Failed to update listing.');
        return;
      }
      setArtisanListingStatus(data.contactStatus || 'pending');
      showAccountToast('success', data.message || 'Listing saved successfully.');
      setReauthForm({ currentPassword: '', totpCode: '', emailOtp: '' });
      await refreshUser();
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Connection error while saving listing.');
    }
  };

  // Account: name + client profile fields
  const handleAccountProfileSave = async (e) => {
    e.preventDefault();
    clearAccountFeedback();
    setAccountBusy(true);
    try {
      const body = { name: accountForm.name };
      if (user?.role === 'client') {
        body.clientProfile = {
          type: accountForm.clientType,
          plannedUse: accountForm.plannedUse,
          companyName: accountForm.companyName
        };
        const companyChanged =
          String(accountForm.companyName || '').trim().toLowerCase() !==
          String(user?.clientProfile?.companyName || '').trim().toLowerCase();
        if (companyChanged) {
          body.currentPassword = reauthForm.currentPassword;
          body.totpCode = reauthForm.totpCode;
          body.emailOtp = reauthForm.emailOtp;
        }
      }
      const res = await authFetch('/auth/profile', { token, method: 'PUT', body });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not save profile.');
        return;
      }
      showAccountToast('success', 'Profile details saved successfully.');
      setReauthForm({ currentPassword: '', totpCode: '', emailOtp: '' });
      await refreshUser();
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Connection error while saving profile.');
    } finally {
      setAccountBusy(false);
    }
  };

  // Account: change password while signed in
  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearAccountFeedback();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showAccountToast('error', 'New password and confirmation do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showAccountToast('error', 'New password must be at least 8 characters.');
      return;
    }

    setAccountBusy(true);
    try {
      const res = await authFetch('/auth/change-password', {
        token,
        method: 'POST',
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          totpCode: passwordForm.totpCode || reauthForm.totpCode,
          emailOtp: passwordForm.emailOtp || reauthForm.emailOtp
        }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not change password.');
        return;
      }
      if (data.token) {
        applySession(data.token, data.user || user);
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '', totpCode: '', emailOtp: '' });
      showAccountToast(
        'success',
        data.message || 'Password changed successfully. Confirmation sent to your email.'
      );
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Connection error while changing password.');
    } finally {
      setAccountBusy(false);
    }
  };

  const requestReauthEmailCode = async () => {
    setReauthBusy(true);
    clearAccountFeedback();
    try {
      const res = await authFetch('/auth/reauth-challenge', { token, method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not send re-auth code.');
        return;
      }
      showAccountToast(
        'success',
        data.deliveryMode === 'console'
          ? 'Dev: copy the re-auth code from the backend terminal.'
          : (data.message || 'Re-auth code sent to your email.')
      );
    } catch (err) {
      showAccountToast('error', 'Connection error while requesting re-auth code.');
    } finally {
      setReauthBusy(false);
    }
  };

  const handleStartEmailChange = async (e) => {
    e.preventDefault();
    clearAccountFeedback();
    setAccountBusy(true);
    try {
      const res = await authFetch('/auth/change-email', {
        token,
        method: 'POST',
        body: {
          newEmail: emailChangeForm.newEmail,
          ...reauthForm
        }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not start email change.');
        return;
      }
      setEmailChangeStage('confirm');
      setReauthForm({ currentPassword: '', totpCode: '', emailOtp: '' });
      showAccountToast(
        'success',
        data.deliveryMode === 'console'
          ? 'Confirmation code sent. Check the backend terminal for the OTP.'
          : 'Confirmation code sent to your new email.'
      );
    } catch (err) {
      showAccountToast('error', 'Connection error while changing email.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleConfirmEmailChange = async (e) => {
    e.preventDefault();
    clearAccountFeedback();
    setAccountBusy(true);
    try {
      const res = await authFetch('/auth/confirm-email-change', {
        token,
        method: 'POST',
        body: { otp: emailChangeForm.otp }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not confirm email change.');
        return;
      }
      setEmailChangeStage('');
      setEmailChangeForm({ newEmail: '', otp: '' });
      showAccountToast('success', 'Email changed successfully.');
      if (data.user) setUser(data.user);
      else await refreshUser();
    } catch (err) {
      showAccountToast('error', 'Connection error while confirming email.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleStartPhoneChange = async (e) => {
    e.preventDefault();
    clearAccountFeedback();
    setAccountBusy(true);
    try {
      const res = await authFetch('/auth/change-phone', {
        token,
        method: 'POST',
        body: {
          newPhone: phoneChangeForm.newPhone,
          ...reauthForm
        }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not start phone change.');
        return;
      }
      setPhoneChangeStage('confirm');
      setReauthForm({ currentPassword: '', totpCode: '', emailOtp: '' });
      showAccountToast(
        'success',
        data.deliveryMode === 'console'
          ? 'Confirmation code sent. Check the backend terminal for the OTP.'
          : 'Confirmation code sent to your new phone number.'
      );
    } catch (err) {
      showAccountToast('error', 'Connection error while changing phone.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleConfirmPhoneChange = async (e) => {
    e.preventDefault();
    clearAccountFeedback();
    setAccountBusy(true);
    try {
      const res = await authFetch('/auth/confirm-phone-change', {
        token,
        method: 'POST',
        body: { otp: phoneChangeForm.otp }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not confirm phone change.');
        return;
      }
      setPhoneChangeStage('');
      setPhoneChangeForm({ newPhone: '', otp: '' });
      showAccountToast('success', 'Phone number changed successfully.');
      if (data.user) setUser(data.user);
      else await refreshUser();
    } catch (err) {
      showAccountToast('error', 'Connection error while confirming phone.');
    } finally {
      setAccountBusy(false);
    }
  };

  // Account: soft delete, then drop the local session
  const handleDeleteAccount = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!confirm('Delete your Scoutify account? Your listings and boards stop being visible immediately.')) return;
    clearAccountFeedback();
    setAccountBusy(true);
    try {
      const res = await authFetch('/auth/account', {
        token,
        method: 'DELETE',
        body: { ...reauthForm }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not delete account.');
        return;
      }
      showAccountToast('success', data.message || 'Account deleted successfully.');
      handleLogout();
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Connection error while deleting account.');
    } finally {
      setAccountBusy(false);
    }
  };

  // Forgot password: request the reset code (logged to the backend console in dev)
  const openForgotPassword = () => {
    setForgotStage('request');
    setForgotEmail(loginEmail);
    setForgotOtp('');
    setForgotNewPassword('');
    setAuthError('');
    setAuthSuccess('');
    setDevOtp('');
  };

  const cancelForgotPassword = () => {
    setForgotStage('');
    setAuthError('');
    setAuthSuccess('');
    setDevOtp('');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await authFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail }
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.message || 'Could not start password reset.');
        return;
      }
      setForgotStage('reset');
      setAuthSuccess(data.message);
      setDevOtp('Development: the 6-digit reset code is printed in the backend server console.');
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await authFetch('/auth/reset-password', {
        method: 'POST',
        body: { email: forgotEmail, otp: forgotOtp, newPassword: forgotNewPassword }
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.message || 'Could not reset password.');
        return;
      }
      setForgotStage('');
      setDevOtp('');
      setAuthTab('login');
      setLoginEmail(forgotEmail);
      setLoginPassword('');
      setForgotOtp('');
      setForgotNewPassword('');
      setAuthSuccess(data.message);
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  const startTotpSetup = async () => {
    setTotpBusy(true);
    clearAccountFeedback();
    try {
      const res = await authFetch('/auth/2fa/setup', { token, method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not start authenticator setup.');
        return;
      }
      setTotpQr(data.qrDataUrl);
      setTotpManualKey(data.manualKey);
      setTotpSetupCode('');
      showAccountToast('success', 'Scan the QR code, then enter the app code to enable 2FA.');
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Could not start authenticator setup.');
    } finally {
      setTotpBusy(false);
    }
  };

  const confirmTotpEnable = async (e) => {
    e.preventDefault();
    setTotpBusy(true);
    clearAccountFeedback();
    try {
      const res = await authFetch('/auth/2fa/enable', {
        token,
        method: 'POST',
        body: { code: totpSetupCode }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not enable authenticator.');
        return;
      }
      setUser(prev => ({ ...prev, twoFactorEnabled: true, mustEnable2FA: false }));
      setTotpQr('');
      setTotpManualKey('');
      setTotpSetupCode('');
      showAccountToast('success', 'Google Authenticator enabled successfully.');
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Could not enable authenticator.');
    } finally {
      setTotpBusy(false);
    }
  };

  const disableTotp = async (e) => {
    e.preventDefault();
    if (user?.role === 'admin') {
      showAccountToast('error', 'Administrators cannot disable two-factor authentication.');
      return;
    }
    setTotpBusy(true);
    clearAccountFeedback();
    try {
      const res = await authFetch('/auth/2fa/disable', {
        token,
        method: 'POST',
        body: { code: totpDisableCode }
      });
      const data = await res.json();
      if (!res.ok) {
        showAccountToast('error', data.message || 'Could not disable authenticator.');
        return;
      }
      setUser(prev => ({ ...prev, twoFactorEnabled: false }));
      setTotpDisableCode('');
      showAccountToast('success', 'Google Authenticator disabled successfully.');
    } catch (err) {
      console.error(err);
      showAccountToast('error', 'Could not disable authenticator.');
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
    refreshUser,
    applySession,

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

    // Forgot / reset password
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
    handleResetPassword,

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
    clientCompany,
    setClientCompany,
    clientPhone,
    setClientPhone,
    verifyingPhone,
    pendingPhone,
    phoneOtp,
    setPhoneOtp,
    handleVerifyPhoneOtp,
    skipPhoneVerification,

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
    handleVerifyPhoneOtp,
    skipPhoneVerification,
    handleGoogleLogin,
    demoLogin,
    handleHudDemoLogin,

    // Artisan profile
    profileForm,
    setProfileForm,
    newPortfolioLink,
    setNewPortfolioLink,
    handleArtisanProfileSave,
    artisanListingStatus,

    // Account settings
    accountForm,
    setAccountForm,
    passwordForm,
    setPasswordForm,
    reauthForm,
    setReauthForm,
    emailChangeForm,
    setEmailChangeForm,
    phoneChangeForm,
    setPhoneChangeForm,
    emailChangeStage,
    phoneChangeStage,
    accountMessage,
    accountError,
    toastKey,
    clearAccountFeedback,
    accountBusy,
    reauthBusy,
    handleAccountProfileSave,
    handleChangePassword,
    handleDeleteAccount,
    requestReauthEmailCode,
    handleStartEmailChange,
    handleConfirmEmailChange,
    handleStartPhoneChange,
    handleConfirmPhoneChange,

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
