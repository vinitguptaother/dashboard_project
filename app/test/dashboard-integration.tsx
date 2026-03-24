'use client';

import React from 'react';
import Dashboard from '../components/Dashboard';

/**
 * Test component to verify Dashboard integration with:
 * - LiveIndexBar with pollMs control
 * - HeatMap with DEFAULT_WATCHLIST and onSelect callback  
 * - Refresh control dropdown
 * - Selected symbol display
 */
const DashboardIntegrationTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Dashboard Integration Test
          </h1>
          <p className="text-gray-600">
            Testing the integration of refresh control, LiveIndexBar, and HeatMap components
          </p>
        </div>

        <Dashboard />
      </div>
    </div>
  );
};

export default DashboardIntegrationTest;