import { Module } from '@nestjs/common';
import { PanelService } from './panel.service.js';
import { PanelController } from './panel.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PanelController],
  providers: [PanelService],
})
export class PanelModule {}
