import { Test, TestingModule } from '@nestjs/testing';
import { FacialController } from './facial.controller.js';
import { FacialService } from './facial.service.js';

describe('FacialController', () => {
  let controller: FacialController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FacialController],
      providers: [FacialService],
    }).compile();

    controller = module.get<FacialController>(FacialController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
