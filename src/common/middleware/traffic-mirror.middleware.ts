import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as https from 'https';
import { CanaryMetricsService } from '../../canary/canary-metrics.service';

@Injectable()
export class TrafficMirrorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TrafficMirrorMiddleware.name);

  constructor(private readonly metrics: CanaryMetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const canaryHost = process.env.CANARY_HOST;
    const canaryPort = parseInt(process.env.CANARY_PORT || '3001', 10);
    const mirrorEnabled = process.env.CANARY_MIRROR_ENABLED === 'true';

    if (mirrorEnabled && canaryHost) {
      this.mirrorRequest(req, canaryHost, canaryPort);
    }

    next();
  }

  private mirrorRequest(req: Request, host: string, port: number): void {
    const startTime = Date.now();
    const useHttps = process.env.CANARY_USE_HTTPS === 'true';
    const transport = useHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: host,
      port,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host,
        'x-mirrored-request': 'true',
        'x-original-host': req.hostname,
      },
    };

    const mirrorReq = transport.request(options, (mirrorRes) => {
      const duration = Date.now() - startTime;
      this.metrics.recordMirrorResult({
        path: req.originalUrl,
        method: req.method,
        statusCode: mirrorRes.statusCode ?? 0,
        durationMs: duration,
        success: (mirrorRes.statusCode ?? 0) < 500,
      });

      // Drain the mirrored response so the socket is released
      mirrorRes.resume();
    });

    mirrorReq.on('error', (err) => {
      const duration = Date.now() - startTime;
      this.logger.warn(`Canary mirror failed [${req.method} ${req.originalUrl}]: ${err.message}`);
      this.metrics.recordMirrorResult({
        path: req.originalUrl,
        method: req.method,
        statusCode: 0,
        durationMs: duration,
        success: false,
      });
    });

    if (req.body && typeof req.body === 'object') {
      try {
        const bodyStr = JSON.stringify(req.body as Record<string, unknown>);
        mirrorReq.setHeader('content-type', 'application/json');
        mirrorReq.setHeader('content-length', Buffer.byteLength(bodyStr));
        mirrorReq.write(bodyStr);
      } catch {
        // Non-serialisable body — skip body forwarding
      }
    }

    mirrorReq.end();
  }
}
