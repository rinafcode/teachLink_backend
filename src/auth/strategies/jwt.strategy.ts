import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

/**
 * Passport JWT strategy for validating Auth0 Bearer tokens dynamically.
 * Resolves signing keys dynamically from the Auth0 Issuer JWKS endpoint.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const audience = process.env.AUTH0_AUDIENCE;
    const issuerUrl = process.env.AUTH0_ISSUER_URL;

    if (!audience) {
      const errorMsg = 'AUTH0_AUDIENCE is not defined in the environment variables.';
      const initLogger = new Logger('JwtStrategy');
      initLogger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!issuerUrl) {
      const errorMsg = 'AUTH0_ISSUER_URL is not defined in the environment variables.';
      const initLogger = new Logger('JwtStrategy');
      initLogger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Safely construct and normalize the issuer and JWKS URI
    const normalizedIssuer = issuerUrl.endsWith('/') ? issuerUrl : `${issuerUrl}/`;
    const jwksUri = `${normalizedIssuer}.well-known/jwks.json`;

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience,
      issuer: normalizedIssuer,
      algorithms: ['RS256'],
    });

    this.logger.log(
      `Auth0 JwtStrategy successfully initialized with audience [${audience}] and issuer [${normalizedIssuer}]`,
    );
  }

  /**
   * Validates the decoded JWT payload.
   * @param payload The decoded JWT payload.
   * @returns The payload to be attached to the request object.
   */
  async validate(payload: any): Promise<any> {
    if (!payload) {
      this.logger.warn('Token validation failed: payload is empty or invalid.');
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
