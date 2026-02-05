// Frontend/src/services/api.js
// UPDATED: Support for instruction-based audio chunk generation

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';

class ApiService {
  /**
   * Upload and analyze audio file
   * NEW: Returns instruction-based audio chunks (one per instruction)
   * @param {File} file - Audio file to process
   * @returns {Promise<Object>} - Analysis result with transcription and instruction-based chunks
   */
  async analyzeAudio(file) {
    console.log('[API] Uploading file:', file.name, 'to', API_BASE_URL);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-audio`, {
        method: 'POST',
        body: formData,
      });

      console.log('[API] Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to analyze audio';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[API] Success! Job ID:', data.job_id);
      console.log('[API] Instructions extracted:', data.instruction_count);
      console.log('[API] Data saved to database:', data.meta?.saved_to_db);
      return data;

    } catch (error) {
      console.error('[API] Request failed:', error);
      
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Make sure backend is running on ' + API_BASE_URL);
      }
      
      throw error;
    }
  }

  /**
   * Process live transcription text directly
   * NEW: Send transcription text to backend for instruction extraction and TTS generation
   * @param {string} text - The live transcription text
   * @returns {Promise<Object>} - Instructions with audio URLs
   */
  async processLiveText(text) {
    console.log('[API] Processing live transcription text...');
    console.log('[API] Text length:', text.length, 'characters');
    
    try {
      const response = await fetch(`${API_BASE_URL}/process-live-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to process transcription';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[API] Text processed. Job ID:', data.job_id);
      console.log('[API] Instructions extracted:', data.instruction_count);
      return data;

    } catch (error) {
      console.error('[API] Failed to process text:', error);
      throw error;
    }
  }

  /**
   * Get all jobs from database
   * @returns {Promise<Object>} - List of all jobs
   */
  async getAllJobs() {
    try {
      console.log('[API] Fetching all jobs from database');
      
      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.status}`);
      }

      const data = await response.json();
      console.log('[API] Fetched jobs:', data.jobs.length);
      return data;

    } catch (error) {
      console.error('[API] Failed to fetch jobs:', error);
      throw error;
    }
  }

  /**
   * Get specific job details with instructions and audio chunks
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Complete job details
   */
  async getJobDetails(jobId) {
    try {
      console.log('[API] Fetching job details for:', jobId);
      
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Job not found');
        }
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const data = await response.json();
      console.log('[API] Job details loaded:', data.job.job_id);
      console.log('[API] Instructions:', data.instructions.length);
      console.log('[API] Audio chunks:', data.audio_chunks.length);
      return data;

    } catch (error) {
      console.error('[API] Failed to fetch job details:', error);
      throw error;
    }
  }

  /**
   * Delete a job and all associated data
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} - Delete confirmation
   */
  async deleteJob(jobId) {
    try {
      console.log('[API] Deleting job:', jobId);
      
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Job not found');
        }
        throw new Error(`Failed to delete job: ${response.status}`);
      }

      const data = await response.json();
      console.log('[API] Job deleted:', data.job_id);
      return data;

    } catch (error) {
      console.error('[API] Failed to delete job:', error);
      throw error;
    }
  }

  /**
   * Record audio from microphone and analyze
   * @param {Blob} audioBlob - Recorded audio blob
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeRecording(audioBlob) {
    const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
    return this.analyzeAudio(file);
  }

  /**
   * Check backend health
   * @returns {Promise<Object>} - Health status
   */
  async checkHealth() {
    try {
      console.log('[API] Testing connection to:', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error(`Backend responded with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[API] Backend is healthy:', data);
      return data;
    } catch (error) {
      console.error('[API] Health check failed:', error);
      throw new Error('Cannot connect to backend. Make sure it is running on ' + API_BASE_URL);
    }
  }

  /**
   * Download audio file from S3 URL
   * @param {string} url - S3 URL
   * @param {string} filename - Desired filename
   */
  async downloadAudio(url, filename) {
    try {
      console.log('[API] Downloading audio from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      console.log('[API] Download complete:', filename);
    } catch (error) {
      console.error('[API] Download failed:', error);
      throw new Error('Failed to download audio file');
    }
  }

  /**
   * Download transcript as text file
   * @param {string} transcription - Transcription text
   * @param {string} jobId - Job ID for filename
   */
  downloadTranscript(transcription, jobId) {
    try {
      const blob = new Blob([transcription], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transcript_${jobId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('[API] Transcript downloaded:', jobId);
    } catch (error) {
      console.error('[API] Failed to download transcript:', error);
      throw new Error('Failed to download transcript');
    }
  }

  /**
   * Get API configuration
   * @returns {Object} - Current API configuration
   */
  getConfig() {
    return {
      baseUrl: API_BASE_URL,
      environment: process.env.NODE_ENV,
      hasCustomUrl: !!process.env.REACT_APP_API_URL
    };
  }
}

export default new ApiService();