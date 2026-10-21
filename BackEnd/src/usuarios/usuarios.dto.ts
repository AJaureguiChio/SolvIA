import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ABooleano } from '../common/validacion.js';

const ROLES = ['administrador', 'gestor'] as const;

export class ListarUsuariosDto {
  @IsOptional()
  @IsIn(ROLES)
  rol?: (typeof ROLES)[number];

  @IsOptional()
  @ABooleano()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsIn(ROLES)
  rol?: (typeof ROLES)[number];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
