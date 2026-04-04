/** Subtle auditory “signal” divider between sections. */
export default function SectionWaveDivider() {
  return (
    <div className="section-wave-wrap" aria-hidden="true">
      <svg
        className="section-wave-svg"
        viewBox="0 0 1200 48"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 24 Q150 8 300 24 T600 24 T900 24 T1200 24 L1200 48 L0 48 Z"
          fill="url(#wave-fill)"
          opacity="0.55"
        />
        <path
          d="M0 26 Q300 10 600 26 T1200 26"
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="1.15"
          opacity="0.28"
        />
        <defs>
          <linearGradient id="wave-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.45" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
