// Add this to your frontend to diagnose connection issues
// Save as: frontend/src/pages/DiagnosticPage.jsx

import React, { useState, useEffect } from 'react';

const DiagnosticPage = () => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const diagnostics = {};

    // 1. Check environment variables
    diagnostics.envVars = {
      REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
    };

    // 2. Test backend connection
    const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:10000';
    
    try {
      const response = await fetch(`${apiUrl}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        diagnostics.backendConnection = {
          status: 'SUCCESS ✅',
          data: data,
        };
      } else {
        diagnostics.backendConnection = {
          status: `FAILED ❌ (${response.status})`,
          error: await response.text(),
        };
      }
    } catch (error) {
      diagnostics.backendConnection = {
        status: 'FAILED ❌',
        error: error.message,
      };
    }

    // 3. Test CORS
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
      });
      diagnostics.cors = response.ok ? 'WORKING ✅' : 'BLOCKED ❌';
    } catch (error) {
      diagnostics.cors = `BLOCKED ❌ (${error.message})`;
    }

    // 4. Window location
    diagnostics.location = {
      origin: window.location.origin,
      href: window.location.href,
    };

    setResults(diagnostics);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Running Diagnostics...</h1>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔍 Connection Diagnostics</h1>

      {/* Environment Variables */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">1. Environment Variables</h2>
        <div className="space-y-2 font-mono text-sm">
          {Object.entries(results.envVars || {}).map(([key, value]) => (
            <div key={key} className="flex">
              <span className="font-bold w-48">{key}:</span>
              <span className={value === 'NOT SET' ? 'text-red-600' : 'text-green-600'}>
                {value}
              </span>
            </div>
          ))}
        </div>
        {results.envVars?.REACT_APP_API_URL === 'NOT SET' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-bold">⚠️ API URL NOT SET!</p>
            <p className="text-sm text-red-700 mt-2">
              Go to Vercel Dashboard → Settings → Environment Variables
              <br />
              Add: REACT_APP_API_URL = http://54.162.155.232
              <br />
              Then redeploy your app
            </p>
          </div>
        )}
      </div>

      {/* Backend Connection */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">2. Backend Connection</h2>
        <div className="font-mono text-sm">
          <p className="mb-2">
            <span className="font-bold">Status:</span> {results.backendConnection?.status}
          </p>
          {results.backendConnection?.data && (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(results.backendConnection.data, null, 2)}
            </pre>
          )}
          {results.backendConnection?.error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded mt-2">
              <p className="text-red-800">{results.backendConnection.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* CORS */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">3. CORS Status</h2>
        <p className="font-mono text-sm">{results.cors}</p>
      </div>

      {/* Location */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">4. Current Location</h2>
        <div className="space-y-2 font-mono text-sm">
          <p><span className="font-bold">Origin:</span> {results.location?.origin}</p>
          <p><span className="font-bold">URL:</span> {results.location?.href}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-blue-50 border border-blue-200 p-6 rounded">
        <h3 className="font-bold mb-2">🔧 Quick Fixes:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Set REACT_APP_API_URL in Vercel Environment Variables</li>
          <li>Redeploy your app on Vercel</li>
          <li>Clear browser cache and reload</li>
          <li>Check backend is running: <code className="bg-white px-2 py-1 rounded">curl http://54.162.155.232/</code></li>
        </ol>
      </div>

      <div className="mt-6">
        <button
          onClick={runDiagnostics}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔄 Re-run Diagnostics
        </button>
      </div>
    </div>
  );
};

export default DiagnosticPage;