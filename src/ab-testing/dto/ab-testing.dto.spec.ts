import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  AutoSelectWinnerDto,
  CreateExperimentDto,
  DashboardFiltersDto,
  UpdateExperimentDto,
  UpdateTrafficAllocationDto,
} from '.';
import { ExperimentStatus, ExperimentType } from '../entities/experiment.entity';

describe('A/B Testing DTOs', () => {
  it('accepts a valid create experiment payload', async () => {
    const dto = plainToInstance(CreateExperimentDto, {
      name: 'Homepage CTA test',
      description: 'Test two CTA variants',
      type: ExperimentType.A_B_TEST,
      startDate: '2025-01-01T00:00:00.000Z',
      trafficAllocation: 50,
      autoAllocateTraffic: false,
      confidenceLevel: 95,
      minimumSampleSize: 1000,
      hypothesis: 'Variant A increases conversions',
      variants: [
        {
          name: 'Control',
          description: 'Existing version',
          configuration: { color: 'blue' },
          isControl: true,
        },
        {
          name: 'Variant A',
          description: 'New button copy',
          configuration: { color: 'green' },
          isControl: false,
        },
      ],
      metrics: [
        {
          name: 'click_rate',
          description: 'Click rate for CTA',
          type: 'conversion',
          isPrimary: true,
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects create experiment with invalid variant data', async () => {
    const dto = plainToInstance(CreateExperimentDto, {
      name: 'Homepage CTA test',
      description: 'Test invalid variant',
      type: ExperimentType.A_B_TEST,
      startDate: '2025-01-01T00:00:00.000Z',
      trafficAllocation: 50,
      autoAllocateTraffic: false,
      confidenceLevel: 95,
      minimumSampleSize: 1000,
      hypothesis: 'Variant A increases conversions',
      variants: [{ name: '', description: '', configuration: 'not-an-object', isControl: true }],
      metrics: [],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects update experiment with invalid fields', async () => {
    const dto = plainToInstance(UpdateExperimentDto, {
      trafficAllocation: 'not-a-number',
      confidenceLevel: 'high',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid update traffic allocation payload', async () => {
    const dto = plainToInstance(UpdateTrafficAllocationDto, {
      allocations: { 'variant-1': 60, 'variant-2': 40 },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid traffic allocation payload', async () => {
    const dto = plainToInstance(UpdateTrafficAllocationDto, {
      allocations: [],
    });
    expect((await validate(dto)).some((error) => error.property === 'allocations')).toBe(true);
  });

  it('validates auto-select winner payload', async () => {
    const validDto = plainToInstance(AutoSelectWinnerDto, {
      minimumVotes: 200,
      minimumDurationDays: 5,
    });
    expect(await validate(validDto)).toHaveLength(0);

    const invalidDto = plainToInstance(AutoSelectWinnerDto, {
      minimumVotes: 0,
      minimumDurationDays: -1,
    });
    expect((await validate(invalidDto)).length).toBeGreaterThan(0);
  });

  it('validates dashboard filters payload', async () => {
    const dto = plainToInstance(DashboardFiltersDto, {
      status: ExperimentStatus.RUNNING,
      type: ExperimentType.A_B_TEST,
      startDate: '2025-01-01',
      endDate: '2025-01-15',
      includeArchived: true,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
