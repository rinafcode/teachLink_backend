import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { SocialAuthService } from '../services/social-auth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly socialAuth: SocialAuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL: process.env.GITHUB_CALLBACK_URL ?? '/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: any) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value ?? '';
    const displayName = profile.displayName ?? profile.username ?? '';
    const [firstName = displayName, lastName = ''] = displayName.split(' ');

    const user = await this.socialAuth.findOrCreateFromProvider({
      provider: 'github',
      providerId: String(profile.id),
      email,
      firstName,
      lastName,
      picture: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    });
    done(null, user);
  }
}
