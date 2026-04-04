import { useId, useState } from 'react';

const FAQS = [
  {
    q: 'What is Rehear?',
    a: 'Rehear helps you work with what you hear: instructions and chunks of information you can replay, clarify, and use again. It is built for anyone who benefits from rehearing content clearly including people with auditory processing or hearing challenges.',
  },
  {
    q: 'How is Rehear different from speech or presentation apps?',
    a: 'Those tools often optimize for performance on stage. Rehear optimizes for listening: chunking, replay, and making sense of what you heard so you can return to the parts you need without treating hearing as an afterthought.',
  },
  {
    q: 'Who is Rehear for?',
    a: 'Students, professionals, and anyone who wants spoken content available again in a structured way. It helps when you miss a detail the first time, need information in smaller pieces, or want a calmer path from sound to understanding.',
  },
  {
    q: 'Does Rehear replace medical care, audiologists, or hearing aids?',
    a: 'No. Rehear is a learning and rehearsal tool, not a medical device or treatment. For hearing loss, tinnitus, or auditory processing concerns, follow your audiologist or physician.',
  },
  {
    q: 'Is my account data secure?',
    a: 'Sign-in uses secure authentication. Choose a strong password and protect your device. In production, always use HTTPS and follow your host’s security guidance.',
  },
  {
    q: 'How do I get started?',
    a: 'Use Login / Signup below to create a free account. Then explore features, FAQs, and the “how sound moves” diagram at the top of the page—it mirrors the same in → process → out → understood story.',
  },
];

export default function FaqSection() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="faq-section section-pad" id="faqs" aria-labelledby="faqs-heading">
      <div className="container faq-inner">
        <div className="section-head faq-head">
          <p className="eyebrow subtle">FAQ</p>
          <h2 id="faqs-heading">Questions &amp; answers</h2>
          <p className="section-text faq-intro">
            Same themes as the rest of the page: replay, chunks, clarity, and
            understanding—plus practical notes on safety and privacy.
          </p>
        </div>
        <div className="faq-list" role="list">
          {FAQS.map((item, i) => {
            const panelId = `${baseId}-panel-${i}`;
            const triggerId = `${baseId}-trigger-${i}`;
            const expanded = openIndex === i;
            return (
              <div key={item.q} className="faq-item" role="listitem">
                <h3 className="faq-item-title">
                  <button
                    type="button"
                    id={triggerId}
                    className="faq-trigger"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(expanded ? -1 : i)}
                  >
                    <span className="faq-trigger-text">{item.q}</span>
                    <span className="faq-trigger-icon" aria-hidden="true">
                      {expanded ? '−' : '+'}
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className="faq-panel"
                  hidden={!expanded}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
