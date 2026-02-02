// Frontend/src/services/api.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

class ApiService {
  /**
   * Upload and analyze audio file
   * @param {File} file - Audio file to process
   * @returns {Promise<Object>} - Analysis result with transcription and instructions
   */
  async analyzeAudio(file) {
    console.log('[API] Uploading file:', file.name, 'to', API_BASE_URL);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-audio`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for FormData
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
      console.log('[API] Data saved to database:', data.meta?.saved_to_db);
      return data;

    } catch (error) {
      console.error('[API] Request failed:', error);
      
      // Network error (CORS, connection refused, etc)
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Make sure backend is running on http://127.0.0.1:8000');
      }
      
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
      return data;

    } catch (error) {
      console.error('[API] Failed to fetch job details:', error);
      throw error;
    }
  }

  /**
   * Record audio from microphone and analyze
   * @param {Blob} audioBlob - Recorded audio blob
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeRecording(audioBlob) {
    const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
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
      throw new Error('Cannot connect to backend. Make sure it is running on http://127.0.0.1:8000');
    }
  }

  /**
   * Download audio file from S3 URL
   * @param {string} url - S3 URL
   * @param {string} filename - Desired filename
   */
  async downloadAudio(url, filename) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('[API] Download failed:', error);
      throw new Error('Failed to download audio file');
    }
  }

  /**
   * Download all audio chunks as a zip (future feature)
   * @param {string} jobId - Job ID
   */
  async downloadAllChunks(jobId) {
    // This would require backend implementation to create zip files
    console.log('[API] Batch download not yet implemented for job:', jobId);
    throw new Error('Batch download feature coming soon');
  }
}

export default new ApiService();