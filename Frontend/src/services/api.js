// Frontend/src/services/api.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000';

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
      return data;

    } catch (error) {
      console.error('[API] Request failed:', error);
      
      // Network error (CORS, connection refused, etc)
      if (error.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server. Make sure backend is running on http://localhost:10000');
      }
      
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
      throw new Error('Cannot connect to backend. Make sure it is running on http://localhost:10000');
    }
  }

  /**
   * Download audio file from S3 URL
   * @param {string} url - S3 URL
   * @param {string} filename - Desired filename
   */
  async downloadAudio(url, filename) {
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
  }
}

export default new ApiService();