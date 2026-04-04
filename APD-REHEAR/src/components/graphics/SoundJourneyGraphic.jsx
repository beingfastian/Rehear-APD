/**
 * Infographic: sound in → ear → processing squiggle → out → understood.
 */
export default function SoundJourneyGraphic() {
  return (
    <div
      className="sound-journey"
      role="region"
      aria-label="Diagram: sound enters the ear, swirls in processing, travels outward, and is heard and understood."
    >
      <p className="sound-journey__title">
        Sound in → your ear → making sense → sound out → understood
      </p>
      <div className="sound-journey__frame">
        <svg
          className="sound-journey__svg"
          viewBox="0 0 920 156"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sj-flow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="45%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            <linearGradient id="sj-ear-mini" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* 1 — Sound in */}
          <g className="sound-journey__in" strokeLinecap="round">
            <path
              d="M 6 56 Q 48 36 88 50"
              stroke="#38bdf8"
              strokeWidth="2"
              opacity="0.55"
            />
            <path
              d="M 2 78 Q 52 58 108 74"
              stroke="#0ea5e9"
              strokeWidth="2.2"
              opacity="0.65"
            />
            <path
              d="M 8 100 Q 54 82 110 94"
              stroke="#7dd3fc"
              strokeWidth="1.85"
              opacity="0.52"
            />
          </g>

          {/* 2 — Ear */}
          <g transform="translate(118 28)">
            <path
              d="M 18 96
                 C 8 72 14 44 36 28
                 C 58 14 86 16 104 32
                 C 122 52 120 80 106 100
                 C 92 118 58 124 36 112
                 C 22 104 18 100 18 96 Z"
              fill="url(#sj-ear-mini)"
              fillOpacity="0.38"
              stroke="#0369a1"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M 44 48 C 56 58 62 76 58 92"
              stroke="#075985"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.5"
            />
            <ellipse
              cx="32"
              cy="76"
              rx="7"
              ry="9"
              fill="#0c4a6e"
              fillOpacity="0.11"
              stroke="#0369a1"
              strokeWidth="1"
              transform="rotate(-8 32 76)"
            />
          </g>

          {/* 3 — Processing squiggle */}
          <g transform="translate(242 8)">
            <rect
              x="0"
              y="12"
              width="248"
              height="120"
              rx="16"
              fill="#f0f9ff"
              stroke="#bae6fd"
              strokeWidth="1.2"
            />
            <path
              className="sound-journey__squiggle"
              d="M 32 78
                 C 56 38 116 34 144 62
                 C 172 90 166 128 128 136
                 C 90 144 48 118 62 84
                 C 76 50 138 44 182 60
                 C 226 76 236 108 210 124
                 C 184 140 138 138 112 108"
              stroke="url(#sj-flow)"
              strokeWidth="2.65"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M 118 102 L 134 94 L 128 112 Z"
              fill="#0369a1"
              fillOpacity="0.65"
            />
          </g>

          {/* 4 — Sound out */}
          <g className="sound-journey__out" transform="translate(508 0)" strokeLinecap="round">
            <path
              d="M 6 56 Q 54 38 104 48"
              stroke="#0ea5e9"
              strokeWidth="2"
              opacity="0.55"
            />
            <path
              d="M 2 78 Q 60 60 124 72"
              stroke="#0284c7"
              strokeWidth="2.15"
              opacity="0.62"
            />
            <path
              d="M 8 100 Q 64 86 118 94"
              stroke="#38bdf8"
              strokeWidth="1.85"
              opacity="0.52"
            />
          </g>

          {/* 5 — Understood */}
          <g transform="translate(668 22)">
            <circle cx="96" cy="56" r="50" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.5" />
            <path
              d="M 124 38
                 C 108 24 82 28 68 44
                 C 54 60 52 86 66 102
                 C 80 118 104 122 124 108"
              fill="#ffffff"
              fillOpacity="0.95"
              stroke="#0369a1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 88 54 C 80 64 80 80 88 90"
              stroke="#0284c7"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.6"
            />
            <g stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" opacity="0.72">
              <path d="M 112 28 L 118 16" />
              <path d="M 124 24 L 132 12" />
              <path d="M 118 20 L 134 16" />
            </g>
            <path
              d="M 78 98 Q 92 90 106 98 T 132 96"
              stroke="#0369a1"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.5"
            />
            <circle cx="142" cy="48" r="12" fill="#0ea5e9" fillOpacity="0.12" stroke="#0ea5e9" strokeWidth="1.2" />
            <path
              d="M 136 48 L 141 54 L 150 42"
              stroke="#0284c7"
              strokeWidth="1.85"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <div className="sound-journey__labels" aria-hidden="true">
          <span>Sound in</span>
          <span>Into the ear</span>
          <span>Making sense</span>
          <span>Sound out</span>
          <span>Understood</span>
        </div>
      </div>
    </div>
  );
}
