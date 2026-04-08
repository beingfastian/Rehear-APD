// Frontend/src/components/shared/FileUpload.jsx

import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const FileUpload = ({ onSuccess, label }) => {
  const fileInputRef = useRef(null);
  const { processAudioFile, isProcessing, processingProgress } = useApp();

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a)$/i)) {
      alert('Please upload a valid audio file (WAV, MP3, or M4A)');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      alert('File size must be less than 200MB');
      return;
    }

    try {
      const job = await processAudioFile(file);
      if (onSuccess) onSuccess(job);
    } catch (error) {
      console.error('Upload failed:', error);
    }
    event.target.value = '';
  };

  return (
    <div className="flex flex-col items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className={`
          flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
          ${isProcessing
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : label
              ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-200'
              : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-200'
          }
        `}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{processingProgress}%</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {label || 'Upload Files +'}
          </>
        )}
      </button>

      {isProcessing && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Processing audio…</span>
            <span className="font-semibold">{processingProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;