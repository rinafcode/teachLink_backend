import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export type DeepLinkType = 'web' | 'app';

export interface DeepLinkRoute {
  name: string;
  path: string;
  allowedTypes: DeepLinkType[];
}

@Injectable()
export class DeepLinkService {
  private readonly allowedRoutes: DeepLinkRoute[] = [
    { name: 'course', path: '/course', allowedTypes: ['web', 'app'] },
  ];

  private readonly absoluteUrlPattern = /^(https?:\/\/|ftp:\/\/|\/\/)/i;
  private readonly schemePattern = /^[a-zA-Z][a-zA-Z0-9+\-.]*:/;
  private readonly pathTraversalPattern = /(\.\.[\/\\])/;
  private readonly injectionPattern = /[<>\{\}\\"'`]/;
  private readonly validParamPattern = /^[a-zA-Z0-9\-_.~]+$/;

  private readonly signingKey = 'teachlink-deeplink-signing-key';

  validateRoute(route: string): boolean {
    return this.allowedRoutes.some(r => r.path === route || r.name === route);
  }

  validateParam(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Invalid parameter value');
    }

    const sanitized = value.trim();

    if (!sanitized) {
      throw new BadRequestException('Parameter value cannot be empty');
    }

    if (this.absoluteUrlPattern.test(sanitized)) {
      throw new BadRequestException('Absolute URLs are not allowed');
    }

    if (this.schemePattern.test(sanitized)) {
      throw new BadRequestException('External URL schemes are not allowed');
    }

    if (this.pathTraversalPattern.test(sanitized)) {
      throw new BadRequestException('Path traversal is not allowed');
    }

    if (this.injectionPattern.test(sanitized)) {
      throw new BadRequestException('Invalid characters in parameter');
    }

    if (!this.validParamPattern.test(sanitized)) {
      throw new BadRequestException('Parameter contains invalid characters');
    }

    return sanitized;
  }

  buildDeepLink(type: DeepLinkType, route: string, param: string): string {
    if (!this.validateRoute(route)) {
      throw new BadRequestException(`Route '${route}' is not allowlisted`);
    }

    const sanitizedParam = this.validateParam(param);
    const encodedParam = encodeURIComponent(sanitizedParam);

    if (type === 'app') {
      return `teachlink://${route}/${encodedParam}`;
    }

    return `/${route}/${encodedParam}`;
  }

  signLink(link: string): string {
    const hmac = createHmac('sha256', this.signingKey);
    hmac.update(link);
    const signature = hmac.digest('hex');
    const separator = link.includes('?') ? '&' : '?';
    return `${link}${separator}sig=${signature}`;
  }

  verifyLink(link: string): boolean {
    const sigParamIndex = link.search(/[?&]sig=/);
    if (sigParamIndex === -1) return false;

    const signature = link.slice(sigParamIndex + 5);
    const basePath = link.slice(0, sigParamIndex);

    const hmac = createHmac('sha256', this.signingKey);
    hmac.update(basePath);
    const expected = hmac.digest('hex');

    if (signature.length !== expected.length) return false;

    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
