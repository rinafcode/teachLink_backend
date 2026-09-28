import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that secures routes using Auth0 Bearer token validation (Passport 'jwt' strategy).
 */
@Injectable()
export class Auth0Guard extends AuthGuard('jwt') {}
