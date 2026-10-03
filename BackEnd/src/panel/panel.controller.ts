import { Controller } from '@nestjs/common';
import { PanelService } from './panel.service.js';

@Controller('panel')
export class PanelController {
  constructor(private readonly panelService: PanelService) {}
}
