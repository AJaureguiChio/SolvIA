import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import { ReportesController } from './reportes.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { PanelModule } from '../panel/panel.module.js';

@Module({
  imports: [DatabaseModule, PanelModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
