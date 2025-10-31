import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async checkHealth() {
    const status: {
      status: string;
      timestamp: string;
      uptime: number;
      environment: string;
      checks: {
        database: string;
      };
      error?: string;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'unknown',
      },
    };

    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;
      status.checks.database = 'healthy';
    } catch (error) {
      status.status = 'degraded';
      status.checks.database = 'unhealthy';
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return status;
  }
}

