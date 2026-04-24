import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TimeoutConfig {
  default: number;
  endpoints: Record<string, number>;
  methods: Record<string, number>;
}

@Injectable()
export class TimeoutConfigService {
  private readonly config: TimeoutConfig;

  constructor(private configService: ConfigService) {
    this.config = this.loadConfig();
  }

  private loadConfig(): TimeoutConfig {
    return {
      default: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10), // 30 seconds
      endpoints: {
        // API endpoints with custom timeouts
        '/auth/login': 10000, // 10 seconds for login
        '/auth/register': 15000, // 15 seconds for registration
        '/payments/create-payment-intent': 20000, // 20 seconds for payment processing
        '/media/upload': 120000, // 2 minutes for file upload
        '/backup/create': 300000, // 5 minutes for backup creation
        '/search': 15000, // 15 seconds for search
        '/email-marketing/campaigns/send': 60000, // 1 minute for campaign sending
      },
      methods: {
        // HTTP method-specific timeouts
        'GET': 30000, // 30 seconds for GET requests
        'POST': 60000, // 1 minute for POST requests
        'PUT': 45000, // 45 seconds for PUT requests
        'DELETE': 30000, // 30 seconds for DELETE requests
        'PATCH': 45000, // 45 seconds for PATCH requests
      },
    };
  }

  getDefaultTimeout(): number {
    return this.config.default;
  }

  getEndpointTimeout(path: string): number | null {
    // Check for exact path match
    if (this.config.endpoints[path]) {
      return this.config.endpoints[path];
    }

    // Check for pattern matches
    for (const [pattern, timeout] of Object.entries(this.config.endpoints)) {
      if (this.matchesPattern(path, pattern)) {
        return timeout;
      }
    }

    return null;
  }

  getMethodTimeout(method: string): number | null {
    return this.config.methods[method.toUpperCase()] || null;
  }

  getTimeoutForRequest(method: string, path: string): number {
    // Priority: endpoint > method > default
    const endpointTimeout = this.getEndpointTimeout(path);
    if (endpointTimeout) {
      return endpointTimeout;
    }

    const methodTimeout = this.getMethodTimeout(method);
    if (methodTimeout) {
      return methodTimeout;
    }

    return this.getDefaultTimeout();
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Simple pattern matching - can be enhanced with regex
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}$`).test(path);
    }
    return false;
  }

  updateEndpointTimeout(path: string, timeout: number): void {
    this.config.endpoints[path] = timeout;
  }

  updateMethodTimeout(method: string, timeout: number): void {
    this.config.methods[method.toUpperCase()] = timeout;
  }

  updateDefaultTimeout(timeout: number): void {
    this.config.default = timeout;
  }

  getConfig(): TimeoutConfig {
    return { ...this.config };
  }
}
