import { NextRequest, NextResponse } from 'next/server';
import { runAllHealthChecks } from '../../../lib/healthChecks';

export async function GET() {
  try {
    const healthCheckResults = await runAllHealthChecks();
    
    // Determine overall health status
    const hasErrors = healthCheckResults.some(result => result.status === 'error');
    const overallStatus = hasErrors ? 'unhealthy' : 'healthy';
    
    // Set appropriate HTTP status code
    const httpStatus = hasErrors ? 503 : 200;
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthCheckResults,
      summary: {
        total: healthCheckResults.length,
        passed: healthCheckResults.filter(r => r.status === 'success').length,
        failed: healthCheckResults.filter(r => r.status === 'error').length,
      }
    };

    return NextResponse.json(response, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Health check system failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

// Optional: Add POST endpoint for triggering specific health checks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service } = body;
    
    if (service) {
      // You could implement individual service checks here if needed
      return NextResponse.json({
        message: `Individual service checks not implemented yet. Use GET /api/health for all checks.`,
        requestedService: service
      }, { status: 501 });
    }
    
    // If no specific service requested, run all checks
    const healthCheckResults = await runAllHealthChecks();
    const hasErrors = healthCheckResults.some(result => result.status === 'error');
    
    return NextResponse.json({
      status: hasErrors ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      checks: healthCheckResults,
    }, { 
      status: hasErrors ? 503 : 200 
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Invalid request',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }
}