import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateAssessmentDto } from './update-assessment.dto';

describe('UpdateAssessmentDto', () => {
  it('accepts a partial update payload', async () => {
    const dto = plainToInstance(UpdateAssessmentDto, {
      title: 'Updated Quiz',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload (all optional via PartialType)', async () => {
    const dto = plainToInstance(UpdateAssessmentDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid maxScore (out of range)', async () => {
    const dto = plainToInstance(UpdateAssessmentDto, {
      maxScore: 9999,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'maxScore')).toBe(true);
  });

  it('rejects invalid assessment type', async () => {
    const dto = plainToInstance(UpdateAssessmentDto, {
      type: 'invalid-type',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects non-numeric timeLimitMinutes', async () => {
    const dto = plainToInstance(UpdateAssessmentDto, {
      timeLimitMinutes: 'not-a-number',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'timeLimitMinutes')).toBe(true);
  });
});
