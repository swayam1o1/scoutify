import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Lock,
  Sparkles,
  User as UserIcon,
  Briefcase,
  LogOut,
  Check,
  CheckCircle,
  HelpCircle,
  FileText,
  ShieldCheck,
  Phone,
  Mail,
  Plus,
  Trash
} from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:5001/api';

// Custom inline SVG for Instagram icon since brand icons are removed from Lucide-react v1+
const Instagram = ({ size = 24, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);


function App() {
  // Navigation / Views
  const [currentView, setCurrentView] = useState('search'); // 'search' | 'dashboard' | 'pricing'
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);


  // Search state
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [paywallActive, setPaywallActive] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // AI Sourcing state
  const [searchMode, setSearchMode] = useState('standard'); // 'standard' | 'ai'
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoaderStep, setAiLoaderStep] = useState(0);
  const [isAiSearching, setIsAiSearching] = useState(false);

  // Project Boards state
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [activeSaveDropdownId, setActiveSaveDropdownId] = useState(null);
  const [quickNewBoardName, setQuickNewBoardName] = useState('');
  
  // Board Recommendations state
  const [boardRecommendations, setBoardRecommendations] = useState([]);
  const [boardRationale, setBoardRationale] = useState('');
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Board Search states
  const [boardSearchCity, setBoardSearchCity] = useState('');
  const [boardSearchService, setBoardSearchService] = useState('');
  const [boardSearchAiQuery, setBoardSearchAiQuery] = useState('');
  const [boardSearchMode, setBoardSearchMode] = useState('standard');
  const [boardSearchResults, setBoardSearchResults] = useState([]);
  const [boardSearching, setBoardSearching] = useState(false);
  const [boardSearchTotalResults, setBoardSearchTotalResults] = useState(0);

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

  // Payment simulator modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);

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
        fetchBoards();
      } catch (err) {
        handleLogout();
      }
    } else {
      localStorage.removeItem('scoutify_token');
      setUser(null);
      setBoards([]);
    }
  }, [token]);

  // Fetch profiles based on role
  const fetchUserProfile = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // We can create a unified endpoint, or fetch specifically
      if (user?.role === 'artisan') {
        const res = await fetch(`${API_BASE}/artisan/profile`, { headers });
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
      const resSearch = await fetch(`${API_BASE}/search`, { headers });
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
    setCurrentView('search');
    setSearchResults([]);
    setHasSearched(false);
  };

  // Perform search
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setSearching(true);
    setHasSearched(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const queryParams = new URLSearchParams({
        service: service,
        location: location
      });

      const res = await fetch(`${API_BASE}/search?${queryParams.toString()}`, { headers });
      const data = await res.json();

      setSearchResults(data.results || []);
      setTotalResults(data.totalResults || 0);
      setPaywallActive(data.paywallActive || false);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleAiSearch = async (e) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim()) return;

    if (!user) {
      setAuthTab('login');
      setShowAuthModal(true);
      return;
    }

    setSearching(true);
    setIsAiSearching(true);
    setHasSearched(true);
    setAiLoaderStep(0);

    const steps = [
      "Analyzing project requirements...",
      "Matching candidate specialties...",
      "Resolving location constraints...",
      "Ranking matching profiles..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setAiLoaderStep(currentStep);
      }
    }, 600);

    try {
      const res = await fetch(`${API_BASE}/search/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: aiQuery })
      });

      const data = await res.json();
      clearInterval(interval);

      if (!res.ok) {
        alert(data.message || 'AI Matching failed.');
        return;
      }

      setSearchResults(data.results || []);
      setTotalResults(data.results?.length || 0);
      setPaywallActive(false);
    } catch (err) {
      clearInterval(interval);
      console.error(err);
    } finally {
      setSearching(false);
      setIsAiSearching(false);
    }
  };

  // YC HUD Helpers
  const handleHudDemoLogin = async (role) => {
    try {
      const res = await fetch(`${API_BASE}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
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

  const handleHudPaywallDemo = async () => {
    setSearchMode('standard');
    setService('Architectural');
    setLocation('Delhi');
    setSearching(true);
    setHasSearched(true);
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const queryParams = new URLSearchParams({ service: 'Architectural', location: 'Delhi' });
      const res = await fetch(`${API_BASE}/search?${queryParams.toString()}`, { headers });
      const data = await res.json();
      setSearchResults(data.results || []);
      setTotalResults(data.totalResults || 0);
      setPaywallActive(data.paywallActive || false);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleHudAiDemo = async () => {
    let currentToken = token;
    if (!user) {
      // Auto login client first
      const resLogin = await fetch(`${API_BASE}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'client_pro' })
      });
      const loginData = await resLogin.json();
      if (resLogin.ok) {
        setToken(loginData.token);
        setUser(loginData.user);
        currentToken = loginData.token;
      } else {
        alert('Demo login failed.');
        return;
      }
    }

    setSearchMode('ai');
    setAiQuery('I need a false ceiling specialist in Tirupati');
    setSearching(true);
    setIsAiSearching(true);
    setHasSearched(true);
    setAiLoaderStep(0);

    const steps = ["Analyzing requirements...", "Scanning database...", "Computing alignment...", "Ranking profiles..."];
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) setAiLoaderStep(step);
    }, 450);

    try {
      const res = await fetch(`${API_BASE}/search/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ query: 'I need a false ceiling specialist in Tirupati' })
      });
      const data = await res.json();
      clearInterval(interval);
      setSearchResults(data.results || []);
      setTotalResults(data.results?.length || 0);
      setPaywallActive(false);
    } catch (err) {
      clearInterval(interval);
      console.error(err);
    } finally {
      setSearching(false);
      setIsAiSearching(false);
    }
  };

  // Trigger search on component load or on plan changes

  useEffect(() => {
    if (hasSearched && searchMode === 'standard') {
      handleSearch();
    }
  }, [user?.subscriptionPlan]);


  // PROJECT BOARDS FUNCTIONS
  const fetchBoards = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/boards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
      }
    } catch (err) {
      console.error('Error fetching boards:', err);
    }
  };

  const createBoard = async (name, autoSaveVendorId = null) => {
    if (!name || !name.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        setNewBoardName('');
        setQuickNewBoardName('');

        if (autoSaveVendorId) {
          const newBoard = data.boards.find(b => b.name.toLowerCase() === name.trim().toLowerCase());
          if (newBoard) {
            await saveVendorToBoard(newBoard._id, autoSaveVendorId);
          }
        } else {
          alert('Project board created successfully!');
        }
      } else {
        alert(data.message || 'Failed to create board.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveVendorToBoard = async (boardId, vendorId) => {
    try {
      const res = await fetch(`${API_BASE}/boards/${boardId}/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vendorId })
      });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        setActiveSaveDropdownId(null);
        alert('Vendor saved to project board!');
      } else {
        alert(data.message || 'Failed to save vendor.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeVendorFromBoard = async (boardId, vendorId) => {
    if (!confirm('Are you sure you want to remove this vendor from the board?')) return;
    try {
      const res = await fetch(`${API_BASE}/boards/${boardId}/vendors/${vendorId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
      } else {
        alert(data.message || 'Failed to remove vendor.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBoard = async (boardId) => {
    if (!confirm('Are you sure you want to delete this project board?')) return;
    try {
      const res = await fetch(`${API_BASE}/boards/${boardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBoards(data.boards || []);
        if (activeBoardId === boardId) {
          setActiveBoardId(null);
        }
      } else {
        alert(data.message || 'Failed to delete board.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBoardRecommendations = async (boardId) => {
    if (!boardId || !token) return;
    setLoadingRecommendations(true);
    try {
      const res = await fetch(`${API_BASE}/boards/${boardId}/recommendations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBoardRecommendations(data.recommendations || []);
        setBoardRationale(data.rationale || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    if (activeBoardId) {
      fetchBoardRecommendations(activeBoardId);
    } else {
      setBoardRecommendations([]);
      setBoardRationale('');
    }
  }, [activeBoardId, boards]);

  const handleBoardSearch = async (e) => {
    if (e) e.preventDefault();
    if (!boardSearchCity.trim() && !boardSearchService.trim()) return;
    setBoardSearching(true);
    setBoardSearchResults([]);
    try {
      const queryParams = new URLSearchParams({
        city: boardSearchCity.trim(),
        service: boardSearchService.trim()
      });
      const res = await fetch(`${API_BASE}/search?${queryParams}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok) {
        setBoardSearchResults(data.results || []);
        setBoardSearchTotalResults(data.totalResults || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBoardSearching(false);
    }
  };

  const handleBoardAiSearch = async (e) => {
    if (e) e.preventDefault();
    if (!boardSearchAiQuery.trim()) return;
    if (!token) { alert('Please log in to use AI Sourcing.'); return; }
    setBoardSearching(true);
    setBoardSearchResults([]);
    try {
      const res = await fetch(`${API_BASE}/search/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: boardSearchAiQuery.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const aiResults = data.matches || data.results || [];
        setBoardSearchResults(aiResults);
        setBoardSearchTotalResults(aiResults.length);
      } else {
        console.error('AI search error:', data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBoardSearching(false);
    }
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

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
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
        setAuthSuccess('2FA verification code sent/logged.');
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
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, otp: verificationCode })
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
      const res = await fetch(`${API_BASE}/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code: verificationCode })
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
          const res = await fetch(`${API_BASE}/auth/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: event.data.name,
              email: event.data.email,
              googleId: event.data.googleId,
              role: authRole // Uses currently selected role in form
            })
          });

          const data = await res.json();
          if (!res.ok) {
            return setAuthError(data.message || 'Google authentication failed.');
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

  // Payments: Create Razorpay Order
  const handleUpgradeClick = async (plan) => {
    if (!user) {
      setAuthTab('register');
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to initiate order.');
        return;
      }

      if (data.simulated) {
        // Open Simulated checkout Modal
        setActivePaymentOrder(data);
        setShowPaymentModal(true);
      } else {
        // Open Real Razorpay Standard Checkout
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: 'INR',
          name: 'Scoutify',
          description: `${plan.toUpperCase()} Membership Upgrade`,
          order_id: data.orderId,
          handler: async function (response) {
            // Verify payment
            const verifyRes = await fetch(`${API_BASE}/payments/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                plan,
                simulated: false
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              setUser(verifyData.user);
              alert('Payment verified! Your account is now upgraded to ' + plan.toUpperCase() + '.');
              setCurrentView('search');
            } else {
              alert(verifyData.message || 'Verification failed.');
            }
          },
          prefill: {
            name: user.name,
            email: user.email
          },
          theme: {
            color: '#14f195'
          }
        };

        const rzp1 = new window.Razorpay(options);
        rzp1.open();
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to payment processor.');
    }
  };

  // Payments: Complete Simulated payment
  const completeSimulatedPayment = async (success) => {
    if (!success) {
      alert('Payment failed/cancelled.');
      setShowPaymentModal(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/payments/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentId: `pay_sim_${Math.random().toString(36).substr(2, 9)}`,
          orderId: activePaymentOrder.orderId,
          plan: activePaymentOrder.plan,
          simulated: true
        })
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        alert('Simulated payment successful! Upgraded to ' + activePaymentOrder.plan.toUpperCase());
        setShowPaymentModal(false);
        setCurrentView('search');
      } else {
        alert(data.message || 'Payment upgrade verification failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating subscription.');
    }
  };

  // Profile: Update Artisan Profile
  const handleArtisanProfileSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/artisan/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      });
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

  // Profile: Toggle 2FA settings for Client
  const toggle2FA = async (enable) => {
    try {
      const res = await fetch(`${API_BASE}/auth/toggle-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: enable })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(prev => ({
          ...prev,
          twoFactorEnabled: data.twoFactorEnabled
        }));
        alert(`2FA configuration successfully updated.`);
      } else {
        alert(data.message || 'Failed to toggle 2FA.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="root">
      {/* 1. STICKY NAVBAR */}
      <nav className="navbar">
        <div className="logo" onClick={() => setCurrentView('search')} style={{ cursor: 'pointer' }}>
          Scoutify <span>Hub</span>
        </div>

        <div className="nav-links">
          <button
            className={`btn btn-secondary ${currentView === 'search' ? 'active-tab' : ''}`}
            onClick={() => setCurrentView('search')}
          >
            Search
          </button>

          <button
            className={`btn btn-secondary ${currentView === 'pricing' ? 'active-tab' : ''}`}
            onClick={() => setCurrentView('pricing')}
          >
            Plans
          </button>

          {user ? (
            <div className="nav-user">
              <button 
                className={`btn btn-secondary`}
                onClick={() => setCurrentView('dashboard')}
              >
                <UserIcon size={16} />
                Portal
              </button>
              
              {user.role === 'client' && (
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setCurrentView('boards');
                    setActiveBoardId(null);
                  }}
                  style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                >
                  📁 Boards
                </button>
              )}


              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.name}</span>
                {user.role === 'client' && (
                  <span className={`badge ${user.subscriptionPlan !== 'basic' ? 'badge-purple' : ''}`} style={{ fontSize: '10px' }}>
                    {user.subscriptionPlan.toUpperCase()}
                  </span>
                )}
                {user.role === 'artisan' && (
                  <span className="badge" style={{ fontSize: '10px' }}>
                    ARTISAN
                  </span>
                )}

              </div>

              <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 14px' }}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => { setAuthTab('login'); setShowAuthModal(true); }}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* 2. MAIN VIEWS SWITCHER */}
      <main style={{ flex: 1 }}>
        {currentView === 'search' && (
          <div className="animate-fade-in">
            {/* Search Hero */}
            <div className="hero">
              <h1>Source Verified Artisans & Services</h1>
              <p>Search over 5000+ curated architects, designers, builders, and specialists instantly.</p>

              {/* Search mode toggle */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                <button
                  type="button"
                  className={`btn ${searchMode === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                  onClick={() => { setSearchMode('standard'); setHasSearched(false); setSearchResults([]); }}
                >
                  Standard Search
                </button>
                <button
                  type="button"
                  className={`btn ${searchMode === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '14px', gap: '6px' }}
                  onClick={() => { setSearchMode('ai'); setHasSearched(false); setSearchResults([]); }}
                >
                  <Sparkles size={14} /> AI Matchmaker
                </button>
              </div>

              {/* Dual input search bar OR AI text brief */}
              <div className="search-box-wrapper">
                {searchMode === 'standard' ? (
                  <form onSubmit={handleSearch} className="search-box">
                    <div className="search-input-group">
                      <Search size={20} />
                      <input
                        type="text"
                        placeholder="Service (e.g. Architectural, Interior...)"
                        value={service}
                        onChange={(e) => setService(e.target.value)}
                      />
                    </div>
                    <div className="search-input-group">
                      <MapPin size={20} />
                      <input
                        type="text"
                        placeholder="Location (e.g. Tirupati, Delhi, Pune...)"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ borderRadius: '10px' }}>
                      Find Artisans
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleAiSearch} className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', textAlign: 'left' }}>
                    <div>
                      <label className="form-label">Explain your project requirements in detail (specialty, aesthetic, budget, city)</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="I need a modern false ceiling expert in Tirupati to remodel a living room under 3 Lakhs..."
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        required
                        style={{ resize: 'none' }}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                      <Sparkles size={18} /> Match Me with Artisans
                    </button>
                  </form>
                )}
              </div>

            </div>

            {/* Results Grid */}
            <div className="results-container">
              {searching ? (
                isAiSearching ? (
                  <div className="glass-card animate-fade-in" style={{ maxWidth: '450px', margin: '40px auto', padding: '30px', textAlign: 'center' }}>
                    <div className="spin" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: '#14f195', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
                    <h3 style={{ marginBottom: '18px', fontSize: '18px' }}>Scoutify AI Matchmaker</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: aiLoaderStep >= 0 ? '#14f195' : 'var(--color-text-secondary)' }}>
                        {aiLoaderStep > 0 ? <CheckCircle size={16} style={{ color: '#14f195' }} /> : <div style={{ width: 16, height: 16, border: '2px solid', borderRadius: '50%', flexShrink: 0 }} />}
                        <span>Analyzing project requirements...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: aiLoaderStep >= 1 ? '#14f195' : 'var(--color-text-secondary)' }}>
                        {aiLoaderStep > 1 ? <CheckCircle size={16} style={{ color: '#14f195' }} /> : <div style={{ width: 16, height: 16, border: '2px solid', borderRadius: '50%', flexShrink: 0 }} />}
                        <span>Scanning database categories...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: aiLoaderStep >= 2 ? '#14f195' : 'var(--color-text-secondary)' }}>
                        {aiLoaderStep > 2 ? <CheckCircle size={16} style={{ color: '#14f195' }} /> : <div style={{ width: 16, height: 16, border: '2px solid', borderRadius: '50%', flexShrink: 0 }} />}
                        <span>Computing compatibility matrix...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: aiLoaderStep >= 3 ? '#14f195' : 'var(--color-text-secondary)' }}>
                        {aiLoaderStep > 3 ? <CheckCircle size={16} style={{ color: '#14f195' }} /> : <div style={{ width: 16, height: 16, border: '2px solid', borderRadius: '50%', flexShrink: 0 }} />}
                        <span>Ranking matching profiles...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="spin" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: '#14f195', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 16px' }}></div>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Searching database...</p>
                  </div>
                )
              ) : hasSearched ? (
                <>
                  <div className="results-header">
                    <h3>
                      Search Results
                      <span className="badge badge-purple" style={{ marginLeft: '12px', fontSize: '13px' }}>
                        {totalResults} found
                      </span>
                    </h3>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                      No verified matching artisans found. Try refining your service name or searching by a different city.
                    </div>
                  ) : (
                    <>
                      <div className="grid-container grid-3" style={{ position: 'relative' }}>
                      {/* Free Results */}
                      {/* Hard-cap: basic plan users never see more than 10 results regardless of state */}
                      {(user?.subscriptionPlan === 'basic' || !user ? searchResults.slice(0, 10) : searchResults).map((artisan, index) => (
                        <div key={artisan._id || index} className="glass-card animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                          <div className="artisan-card-header">
                            <h4 className="artisan-title">{artisan.companyName}</h4>
                            {artisan.matchPercentage ? (
                              <span className="badge badge-purple">{artisan.matchPercentage}% MATCH</span>
                            ) : (
                              <span className="badge">VERIFIED</span>
                            )}
                          </div>

                          <div className="artisan-specializations">
                            {artisan.specialization?.map((spec, i) => (
                              <span key={i} className="spec-tag">{spec}</span>
                            ))}
                          </div>

                          <div className="artisan-info">
                            <div className="artisan-info-item">
                              <MapPin size={14} />
                              <span>{artisan.city}</span>
                            </div>
                            <div className="artisan-info-item">
                              <UserIcon size={14} />
                              <span>Contact: {artisan.personOfContact || 'N/A'}</span>
                            </div>
                            <div className="artisan-info-item">
                              <Phone size={14} />
                              <span>{artisan.phoneNumber || 'Hidden'}</span>
                            </div>
                            <div className="artisan-info-item">
                              <Mail size={14} />
                              <span style={{ fontSize: '13px', wordBreak: 'break-all' }}>{artisan.email || 'Hidden'}</span>
                            </div>
                            {artisan.instagram && (
                              <div className="artisan-info-item">
                                <Instagram size={14} />
                                <span>{artisan.instagram}</span>
                              </div>
                            )}
                          </div>

                          {artisan.phoneNumber && (
                            <a
                              href={`https://wa.me/91${artisan.phoneNumber.split('/')[0].replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(artisan.personOfContact || artisan.companyName)},%20I%20found%20your%20verified%20profile%20on%20Scoutify%20and%20would%20like%20to%20discuss%20a%20project%20in%20${encodeURIComponent(artisan.city)}.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: '8px 12px', fontSize: '13px', marginTop: '12px', width: '100%', background: '#25D366', color: '#fff', border: 'none', justifyContent: 'center', fontWeight: '600' }}
                            >
                              Message on WhatsApp
                            </a>
                          )}

                          {(!user || user.role === 'client') && (
                            <div style={{ position: 'relative', marginTop: '8px' }}>
                              <button
                                className="btn btn-outline"
                                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', justifyContent: 'center' }}
                                onClick={() => {
                                  if (!user) {
                                    setAuthTab('login');
                                    setShowAuthModal(true);
                                  } else {
                                    setActiveSaveDropdownId(activeSaveDropdownId === artisan._id ? null : artisan._id);
                                    setQuickNewBoardName('');
                                  }
                                }}
                              >
                                Save to Project Board
                              </button>

                              {activeSaveDropdownId === artisan._id && (
                                <div className="save-board-dropdown animate-fade-in">
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', padding: '4px 8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                    Select Board
                                  </div>

                                  {boards.length === 0 ? (
                                    <div style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                      No boards created yet.
                                    </div>
                                  ) : (
                                    <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                                      {boards.map(board => (
                                        <div
                                          key={board._id}
                                          className="save-board-item"
                                          onClick={() => saveVendorToBoard(board._id, artisan._id)}
                                        >
                                          📁 {board.name}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="save-board-create">
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Create new board..."
                                      value={quickNewBoardName}
                                      onChange={(e) => setQuickNewBoardName(e.target.value)}
                                      style={{ padding: '6px 10px', fontSize: '12px', height: 'auto', marginBottom: '6px', background: 'rgba(255,255,255,0.02)' }}
                                    />
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '4px 8px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                                      onClick={() => createBoard(quickNewBoardName, artisan._id)}
                                    >
                                      Create & Save
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}



                          {artisan.aiReasoning && (
                            <div style={{ background: 'rgba(153, 69, 255, 0.06)', border: '1px solid rgba(153, 69, 255, 0.15)', padding: '12px', borderRadius: '8px', marginTop: '10px', fontSize: '13px', textAlign: 'left' }}>
                              <strong style={{ color: '#c084fc', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                AI Match Reasoning
                              </strong>
                              {artisan.aiReasoning}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>

                    {/* Paywall Banner / Section (Rendered outside the grid container) */}
                    {(paywallActive || ((user?.subscriptionPlan === 'basic' || !user) && totalResults > 10)) && (
                      <div className="glass-card paywall-section animate-fade-in" style={{ marginTop: '30px', padding: '40px', position: 'relative', textAlign: 'center', overflow: 'hidden' }}>
                        {/* Previews background graphic */}
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', opacity: 0.1, filter: 'blur(5px)', pointerEvents: 'none', marginBottom: '20px', userSelect: 'none' }}>
                          <div className="glass-card" style={{ width: '220px', padding: '12px' }}>
                            <h4>Hidden Studio</h4>
                            <p>Architectural Services</p>
                          </div>
                          <div className="glass-card" style={{ width: '220px', padding: '12px' }}>
                            <h4>Locked Artisan</h4>
                            <p>Interior Designing</p>
                          </div>
                        </div>

                        {/* Paywall Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative' }}>
                          <Lock size={36} style={{ color: 'var(--color-primary)', marginBottom: '12px' }} />
                          <h3>Viewing Limits Exceeded</h3>
                          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '8px auto 20px', fontSize: '14px' }}>
                            Unlock access to remaining {totalResults - 10} verified artisans found matching this search!
                          </p>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            {!user ? (
                              <button className="btn btn-primary" onClick={() => { setAuthTab('register'); setShowAuthModal(true); }}>
                                Register to Unlock
                              </button>
                            ) : (
                              <button className="btn btn-purple" onClick={() => setCurrentView('pricing')}>
                                Upgrade Subscription
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                </>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
                  <div className="glass-card" style={{ maxWidth: '280px', textAlign: 'center' }}>
                    <Sparkles size={24} style={{ color: 'var(--color-primary)', margin: '0 auto 12px' }} />
                    <h4 style={{ marginBottom: '8px' }}>Verified Data</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Pre-vetted contact records directly matching verified status.</p>
                  </div>
                  <div className="glass-card" style={{ maxWidth: '280px', textAlign: 'center' }}>
                    <ShieldCheck size={24} style={{ color: 'var(--color-secondary)', margin: '0 auto 12px' }} />
                    <h4 style={{ marginBottom: '8px' }}>Security Built-in</h4>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Support for client double-factor authentication (2FA).</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pricing Subscriptions Page */}
        {currentView === 'pricing' && (
          <div className="pricing-section animate-fade-in">
            <div className="pricing-header">
              <h2>Select Your Membership Tier</h2>
              <p>Find local artisans, build partnerships, and contract seamlessly with no middleman margins.</p>
            </div>

            <div className="pricing-grid">
              {/* Basic */}
              <div className="pricing-card">
                <div className="plan-name">Basic Searcher</div>
                <div className="plan-price">₹0 <span>/ lifetime</span></div>
                <div className="plan-desc">For individual clients starting with basic discovery.</div>
                <ul className="plan-features">
                  <li><Check size={16} /> 10 free search views</li>
                  <li><Check size={16} /> Basic location filters</li>
                  <li style={{ color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}><Lock size={12} /> Unlimited results</li>
                  <li style={{ color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}><Lock size={12} /> Priority email support</li>
                </ul>
                <button className="btn btn-secondary" onClick={() => setCurrentView('search')}>
                  Start Free Search
                </button>
              </div>

              {/* Pro */}
              <div className="pricing-card popular">
                <div className="popular-badge">Recommended</div>
                <div className="plan-name" style={{ color: 'var(--color-primary)' }}>Pro Directory</div>
                <div className="plan-price">₹999 <span>/ month</span></div>
                <div className="plan-desc">For architects, designers, and firms with regular sourcing needs.</div>
                <ul className="plan-features">
                  <li><Check size={16} /> Unlimited search lookups</li>
                  <li><Check size={16} /> Full contact details unlocked</li>
                  <li><Check size={16} /> OTP & 2FA security features</li>
                  <li><Check size={16} /> Sync multiple locations</li>
                </ul>
                <button className="btn btn-primary" onClick={() => handleUpgradeClick('pro')}>
                  Upgrade to Pro
                </button>
              </div>

              {/* Enterprise */}
              <div className="pricing-card">
                <div className="plan-name" style={{ color: 'var(--color-secondary)' }}>Enterprise API</div>
                <div className="plan-price">₹4,999 <span>/ month</span></div>
                <div className="plan-desc">Corporate account for developers, bulk inquiries, and data sync.</div>
                <ul className="plan-features">
                  <li><Check size={16} /> Everything in Pro plan</li>
                  <li><Check size={16} /> Export to Excel / CSV format</li>
                  <li><Check size={16} /> Bulk messaging integration</li>
                  <li><Check size={16} /> Dedicated client success rep</li>
                </ul>
                <button className="btn btn-purple" onClick={() => handleUpgradeClick('enterprise')}>
                  Get Enterprise
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User / Artisan Portal Dashboard */}
        {currentView === 'dashboard' && user && (
          <div className="dashboard-container animate-fade-in">
            <div className="dashboard-header">
              <div>
                <h2>{user.role === 'artisan' ? 'Artisan Sourcing Portal' : 'Client User Portal'}</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>Manage account parameters and configurations.</p>
              </div>
              {user.role === 'client' && (
                <span className="badge badge-purple" style={{ fontSize: '14px', padding: '6px 16px' }}>
                  Plan: {user.subscriptionPlan.toUpperCase()}
                </span>
              )}

            </div>

            <div className="dashboard-grid">
              {/* Left sidebar: general details */}
              <div className="glass-card">
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
                  Account Info
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '15px' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Member Name</span>
                    <strong>{user.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Account Role</span>
                    <strong style={{ textTransform: 'capitalize' }}>{user.role}</strong>
                  </div>

                  {user.role === 'client' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
                      <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Security Settings (2FA)</h4>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                        Require verification code during email/password login.
                      </p>
                      {user.twoFactorEnabled ? (
                        <button className="btn btn-outline" onClick={() => toggle2FA(false)} style={{ width: '100%', fontSize: '13px', padding: '8px' }}>
                          Disable Login 2FA
                        </button>
                      ) : (
                        <button className="btn btn-primary" onClick={() => toggle2FA(true)} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000' }}>
                          Enable Login 2FA
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right content: profile forms */}
              {user.role === 'artisan' ? (
                <div className="glass-card">
                  <h3 style={{ marginBottom: '16px' }}>Public Directory Listing</h3>
                  <form onSubmit={handleArtisanProfileSave}>
                    <div className="grid-container grid-2">
                      <div className="form-group">
                        <label className="form-label">Company Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={profileForm.companyName}
                          onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className="form-control"
                          value={profileForm.phoneNumber}
                          onChange={e => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid-container grid-2">
                      <div className="form-group">
                        <label className="form-label">Instagram Handle</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="@studio_name"
                          value={profileForm.instagram}
                          onChange={e => setProfileForm({ ...profileForm, instagram: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Listing City</label>
                        <input
                          type="text"
                          className="form-control"
                          value={profileForm.city}
                          onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Person of Contact</label>
                      <input
                        type="text"
                        className="form-control"
                        value={profileForm.personOfContact}
                        onChange={e => setProfileForm({ ...profileForm, personOfContact: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Specializations (comma separated)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Architectural Services, Interior Styling, Contracting..."
                        value={profileForm.specialization.join(', ')}
                        onChange={e => setProfileForm({ ...profileForm, specialization: e.target.value.split(',').map(s => s.trim()) })}
                      />
                    </div>

                    <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                      <label className="form-label">Portfolio Items / Website Links</label>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                        <input
                          type="url"
                          className="form-control"
                          placeholder="https://behance.net/my-project"
                          value={newPortfolioLink}
                          onChange={e => setNewPortfolioLink(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            if (newPortfolioLink) {
                              setProfileForm({
                                ...profileForm,
                                portfolio: [...profileForm.portfolio, newPortfolioLink]
                              });
                              setNewPortfolioLink('');
                            }
                          }}
                        >
                          <Plus size={16} /> Add
                        </button>
                      </div>

                      <div className="portfolio-list">
                        {profileForm.portfolio.map((link, idx) => (
                          <div key={idx} className="portfolio-item">
                            <span style={{ fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '350px' }}>
                              {link}
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '4px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                              onClick={() => {
                                setProfileForm({
                                  ...profileForm,
                                  portfolio: profileForm.portfolio.filter((_, i) => i !== idx)
                                });
                              }}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }}>
                      Save Listing Details
                    </button>
                  </form>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="glass-card">
                    <h3 style={{ marginBottom: '14px' }}>Client Profile Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="grid-container grid-2">
                        <div className="glass-card" style={{ padding: '16px' }}>
                          <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)' }}>User Type</span>
                          <strong style={{ fontSize: '16px', textTransform: 'capitalize' }}>
                            {profileForm.clientType || 'Interior Designer'}
                          </strong>
                        </div>
                        <div className="glass-card" style={{ padding: '16px' }}>
                          <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Planned Sourcing Purpose</span>
                          <strong style={{ fontSize: '16px', textTransform: 'capitalize' }}>
                            {profileForm.plannedUse || 'Contractor Hiring'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0 }}>My Project Boards</h3>
                      {activeBoardId ? (
                        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setActiveBoardId(null)}>
                          ← Back to Boards
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="New Board Name..."
                            value={newBoardName}
                            onChange={(e) => setNewBoardName(e.target.value)}
                            style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', width: '160px' }}
                          />
                          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', color: '#000' }} onClick={() => createBoard(newBoardName)}>
                            + Create
                          </button>
                        </div>
                      )}
                    </div>

                    {activeBoardId ? (
                      <div>
                        {(() => {
                          const board = boards.find(b => b._id === activeBoardId);
                          if (!board) return <p>Board not found.</p>;
                          return (
                            <div>
                              <h4 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--color-primary)' }}>
                                Folder: {board.name} ({board.vendors?.length || 0} vendors saved)
                              </h4>
                              {(!board.vendors || board.vendors.length === 0) ? (
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                  No vendors saved in this board yet. Go to search to add some!
                                </p>
                              ) : (
                                <div className="grid-container grid-2">
                                  {board.vendors.map(vendor => (
                                    <div key={vendor._id} className="glass-card animate-fade-in" style={{ padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                        <h5 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>{vendor.companyName}</h5>
                                        <button
                                          className="btn btn-outline"
                                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)', borderColor: 'rgba(255,75,75,0.2)' }}
                                          onClick={() => removeVendorFromBoard(board._id, vendor._id)}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div>📍 {vendor.city}</div>
                                        <div>📞 {vendor.phoneNumber || 'Hidden'}</div>
                                        <div>✉️ {vendor.email || 'Hidden'}</div>
                                      </div>
                                      {vendor.phoneNumber && (
                                        <a
                                          href={`https://wa.me/91${vendor.phoneNumber.split('/')[0].replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(vendor.personOfContact || vendor.companyName)},%20we%20saved%20your%20profile%20on%20Scoutify%20and%20would%20like%20to%20discuss%20our%20project%20board%20"${encodeURIComponent(board.name)}".`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="btn btn-secondary"
                                          style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px', width: '100%', background: '#25D366', color: '#fff', border: 'none', justifyContent: 'center', fontWeight: '500' }}
                                        >
                                          WhatsApp Sourcing Chat
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div>
                        {boards.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                            You have no project boards. Create one above to start organizing sourcing vendors!
                          </div>
                        ) : (
                          <div className="boards-grid">
                            {boards.map(board => (
                              <div key={board._id} className="board-card" onClick={() => setActiveBoardId(board._id)}>
                                <button
                                  className="board-delete-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBoard(board._id);
                                  }}
                                  title="Delete board"
                                >
                                  ✕
                                </button>
                                <div className="board-card-title">📁 {board.name}</div>
                                <div className="board-card-meta">
                                  {board.vendors?.length || 0} Vendors Saved
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* 6. DEDICATED BOARDS VIEW */}
        {currentView === 'boards' && user && (
          <div className="dashboard-container animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 60px' }}>
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h2>📁 My Project Sourcing Boards</h2>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>Create and organize distinct vendor board directories for your builds.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="New Board Name..."
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  style={{ padding: '8px 14px', fontSize: '14px', height: 'auto', width: '200px' }}
                />
                <button className="btn btn-primary" onClick={() => createBoard(newBoardName)}>
                  + Create Board
                </button>
              </div>
            </div>

            {boards.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                <h3>No Project Boards Created Yet</h3>
                <p style={{ maxWidth: '400px', margin: '8px auto 20px', fontSize: '14px' }}>
                  Organize different sourcing jobs (e.g. "Tirupati Villa", "Chennai Office") and save verified vendor cards directly.
                </p>
              </div>
            ) : (
              <div className="grid-container grid-3">
                {boards.map(board => (
                  <div 
                    key={board._id} 
                    className="glass-card board-card-primary" 
                    onClick={() => {
                      setActiveBoardId(board._id);
                      setCurrentView('board-details');
                    }}
                    style={{ cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '180px', transition: 'transform 0.2s' }}
                  >
                    <button
                      className="board-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBoard(board._id);
                      }}
                      style={{ position: 'absolute', top: '16px', right: '16px' }}
                    >
                      ✕
                    </button>
                    
                    <div style={{ fontSize: '36px' }}>📁</div>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>{board.name}</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {board.vendors?.length || 0} Sourced Vendors
                      </p>
                    </div>
                    
                    <button 
                      className="btn btn-outline" 
                      style={{ marginTop: 'auto', padding: '6px 12px', fontSize: '12px', justifyContent: 'center' }}
                    >
                      Open Sourcing Pipeline →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. DEDICATED BOARD DETAILS & CURATION VIEW */}
        {currentView === 'board-details' && user && (() => {
          const board = boards.find(b => b._id === activeBoardId);
          if (!board) return <div style={{ color: 'red', textAlign: 'center', marginTop: '40px' }}>Board not found.</div>;

          return (
            <div className="dashboard-container animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 60px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => {
                      setCurrentView('boards');
                      setActiveBoardId(null);
                    }}
                    style={{ padding: '6px 12px', fontSize: '12px', marginBottom: '8px' }}
                  >
                    ← Back to Project Boards
                  </button>
                  <h2>📁 {board.name}</h2>
                  <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Manage and curate verified artisan listings saved to this sourcing folder.
                  </p>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ color: 'var(--color-danger)', borderColor: 'rgba(255,75,75,0.2)' }}
                  onClick={() => {
                    deleteBoard(board._id);
                    setCurrentView('boards');
                  }}
                >
                  Delete Board
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px' }} className="board-details-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  <div className="glass-card">
                    <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
                      Saved Vendors ({board.vendors?.length || 0})
                    </h3>
                    
                    {(!board.vendors || board.vendors.length === 0) ? (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                        No vendors saved yet. Use the sourcing search console on the right to find and save verified partners!
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {board.vendors.map(vendor => (
                          <div 
                            key={vendor._id} 
                            style={{ 
                              padding: '16px', 
                              borderRadius: '12px', 
                              border: '1px solid rgba(255,255,255,0.04)', 
                              background: 'rgba(255,255,255,0.01)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>{vendor.companyName}</h4>
                              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                📍 {vendor.city} | Specialties: {vendor.specialization?.slice(0,2).join(', ')}
                              </div>
                              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                                {vendor.phoneNumber && (
                                  <a
                                    href={`https://wa.me/91${vendor.phoneNumber.split('/')[0].replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(vendor.personOfContact || vendor.companyName)},%20we%20saved%20your%20profile%20on%20Scoutify%20and%20would%20like%20to%20discuss%20our%20project%20board%20"${encodeURIComponent(board.name)}".`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '11px', color: '#25D366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                                  >
                                    💬 WhatsApp
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            <button
                              className="btn btn-outline"
                              style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)', borderColor: 'rgba(255,75,75,0.2)' }}
                              onClick={() => removeVendorFromBoard(board._id, vendor._id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="glass-card" style={{ border: '1px solid rgba(153, 69, 255, 0.25)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ animation: 'pulse 2s infinite' }}>🪄</span> Recommended For You
                      </h3>
                      <span className="badge badge-purple" style={{ fontSize: '10px' }}>GEMINI AI SOURCING</span>
                    </div>

                    {loadingRecommendations ? (
                      <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <div className="spinner" style={{ borderTopColor: 'var(--color-purple)', margin: '0 auto 12px' }}></div>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Gemini is scanning project board scope...</p>
                      </div>
                    ) : (
                      <div>
                        {boardRationale && (
                          <div style={{ background: 'rgba(153, 69, 255, 0.05)', border: '1px solid rgba(153, 69, 255, 0.15)', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.4', marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
                            <strong style={{ color: '#c084fc', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Sourcing Recommendation Rationale
                            </strong>
                            {boardRationale}
                          </div>
                        )}

                        {boardRecommendations.length === 0 ? (
                          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                            Add your first vendor to this board to trigger personalized project sourcing recommendations.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {boardRecommendations.map(rec => (
                              <div 
                                key={rec._id} 
                                style={{ 
                                  padding: '12px', 
                                  borderRadius: '8px', 
                                  border: '1px solid rgba(153, 69, 255, 0.15)', 
                                  background: 'rgba(153, 69, 255, 0.02)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>{rec.companyName}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                    📍 {rec.city} | {rec.specialization?.slice(0, 2).join(', ')}
                                  </div>
                                </div>
                                
                                <button
                                  className="btn btn-purple"
                                  style={{ padding: '6px 12px', fontSize: '11px' }}
                                  onClick={() => saveVendorToBoard(board._id, rec._id)}
                                >
                                  + Save to Board
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="glass-card" style={{ border: '1px solid rgba(20, 241, 149, 0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0 }}>Add Vendors to Sourcing Board</h3>
                      <div className="search-mode-tabs" style={{ background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '8px', display: 'flex' }}>
                        <button 
                          className={`btn ${boardSearchMode === 'standard' ? 'btn-primary' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                          onClick={() => setBoardSearchMode('standard')}
                        >
                          Standard
                        </button>
                        <button 
                          className={`btn ${boardSearchMode === 'ai' ? 'btn-purple' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                          onClick={() => setBoardSearchMode('ai')}
                        >
                          AI Sourcing
                        </button>
                      </div>
                    </div>

                    {boardSearchMode === 'standard' ? (
                      <form onSubmit={handleBoardSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Service Specialized</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="e.g. False Ceiling, Interior"
                              value={boardSearchService}
                              onChange={(e) => setBoardSearchService(e.target.value)}
                              style={{ padding: '8px 12px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>City / Location</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="e.g. Tirupati, Delhi"
                              value={boardSearchCity}
                              onChange={(e) => setBoardSearchCity(e.target.value)}
                              style={{ padding: '8px 12px', fontSize: '13px' }}
                            />
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', width: '100%', justifyContent: 'center' }}>
                          🔍 Search Directory
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleBoardAiSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Describe Sourcing Target</label>
                          <textarea 
                            className="form-control" 
                            rows="2"
                            placeholder="e.g. I need a modular false ceiling builder in Tirupati..."
                            value={boardSearchAiQuery}
                            onChange={(e) => setBoardSearchAiQuery(e.target.value)}
                            style={{ padding: '10px', fontSize: '13px', resize: 'vertical' }}
                          />
                        </div>
                        <button type="submit" className="btn btn-purple" style={{ padding: '8px 14px', width: '100%', justifyContent: 'center' }}>
                          ✨ Scan Project Brief
                        </button>
                      </form>
                    )}

                    <div>
                      {boardSearching ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                          <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                          <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Querying verified data...</p>
                        </div>
                      ) : (
                        <div>
                          {boardSearchResults.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                {boardSearchTotalResults} matches found
                              </span>
                              {(!user || user.subscriptionPlan === 'basic') && boardSearchTotalResults > 10 && (
                                <span style={{ fontSize: '10px', color: 'var(--color-warning)' }}>
                                  Capped at 10 (Basic Plan)
                                </span>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                            {boardSearchResults.map(artisan => {
                              const isSaved = board.vendors?.some(v => (v._id || v).toString() === artisan._id.toString());
                              return (
                                <div 
                                  key={artisan._id} 
                                  style={{ 
                                    padding: '12px', 
                                    borderRadius: '8px', 
                                    border: '1px solid rgba(255,255,255,0.04)', 
                                    background: 'rgba(255,255,255,0.01)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <div style={{ fontWeight: '500', fontSize: '13px', color: '#fff' }}>
                                      {artisan.companyName}
                                      {artisan.matchPercentage && (
                                        <span className="badge badge-purple" style={{ fontSize: '8px', padding: '2px 4px', marginLeft: '6px' }}>
                                          {artisan.matchPercentage}% AI MATCH
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                      📍 {artisan.city} | {artisan.specialization?.slice(0,2).join(', ')}
                                    </div>
                                  </div>
                                  
                                  {isSaved ? (
                                    <button
                                      className="btn"
                                      disabled
                                      style={{ padding: '6px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: 'none' }}
                                    >
                                      ✓ Added
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '6px 10px', fontSize: '11px' }}
                                      onClick={() => saveVendorToBoard(board._id, artisan._id)}
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {boardSearchResults.length === 0 && !boardSearching && (
                              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>
                                Enter filters above to discover verified candidates.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* 3. AUTHORIZATION MODAL (OTP & GOOGLE & 2FA) */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>
                {verifyingOtp ? 'Account Verification' : verifying2Fa ? 'Two-Factor Login' : authTab === 'login' ? 'Welcome Back' : 'Get Started'}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {verifyingOtp ? 'Enter verification code' : verifying2Fa ? 'Check OTP to sign in' : 'Unlock direct connections with verified artisans.'}
              </p>
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
                  <label className="form-label">2FA Security Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter 2FA login OTP"
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

            {!verifyingOtp && !verifying2Fa && (
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
                        <input
                          type="password"
                          className="form-control"
                          value={loginPassword}
                          onChange={e => setLoginPassword(e.target.value)}
                          required
                        />
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
                        <input
                          type="password"
                          className="form-control"
                          value={clientPassword}
                          onChange={e => setClientPassword(e.target.value)}
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
                        <input
                          type="password"
                          className="form-control"
                          value={artisanPassword}
                          onChange={e => setArtisanPassword(e.target.value)}
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
      )}

      {/* 4. SIMULATED RAZORPAY MODAL */}
      {showPaymentModal && activePaymentOrder && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', background: '#0b1623', border: '1px solid #1480f1', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '20px' }}>
              <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>
                Razorpay Checkout
              </div>
              <span className="badge" style={{ background: '#1480f1', color: '#fff' }}>TEST MODE</span>
            </div>

            <div style={{ marginBottom: '20px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              <p style={{ color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                Scoutify Sourcing Hub
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Order Ref:</span>
                <span style={{ color: '#fff', fontFamily: 'monospace' }}>{activePaymentOrder.orderId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Plan Upgrade:</span>
                <span style={{ color: '#fff', textTransform: 'capitalize' }}>{activePaymentOrder.plan}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '10px' }}>
                <strong>Amount Due:</strong>
                <strong style={{ color: '#14f195', fontSize: '18px' }}>
                  ₹{activePaymentOrder.amount / 100}.00
                </strong>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px', textAlign: 'center' }}>
              Select payment status to simulate the gateway response.
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, background: '#1480f1', color: '#fff' }}
                onClick={() => completeSimulatedPayment(true)}
              >
                Simulate Success
              </button>
              <button
                className="btn btn-outline"
                style={{ flex: 1, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                onClick={() => completeSimulatedPayment(false)}
              >
                Simulate Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 5. FLOATING YC JUDGE DEMO HUD */}
      <div className={`yc-hud ${isHudCollapsed ? 'collapsed' : ''}`} onClick={isHudCollapsed ? () => setIsHudCollapsed(false) : undefined}>
        {isHudCollapsed ? (
          <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
        ) : (
          <>
            <div className="yc-hud-header">
              <h3><Sparkles size={16} /> YC Demo Console</h3>
              <button className="yc-hud-close-btn" onClick={(e) => { e.stopPropagation(); setIsHudCollapsed(true); }}>
                [Collapse]
              </button>
            </div>

            <div className="yc-hud-section">
              <div className="yc-hud-section-title">Instant Personas</div>
              <div className="yc-hud-grid">
                <button className="yc-hud-btn" onClick={() => handleHudDemoLogin('client_basic')}>
                  <UserIcon size={14} style={{ color: 'var(--color-primary)' }} />
                  Login as Client Basic
                </button>
                <button className="yc-hud-btn" onClick={() => handleHudDemoLogin('client_pro')}>
                  <UserIcon size={14} style={{ color: '#c084fc' }} />
                  Login as Client Pro
                </button>
                <button className="yc-hud-btn" onClick={() => handleHudDemoLogin('artisan')}>
                  <Briefcase size={14} style={{ color: '#14f195' }} />
                  Login as Artisan
                </button>


              </div>
            </div>

            <div className="yc-hud-section">
              <div className="yc-hud-section-title">Automated Workflows</div>
              <div className="yc-hud-grid">
                <button className="yc-hud-btn" onClick={handleHudPaywallDemo}>
                  <Lock size={14} style={{ color: 'var(--color-warning)' }} />
                  Trigger Sourcing Paywall
                </button>
                <button className="yc-hud-btn yc-hud-btn-purple" onClick={handleHudAiDemo}>
                  <Sparkles size={14} style={{ color: '#c084fc' }} />
                  Run AI Matchmaker
                </button>
              </div>
            </div>

            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
              One-click testing helper for YC reviewers
            </div>
          </>
        )}
      </div>
    </div>
  );
}


export default App;
