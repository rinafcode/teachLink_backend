import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface SocialProfile {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class SocialAuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findOrCreateFromProvider(profile: SocialProfile): Promise<User> {
    const existing = await this.users.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
    });
    if (existing) return existing;

    if (profile.email) {
      const byEmail = await this.users.findOne({ where: { email: profile.email } });
      if (byEmail) {
        if (byEmail.provider && byEmail.provider !== profile.provider) {
          throw new ConflictException(
            `Email already registered with ${byEmail.provider}. Please sign in with that provider.`,
          );
        }
        byEmail.provider = profile.provider;
        byEmail.providerId = profile.providerId;
        byEmail.providerAccessToken = profile.accessToken ?? null;
        byEmail.providerRefreshToken = profile.refreshToken ?? null;
        if (profile.picture && !byEmail.profilePicture) {
          byEmail.profilePicture = profile.picture;
        }
        return this.users.save(byEmail);
      }
    }

    // Derive a username-like base from the email local part for fallback names.
    const emailLocalPart = profile.email ? profile.email.split('@')[0] : profile.providerId;

    const firstName = profile.firstName?.trim() || emailLocalPart;
    const lastName = profile.lastName?.trim() || '';

    const user = this.users.create({
      email: profile.email,
      firstName,
      lastName,
      profilePicture: profile.picture,
      provider: profile.provider,
      providerId: profile.providerId,
      providerAccessToken: profile.accessToken ?? null,
      providerRefreshToken: profile.refreshToken ?? null,
      isEmailVerified: true,
    });
    return this.users.save(user);
  }

  async linkProvider(userId: string, profile: SocialProfile): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    user.provider = profile.provider;
    user.providerId = profile.providerId;
    user.providerAccessToken = profile.accessToken ?? null;
    user.providerRefreshToken = profile.refreshToken ?? null;
    return this.users.save(user);
  }

  async unlinkProvider(userId: string): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    user.provider = null;
    user.providerId = null;
    user.providerAccessToken = null;
    user.providerRefreshToken = null;
    return this.users.save(user);
  }
}
