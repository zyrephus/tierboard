import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'TierBoard is a crowd-sourced opinion board, not a scorecard. Terms of use, limits of liability, and how to request a takedown.',
};

const ISSUES = 'https://github.com/zyrephus/tierboard/issues';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="17 August 2026"
    >
      <section className="legal-section">
        <div className="legal-section-label">01</div>
        <h2 className="legal-section-title">What this is</h2>
        <p className="legal-body">
          TierBoard aggregates anonymous head-to-head votes into a ranking of how
          prestigious a crowd believes tech companies to be. It measures opinion. It
          does not measure pay, culture, job security, management quality, or whether
          you would be happy there.
        </p>
        <p className="legal-body">
          Rankings are the aggregated views of anonymous voters. They are not
          statements of fact about any employer and carry no editorial endorsement.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">02</div>
        <h2 className="legal-section-title">No warranty, no advice</h2>
        <p className="legal-body">
          The site is provided as-is, without warranty of any kind. Data may be
          wrong, stale, incomplete, or unavailable. Companies may be missing,
          duplicated, or described inaccurately.
        </p>
        <p className="legal-body">
          <strong>Nothing here is career, financial, or legal advice.</strong> Do not
          accept or decline a job because of a number on this board.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">03</div>
        <h2 className="legal-section-title">Limitation of liability</h2>
        <p className="legal-body">
          To the fullest extent the law allows, TierBoard and its operator are not
          liable for any damages arising from your use of the site, including any
          decision made in reliance on it. The service is free, and total liability
          is limited to the amount you have paid to use it, which is nothing.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">04</div>
        <h2 className="legal-section-title">Acceptable use</h2>
        <p className="legal-body">Do not:</p>
        <ul className="legal-list">
          <li>Script, automate, or otherwise manipulate voting to move a company&apos;s rank.</li>
          <li>Circumvent rate limiting, or scrape the site in a way that degrades it for others.</li>
          <li>Submit content that is unlawful, defamatory, or infringing.</li>
        </ul>
        <p className="legal-body">
          Votes that appear manipulated may be discarded from the rankings without
          notice.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">05</div>
        <h2 className="legal-section-title">Submissions</h2>
        <p className="legal-body">
          Suggesting a company or a tag grants permission to use that submission on
          the site. Submissions are reviewed before anything is published, and there
          is no obligation to act on any of them. Do not submit anything confidential
          or anything you do not have the right to share.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">06</div>
        <h2 className="legal-section-title">Trademarks and takedown</h2>
        <p className="legal-body">
          TierBoard is not affiliated with, endorsed by, or sponsored by any company
          listed. Company names and logos are trademarks of their respective owners
          and appear here only to identify the companies being compared.
        </p>
        <p className="legal-body">
          If you represent a company and want its logo removed, its details
          corrected, or the listing taken down, open a{' '}
          <a className="legal-link" href={ISSUES} target="_blank" rel="noopener noreferrer">
            GitHub issue
          </a>{' '}
          and it will be handled.
        </p>
      </section>

      <section className="legal-section">
        <div className="legal-section-label">07</div>
        <h2 className="legal-section-title">Changes</h2>
        <p className="legal-body">
          These terms may change. The date at the top of the page changes with them,
          and continuing to use the site means accepting the current version.
        </p>
      </section>
    </LegalPage>
  );
}
