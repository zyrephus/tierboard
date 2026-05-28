'use client';

import { useState, useEffect, useRef } from 'react';
import { SECTORS } from '@/lib/data';

type ModalMode = 'missing_company' | 'tag_edit';
type Status = 'idle' | 'loading' | 'success' | 'error' | 'rate_limited';

interface Props {
  mode: ModalMode;
  onClose: () => void;
}

export function SuggestModal({ mode, onClose }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [tagAction, setTagAction] = useState<'add' | 'remove'>('add');
  const [status, setStatus] = useState<Status>('idle');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleSector(id: string) {
    setSectors(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || sectors.length === 0) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          companyName: companyName.trim(),
          tagline: tagline.trim() || undefined,
          sectors,
          tagAction: mode === 'tag_edit' ? tagAction : undefined,
        }),
      });
      if (res.status === 429) { setStatus('rate_limited'); return; }
      if (!res.ok) { setStatus('error'); return; }
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  const isNew = mode === 'missing_company';
  const title = isNew ? 'Suggest a company' : 'Fix sector tags';
  const canSubmit = companyName.trim().length > 0 && sectors.length > 0 && status === 'idle';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-eyebrow">{isNew ? 'MISSING COMPANY' : 'TAG CORRECTION'}</span>
            <h2 className="modal-title">{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {status === 'success' ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <p>Thanks — we'll review your suggestion.</p>
            <button className="modal-btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="modal-form">
            <div className="modal-field">
              <label className="modal-label">
                {isNew ? 'Company name' : 'Company name'}
              </label>
              <input
                ref={nameRef}
                className="modal-input"
                type="text"
                placeholder={isNew ? 'e.g. Palantir' : 'e.g. TierBoard'}
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            {isNew && (
              <div className="modal-field">
                <label className="modal-label">Tagline <span className="modal-optional">(optional)</span></label>
                <input
                  className="modal-input"
                  type="text"
                  placeholder="One-line description"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  maxLength={200}
                />
              </div>
            )}

            {!isNew && (
              <div className="modal-field">
                <label className="modal-label">Action</label>
                <div className="modal-radio-group">
                  <label className="modal-radio">
                    <input
                      type="radio"
                      name="tagAction"
                      value="add"
                      checked={tagAction === 'add'}
                      onChange={() => setTagAction('add')}
                    />
                    <span>Add tag</span>
                  </label>
                  <label className="modal-radio">
                    <input
                      type="radio"
                      name="tagAction"
                      value="remove"
                      checked={tagAction === 'remove'}
                      onChange={() => setTagAction('remove')}
                    />
                    <span>Remove tag</span>
                  </label>
                </div>
              </div>
            )}

            <div className="modal-field">
              <label className="modal-label">
                {isNew ? 'Sectors' : `Sectors to ${tagAction}`}
                <span className="modal-optional"> · up to 4</span>
              </label>
              <div className="modal-sector-grid">
                {SECTORS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`modal-sector-chip ${sectors.includes(s.id) ? 'selected' : ''}`}
                    style={sectors.includes(s.id) ? { background: s.tint, color: s.fg, borderColor: s.fg } : undefined}
                    onClick={() => toggleSector(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {status === 'error' && (
              <p className="modal-error">Something went wrong. Please try again.</p>
            )}
            {status === 'rate_limited' && (
              <p className="modal-error">Too many suggestions — try again in a few minutes.</p>
            )}

            <div className="modal-actions">
              <button type="button" className="modal-btn-ghost" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="modal-btn-primary"
                disabled={!canSubmit}
              >
                {status === 'loading' ? 'Submitting…' : 'Submit suggestion'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
