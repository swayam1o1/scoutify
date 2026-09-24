import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../api/client';
import { createSearchModeState } from '../utils/searchState';

export function useSearch({ token, user, onRequireAuth, demoLogin }) {
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');

  // Results are kept per mode so switching tabs keeps each mode's API output
  const [searchByMode, setSearchByMode] = useState({
    standard: createSearchModeState(),
    ai: createSearchModeState()
  });
  // Latest request per mode wins, so a slow response can't overwrite a newer one
  const searchRequestId = useRef({ standard: 0, ai: 0 });

  // AI Sourcing state
  const [searchMode, setSearchMode] = useState('standard'); // 'standard' | 'ai'
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoaderStep, setAiLoaderStep] = useState(0);

  const {
    results: searchResults,
    totalResults,
    paywallActive,
    hasSearched,
    searching,
    extracted: aiExtracted,
    summary: aiSummary
  } = searchByMode[searchMode];
  const isAiSearching = searchByMode.ai.searching;

  const updateSearchMode = (mode, patch) => {
    setSearchByMode(prev => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  };

  const startSearchRequest = (mode) => {
    searchRequestId.current[mode] += 1;
    updateSearchMode(mode, { searching: true, hasSearched: true });
    return searchRequestId.current[mode];
  };

  const isLatestSearchRequest = (mode, requestId) => searchRequestId.current[mode] === requestId;

  const resetSearch = () => {
    searchRequestId.current.standard += 1;
    searchRequestId.current.ai += 1;
    setSearchByMode({ standard: createSearchModeState(), ai: createSearchModeState() });
  };

  // Perform search
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const requestId = startSearchRequest('standard');
    try {
      const queryParams = new URLSearchParams({
        service: service,
        location: location
      });

      const res = await authFetch(`/search?${queryParams.toString()}`, { token });
      const data = await res.json();
      if (!isLatestSearchRequest('standard', requestId)) return;

      updateSearchMode('standard', {
        results: data.results || [],
        totalResults: data.totalResults || 0,
        paywallActive: data.paywallActive || false
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (isLatestSearchRequest('standard', requestId)) {
        updateSearchMode('standard', { searching: false });
      }
    }
  };

  const handleAiSearch = async (e) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim()) return;

    if (!user) {
      onRequireAuth?.('login');
      return;
    }

    const requestId = startSearchRequest('ai');
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
      const res = await authFetch('/search/ai', {
        token,
        method: 'POST',
        body: { query: aiQuery }
      });

      const data = await res.json();
      clearInterval(interval);
      if (!isLatestSearchRequest('ai', requestId)) return;

      if (!res.ok) {
        alert(data.message || 'AI Matching failed.');
        return;
      }

      updateSearchMode('ai', {
        results: data.results || [],
        totalResults: data.results?.length || 0,
        paywallActive: false,
        extracted: data.extracted || null,
        summary: data.summary || null
      });
    } catch (err) {
      clearInterval(interval);
      console.error(err);
    } finally {
      if (isLatestSearchRequest('ai', requestId)) {
        updateSearchMode('ai', { searching: false });
      }
    }
  };

  // YC HUD Helpers
  const handleHudPaywallDemo = async () => {
    setSearchMode('standard');
    setService('Architectural');
    setLocation('Delhi');
    const requestId = startSearchRequest('standard');
    try {
      const queryParams = new URLSearchParams({ service: 'Architectural', location: 'Delhi' });
      const res = await authFetch(`/search?${queryParams.toString()}`, { token });
      const data = await res.json();
      if (!isLatestSearchRequest('standard', requestId)) return;
      updateSearchMode('standard', {
        results: data.results || [],
        totalResults: data.totalResults || 0,
        paywallActive: data.paywallActive || false
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (isLatestSearchRequest('standard', requestId)) {
        updateSearchMode('standard', { searching: false });
      }
    }
  };

  const handleHudAiDemo = async () => {
    let currentToken = token;
    if (!user) {
      // Auto login client first
      const result = await demoLogin('client_pro');
      if (result.ok) {
        currentToken = result.data.token;
      } else {
        alert('Demo login failed.');
        return;
      }
    }

    setSearchMode('ai');
    setAiQuery('I need a false ceiling specialist in Tirupati');
    const requestId = startSearchRequest('ai');
    setAiLoaderStep(0);

    const steps = ["Analyzing requirements...", "Scanning database...", "Computing alignment...", "Ranking profiles..."];
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) setAiLoaderStep(step);
    }, 450);

    try {
      const res = await authFetch('/search/ai', {
        token: currentToken,
        method: 'POST',
        body: { query: 'I need a false ceiling specialist in Tirupati' }
      });
      const data = await res.json();
      clearInterval(interval);
      if (!isLatestSearchRequest('ai', requestId)) return;
      updateSearchMode('ai', {
        results: data.results || [],
        totalResults: data.results?.length || 0,
        paywallActive: false,
        extracted: data.extracted || null,
        summary: data.summary || null
      });
    } catch (err) {
      clearInterval(interval);
      console.error(err);
    } finally {
      if (isLatestSearchRequest('ai', requestId)) {
        updateSearchMode('ai', { searching: false });
      }
    }
  };

  // Trigger search on component load or on plan changes
  useEffect(() => {
    if (searchByMode.standard.hasSearched) {
      handleSearch();
    }
  }, [user?.subscriptionPlan]);

  return {
    service,
    setService,
    location,
    setLocation,
    searchMode,
    setSearchMode,
    aiQuery,
    setAiQuery,
    aiLoaderStep,
    searchResults,
    totalResults,
    paywallActive,
    hasSearched,
    searching,
    isAiSearching,
    aiExtracted,
    aiSummary,
    handleSearch,
    handleAiSearch,
    handleHudPaywallDemo,
    handleHudAiDemo,
    resetSearch
  };
}

export default useSearch;
