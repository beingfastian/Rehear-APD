// Frontend/src/context/AppContext.jsx

import React, { createContext, useState, useContext } from 'react';
import apiService from '../services/api';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Processed jobs (in-memory storage since no DB)
  const [jobs, setJobs] = useState([]);
  
  // Current selected job
  const [currentJob, setCurrentJob] = useState(null);
  
  // Notifications
  const [notification, setNotification] = useState(null);

  /**
   * Show notification toast
   */
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  /**
   * Process audio file
   */
  const processAudioFile = async (file) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await apiService.analyzeAudio(file);
      
      clearInterval(progressInterval);
      setProcessingProgress(100);

      // Create job object
      const job = {
        id: result.job_id,
        name: file.name,
        type: 'Segmented Chunks',
        duration: '00:00', // Will be updated if we add duration detection
        status: 'Completed',
        transcription: result.transcription,
        instructions: result.instructions,
        meta: result.meta,
        createdAt: new Date().toISOString(),
      };

      // Add to jobs list
      setJobs(prev => [job, ...prev]);
      setCurrentJob(job);

      showNotification('Audio processed successfully!', 'success');
      
      return job;
    } catch (error) {
      showNotification(error.message || 'Failed to process audio', 'error');
      throw error;
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  /**
   * Process microphone recording
   */
  const processRecording = async (audioBlob) => {
    const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
    return processAudioFile(file);
  };

  /**
   * Get job by ID
   */
  const getJob = (jobId) => {
    return jobs.find(job => job.id === jobId);
  };

  /**
   * Calculate statistics
   */
  const getStats = () => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'Completed').length;
    const totalChunks = jobs.reduce((acc, job) => {
      return acc + (job.instructions?.reduce((sum, inst) => sum + inst.steps.length, 0) || 0);
    }, 0);

    return {
      totalJobs,
      completedJobs,
      processingJobs: totalJobs - completedJobs,
      totalChunks,
    };
  };

  const value = {
    // State
    jobs,
    currentJob,
    isProcessing,
    processingProgress,
    notification,
    
    // Actions
    processAudioFile,
    processRecording,
    setCurrentJob,
    getJob,
    getStats,
    showNotification,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};