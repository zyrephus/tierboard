import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What TierBoard collects, why, who processes it, and how long it is kept. No accounts, no email addresses, no advertising trackers.',
};

const ISSUES = 'https://github.com/zyrephus/tierboard/issues';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="17 August 2026">
      <section className="legal-section">
        <div className="legal-section-label">01</div>
        <h2 className="legal-section-title">What we collect</h2>
        <ul className="legal-list">
          <li>
            <strong>Your votes</strong> — which company you picked over which.
          </li>
          <li>
            <strong>A session ID</strong> — a random value your browser generates and
            stores locally, attached to votes so repeat votes from one browser can be
            weighed as one voice. It is not derived from anything about you.
          </li>
          <li>
            <strong>Your IP address</strong> — used to rate limit requests, and kept
            only in anonymized form on company suggestions.
          </li>
          <li>
            <strong>Aggregate page views</strong> — via Vercel Analytics, which sets
            no cookies and stores nothing on your device.
          </li>
        </ul>
        <p className="legal-body">
          There is no account. We never collect your name, email address, password,
          phone number, or employer.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">02</div>
        <h2 className="legal-section-title">Why, and on what basis</h2>
        <p className="legal-body">
          To produce the rankings, to stop automated vote manipulation, and to see
          how much traffic the site gets. The legal basis is legitimate interests:
          running the service and keeping it usable.
        </p>
        <p className="legal-body">
          We do not advertise, profile individuals, or sell data to anyone.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">03</div>
        <h2 className="legal-section-title">Who else handles it</h2>
        <ul className="legal-list">
          <li><strong>Vercel</strong> — hosting and analytics.</li>
          <li><strong>Supabase</strong> — the database holding votes and suggestions.</li>
          <li><strong>Upstash</strong> — the temporary store backing rate limiting.</li>
        </ul>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">04</div>
        <h2 className="legal-section-title">How long we keep it</h2>
        <p className="legal-body">
          Votes are kept indefinitely, because the rankings are computed from the
          full history. Rate limiting counters expire within minutes. Suggestions are
          kept until they are reviewed.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">05</div>
        <h2 className="legal-section-title">Your rights and contact</h2>
        <p className="legal-body">
          Because there is no account, we cannot connect stored rows to a person,
          which means we cannot look up your data on request and neither can anyone
          else. Clearing your browser storage for this site discards the session ID
          permanently.
        </p>
        <p className="legal-body">
          Where data protection law applies to you, you have rights of access,
          erasure, and objection, which we will honour to the extent we can identify
          the data. You also have the right to complain to your local data protection
          authority.
        </p>
        <p className="legal-body">
          Requests and questions go through{' '}
          <a className="legal-link" href={ISSUES} target="_blank" rel="noopener noreferrer">
            GitHub issues
          </a>
          . If this policy changes, the date at the top changes with it. TierBoard is
          not directed at children under 13.
        </p>
      </section>
    </LegalPage>
  );
}
