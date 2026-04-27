import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import axios from 'axios';
import {
  calculatePasswordStrength,
  IPasswordStrengthResult,
} from '../../common/validators/password.validator';

const DEFAULT_MIN_LENGTH = 12;
const HIBP_RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range';

interface IBreachCheckResult {
  checked: boolean;
  breached: boolean;
  breachCount: number;
}

@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  constructor(private readonly configService: ConfigService) {}

  async enforce(password: string): Promise<void> {
    const complexity = this.validateComplexity(password);
    if (!complexity.isValid) {
      throw new BadRequestException(complexity.errors.join('; '));
    }

    const breachResult = await this.checkBreach(password);
    if (breachResult.breached) {
      throw new BadRequestException(
        'Password has appeared in known data breaches. Choose a different password.',
      );
    }
  }

  validateComplexity(password: string): IPasswordStrengthResult {
    const result = calculatePasswordStrength(password);
    const minLength = this.configService.get<number>(
      'PASSWORD_POLICY_MIN_LENGTH',
      DEFAULT_MIN_LENGTH,
    );

    if (password.length < minLength) {
      result.errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (/\s/.test(password)) {
      result.errors.push('Password must not contain whitespace');
    }

    if (/(password|qwerty|123456|letmein|admin)/i.test(password)) {
      result.errors.push('Password must not include common weak patterns');
    }

    return {
      ...result,
      isValid: result.errors.length === 0,
    };
  }

  async checkBreach(password: string): Promise<IBreachCheckResult> {
    const breachCheckEnabled =
      this.configService.get<string>('PASSWORD_BREACH_CHECK_ENABLED', 'true') !== 'false';

    if (!breachCheckEnabled || process.env.NODE_ENV === 'test') {
      return { checked: false, breached: false, breachCount: 0 };
    }

    const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const response = await axios.get<string>(`${HIBP_RANGE_ENDPOINT}/${prefix}`, {
        timeout: 5000,
        headers: {
          'Add-Padding': 'true',
        },
        responseType: 'text',
      });

      const lines = response.data.split('\n');
      const breachThreshold = this.configService.get<number>('PASSWORD_BREACH_MIN_COUNT', 1);

      for (const line of lines) {
        const [hashSuffix, countRaw] = line.trim().split(':');
        if (!hashSuffix || !countRaw) {
          continue;
        }

        if (hashSuffix === suffix) {
          const breachCount = Number.parseInt(countRaw, 10) || 0;
          return {
            checked: true,
            breached: breachCount >= breachThreshold,
            breachCount,
          };
        }
      }

      return { checked: true, breached: false, breachCount: 0 };
    } catch (error) {
      const failClosed =
        this.configService.get<string>('PASSWORD_BREACH_CHECK_FAIL_CLOSED', 'false') === 'true';
      this.logger.warn(
        'Password breach check failed',
        error instanceof Error ? error.message : String(error),
      );

      if (failClosed) {
        throw new BadRequestException(
          'Password breach verification unavailable. Please try again.',
        );
      }

      return { checked: false, breached: false, breachCount: 0 };
    }
  }
}
