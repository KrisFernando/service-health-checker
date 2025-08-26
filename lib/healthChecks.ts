import { Client } from 'pg';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { SESClient, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';

export interface HealthCheckResult {
  service: string;
  status: 'success' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

// Database Health Check
export async function checkDatabase(): Promise<HealthCheckResult> {
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
export async function checkS3(): Promise<HealthCheckResult> {
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
export async function checkSES(): Promise<HealthCheckResult> {
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
  ]);

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      const services = ['Application Port', 'PostgreSQL Database', 'AWS S3', 'AWS SES'];
      return {
        service: services[index],
        status: 'error' as const,
        message: `Health check failed: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`,
      };
    }
  });
}