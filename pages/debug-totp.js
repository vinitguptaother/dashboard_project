import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function DebugTOTP() {
  const [debugData, setDebugData] = useState(null);
  const [testSecret, setTestSecret] = useState('');
  const [testCode, setTestCode] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDebugInfo = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (testSecret) params.append('secret', testSecret);
      if (testCode) params.append('testCode', testCode);
      
      const response = await fetch(`/api/debug-totp?${params}`);
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Debug fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Head>
        <title>TOTP Debug Tool</title>
      </Head>
      
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">TOTP Debug Tool</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Test TOTP Secret (optional)</label>
              <input
                type="text"
                value={testSecret}
                onChange={(e) => setTestSecret(e.target.value)}
                placeholder="Enter TOTP secret to test"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Test Code (optional)</label>
              <input
                type="text"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code to validate"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                maxLength={6}
              />
            </div>
          </div>
          
          <button
            onClick={fetchDebugInfo}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Debug TOTP'}
          </button>
        </div>

        {debugData && (
          <div className="space-y-6">
            {/* Current Time Info */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Time Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <strong>Current Time:</strong><br />
                  {debugData.data?.currentTime}
                </div>
                <div>
                  <strong>System Timestamp:</strong><br />
                  {debugData.data?.systemTime}
                </div>
                <div>
                  <strong>TOTP Time Step:</strong><br />
                  {debugData.data?.timeStep}
                </div>
              </div>
            </div>

            {/* Environment Secret */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Environment TOTP Secret</h2>
              <div className="space-y-2">
                <div>
                  <strong>Secret:</strong> {debugData.data?.environment?.totpSecret}
                </div>
                <div>
                  <strong>Length:</strong> {debugData.data?.environment?.secretLength} characters
                </div>
                {debugData.data?.environmentSecret && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    {debugData.data.environmentSecret.error ? (
                      <div className="text-red-600">
                        <strong>Error:</strong> {debugData.data.environmentSecret.error}
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          Generated Code: {debugData.data.environmentSecret.code}
                        </div>
                        <div className="text-sm text-gray-600">
                          Time Step: {debugData.data.environmentSecret.timeStep}<br />
                          Generated at: {debugData.data.environmentSecret.timestamp}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Time Windows */}
            {debugData.data?.timeWindows && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">TOTP Codes for Time Windows</h2>
                <div className="grid grid-cols-1 gap-2">
                  {debugData.data.timeWindows.map && debugData.data.timeWindows.map((window, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        window.isCurrent 
                          ? 'bg-green-100 border-green-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <strong className="text-lg">{window.code}</strong>
                          <span className="ml-2 text-sm text-gray-600">
                            ({window.offset === 0 ? 'Current' : `${window.offset > 0 ? '+' : ''}${window.offset * 30}s`})
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(window.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Results */}
            {debugData.data?.validation && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Code Validation</h2>
                <div className={`p-4 rounded-lg ${
                  debugData.data.validation.matches 
                    ? 'bg-green-100 border border-green-300' 
                    : 'bg-red-100 border border-red-300'
                }`}>
                  <div className="space-y-2">
                    <div>
                      <strong>Test Code:</strong> {debugData.data.validation.testCode}
                    </div>
                    <div>
                      <strong>Expected Code:</strong> {debugData.data.validation.currentCode}
                    </div>
                    <div>
                      <strong>Match:</strong> {debugData.data.validation.matches ? '✅ Yes' : '❌ No'}
                    </div>
                    <div>
                      <strong>Time Difference:</strong> {debugData.data.validation.timeDiff?.toFixed(1)} seconds
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Raw Debug Data */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Raw Debug Data</h2>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




