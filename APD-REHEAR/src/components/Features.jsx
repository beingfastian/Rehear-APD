const FEATURES = [
  {
    title: 'Instruction-first',
    description: 'Pulls out the critical teacher directions from the rest of the conversation so you know what to do.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4v16M8 8v8M16 8v8M4 12v4M20 12v4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M8.5 20c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'Replayable',
    description: 'Listen again to important parts at your own pace without searching through an entire transcript.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="3"
          y="14"
          width="4"
          height="6"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="10"
          y="10"
          width="4"
          height="10"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="17"
          y="6"
          width="4"
          height="14"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 8V5a2 2 0 012-2h10a2 2 0 012 2v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'Less Overload',
    description: 'Breaks lengthy spoken information into manageable pieces for easier recall and better understanding.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 19V5M4 19h16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M7 14l4-4 3 3 5-7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="6" r="2" fill="currentColor" opacity="0.35" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section className="features section-pad" id="features">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow subtle">More than transcription</p>
          <h2>More useful than a full transcript</h2>
          <p className="section-text">
            A full lesson transcript can still be overwhelming. Rehear is designed to identify the parts students need to act on, including what to do, in what order, and by when.
          </p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ title, description, icon }) => (
            <article key={title} className="feature-card">
              <div className="feature-icon">{icon}</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
