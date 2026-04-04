const STEPS = [
  {
    n: '1',
    title: 'Capture',
    text: 'Rehear listens to teacher or lecturer instructions during class.',
  },
  {
    n: '2',
    title: 'Decode',
    text: 'Advanced AI transcribes and highlights the crucial instructional chunks.',
  },
  {
    n: '3',
    title: 'Rehear',
    text: 'Revisit the parts that matter most, reducing confusion and stress.',
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works section-pad" id="how-it-works">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow subtle">How it works</p>
          <h2>From spoken lesson to usable next steps</h2>
          <p className="section-text narrow">
            Listen, decode, and rehear the instructions that matter in the classroom.
          </p>
        </div>
        <div className="steps">
          {STEPS.map(({ n, title, text }, i) => (
            <div key={n} className="step">
              <div className="step-top">
                <span className="step-num">{n}</span>
                {i < STEPS.length - 1 && (
                  <span className="step-connector" aria-hidden="true" />
                )}
              </div>
              <h4>{title}</h4>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
