import { useRef } from 'react';
import { CheckCircle, ImagePlus, MapPin, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { ArtisanCard } from './ArtisanCard';
import { PaywallSection } from './PaywallSection';
import { fileToResizedDataUrl, IMAGE_ACCEPT } from '../../utils/image';

const AI_LOADER_STEPS = [
  'Analyzing project requirements...',
  'Scanning database categories...',
  'Computing compatibility matrix...',
  'Ranking matching profiles...'
];

function AiMatchmakerLoader({ aiLoaderStep }) {
  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '450px', margin: '40px auto', padding: '30px', textAlign: 'center' }}>
      <div className="spin" style={{ border: '4px solid var(--surface-3)', borderLeftColor: 'var(--color-primary)', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
      <h3 style={{ marginBottom: '18px', fontSize: '18px' }}>Scoutify AI Matchmaker</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left', fontSize: '14px' }}>
        {AI_LOADER_STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: aiLoaderStep >= i ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
            {aiLoaderStep > i
              ? <CheckCircle size={16} style={{ color: 'var(--color-primary)' }} />
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
    aiImage,
    setAiImage,
    aiSearchedImage,
    aiLoaderStep,
    searchResults,
    totalResults,
    paywallActive,
    hasSearched,
    searching,
    searchError,
    isAiSearching,
    aiExtracted,
    aiSummary,
    aiSuggestions,
    handleSearch,
    handleAiSearch,
    handleAiSuggestion
  } = search;

  const photoInput = useRef(null);

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!user) {
      onRequireAuth('login');
      return;
    }
    try {
      setAiImage(await fileToResizedDataUrl(file));
    } catch (err) {
      alert(err.message);
    }
  };

  // Hard-cap: basic plan users never see more than 10 results regardless of state
  const isCapped = user?.subscriptionPlan === 'basic' || !user;
  const visibleResults = isCapped ? searchResults.slice(0, 10) : searchResults;
  const showPaywall = paywallActive || (isCapped && totalResults > 10);

  const extractChips = [];
  if (searchMode === 'ai' && aiExtracted) {
    const pushChip = (label, value) => {
      if (value == null || value === '') return;
      extractChips.push({ label, value: String(value) });
    };
    pushChip('Use case', aiExtracted.useCase);
    pushChip('Product', aiExtracted.productType || aiExtracted.service);
    pushChip('Material', aiExtracted.material);
    pushChip('Design', aiExtracted.designPreference);
    if (Array.isArray(aiExtracted.colors) && aiExtracted.colors.length) {
      pushChip('Colours', aiExtracted.colors.join(', '));
    }
    pushChip('Location', aiExtracted.city || aiExtracted.location);
    if (aiExtracted.distanceKm) pushChip('Distance', `${aiExtracted.distanceKm} km`);
    pushChip('Quantity', aiExtracted.quantity);
    pushChip('Project size', aiExtracted.projectSize);
    if (aiExtracted.budgetMin != null || aiExtracted.budgetMax != null) {
      const min = aiExtracted.budgetMin != null ? `₹${Number(aiExtracted.budgetMin).toLocaleString('en-IN')}` : '';
      const max = aiExtracted.budgetMax != null ? `₹${Number(aiExtracted.budgetMax).toLocaleString('en-IN')}` : '';
      pushChip('Budget', [min, max].filter(Boolean).join(' – '));
    }
    if (Array.isArray(aiExtracted.synonyms) && aiExtracted.synonyms.length) {
      pushChip('Synonyms', aiExtracted.synonyms.slice(0, 4).join(', '));
    }
  }

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
              <button
                type="submit"
                className="btn btn-primary"
                style={{ borderRadius: '10px', opacity: searching ? 0.7 : 1, cursor: searching ? 'not-allowed' : 'pointer' }}
                disabled={searching}
              >
                {searching ? (
                  <>
                    <span className="spin" style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.25)', borderLeftColor: '#000', borderRadius: '50%', display: 'inline-block' }} />
                    Finding artisans…
                  </>
                ) : 'Find Artisans'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAiSearch} className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', textAlign: 'left' }}>
              <div>
                <label className="form-label">
                  {aiImage
                    ? 'Add a note about the item (optional): city, material, quantity...'
                    : 'Explain your project requirements in detail (use case, material, design, budget, city, distance)'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={aiImage
                    ? 'e.g. "Need 20 of these for a cafe in Pune, in teak."'
                    : 'e.g. "Find handcrafted wooden furniture manufacturers near Bangalore for a hospitality project under 5 lakhs."'}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  required={!aiImage}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {aiImage ? (
                  <div style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={aiImage} alt="Item to match" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ position: 'absolute', top: 4, right: 4, padding: '2px 5px' }}
                      onClick={() => setAiImage('')}
                      disabled={isAiSearching}
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '13px', gap: '6px' }}
                  onClick={() => (user ? photoInput.current?.click() : onRequireAuth('login'))}
                  disabled={isAiSearching}
                >
                  <ImagePlus size={16} /> {aiImage ? 'Change photo' : 'Search by photo'}
                </button>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', flex: 1, minWidth: '180px' }}>
                  {aiImage
                    ? "We'll match vendors who make or supply similar products."
                    : 'Have a picture of the item you want? Upload it to find vendors who make it.'}
                </span>
                <input ref={photoInput} type="file" accept={IMAGE_ACCEPT} onChange={pickPhoto} style={{ display: 'none' }} />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: isAiSearching ? 0.7 : 1, cursor: isAiSearching ? 'not-allowed' : 'pointer' }}
                disabled={isAiSearching}
              >
                {isAiSearching ? (
                  <>
                    <span className="spin" style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.25)', borderLeftColor: '#000', borderRadius: '50%', display: 'inline-block' }} />
                    Finding vendors…
                  </>
                ) : (
                  <><Sparkles size={18} /> {aiImage ? 'Find Vendors for This Item' : 'Match Me with Artisans'}</>
                )}
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
              <div className="spin" style={{ border: '4px solid var(--surface-3)', borderLeftColor: 'var(--color-primary)', borderRadius: '50%', width: '40px', height: '40px', margin: '0 auto 16px' }}></div>
              <p style={{ color: 'var(--color-text-secondary)' }}>Searching database...</p>
            </div>
          )
        ) : searchError ? (
          <div
            role="alert"
            className="glass-card"
            style={{ maxWidth: '560px', margin: '20px auto', textAlign: 'center', padding: '28px', background: 'var(--tone-danger-bg)', border: '1px solid var(--tone-danger-border)', color: 'var(--tone-danger-text)' }}
          >
            <strong style={{ display: 'block', marginBottom: '6px' }}>Search failed</strong>
            <span style={{ fontSize: '14px' }}>{searchError}</span>
          </div>
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

            {searchMode === 'ai' && (aiSummary || extractChips.length > 0) && (
              <div className="glass-card" style={{ marginBottom: '18px', padding: '16px 18px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {aiSearchedImage && (
                  <img
                    src={aiSearchedImage}
                    alt="Your uploaded item"
                    style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid var(--border-color)' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {aiExtracted?.visualDescription && (
                    <p style={{ fontSize: '13px', marginBottom: '8px' }}>
                      <strong>Detected item:</strong> {aiExtracted.visualDescription}
                    </p>
                  )}
                  {aiSummary && (
                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: extractChips.length ? '12px' : 0 }}>
                      {aiSummary}
                    </p>
                  )}
                  {extractChips.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {extractChips.map(chip => (
                        <span
                          key={`${chip.label}-${chip.value}`}
                          className="badge badge-purple"
                          style={{ fontSize: '11px', padding: '6px 10px', fontWeight: 500 }}
                        >
                          <strong style={{ opacity: 0.85 }}>{chip.label}:</strong> {chip.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {searchMode === 'ai' && Array.isArray(aiSuggestions) && aiSuggestions.length > 0 && (
              <div className="glass-card" style={{ marginTop: '18px', padding: '16px 18px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px' }}>Related searches</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {aiSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'left', maxWidth: '100%' }}
                      onClick={() => handleAiSuggestion(suggestion)}
                      disabled={searching}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
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
