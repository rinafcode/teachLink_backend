import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('returns the expected greeting', () => {
      expect(service.getHello()).toBe('Hello World!');
    });

    it('returns the same greeting on repeated calls', () => {
      expect(service.getHello()).toBe(service.getHello());
    });
  });
});
