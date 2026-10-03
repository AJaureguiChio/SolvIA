import { Test, TestingModule } from '@nestjs/testing';
import { FacialService } from './facial.service.js';

describe('FacialService', () => {
  let service: FacialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FacialService],
    }).compile();

    service = module.get<FacialService>(FacialService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
