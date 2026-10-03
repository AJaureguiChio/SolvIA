import { Controller } from '@nestjs/common';
import { DeudoresService } from './deudores.service.js';

@Controller('deudores')
export class DeudoresController {
  constructor(private readonly deudoresService: DeudoresService) {}
}
