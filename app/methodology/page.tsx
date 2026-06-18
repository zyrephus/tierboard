import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Rankings Work",
  description:
    "TierBoard ranks companies with the Bradley-Terry model, distilling thousands of anonymous head-to-head votes into a single strength score. Learn how matchups become Points.",
};

export default function MethodologyPage() {
  return (
    <div className="methodology-page">
      <div className="methodology-content">
        <Link href="/" className="method-back">
          ← Board
        </Link>

        {/* Lead */}
        <section className="method-section method-lead">
          <h1 className="method-headline">How rankings work</h1>
          <p className="method-lede">
            Companies are ranked with the{" "}
            <a
              href="https://en.wikipedia.org/wiki/Bradley%E2%80%93Terry_model"
              target="_blank"
              rel="noopener noreferrer"
              className="method-link"
            >
              Bradley-Terry
            </a>{" "}
            model, a statistical method that distills thousands of anonymous
            head-to-head votes into a single strength score for every company.
          </p>
        </section>

        {/* Divider */}
        <div className="method-rule" />

        {/* Section 1: Voting */}
        <section className="method-section">
          <div className="method-section-label">01</div>
          <h2 className="method-section-title">How voting works</h2>
          <p className="method-body">
            Every matchup asks one question:{" "}
            <em>"Would you rather work at X or Y?" </em>You pick one. That's a
            vote. No accounts. No personal data. One anonymous preference at a
            time.
          </p>
          <p className="method-body">
            Voting runs in a{" "}
            <a
              href="https://en.wikipedia.org/wiki/Running_the_gauntlet"
              target="_blank"
              rel="noopener noreferrer"
              className="method-link"
            >
              gauntlet format
            </a>
            . The winning company stays on screen as the reigning champion and
            faces a fresh challenger. It keeps its streak until it loses. A
            champion that wins <span className="method-mono">6</span>{" "}
            consecutive matchups retires and preventing any single company from
            dominating the data.
          </p>
          <div className="method-callout">
            <span className="method-callout-label">GAUNTLET FORMAT</span>
            <span className="method-callout-body">
              Win → stay as champion → face next challenger. Retire after{" "}
              <span className="method-mono">6</span> wins.
            </span>
          </div>
        </section>

        {/* Section 2: Ranking model */}
        <section className="method-section">
          <div className="method-section-label">02</div>
          <h2 className="method-section-title">How votes become a ranking</h2>
          <p className="method-body">
            Every matchup is a pairwise result: company A beat company B. The
            model takes all of those results and fits one latent strength number{" "}
            <span className="method-mono">p</span> per company such that the
            predicted win probability matches the observed vote share across
            every pair. Higher strength = more likely to win any given matchup.
          </p>
          <p className="method-body">
            That strength maps to the displayed <strong>Points</strong>:
          </p>
          <div className="method-formula">
            <span className="method-mono method-formula-text">
              Points = 1500 + 120 × log₁₀(p)
            </span>
          </div>
          <p className="method-body">
            The field is anchored so the geometric mean sits at{" "}
            <span className="method-mono">1500</span>. In practice, companies
            span roughly <span className="method-mono">1230</span>–
            <span className="method-mono">1795</span> (unless you're Anthropic). The trend arrow tells you
            which direction the company moved in the last update.
          </p>
          <div className="method-ticker-examples">
            <div className="method-ticker method-ticker-up">
              <span className="method-ticker-value">1,847 ▲</span>
              <span className="method-ticker-label">rising</span>
            </div>
            <div className="method-ticker method-ticker-flat">
              <span className="method-ticker-value">1,512 —</span>
              <span className="method-ticker-label">stable</span>
            </div>
            <div className="method-ticker method-ticker-down">
              <span className="method-ticker-value">1,284 ▼</span>
              <span className="method-ticker-label">falling</span>
            </div>
          </div>
        </section>

        {/* Section 3: Order independence */}
        <section className="method-section">
          <div className="method-section-label">03</div>
          <h2 className="method-section-title">
            Why the order of votes doesn't matter
          </h2>
          <p className="method-body">
            A sequential system like ELO processes votes one at a time. The
            result depends on who played whom first. Shuffle the same votes and
            you get a different board. In testing, that churn reached ±6 ranks
            on average and up to 16 positions for individual companies on the
            same vote set.
          </p>
          <p className="method-body">
            Bradley-Terry is a <strong>global fit</strong>. It doesn't replay
            the log chronologically but rather solves for the single set of strength
            values that best explains all votes simultaneously. The same votes,
            in any order, always produce the same Points for every company.
          </p>
          <div className="method-callout method-callout-trust">
            <span className="method-callout-label">KEY PROPERTY</span>
            <span className="method-callout-body">
              Shuffle the vote log. Run it again. The board is identical.
            </span>
          </div>
        </section>

        {/* Section 4: Update cadence */}
        <section className="method-section">
          <div className="method-section-label">04</div>
          <h2 className="method-section-title">When rankings update</h2>
          <p className="method-body">
            Rankings update <strong>hourly</strong>. Every vote is logged
            immediately, but the solver runs as a single batch — one full
            recompute of the Points for all companies from all votes. The
            displayed index reflects the last completed recompute, not an
            instant per-vote tally.
          </p>
          <p className="method-body">
            This is intentional: batch recomputes are what give the board its
            order-independence guarantee. A live per-vote update would require
            sequential processing and reintroduce the ordering problem.
          </p>
        </section>
      </div>

      <style>{`
        .methodology-page {
          min-height: 100%;
          padding: 32px 24px;
        }

        .methodology-content {
          max-width: 680px;
          margin: 0 auto;
        }

        .method-back {
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

        .method-back:hover {
          color: var(--text, oklch(0.18 0.008 290));
        }

        .method-lead {
          padding-bottom: 0;
        }

        .method-headline {
          font-family: var(--font-geist-sans);
          font-size: 28px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: var(--text, oklch(0.18 0.008 290));
          margin: 0 0 12px 0;
          -webkit-font-smoothing: antialiased;
        }

        .method-lede {
          font-family: var(--font-geist-sans);
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-muted, oklch(0.45 0.008 290));
          margin: 0;
        }

        .method-link {
          color: var(--accent, oklch(0.5 0.18 290));
          text-decoration: none;
          border-bottom: 1px solid var(--accent-soft, oklch(0.85 0.07 290));
          transition: border-color 120ms;
        }

        .method-link:hover {
          border-bottom-color: var(--accent, oklch(0.5 0.18 290));
        }

        .method-rule {
          height: 1px;
          background: var(--border, oklch(0.92 0.005 290));
          margin: 6px 0 32px;
        }

        .method-section {
          padding: 0 0 36px 0;
          position: relative;
        }

        .method-section-label {
          font-family: var(--font-geist-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--text-dim, oklch(0.6 0.005 290));
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .method-section-title {
          font-family: var(--font-geist-sans);
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--text, oklch(0.18 0.008 290));
          margin: 0 0 14px 0;
          -webkit-font-smoothing: antialiased;
        }

        .method-body {
          font-family: var(--font-geist-sans);
          font-size: 14px;
          line-height: 1.65;
          color: var(--text-muted, oklch(0.45 0.008 290));
          margin: 0 0 12px 0;
        }

        .method-body:last-child {
          margin-bottom: 0;
        }

        .method-body strong {
          color: var(--text, oklch(0.18 0.008 290));
          font-weight: 500;
        }

        .method-body em {
          font-style: italic;
          color: var(--text, oklch(0.18 0.008 290));
        }

        .method-mono {
          font-family: var(--font-geist-mono);
          font-size: 13px;
          font-weight: 500;
          color: var(--text, oklch(0.18 0.008 290));
        }

        .method-callout {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 12px 14px;
          background: var(--bg-soft, oklch(0.975 0.003 290));
          border: 1px solid var(--border, oklch(0.92 0.005 290));
          border-radius: 7px;
          margin-top: 16px;
        }

        .method-callout-trust {
          background: var(--accent-bg, oklch(0.97 0.03 290));
          border-color: var(--accent-soft, oklch(0.85 0.07 290));
        }

        .method-callout-label {
          font-family: var(--font-geist-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--accent-text, oklch(0.4 0.15 290));
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .method-callout-body {
          font-family: var(--font-geist-sans);
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-muted, oklch(0.45 0.008 290));
        }

        .method-formula {
          padding: 14px 16px;
          background: var(--bg-soft, oklch(0.975 0.003 290));
          border: 1px solid var(--border, oklch(0.92 0.005 290));
          border-radius: 7px;
          margin: 14px 0;
          text-align: center;
        }

        .method-formula-text {
          font-size: 14px;
          letter-spacing: 0.01em;
          color: var(--text, oklch(0.18 0.008 290));
        }

        .method-ticker-examples {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .method-ticker {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 10px 14px;
          border: 1px solid var(--border, oklch(0.92 0.005 290));
          border-radius: 7px;
          background: var(--bg-elev, #ffffff);
          min-width: 100px;
        }

        .method-ticker-value {
          font-family: var(--font-geist-mono);
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
        }

        .method-ticker-label {
          font-family: var(--font-geist-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-dim, oklch(0.6 0.005 290));
        }

        .method-ticker-up .method-ticker-value {
          color: var(--green, oklch(0.55 0.16 145));
        }

        .method-ticker-flat .method-ticker-value {
          color: var(--text-muted, oklch(0.45 0.008 290));
        }

        .method-ticker-down .method-ticker-value {
          color: var(--red, oklch(0.55 0.18 25));
        }
      `}</style>
    </div>
  );
}
