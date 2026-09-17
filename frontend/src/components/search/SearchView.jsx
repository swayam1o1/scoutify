import { CheckCircle, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { ArtisanCard } from './ArtisanCard';
import { PaywallSection } from './PaywallSection';

const AI_LOADER_STEPS = [
  'Analyzing project requirements...',
  'Scanning database categories...',
  'Computing compatibility matrix...',
  'Ranking matching profiles...'
];

function AiMatchmakerLoader({ aiLoaderStep }) {
  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '450px', margin: '40px auto', padding: '30px', textAlign: 'center' }}>
      <div className="spin" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: '#14f195', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
      <h3 style={{ marginBottom: '18px', fontSize: '18px' }}>Scoutify AI Matchmaker</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left', fontSize: '14px' }}>
        {AI_LOADER_STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: aiLoaderStep >= i ? '#14f195' : 'var(--color-text-secondary)' }}>
            {aiLoaderStep > i
              ? <CheckCircle size={16} style={{ color: '#14f195' }} />
              : <div style={{ width: 16, height: 16, border: '2px solid', borderRadius: '50%', flexShrink: 0 }} />}
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchView({ search, boards, user, onRequireAuth, onNavigate }) {
  const {
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
    handleSearch,
    handleAiSearch
  } = search;

  // Hard-cap: basic plan users never see more than 10 results regardless of state
  const isCapped = user?.subscriptionPlan === 'basic' || !user;
  const visibleResults = isCapped ? searchResults.slice(0, 10) : searchResults;
  const showPaywall = paywallActive || (isCapped && totalResults > 10);

  return (
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
            onClick={() => setSearchMode('standard')}
          >
            Standard Search
          </button>
          <button
            type="button"
            className={`btn ${searchMode === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '14px', gap: '6px' }}
            onClick={() => setSearchMode('ai')}
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
            <AiMatchmakerLoader aiLoaderStep={aiLoaderStep} />
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
                  {visibleResults.map((artisan, index) => (
                    <ArtisanCard
                      key={artisan._id || index}
                      artisan={artisan}
                      index={index}
                      user={user}
                      boards={boards.boards}
                      activeSaveDropdownId={boards.activeSaveDropdownId}
                      setActiveSaveDropdownId={boards.setActiveSaveDropdownId}
                      quickNewBoardName={boards.quickNewBoardName}
                      setQuickNewBoardName={boards.setQuickNewBoardName}
                      onSaveVendorToBoard={boards.saveVendorToBoard}
                      onCreateBoard={boards.createBoard}
                      onRequireAuth={onRequireAuth}
                    />
                  ))}
                </div>

                {/* Paywall Banner / Section (Rendered outside the grid container) */}
                {showPaywall && (
                  <PaywallSection
                    totalResults={totalResults}
                    user={user}
                    onRegister={() => onRequireAuth('register')}
                    onUpgrade={() => onNavigate('pricing')}
                  />
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
  );
}

export default SearchView;
