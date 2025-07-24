import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GatewayAuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Authenticates the request using JWT Bearer token.
   * Returns true if valid, false otherwise.
   */
  async authenticate(request: any): Promise<boolean> {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      // Optionally attach user info to request for downstream use
      request.user = payload;
      return true;
    } catch (e) {
      return false;
    }
  }
} 