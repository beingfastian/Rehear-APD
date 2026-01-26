// Frontend/src/context/AppContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
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
  
  // Jobs loaded from database
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  
  // Current selected job
  const [currentJob, setCurrentJob] = useState(null);
  
  // Notifications
  const [notification, setNotification] = useState(null);

  /**
   * Load all jobs from database on mount
   */
  useEffect(() => {
    loadJobsFromDatabase();
  }, []);

  /**
   * Load jobs from PostgreSQL database via API
   */
  const loadJobsFromDatabase = async () => {
    try {
      setIsLoadingJobs(true);
      const data = await apiService.getAllJobs();
      
      // Transform database jobs to match frontend format
      const transformedJobs = data.jobs.map(job => ({
        id: job.job_id,
        name: `Recording_${job.job_id}`,
        type: 'Segmented Chunks',
        duration: '00:00',
        status: 'Completed',
        transcription: job.transcription,
        instruction_count: job.instruction_count,
        createdAt: job.created_at,
        // Instructions will be loaded separately when viewing job details
      }));
      
      setJobs(transformedJobs);
      console.log('[AppContext] Loaded jobs from database:', transformedJobs.length);
    } catch (error) {
      console.error('[AppContext] Failed to load jobs:', error);
      showNotification('Failed to load recordings from database', 'warning');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  /**
   * Load full job details including instructions and audio chunks
   */
  const loadJobDetails = async (jobId) => {
    try {
      const jobDetails = await apiService.getJobDetails(jobId);
      
      // Transform instructions to match frontend format
      const instructions = jobDetails.instructions.map(inst => {
        // Get audio chunks for this instruction
        const instructionChunks = jobDetails.audio_chunks.filter(
          chunk => chunk.instruction_index === inst.instruction_index
        );
        
        // Transform steps with audio URLs
        const steps = instructionChunks.map(chunk => ({
          text: chunk.step_text,
          audio: chunk.audio_url,
          download: chunk.audio_url,
          s3_key: chunk.s3_key
        }));
        
        return {
          instruction: inst.instruction_text,
          steps: steps
        };
      });
      
      // Create complete job object
      const completeJob = {
        id: jobDetails.job.job_id,
        name: `Recording_${jobDetails.job.job_id}`,
        type: 'Segmented Chunks',
        duration: '00:00',
        status: 'Completed',
        transcription: jobDetails.job.transcription,
        instructions: instructions,
        createdAt: jobDetails.job.created_at,
        meta: {
          instruction_count: jobDetails.job.instruction_count,
          timestamp: jobDetails.job.created_at
        }
      };
      
      return completeJob;
    } catch (error) {
      console.error('[AppContext] Failed to load job details:', error);
      throw error;
    }
  };

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
        duration: '00:00',
        status: 'Completed',
        transcription: result.transcription,
        instructions: result.instructions,
        meta: result.meta,
        createdAt: new Date().toISOString(),
      };

      // Reload jobs from database to get the newly saved job
      await loadJobsFromDatabase();
      
      setCurrentJob(job);

      showNotification('Audio processed and saved to database!', 'success');
      
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
   * Get job by ID with full details
   */
  const getJob = async (jobId) => {
    // First check if job is already in memory with full details
    const cachedJob = jobs.find(job => job.id === jobId);
    if (cachedJob && cachedJob.instructions) {
      return cachedJob;
    }
    
    // If not, load from database
    try {
      const jobDetails = await loadJobDetails(jobId);
      
      // Update jobs array with full details
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? jobDetails : job
        )
      );
      
      return jobDetails;
    } catch (error) {
      console.error('[AppContext] Failed to get job:', error);
      showNotification('Failed to load job details', 'error');
      return null;
    }
  };

  /**
   * Set current job and load details if needed
   */
  const selectJob = async (job) => {
    try {
      // If job doesn't have instructions, load them
      if (!job.instructions) {
        const fullJob = await getJob(job.id);
        setCurrentJob(fullJob);
      } else {
        setCurrentJob(job);
      }
    } catch (error) {
      console.error('[AppContext] Failed to select job:', error);
      showNotification('Failed to load job details', 'error');
    }
  };

  /**
   * Calculate statistics
   */
  const getStats = () => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'Completed').length;
    const totalChunks = jobs.reduce((acc, job) => {
      return acc + (job.instruction_count || 0);
    }, 0);

    return {
      totalJobs,
      completedJobs,
      processingJobs: totalJobs - completedJobs,
      totalChunks,
    };
  };

  /**
   * Refresh jobs from database
   */
  const refreshJobs = async () => {
    await loadJobsFromDatabase();
  };

  const value = {
    // State
    jobs,
    currentJob,
    isProcessing,
    processingProgress,
    notification,
    isLoadingJobs,
    
    // Actions
    processAudioFile,
    processRecording,
    setCurrentJob: selectJob,
    getJob,
    getStats,
    showNotification,
    refreshJobs,
    loadJobsFromDatabase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};