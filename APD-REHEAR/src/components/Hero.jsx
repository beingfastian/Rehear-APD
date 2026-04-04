import HearingHeroVisual from './graphics/HearingHeroVisual.jsx';
import SoundJourneyGraphic from './graphics/SoundJourneyGraphic.jsx';

const STATS = [
  { value: 'Focus', label: 'On instructions' },
  { value: 'Chunk', label: 'Complex speech' },
  { value: 'Replay', label: 'Anytime' },
];

const SESSIONS = [
  'Extract key directions',
  'Clarify missed details',
  'Reduce cognitive load',
];

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-bg" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-content">
          <p className="eyebrow">AI support for auditory processing</p>
          <h1 id="hero-heading">
            Level up your hearing with <span className="gradient-text">Rehear</span>
          </h1>
          <p className="hero-text">
            Catch the instructions you missed. Rehear turns spoken teaching into clear, replayable guidance. Perfect for students who need to capture, clarify, and revisit spoken instructions with less stress and more clarity.
          </p>
          <div className="hero-actions">
            <a href="#auth" className="btn btn-primary">
              Request Early Access
            </a>
            <a href="#how-it-works" className="btn btn-secondary">
              See How It Works
            </a>
          </div>
          <p className="small-note" style={{ marginTop: '1rem', fontWeight: 500 }}>
            Built to support students with auditory processing challenges, including APD.
          </p>
          <div className="hero-stats" role="list">
            {STATS.map(({ value, label }) => (
              <div key={label} className="stat" role="listitem">
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-visual-column">
          <HearingHeroVisual />
          <aside
            className="hero-card hero-card--overlay"
            aria-label="Listening session"
          >
            <div className="hero-card-head">
              <h3>Extracted Instructions</h3>
              <span className="badge">Actionable</span>
            </div>
            <ul className="session-list">
              {SESSIONS.map((line) => (
                <li key={line}>
                  <span className="dot" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary full">
              Start listening
            </button>
          </aside>
        </div>
      </div>
      <div className="container hero-journey">
        <SoundJourneyGraphic />
      </div>
    </section>
  );
}
