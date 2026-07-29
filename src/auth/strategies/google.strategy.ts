import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { SocialAuthService } from '../services/social-auth.service';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly socialAuth: SocialAuthService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value ?? '';
      const user = await this.socialAuth.findOrCreateFromProvider({
        provider: 'google',
        providerId: profile.id,
        email,
        firstName: profile.name?.givenName ?? profile.displayName,
        lastName: profile.name?.familyName ?? '',
        picture: profile.photos?.[0]?.value,
        accessToken,
        refreshToken,
      });

      this.authService.assertUserMayAuthenticate(user, 'google_oauth_login');
      done(null, user);
    } catch (error) {
      done(error as Error, false);
    }
  }
}