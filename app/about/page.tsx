import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'TierBoard aggregates anonymous head-to-head votes into a live ranking of tech company prestige. One question, asked thousands of times, turned into a number.',
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-content">

        <Link href="/board" className="about-back">← Board</Link>

        {/* Lead */}
        <section className="about-section about-lead">
          <h1 className="about-headline">About TierBoard</h1>
          <p className="about-lede">
            The ranking already existed. It just lived in group chats and offer comparison
            threads and the confident opinions of people you half-trust. We made it a number.
          </p>
        </section>

        {/* Divider */}
        <div className="about-rule" />

        {/* Section 1: The problem with the signal */}
        <section className="about-section">
          <div className="about-section-label">01</div>
          <h2 className="about-section-title">The problem with the signal</h2>
          <p className="about-body">
            Company prestige moves careers in ways people don't always say out loud. It shows
            up in which offers get accepted, which referrals get favors, which logos get
            mentioned first in conversation. But the signal itself is fragmented: recruiter
            opinions, subreddit threads, what your senior friend said once over lunch. All
            confident. All contradictory.
          </p>
          <p className="about-body">
            TierBoard aggregates it. One question, asked at scale, turned into a live board
            you can read off and argue with.
          </p>
        </section>

        {/* Section 2: The vote */}
        <section className="about-section">
          <div className="about-section-label">02</div>
          <h2 className="about-section-title">The vote</h2>
          <p className="about-body">
            Two companies. No context, no salary data, no Glassdoor scores. Just: which would
            you rather work at? Tap one and move on. No account required.
          </p>
          <p className="about-body">
            We don't filter by role, seniority, or any other qualifier. A new grad and a
            principal engineer each get one vote. The board is whatever that mix produces.
          </p>
          <div className="about-callout">
            <span className="about-callout-label">THE QUESTION</span>
            <span className="about-callout-body">
              "Would you rather work at <strong>X</strong> or <strong>Y</strong>?" — pick
              based on your own read. There's no correct answer.
            </span>
          </div>
        </section>

        {/* Section 3: The companies */}
        <section className="about-section">
          <div className="about-section-label">03</div>
          <h2 className="about-section-title">The companies</h2>
          <p className="about-body">
            We started with the names that come up in actual offer comparison conversations:
            FAANG, the quant shops, the AI labs, the unicorns people have opinions about.
            Anyone can nominate a company via the <strong>Missing a company?</strong> button
            on the board. We add active tech companies that clear a basic relevance bar, and
            remove a company only when it stops applying — acquired, wound down, or no longer
            in the conversation.
          </p>
          <p className="about-body">
            Newly added companies don't show on the board right away. They collect votes
            first, staying off the rankings until the score has enough data to be stable.
            Early scores swing too much to be useful.
          </p>
        </section>

        {/* Section 4: What the board is */}
        <section className="about-section">
          <div className="about-section-label">04</div>
          <h2 className="about-section-title">What the board is</h2>
          <p className="about-body">
            The rankings have no editorial input. We don't seed favorites, tune scores, or
            intervene when the board produces a result we didn't expect. What you see is a
            direct readout of aggregate vote data. Curious about the model?{' '}
            <Link href="/methodology" className="about-link">
              Methodology
            </Link>{' '}
            has the full breakdown.
          </p>
          <div className="about-callout about-callout-trust">
            <span className="about-callout-label">NOTE</span>
            <span className="about-callout-body">
              The board reflects who votes, not who's objectively correct. Both of those
              things are interesting.
            </span>
          </div>
        </section>

        {/* Section 5: Colophon */}
        <section className="about-section">
          <div className="about-section-label">05</div>
          <h2 className="about-section-title">Colophon</h2>
          <p className="about-body">
            Built on <span className="about-mono">Next.js</span> and{' '}
            <span className="about-mono">React</span>, with{' '}
            <span className="about-mono">Supabase</span> (Postgres) for votes and the
            Bradley-Terry solver, <span className="about-mono">Upstash</span> for rate
            limiting, and <span className="about-mono">Vercel</span> for hosting. Type is{' '}
            <span className="about-mono">Geist</span> and{' '}
            <span className="about-mono">Geist Mono</span>; every color is OKLCH. Designed to
            feel like a Bloomberg terminal that happens to be about your next job.
          </p>
        </section>

        {/* Section 6: Legal */}
        <section className="about-section">
          <div className="about-section-label">06</div>
          <h2 className="about-section-title">Legal</h2>
          <p className="about-body">
            TierBoard is not affiliated with, endorsed by, or sponsored by any company
            listed. Company names and logos are trademarks of their respective owners,
            shown here only to identify the companies being compared.
          </p>
          <p className="about-body">
            Rankings are the aggregated opinions of anonymous voters. They are not
            statements of fact about any employer, and nothing here should be relied on
            for an employment decision.
          </p>
          <p className="about-body">
            Full <Link href="/terms" className="about-link">Terms</Link> and{' '}
            <Link href="/privacy" className="about-link">Privacy</Link>. To request
            removal of a logo or a correction to a listing, open a{' '}
            <a
              className="about-link"
              href="https://github.com/zyrephus/tierboard/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub issue
            </a>.
          </p>
        </section>

        {/* Sign-off */}
        <div className="about-rule about-rule-signoff" />
        <p className="about-signoff">
          Prestige isn't everything. We built a whole board about it anyway. Read it for what
          it is: a snapshot of what a crowd believes this week, not a scorecard for your life.
        </p>

      </div>

      <style>{`
        .about-page {
          min-height: 100%;
          padding: 32px 24px;
        }

        .about-content {
          max-width: 680px;
          margin: 0 auto;
        }

        .about-back {
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

        .about-back:hover {
          color: var(--text, oklch(0.18 0.008 290));
        }

        .about-lead {
          padding-bottom: 0;
        }

        .about-headline {
          font-family: var(--font-geist-sans);
          font-size: 28px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--text, oklch(0.18 0.008 290));
          margin: 0 0 12px 0;
          -webkit-font-smoothing: antialiased;
        }

        .about-lede {
          font-family: var(--font-geist-sans);
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-muted, oklch(0.45 0.008 290));
          margin: 0;
        }

        .about-link {
          color: var(--accent, oklch(0.5 0.18 290));
          text-decoration: none;
          border-bottom: 1px solid var(--accent-soft, oklch(0.85 0.07 290));
          transition: border-color 120ms;
        }

        .about-link:hover {
          border-bottom-color: var(--accent, oklch(0.5 0.18 290));
        }

        .about-rule {
          height: 1px;
          background: var(--border, oklch(0.92 0.005 290));
          margin: 6px 0 32px;
        }

        .about-section {
          padding: 0 0 36px 0;
          position: relative;
        }

        .about-section:last-of-type {
          padding-bottom: 0;
        }

        .about-section-label {
          font-family: var(--font-geist-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--text-dim, oklch(0.6 0.005 290));
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .about-section-title {
          font-family: var(--font-geist-sans);
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--text, oklch(0.18 0.008 290));
          margin: 0 0 14px 0;
          -webkit-font-smoothing: antialiased;
        }

        .about-body {
          font-family: var(--font-geist-sans);
          font-size: 14px;
          line-height: 1.65;
          color: var(--text-muted, oklch(0.45 0.008 290));
          margin: 0 0 12px 0;
        }

        .about-body:last-child {
          margin-bottom: 0;
        }

        .about-body strong {
          color: var(--text, oklch(0.18 0.008 290));
          font-weight: 500;
        }

        .about-mono {
          font-family: var(--font-geist-mono);
          font-size: 13px;
          font-weight: 500;
          color: var(--text, oklch(0.18 0.008 290));
        }

        .about-define {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 8px;
          padding: 14px 16px;
          background: var(--bg-soft, oklch(0.975 0.003 290));
          border: 1px solid var(--border, oklch(0.92 0.005 290));
          border-radius: 7px;
          margin-bottom: 16px;
        }

        .about-define-word {
          font-family: var(--font-geist-sans);
          font-size: 15px;
          font-weight: 500;
          color: var(--text, oklch(0.18 0.008 290));
        }

        .about-define-pos {
          font-family: var(--font-geist-mono);
          font-size: 12px;
          font-style: italic;
          color: var(--text-dim, oklch(0.6 0.005 290));
        }

        .about-define-body {
          flex: 1 1 100%;
          font-family: var(--font-geist-sans);
          font-size: 13px;
          line-height: 1.55;
          color: var(--text-muted, oklch(0.45 0.008 290));
        }

        .about-callout {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 12px 14px;
          background: var(--bg-soft, oklch(0.975 0.003 290));
          border: 1px solid var(--border, oklch(0.92 0.005 290));
          border-radius: 7px;
          margin-top: 16px;
        }

        .about-callout-trust {
          background: var(--accent-bg, oklch(0.97 0.03 290));
          border-color: var(--accent-soft, oklch(0.85 0.07 290));
        }

        .about-callout-label {
          font-family: var(--font-geist-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--accent-text, oklch(0.4 0.15 290));
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .about-callout-body {
          font-family: var(--font-geist-sans);
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-muted, oklch(0.45 0.008 290));
        }

        .about-callout-body strong {
          color: var(--text, oklch(0.18 0.008 290));
          font-weight: 500;
        }

        .about-rule-signoff {
          margin: 4px 0 20px;
        }

        .about-signoff {
          font-family: var(--font-geist-sans);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-dim, oklch(0.6 0.005 290));
          margin: 0;
        }
      `}</style>
    </div>
  );
}
