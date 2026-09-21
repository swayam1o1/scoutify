import { useMemo, useState } from 'react';
import { useCategories } from '../../hooks/useCategories';
import { DarkSelect } from '../ui/DarkSelect.jsx';

const TOTAL_STEPS = 6;

/** Steps where every field is optional — Skip is offered. */
const OPTIONAL_STEPS = new Set([1, 3, 4, 5]);

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'professional', label: 'Professional' },
  { value: 'architect', label: 'Architect' },
  { value: 'designer', label: 'Designer / Interior Designer' },
  { value: 'architectural_firm', label: 'Architectural Firm' },
  { value: 'design_firm', label: 'Design Firm' },
  { value: 'company', label: 'Company / Other firm' },
  { value: 'hobbyist', label: 'Hobbyist / Other' },
  { value: 'private_client', label: 'Private Client' }
];

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' }
];

const USAGE_OPTIONS = [
  { value: 'personal', label: 'Personal use' },
  { value: 'professional', label: 'Professional use' }
];

const REASON_OPTIONS = [
  { value: 'source_vendors', label: 'Source vendors for active projects' },
  { value: 'hiring', label: 'Direct hiring for short-term projects' },
  { value: 'collaboration', label: 'Collaborations and partnerships' },
  { value: 'research', label: 'Research and database compilation' }
];

const FIRM_TYPES = new Set(['architectural_firm', 'design_firm', 'company', 'firm', 'architect_firm']);

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function buildInitialForm(user) {
  const cp = user?.clientProfile || {};
  return {
    name: user?.name || '',
    dateOfBirth: toDateInput(user?.dateOfBirth),
    gender: user?.gender || '',
    profilePictureUrl: user?.profilePictureUrl || '',
    accountType: cp.type || 'designer',
    companyName: cp.companyName || '',
    plannedUse: cp.plannedUse || 'source_vendors',
    usageType: cp.usageType || 'professional',
    interests: Array.isArray(cp.interests) ? [...cp.interests] : [],
    preferredLocation: cp.preferredLocation || '',
    serviceArea: cp.serviceArea || '',
    geoLat: cp.geoLat ?? null,
    geoLng: cp.geoLng ?? null,
    geoAllowed: !!cp.geoAllowed
  };
}

