'use client';

import { useState, useEffect } from 'react';

interface HealthCheckResult {
  service: string;
  status: 'success' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: string;
  timestamp: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export default function HealthDashboard() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache',
      });
      
      const data = await response.json();
      setHealthData(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return '✅';
      case 'error':
      case 'unhealthy':
        return '❌';
      default:
        return '⚠️';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Service Health Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time monitoring of connected services and configurations
          </p>
        </div>

        {/* Overall Status Card */}
        <div className="mb-8">
          <div className={`rounded-lg border-2 p-6 ${healthData ? getStatusColor(healthData.status) : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">
                  {healthData ? getStatusIcon(healthData.status) : '⏳'}
                </span>
                <div>
                  <h2 className="text-xl font-semibold">
                    Overall Status: {healthData?.status?.toUpperCase() || 'CHECKING...'}
                  </h2>
                  {healthData?.summary && (
                    <p className="text-sm opacity-75">
                      {healthData.summary.passed}/{healthData.summary.total} services healthy
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={fetchHealthData}
                disabled={loading}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking...' : 'Refresh'}
              </button>
            </div>
            {lastRefresh && (
              <p className="text-xs opacity-60 mt-2">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">❌</span>
              <p className="text-red-700">Error: {error}</p>
            </div>
          </div>
        )}

        {/* Service Checks */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Checks</h3>
          
          {loading && !healthData ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Running health checks...</p>
            </div>
          ) : (
            healthData?.checks.map((check, index) => (
              <div
                key={index}
                className={`rounded-lg border p-4 ${getStatusColor(check.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-xl mt-0.5">
                      {getStatusIcon(check.status)}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium text-lg">{check.service}</h4>
                      <p className="text-sm opacity-90 mt-1">{check.message}</p>
                      
                      {check.details && (
                        <div className="mt-3 p-3 bg-white bg-opacity-50 rounded text-xs">
                          <h5 className="font-medium mb-1">Details:</h5>
                          <pre className="whitespace-pre-wrap font-mono">
                            {JSON.stringify(check.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Service Health Checker v1.0</p>
          <p>Auto-refreshes every 30 seconds</p>
        </div>
      </div>
    </div>
  );
}