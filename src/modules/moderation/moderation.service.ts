import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ModerationResultDto, ModerationFlag } from './dto/moderation-result.dto';

// Basic profanity list — matches word stems (e.g. "fucking", "shitty")
const PROFANITY_PATTERNS = [
  /\bf+u+c+k/i,
  /\bs+h+i+t/i,
  /\ba+s+s+h+o+l+e/i,
  /\bb+i+t+c+h/i,
  /\bc+u+n+t/i,
  /\bn+i+g+g+e+r/i,
  /\bf+a+g+g+o+t/i,
];

// Spam signals: excessive caps, repeated chars, URL spam, all-caps shouting
const SPAM_PATTERNS = [
  /(.)\1{9,}/, // 10+ repeated characters
  /https?:\/\/\S+/gi, // URLs (flag if 3+)
  /\b(buy now|click here|free money|make money fast|earn \$|limited offer|act now)\b/i,
];

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly openaiApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY', '');
  }

  async moderate(content: string): Promise<ModerationResultDto> {
    const flags: ModerationFlag[] = [];

    // 1. Profanity filter (local, fast)
    if (this.hasProfanity(content)) {
      flags.push('profanity');
    }

    // 2. Spam detection (local, fast)
    if (this.isSpam(content)) {
      flags.push('spam');
    }

    // 3. OpenAI moderation API (remote)
    if (this.openaiApiKey) {
      const openaiViolation = await this.checkOpenAI(content);
      if (openaiViolation) {
        flags.push('openai_violation');
      }
    }

    const autoRejected = flags.length > 0;

    return {
      allowed: !autoRejected,
      autoRejected,
      flags,
      reason: autoRejected ? this.buildReason(flags) : undefined,
    };
  }

  private hasProfanity(content: string): boolean {
    return PROFANITY_PATTERNS.some((pattern) => pattern.test(content));
  }

  private isSpam(content: string): boolean {
    // Flag if repeated-char pattern found
    if (SPAM_PATTERNS[0].test(content)) return true;

    // Flag if 3+ URLs
    const urls = content.match(SPAM_PATTERNS[1]) ?? [];
    if (urls.length >= 3) return true;

    // Flag known spam phrases
    if (SPAM_PATTERNS[2].test(content)) return true;

    // Flag if >70% uppercase (min 20 chars)
    if (content.length >= 20) {
      const letters = content.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 0 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) {
        return true;
      }
    }

    return false;
  }

  private async checkOpenAI(content: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.openai.com/v1/moderations',
          { input: content },
          { headers: { Authorization: `Bearer ${this.openaiApiKey}` } },
        ),
      );
      return response.data?.results?.[0]?.flagged === true;
    } catch (err) {
      this.logger.warn(`OpenAI moderation check failed: ${(err as Error).message}`);
      return false;
    }
  }

  private buildReason(flags: ModerationFlag[]): string {
    const descriptions: Record<ModerationFlag, string> = {
      profanity: 'contains profanity',
      spam: 'detected as spam',
      openai_violation: 'violates content policy',
    };
    return flags.map((f) => descriptions[f]).join('; ');
  }
}
