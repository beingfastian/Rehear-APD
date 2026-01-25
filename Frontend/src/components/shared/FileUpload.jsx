// Frontend/src/components/shared/FileUpload.jsx

import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const FileUpload = ({ onSuccess }) => {
  const fileInputRef = useRef(null);
  const { processAudioFile, isProcessing, processingProgress } = useApp();

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a)$/i)) {
      alert('Please upload a valid audio file (WAV, MP3, or M4A)');
      return;
    }

    // Validate file size (200MB max)
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 200MB');
      return;
    }

    try {
      const job = await processAudioFile(file);
      if (onSuccess) {
        onSuccess(job);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }

    // Reset input
    event.target.value = '';
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        onClick={handleClick}
        disabled={isProcessing}
        className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all ${
          isProcessing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            <span className="hidden sm:inline">Processing... {processingProgress}%</span>
            <span className="sm:hidden">{processingProgress}%</span>
          </>
        ) : (
          <>
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            Upload file
          </>
        )}
      </button>

      {isProcessing && (
        <div className="mt-3 sm:mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-600">Processing audio...</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{processingProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;