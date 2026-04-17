'use client';

import { useState, useEffect } from 'react';
import { Key, Save, RefreshCw, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, Activity, Newspaper, Server } from 'lucide-react';
import { config } from '../lib/config';

interface EnvVariable {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface EnvSchema {
  [category: string]: EnvVariable[];
}

const APIKeysTab = () => {
  const [envVars, setEnvVars] = useState<{ [key: string]: string }>({});
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set()); // Track which fields user has edited
  const [schema, setSchema] = useState<EnvSchema>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    // Check if backend is accessible
    const backendConfigured = config.backendURL && config.backendURL.length > 0;
    if (backendConfigured) {
      fetchEnvironmentVariables();
      fetchSchema();
    } else {
      setIsLoading(false);
      // Use default schema without fetching
      setSchema({
        'Angel One': [
          { key: 'ANGELONE_API_KEY', label: 'API Key', type: 'password', required: true },
          { key: 'ANGELONE_CLIENT_CODE', label: 'Client Code', type: 'text', required: true },
          { key: 'ANGELONE_PASSWORD', label: 'Password', type: 'password', required: true }
        ],
        'Upstox': [
          { key: 'UPSTOX_API_KEY', label: 'API Key', type: 'password', required: true },
          { key: 'UPSTOX_API_SECRET', label: 'API Secret', type: 'password', required: true },
          { key: 'UPSTOX_REDIRECT_URI', label: 'Redirect URI', type: 'text', required: true },
          { key: 'UPSTOX_ACCESS_TOKEN', label: 'Access Token', type: 'password', required: false },
          { key: 'UPSTOX_DEFAULT_INSTRUMENTS', label: 'Default Instruments', type: 'text', required: false }
        ],
        'News & AI': [
          { key: 'PERPLEXITY_API_KEY', label: 'Perplexity API Key', type: 'password', required: false },
          { key: 'NEWSAPI_KEY', label: 'NewsAPI Key', type: 'password', required: false }
        ],
        'Server': [
          { key: 'FRONTEND_URL', label: 'Frontend URL', type: 'text', required: true },
          { key: 'PORT', label: 'Backend Port', type: 'number', required: true }
        ]
      });
      setSaveStatus({ 
        type: 'error', 
        message: 'Backend server not configured. API key management requires a backend server. You can still use environment variables directly in your .env file.' 
      });
    }
  }, []);

  const fetchEnvironmentVariables = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${config.backendURL}/api/settings/env`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in first.');
        }
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to fetch environment variables');
      }
      
      const data = await response.json();
      const fetchedVars = data.data.env || {};
      setEnvVars(fetchedVars);
      setEditedFields(new Set()); // Reset edited fields after fetch
      setSaveStatus({ type: null, message: '' });
    } catch (error: any) {
      console.error('Error fetching env vars:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to load environment variables. Make sure the backend server is running.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchema = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${config.backendURL}/api/settings/env/schema`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Failed to fetch schema');
      }
      
      const data = await response.json();
      setSchema(data.data.schema || {});
    } catch (error: any) {
      console.error('Error fetching schema:', error);
      // Use default schema if fetch fails
      setSchema({
        'Angel One': [
          { key: 'ANGELONE_API_KEY', label: 'API Key', type: 'password', required: true },
          { key: 'ANGELONE_CLIENT_CODE', label: 'Client Code', type: 'text', required: true },
          { key: 'ANGELONE_PASSWORD', label: 'Password', type: 'password', required: true }
        ],
        'Upstox': [
          { key: 'UPSTOX_API_KEY', label: 'API Key', type: 'password', required: true },
          { key: 'UPSTOX_API_SECRET', label: 'API Secret', type: 'password', required: true },
          { key: 'UPSTOX_REDIRECT_URI', label: 'Redirect URI', type: 'text', required: true },
          { key: 'UPSTOX_ACCESS_TOKEN', label: 'Access Token', type: 'password', required: false },
          { key: 'UPSTOX_DEFAULT_INSTRUMENTS', label: 'Default Instruments', type: 'text', required: false }
        ],
        'News & AI': [
          { key: 'PERPLEXITY_API_KEY', label: 'Perplexity API Key', type: 'password', required: false },
          { key: 'NEWSAPI_KEY', label: 'NewsAPI Key', type: 'password', required: false }
        ],
        'Server': [
          { key: 'FRONTEND_URL', label: 'Frontend URL', type: 'text', required: true },
          { key: 'PORT', label: 'Backend Port', type: 'number', required: true }
        ]
      });
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setEnvVars(prev => ({
      ...prev,
      [key]: value
    }));
    // Mark this field as edited
    setEditedFields(prev => { const next = new Set(Array.from(prev)); next.add(key); return next; });
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getDisplayValue = (key: string) => {
    return envVars[key] || '';
  };

  const getPlaceholder = (field: any) => {
    return `Enter ${field.label.toLowerCase()}`;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus({ type: null, message: '' });
      
      // Only send edited fields
      const editedVars: { [key: string]: string } = {};
      editedFields.forEach(key => {
        editedVars[key] = envVars[key] || '';
      });
      
      // If no fields were actually edited, don't make the request
      if (Object.keys(editedVars).length === 0) {
        setSaveStatus({ 
          type: 'error', 
          message: 'No changes to save. Please edit at least one field.' 
        });
        return;
      }
      
      const token = localStorage.getItem('auth_token');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${config.backendURL}/api/settings/env`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ envVars: editedVars })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in first.');
        }
        throw new Error(data.message || 'Failed to save environment variables');
      }
      
      setSaveStatus({ 
        type: 'success', 
        message: data.message || 'Settings saved successfully! Please restart the server for all changes to take effect.' 
      });
      
      // Refresh the data to show masked values
      setTimeout(() => {
        fetchEnvironmentVariables();
      }, 1000);
    } catch (error: any) {
      console.error('Error saving env vars:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to save settings. Make sure the backend server is running.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Angel One':
        return <Activity className="h-5 w-5 text-blue-600" />;
      case 'Upstox':
        return <Activity className="h-5 w-5 text-purple-600" />;
      case 'News & AI':
        return <Newspaper className="h-5 w-5 text-green-600" />;
      case 'Server':
        return <Server className="h-5 w-5 text-orange-600" />;
      default:
        return <Key className="h-5 w-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading API settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
        <Key className="h-5 w-5 mr-2 text-blue-600" />
        API Keys & Tokens
      </h3>

      {/* Save Status Alert */}
      {saveStatus.type && (
        <div className={`p-4 rounded-lg flex items-start space-x-3 ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              saveStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {saveStatus.message}
            </p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="space-y-6">
        {Object.entries(schema).map(([category, fields]) => (
          <div key={category} className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              {getCategoryIcon(category)}
              <h4 className="text-base font-semibold text-gray-900">{category}</h4>
            </div>

            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={field.type === 'password' && !showPassword[field.key] ? 'password' : 'text'}
                      value={getDisplayValue(field.key)}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={getPlaceholder(field)}
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(field.key)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword[field.key] ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {editedFields.has(field.key)
                      ? 'Modified - will update on save' 
                      : 'Click to edit'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Warning */}
      <div className="flex items-start space-x-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-yellow-800">Important:</p>
          <p className="text-yellow-700">
            Changes will update both root and backend .env files. A server restart is recommended for all changes to take full effect.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={fetchEnvironmentVariables}
          disabled={isLoading}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Reload
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Help Section */}
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-base font-semibold text-blue-900 mb-3 flex items-center">
          <Key className="h-5 w-5 mr-2" />
          How to get API Keys
        </h4>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>Angel One:</strong> Visit <a href="https://smartapi.angelbroking.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">smartapi.angelbroking.com</a> to generate your API credentials</p>
          <p><strong>Upstox:</strong> Go to <a href="https://account.upstox.com/developer/apps" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Upstox Developer Console</a> to create an app and get your keys</p>
          <p><strong>NewsAPI:</strong> Sign up at <a href="https://newsapi.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">newsapi.org</a> to get your free API key</p>
          <p><strong>Perplexity:</strong> Visit <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Perplexity API Settings</a> to generate your API key</p>
        </div>
      </div>
    </div>
  );
};

export default APIKeysTab;
