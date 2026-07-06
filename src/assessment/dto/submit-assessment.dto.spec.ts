import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubmitAssessmentDto } from './submit-assessment.dto';

describe('SubmitAssessmentDto', () => {
  it('accepts a valid answers payload', async () => {
    const errors = await validate(
      plainToInstance(SubmitAssessmentDto, {
        answers: [{ questionId: 'question-1', answer: 'A' }],
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects missing answers array', async () => {
    const errors = await validate(plainToInstance(SubmitAssessmentDto, {}));
    expect(errors.some((error) => error.property === 'answers')).toBe(true);
  });

  it('rejects invalid answer entries', async () => {
    const errors = await validate(
      plainToInstance(SubmitAssessmentDto, {
        answers: [{ questionId: '', answer: null }],
      }),
    );
    expect(errors).toHaveLength(1);
    const itemChildren = errors[0].children?.[0]?.children ?? [];
    expect(itemChildren.some((child) => child.property === 'questionId')).toBe(true);
  });
});
