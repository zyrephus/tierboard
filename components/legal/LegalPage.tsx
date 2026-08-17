import Link from 'next/link';
import type { ReactNode } from 'react';

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Shared chrome for /privacy and /terms. Mirrors the type scale and rhythm of
 *  the about and methodology pages, which each carry their own prefixed styles. */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className="legal-page">
      <div className="legal-content">

        <Link href="/board" className="legal-back">← Board</Link>

        <section className="legal-section legal-lead">
          <h1 className="legal-headline">{title}</h1>
          <p className="legal-updated">Last updated {updated}</p>
        </section>

        <div className="legal-rule" />

        {children}

      </div>

      <style>{`
        .legal-page {
          min-height: 100%;
          padding: 32px 24px;
        }

        .legal-content {
          max-width: 680px;
          margin: 0 auto;
        }

        .legal-back {
          display: inline-block;
          font-family: var(--font-geist-mono);
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--text-dim, oklch(0.6 0.005 290));
          text-decoration: none;
          margin-bottom: 20px;
          transition: color 120ms;
        }

        .legal-back:hover {
          color: var(--text, oklch(0.18 0.008 290));
        }

        .legal-lead {
          padding-bottom: 0;
        }

        .legal-headline {
          font-family: var(--font-geist-sans);
          font-size: 28px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--text, oklch(0.18 0.008 290));
          margin: 0 0 12px 0;
          -webkit-font-smoothing: antialiased;
        }

        .legal-updated {
          font-family: var(--font-geist-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--text-dim, oklch(0.6 0.005 290));
          margin: 0;
        }

        .legal-rule {
          height: 1px;
          background: var(--border, oklch(0.92 0.005 290));
          margin: 6px 0 32px;
        }

        .legal-section {
          padding: 0 0 36px 0;
          position: relative;
        }

        .legal-section:last-of-type {
          padding-bottom: 0;
        }

        .legal-section-label {
          font-family: var(--font-geist-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--text-dim, oklch(0.6 0.005 290));
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .legal-section-title {
          font-family: var(--font-geist-sans);
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--text, oklch(0.18 0.008 290));
          margin: 0 0 14px 0;
          -webkit-font-smoothing: antialiased;
        }

        .legal-body {
          font-family: var(--font-geist-sans);
          font-size: 14px;
          line-height: 1.65;
          color: var(--text-muted, oklch(0.45 0.008 290));
          margin: 0 0 12px 0;
        }

        .legal-body:last-child {
          margin-bottom: 0;
        }

        .legal-body strong {
          color: var(--text, oklch(0.18 0.008 290));
          font-weight: 500;
        }

        .legal-list {
          list-style: disc;
          margin: 0 0 12px 0;
          padding-left: 18px;
        }

        .legal-list li::marker {
          color: var(--text-dim, oklch(0.6 0.005 290));
        }

        .legal-list li {
          font-family: var(--font-geist-sans);
          font-size: 14px;
          line-height: 1.65;
          color: var(--text-muted, oklch(0.45 0.008 290));
          margin-bottom: 6px;
        }

        .legal-mono {
          font-family: var(--font-geist-mono);
          font-size: 13px;
          color: var(--text, oklch(0.18 0.008 290));
        }

        .legal-link {
          color: var(--accent, oklch(0.5 0.18 290));
          text-decoration: none;
          border-bottom: 1px solid var(--accent-soft, oklch(0.85 0.07 290));
          transition: border-color 120ms;
        }

        .legal-link:hover {
          border-bottom-color: var(--accent, oklch(0.5 0.18 290));
        }
      `}</style>
    </div>
  );
}
