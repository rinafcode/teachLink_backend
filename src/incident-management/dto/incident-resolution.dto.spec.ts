import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { EscalateIncidentDto, ResolveIncidentDto } from './incident-resolution.dto';

describe('ResolveIncidentDto', () => {
  it('accepts valid resolution notes', async () => {
    const errors = await validate(
      plainToInstance(ResolveIncidentDto, { resolutionNotes: 'Restarted the service successfully.' }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects missing resolution notes', async () => {
    const errors = await validate(plainToInstance(ResolveIncidentDto, {}));
    expect(errors.some((error) => error.property === 'resolutionNotes')).toBe(true);
  });
});

describe('EscalateIncidentDto', () => {
  it('accepts valid escalation payload', async () => {
    const errors = await validate(
      plainToInstance(EscalateIncidentDto, {
        escalatedTo: 'Platform SRE',
        reason: 'Require urgent production support',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects missing escalation fields', async () => {
    const errors = await validate(plainToInstance(EscalateIncidentDto, { escalatedTo: '' }));
    expect(errors.some((error) => error.property === 'escalatedTo')).toBe(true);
    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });
});
