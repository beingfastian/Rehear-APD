import React from 'react';
import { Mic, Search, Play, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { transcriptSegments, learningModules } from '../data/sampleData';

const SegmentWorkspace = ({ selectedFile }) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {selectedFile?.name || 'Chemistry_Lecture_01.mp3'}
      </h1>

      <div className="flex gap-2 mb-6">
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
          <Mic className="w-4 h-4" /> Audio Ingestion
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
          Whisper Transcription
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
          Logical Segmenting
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
          Final Synth Chunks
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        
        {/* Left column */}
        <div className="col-span-2 space-y-6">

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <button className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 mb-4">
              Download Full Transcript
            </button>
            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
              Export All Chunks
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="relative mb-4">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search recordings or jobs..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-4">
              {transcriptSegments.map((segment) => (
                <div
                  key={segment.id}
                  className={`p-4 rounded-lg ${
                    segment.isInstruction
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {segment.isInstruction && (
                      <Play className="w-4 h-4 text-blue-600 mt-1" />
                    )}
                    <div>
                      <span className="text-sm font-mono text-gray-600">
                        {segment.timestamp}:
                      </span>
                      <p className="text-sm text-gray-700 mt-1">
                        {segment.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '30%' }} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <ChevronLeft className="w-5 h-5 cursor-pointer" />
              <Play className="w-6 h-6 cursor-pointer" />
              <ChevronRight className="w-5 h-5 cursor-pointer" />
            </div>

            <div className="flex justify-between mt-4 text-sm text-gray-600">
              <span>00:00</span>
              <span>12:45</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              AI-Generated Learning Modules
            </h3>

            {learningModules.map((module, index) => (
              <div
                key={module.id}
                className={`p-3 rounded-lg border mb-4 ${
                  index === 0
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <h4 className="font-medium text-gray-900 mb-2">
                  {module.title}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {module.step}
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center justify-center gap-1">
                    <Play className="w-4 h-4" /> Play Segment
                  </button>
                  <button className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SegmentWorkspace;
