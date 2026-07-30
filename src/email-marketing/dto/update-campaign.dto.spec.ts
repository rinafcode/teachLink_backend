import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateCampaignDto } from './update-campaign.dto';

describe('UpdateCampaignDto', () => {
  it('accepts a partial update payload', async () => {
    const dto = plainToInstance(UpdateCampaignDto, {
      name: 'Updated Campaign',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload', async () => {
    const dto = plainToInstance(UpdateCampaignDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-string name', async () => {
    const dto = plainToInstance(UpdateCampaignDto, {
      name: 123 as any,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects name exceeding max length', async () => {
    const dto = plainToInstance(UpdateCampaignDto, {
      name: 'x'.repeat(300),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects non-UUID templateId', async () => {
    const dto = plainToInstance(UpdateCampaignDto, {
      templateId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
