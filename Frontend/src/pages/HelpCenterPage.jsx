import React from 'react';
import { FolderKanban, HelpCircle, LifeBuoy, Settings2, Waves } from 'lucide-react';

const HelpCenterPage = ({ setCurrentPage }) => {
  const cards = [
    {
      title: 'Record Live Audio',
      description: 'Use Dashboard → Start Recording to capture speech, extract instructions, and generate TTS audio chunks.',
      icon: Waves,
      action: 'Open Dashboard',
      target: 'dashboard',
    },
    {
      title: 'Review Saved Jobs',
      description: 'Open Media Center to inspect past recordings, transcripts, and generated audio for each instruction.',
      icon: FolderKanban,
      action: 'Open Media Center',
      target: 'media',
    },
    {
      title: 'Manage Billing',
      description: 'Open Settings to inspect credits, plan status, RevenueCat sync state, and subscription configuration.',
      icon: Settings2,
      action: 'Open Settings',
      target: 'settings',
    },
  ];

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs font-semibold uppercase tracking-wide mb-4">
          <HelpCircle className="w-3.5 h-3.5" />
          Help Center
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Quick paths through the app</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-2xl leading-relaxed">
          This workspace is organized around recording, inspecting generated instruction chunks, and now monitoring subscription-backed usage. Use the shortcuts below to jump straight into the part you need.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-5">
              <card.icon className="w-5 h-5 text-gray-600" />
            </div>

            <h2 className="text-lg font-bold text-gray-900">{card.title}</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{card.description}</p>

            <button
              onClick={() => setCurrentPage(card.target)}
              className="mt-6 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-200 hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              {card.action}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
          <LifeBuoy className="w-5 h-5 text-amber-700" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900">Operational note</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Billing enforcement currently applies only to authenticated requests. If you want production-grade subscription gates, finish the sign-in and RevenueCat checkout wiring, then switch the billable endpoints to required auth.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpCenterPage;