import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
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

// Alta de identidad en Neon Auth + perfil. Si el correo ya tiene identidad
// sin perfil, solo se crea el perfil y la contrasena se ignora.
export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsEmail({}, { message: 'email inválido' })
  @MaxLength(256)
  email: string;

  // Temporal: el usuario la usa en su primer acceso. Neon Auth exige 8 o mas.
  @IsString()
  @MinLength(8, { message: 'password debe tener al menos 8 caracteres' })
  @MaxLength(128)
  password: string;

  @IsIn(ROLES)
  rol: (typeof ROLES)[number];
}
