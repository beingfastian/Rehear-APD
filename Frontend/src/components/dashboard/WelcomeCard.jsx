import React from 'react';
import { Mic, FileText } from 'lucide-react';

const WelcomeCard = () => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Welcome back, Shaun! Ready to transform your audio?
      </h2>
      <p className="text-gray-600 text-sm mb-6">
        Upload your recordings to generate instant transcripts, AI-powered summaries, and instructional chunks. Your API is currently active and ready for processing.
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Mic className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">9</div>
            <div className="text-sm text-gray-600">Audio Held</div>
          </div>
          <div className="ml-auto text-sm font-medium text-gray-500">1%</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">148</div>
            <div className="text-sm text-gray-600">Chunks Ready</div>
          </div>
          <div className="ml-auto text-sm font-medium text-gray-500">+12%</div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;