import { Client } from 'pg';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { SESClient, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';
import { createConnection } from 'net';

export interface HealthCheckResult {
  service: string;
  status: 'success' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

// Database Health Check
export async function checkDatabase(): Promise<HealthCheckResult | null> {
  // Skip if required environment variables are not set
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
    return null;
  }

  try {
    const client = new Client({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    const result = await client.query('SELECT NOW() as current_time');
    await client.end();

    return {
      service: 'PostgreSQL Database',
      status: 'success',
      message: 'Successfully connected to database',
      details: {
        connected: true,
        responseTime: 'Fast',
        currentTime: result.rows[0].current_time,
      }
    };
  } catch (error) {
    return {
      service: 'PostgreSQL Database',
      status: 'error',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        connected: false,
        issue: 'Connection refused or authentication failed'
      }
    };
  }
}

// S3 Health Check
export async function checkS3(): Promise<HealthCheckResult | null> {
  // Skip if required environment variables are not set
  if (!process.env.S3_BUCKET_NAME) {
    return null;
  }

  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));

    return {
      service: 'AWS S3',
      status: 'success',
      message: 'Successfully accessed S3 bucket',
      details: {
        accessible: true,
        permissions: 'Valid'
      }
    };
  } catch (error) {
    return {
      service: 'AWS S3',
      status: 'error',
      message: `S3 access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        accessible: false,
        issue: 'Access denied or bucket not found'
      }
    };
  }
}

// SES Health Check
export async function checkSES(): Promise<HealthCheckResult | null> {
  // Skip if required environment variables are not set
  if (!process.env.SES_FROM_EMAIL) {
    return null;
  }

  try {
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const fromEmail = process.env.SES_FROM_EMAIL;
    if (!fromEmail) {
      throw new Error('SES_FROM_EMAIL environment variable is not set');
    }

    // Check if the email identity is verified
    const result = await sesClient.send(
      new GetIdentityVerificationAttributesCommand({
        Identities: [fromEmail],
      })
    );

    const verificationStatus = result.VerificationAttributes?.[fromEmail]?.VerificationStatus;

    return {
      service: 'AWS SES',
      status: 'success',
      message: 'Successfully connected to SES',
      details: {
        accessible: true,
        emailVerified: verificationStatus === 'Success'
      }
    };
  } catch (error) {
    return {
      service: 'AWS SES',
      status: 'error',
      message: `SES access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        accessible: false,
        issue: 'Access denied or email not verified'
      }
    };
  }
}

// DNS/Port Connectivity Health Check
export function checkDNSPort(hostname?: string, port?: number): Promise<HealthCheckResult | null> {
  // Skip if no hostname/port specified and no environment variables set
  if (!hostname && !port && !process.env.DNS_CHECK_HOST && !process.env.DNS_CHECK_PORT) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const testHost = hostname || process.env.DNS_CHECK_HOST || 'google.com';
    const testPort = port || parseInt(process.env.DNS_CHECK_PORT || '80');
    const timeout = 5000; // 5 second timeout

    const socket = createConnection({
      host: testHost,
      port: testPort,
      timeout: timeout
    });
    
    const timeoutId = setTimeout(() => {
      socket.destroy();
      resolve({
        service: 'DNS/Port Connectivity',
        status: 'error',
        message: `Connection timeout to ${testHost}:${testPort}`,
        details: {
          hostname: testHost,
          port: testPort,
          timeout: `${timeout}ms`,
          accessible: false
        }
      });
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timeoutId);
      socket.destroy();
      resolve({
        service: 'DNS/Port Connectivity',
        status: 'success',
        message: `Successfully connected to ${testHost}:${testPort}`,
        details: {
          hostname: testHost,
          port: testPort,
          accessible: true,
          responseTime: 'Fast'
        }
      });
    });

    socket.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timeoutId);
      socket.destroy();
      resolve({
        service: 'DNS/Port Connectivity',
        status: 'error',
        message: `Failed to connect to ${testHost}:${testPort}: ${error.message}`,
        details: {
          hostname: testHost,
          port: testPort,
          accessible: false,
          error: error.code || 'Unknown error'
        }
      });
    });
  });
}

// Port Health Check
export function checkPort(): HealthCheckResult {
  const port = process.env.PORT || '3000';
  
  return {
    service: 'Application Port',
    status: 'success',
    message: `Application is running on port ${port}`,
    details: {
      running: true,
      environment: process.env.ENV || 'development',
    }
  };
}

// Run all health checks
export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  const results = await Promise.allSettled([
    Promise.resolve(checkPort()),
    checkDatabase(),
    checkS3(),
    checkSES(),
    checkDNSPort(),
  ]);

  // Filter out null results (skipped checks) and process the rest
  const processedResults: HealthCheckResult[] = [];
  
  results.forEach((result, index) => {
    const services = ['Application Port', 'PostgreSQL Database', 'AWS S3', 'AWS SES', 'DNS/Port Connectivity'];
    
    if (result.status === 'fulfilled') {
      // Only add non-null results (null means check was skipped)
      if (result.value !== null) {
        processedResults.push(result.value);
      }
    } else {
      // Add error results
      processedResults.push({
        service: services[index],
        status: 'error' as const,
        message: `Health check failed: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`,
      });
    }
  });

  return processedResults;
}