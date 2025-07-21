'use client';

import { useState, useEffect } from 'react';
import { apiService, APIConfiguration, APIResponse } from '../lib/apiService';

// Hook for API Integration management
export const useAPIIntegration = () => {
  const [apis, setAPIs] = useState<APIConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleAPIUpdate = (apiData: APIConfiguration[]) => {
      setAPIs(apiData);
      setIsLoading(false);
    };

    apiService.subscribe(handleAPIUpdate);

    return () => {
      apiService.unsubscribe(handleAPIUpdate);
    };
  }, []);

  const addAPI = async (config: Omit<APIConfiguration, 'id' | 'status' | 'lastUpdate' | 'latency' | 'requestsToday' | 'createdAt' | 'lastTested'>) => {
    setIsLoading(true);
    try {
      const newAPI = await apiService.addAPI(config);
      return { success: true, api: newAPI };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add API' };
    } finally {
      setIsLoading(false);
    }
  };

  const updateAPI = async (id: string, updates: Partial<APIConfiguration>) => {
    try {
      const success = await apiService.updateAPI(id, updates);
      return { success };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update API' };
    }
  };

  const deleteAPI = (id: string) => {
    try {
      const success = apiService.deleteAPI(id);
      return { success };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete API' };
    }
  };

  const testAPI = async (id: string): Promise<APIResponse> => {
    return await apiService.testAPIConnection(id);
  };

  const testAllAPIs = async () => {
    setIsLoading(true);
    try {
      await apiService.testAllAPIs();
    } finally {
      setIsLoading(false);
    }
  };

  const getCachedData = (apiId: string) => {
    return apiService.getCachedData(apiId);
  };

  const getAPIStats = () => {
    return apiService.getAPIStats();
  };

  const getAPIsByCategory = (category: string) => {
    return apiService.getAPIsByCategory(category);
  };

  const getConnectedAPIs = () => {
    return apiService.getConnectedAPIs();
  };

  return {
    apis,
    isLoading,
    addAPI,
    updateAPI,
    deleteAPI,
    testAPI,
    testAllAPIs,
    getCachedData,
    getAPIStats,
    getAPIsByCategory,
    getConnectedAPIs
  };
};