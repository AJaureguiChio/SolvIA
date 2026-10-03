import { Controller } from '@nestjs/common';
import { FacialService } from './facial.service.js';

@Controller('facial')
export class FacialController {
  constructor(private readonly facialService: FacialService) {}
}
