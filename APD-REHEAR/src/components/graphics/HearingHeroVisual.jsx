/**
 * Decorative hearing & auditory-processing illustration (SVG).
 */
export default function HearingHeroVisual() {
  return (
    <div className="hearing-visual" aria-hidden="true">
      <svg
        className="hearing-visual__svg"
        viewBox="0 0 440 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hv-ear" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0369a1" />
            <stop offset="55%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="hv-neural" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        {/* Incoming sound — curved wavefronts */}
        <g className="hearing-visual__waves" strokeLinecap="round" fill="none">
          <path
            d="M 28 200 C 52 155 88 128 130 118"
            stroke="#0ea5e9"
            strokeWidth="2.2"
            opacity="0.45"
          />
          <path
            d="M 18 232 C 48 178 95 142 148 128"
            stroke="#38bdf8"
            strokeWidth="1.85"
            opacity="0.4"
          />
          <path
            d="M 8 264 C 44 198 102 156 168 138"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <path
            d="M 42 168 C 58 138 82 118 112 108"
            stroke="#bae6fd"
            strokeWidth="1.35"
            opacity="0.55"
          />
        </g>

        {/* Stylized ear — auditory focus */}
        <g className="hearing-visual__ear">
          <path
            d="M 158 72 
               C 198 68 238 92 252 128 
               C 268 170 258 218 232 248 
               C 210 272 178 282 148 276 
               C 132 272 122 260 118 244 
               C 114 228 120 210 132 198 
               C 156 176 168 152 162 124 
               C 158 104 148 88 132 82 
               C 124 78 132 70 148 72 Z"
            fill="url(#hv-ear)"
            fillOpacity="0.12"
            stroke="url(#hv-ear)"
            strokeWidth="2.25"
            strokeLinejoin="round"
          />
          <path
            d="M 188 118 C 212 124 228 148 224 176 C 220 202 198 222 172 224"
            stroke="#0369a1"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          <ellipse cx="198" cy="168" rx="22" ry="32" fill="#0ea5e9" fillOpacity="0.07" />
        </g>

        {/* Frequency bands — listening / processing cue */}
        <g
          className="hearing-visual__spectrum"
          transform="translate(268 218)"
          opacity="0.88"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
            const h = 14 + ((i * 5 + 7) % 8) * 4;
            return (
              <rect
                key={i}
                x={i * 14}
                y={50 - h}
                width="5"
                height={h}
                rx="2"
                fill="#0284c7"
                opacity={0.22 + (i % 4) * 0.1}
              />
            );
          })}
        </g>

        {/* Abstract neural pathway motif — sound → understanding */}
        <g className="hearing-visual__neural" stroke="url(#hv-neural)">
          <path
            d="M 302 96 L 338 118 L 372 98 L 398 128 L 384 168 L 350 188 L 312 176 Z"
            fill="none"
            strokeWidth="1.2"
            opacity="0.42"
          />
          <circle cx="338" cy="118" r="5" fill="#0369a1" fillOpacity="0.32" />
          <circle cx="372" cy="98" r="4" fill="#0ea5e9" fillOpacity="0.38" />
          <circle cx="398" cy="128" r="4.5" fill="#0284c7" fillOpacity="0.32" />
          <circle cx="384" cy="168" r="5" fill="#38bdf8" fillOpacity="0.36" />
          <circle cx="350" cy="188" r="4" fill="#0369a1" fillOpacity="0.28" />
          <circle cx="312" cy="176" r="4.5" fill="#0ea5e9" fillOpacity="0.34" />
          <path
            d="M 268 148 Q 302 132 338 118 M 252 200 Q 290 210 350 188"
            fill="none"
            strokeWidth="1"
            strokeDasharray="4 6"
            opacity="0.38"
          />
        </g>

        <path
          d="M 252 140 C 268 130 288 124 302 120"
          stroke="#7dd3fc"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.48"
          strokeDasharray="3 5"
        />
      </svg>
    </div>
  );
}