export function OnboardingWizard({ user, token, onComplete, onDraftSaved, onCancel, authFetch, editMode = false }) {
  const categories = useCategories();
  const initialStep = Math.max(0, Math.min(TOTAL_STEPS - 1, Number(user?.onboardingStep || 0)));
  const [step, setStep] = useState(editMode ? 0 : initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [form, setForm] = useState(() => buildInitialForm(user));

  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const showCompany = FIRM_TYPES.has(form.accountType);
  const progress = useMemo(() => ((step + 1) / TOTAL_STEPS) * 100, [step]);
  const canSkip = OPTIONAL_STEPS.has(step);

  const toggleInterest = (category) => {
    setForm(prev => {
      const has = prev.interests.includes(category);
      if (has) return { ...prev, interests: prev.interests.filter(i => i !== category) };
      if (prev.interests.length >= 5) return prev;
      return { ...prev, interests: [...prev.interests, category] };
    });
  };

  const requestGeo = () => {
    setGeoStatus('');
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          geoAllowed: true,
          geoLat: pos.coords.latitude,
          geoLng: pos.coords.longitude
        }));
        setGeoStatus('Location permission granted.');
      },
      () => {
        setForm(prev => ({ ...prev, geoAllowed: false, geoLat: null, geoLng: null }));
        setGeoStatus('Location permission denied or unavailable. You can still continue.');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const payloadFromForm = (complete, nextStep) => ({
    name: form.name.trim(),
    dateOfBirth: form.dateOfBirth || '',
    gender: form.gender || '',
    profilePictureUrl: form.profilePictureUrl || '',
    accountType: form.accountType,
    companyName: showCompany ? form.companyName.trim() : '',
    plannedUse: form.plannedUse,
    usageType: form.usageType,
    interests: form.interests,
    preferredLocation: form.preferredLocation,
    serviceArea: form.serviceArea,
    geoLat: form.geoLat,
    geoLng: form.geoLng,
    geoAllowed: form.geoAllowed,
    onboardingStep: nextStep,
    complete
  });

  const save = async ({ complete, nextStep = step }) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await authFetch('/auth/onboarding', {
        token,
        method: 'POST',
        body: payloadFromForm(complete, nextStep)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not save onboarding.');
        return null;
      }
      if (complete) {
        onComplete?.(data.user);
      } else {
        onDraftSaved?.(data.user);
        setInfo('Progress saved. You can leave and finish later — restricted features stay locked until you complete onboarding.');
      }
      return data.user;
    } catch {
      setError('Connection error while saving onboarding.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const validateStep = ({ forFinish = false } = {}) => {
    if ((step === 0 || forFinish) && !form.name.trim()) return 'Full name is required.';
    if ((step === 2 || forFinish) && showCompany && !form.companyName.trim()) {
      return 'Company name is required for firm accounts.';
    }
    return '';
  };

  const goTo = async (target) => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const nextStep = Math.max(0, Math.min(TOTAL_STEPS - 1, target));
    const saved = await save({ complete: false, nextStep });
    if (saved) setStep(nextStep);
  };

  const next = () => goTo(step + 1);

  const back = async () => {
    setError('');
    const nextStep = Math.max(0, step - 1);
    const saved = await save({ complete: false, nextStep });
    if (saved) setStep(nextStep);
  };

  const skip = async () => {
    if (!canSkip) return;
    setError('');
    if (step >= TOTAL_STEPS - 1) {
      await finish();
      return;
    }
    const nextStep = step + 1;
    const saved = await save({ complete: false, nextStep });
    if (saved) setStep(nextStep);
  };

  const saveProgress = async () => {
    await save({ complete: false, nextStep: step });
  };

  const finish = async () => {
    const err = validateStep({ forFinish: true });
    if (err) {
      setError(err);
      return;
    }
    await save({ complete: true, nextStep: TOTAL_STEPS - 1 });
  };

  return (
    <div className="dashboard-container animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ marginBottom: '6px' }}>
            {editMode ? 'Edit onboarding preferences' : 'Welcome to Scoutify'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
            {editMode
              ? `Step ${step + 1} of ${TOTAL_STEPS} — changes save as you move between steps.`
              : `Step ${step + 1} of ${TOTAL_STEPS} — progress is saved automatically. Finish to unlock search, boards, and plans.`}
          </p>
          <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.25s ease' }} />
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid var(--color-danger)',
            color: '#fca5a5',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '14px'
          }}>
            {error}
          </div>
        )}

        {info && !error && (
          <div style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)',
            color: '#a7f3d0',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '14px'
          }}>
            {info}
          </div>
        )}

        {step === 0 && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>Your name</h3>
            <div className="form-group">
              <label className="form-label required">Full name</label>
              <input className="form-control" value={form.name} onChange={setField('name')} required />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>About you <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(optional)</span></h3>
            <div className="form-group">
              <label className="form-label">Date of birth</label>
              <input type="date" className="form-control" value={form.dateOfBirth} onChange={setField('dateOfBirth')} />
            </div>
            <DarkSelect
              label="Gender"
              value={form.gender}
              onChange={(v) => setForm(prev => ({ ...prev, gender: v }))}
              options={GENDER_OPTIONS}
            />
            <div className="form-group">
              <label className="form-label">Profile picture URL (optional)</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://..."
                value={form.profilePictureUrl}
                onChange={setField('profilePictureUrl')}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Image upload comes later — paste a public image link, or skip.
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>Account type</h3>
            <DarkSelect
              label="What best describes you?"
              value={form.accountType}
              onChange={(v) => setForm(prev => ({ ...prev, accountType: v }))}
              options={ACCOUNT_TYPE_OPTIONS}
              required
            />
            {showCompany && (
              <div className="form-group">
                <label className="form-label required">Company name</label>
                <input className="form-control" value={form.companyName} onChange={setField('companyName')} required />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>Why Scoutify? <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(optional)</span></h3>
            <DarkSelect
              label="Reason for using the platform"
              value={form.plannedUse}
              onChange={(v) => setForm(prev => ({ ...prev, plannedUse: v }))}
              options={REASON_OPTIONS}
            />
            <DarkSelect
              label="Personal or professional usage"
              value={form.usageType}
              onChange={(v) => setForm(prev => ({ ...prev, usageType: v }))}
              options={USAGE_OPTIONS}
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 style={{ marginBottom: '8px' }}>Areas of interest <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(optional)</span></h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
              Pick up to 5 preferred artisan / vendor categories ({form.interests.length}/5), or skip.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categories.filter(c => c !== 'Other').map(category => {
                const selected = form.interests.includes(category);
                return (
                  <button
                    type="button"
                    key={category}
                    className={`btn ${selected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '12px', color: selected ? '#000' : undefined }}
                    onClick={() => toggleInterest(category)}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>Preferred location <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>(optional)</span></h3>
            <div className="form-group">
              <label className="form-label">City / service area</label>
              <input
                className="form-control"
                placeholder="e.g. Bangalore, South Delhi..."
                value={form.preferredLocation}
                onChange={setField('preferredLocation')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Broader service area (optional)</label>
              <input
                className="form-control"
                placeholder="Karnataka, NCR..."
                value={form.serviceArea}
                onChange={setField('serviceArea')}
              />
            </div>
            <button type="button" className="btn btn-outline" onClick={requestGeo} style={{ marginBottom: '8px' }}>
              Allow geolocation (optional)
            </button>
            {geoStatus && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{geoStatus}</p>
            )}
            {form.geoAllowed && form.geoLat != null && (
              <p style={{ fontSize: '12px', color: '#a7f3d0' }}>
                Saved coordinates: {Number(form.geoLat).toFixed(4)}, {Number(form.geoLng).toFixed(4)}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '22px' }}>
          {step > 0 && (
            <button type="button" className="btn btn-outline" onClick={back} disabled={busy} style={{ flex: '1 1 120px' }}>
              Back
            </button>
          )}
          {canSkip && step < TOTAL_STEPS - 1 && (
            <button type="button" className="btn btn-secondary" onClick={skip} disabled={busy} style={{ flex: '1 1 120px' }}>
              Skip
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next} disabled={busy} style={{ flex: '1 1 140px', color: '#000' }}>
              {busy ? 'Saving...' : 'Continue'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish} disabled={busy} style={{ flex: '1 1 140px', color: '#000' }}>
              {busy ? 'Saving...' : (editMode ? 'Save changes' : 'Finish onboarding')}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
          <button type="button" className="btn btn-outline" onClick={saveProgress} disabled={busy} style={{ flex: '1 1 160px', fontSize: '13px' }}>
            {busy ? 'Saving...' : 'Save progress'}
          </button>
          {editMode && onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy} style={{ flex: '1 1 120px', fontSize: '13px' }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
