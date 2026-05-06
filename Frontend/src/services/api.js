// Frontend/src/services/api.js
// UPDATED: Added filterLiveChunk for real-time instruction filtering

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';

class ApiService {
  async parseError(response, fallbackMessage) {
    try {
      const error = await response.json();
      const detail = error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (detail?.message) {
        return detail.message;
      }
      if (error?.error) {
        return error.error;
      }
    } catch (e) {
      // Ignore parse errors and fall back to the provided message.
    }

    return fallbackMessage;
  }

  getAuthToken() {
    return localStorage.getItem('rehear_token');
  }

  getAuthHeaders(extraHeaders = {}) {
    const token = this.getAuthToken();
    return token
      ? { ...extraHeaders, Authorization: `Bearer ${token}` }
      : extraHeaders;
  }

  async signup({ name, email, password }) {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Unable to create account'));
    }

    return response.json();
  }

  async login({ email, password }) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Unable to sign in'));
    }

    return response.json();
  }

  async googleLogin(credential) {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Google sign-in failed'));
    }

    return response.json();
  }

  async getCurrentUser(token = this.getAuthToken()) {
    if (!token) {
      throw new Error('Missing token');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Session is not valid'));
    }

    return response.json();
  }

  /**
   * Notify the backend of a logout event.
   * Best-effort: failures are swallowed since the client still clears its session.
   */
  async logout() {
    try {
      const token = this.getAuthToken();
      if (!token) return;

      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Silently ignore — logout should always succeed client-side
      console.warn('[API] Backend logout notification failed:', error.message);
    }
  }

  async forgetPassword({ email }) {
    const response = await fetch(`${API_BASE_URL}/api/auth/forget-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Unable to send reset code'));
    }

    return response.json();
  }

  async resendResetCode({ email }) {
    const response = await fetch(`${API_BASE_URL}/api/auth/resend-reset-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Unable to resend reset code'));
    }

    return response.json();
  }

  async verifyResetCode({ email, code }) {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Unable to verify reset code'));
    }

    return response.json();
  }

  async resetPassword({ resetToken, email, code, newPassword }) {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reset_token: resetToken,
        email,
        code,
        new_password: newPassword,
      }),
    });

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Unable to reset password'));
    }

    return response.json();
  }

  /**
   * Upload and analyze audio file
   * Returns instruction-based audio chunks (one per instruction)
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
        headers: this.getAuthHeaders(),
        // Don't set Content-Type header - browser will set it with boundary for FormData
      });

      console.log('[API] Response status:', response.status);

      if (!response.ok) {
        const errorMessage = await this.parseError(
          response,
          `Server error: ${response.status} ${response.statusText}`
        );
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
   * Process live transcription text directly (Final Save)
   * Send transcription text to backend for instruction extraction and TTS generation
   * @param {string} text - The live transcription text
   * @returns {Promise<Object>} - Instructions with audio URLs
   */
  async processLiveText(text) {
    console.log('[API] Processing live transcription text...');
    console.log('[API] Text length:', text.length, 'characters');

    try {
      const response = await fetch(`${API_BASE_URL}/process-live-text`, {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorMessage = await this.parseError(response, `Server error: ${response.status}`);
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
   * Fast live filtering for real-time display (NEW)
   * Sends a sentence to the backend to check if it's an instruction
   * @param {string} text - Raw spoken chunk
   * @returns {Promise<Object>} - { filtered_text: "..." }
   */
  async filterLiveChunk(text) {
    // Fail silently/quickly for real-time lookups if backend is down
    try {
      const response = await fetch(`${API_BASE_URL}/filter-live-chunk`, {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        return { filtered_text: "" };
      }

      return await response.json();
    } catch (error) {
      // Don't log error to avoid console spam during typing/speaking
      return { filtered_text: "" };
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
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
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
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
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
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
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

  async getBillingPlans() {
    const response = await fetch(`${API_BASE_URL}/api/billing/plans`, {
      method: 'GET',
      headers: this.getAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch billing plans: ${response.status}`);
    }

    return response.json();
  }

  async getBillingStatus() {
    const response = await fetch(`${API_BASE_URL}/api/billing/me`, {
      method: 'GET',
      headers: this.getAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseError(response, `Server error: ${response.status}`);
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async syncRevenueCatSubscription() {
    const response = await fetch(`${API_BASE_URL}/api/billing/revenuecat/sync`, {
      method: 'POST',
      headers: this.getAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    if (!response.ok) {
      const errorMessage = await this.parseError(response, `Server error: ${response.status}`);
      throw new Error(errorMessage);
    }

    return response.json();
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