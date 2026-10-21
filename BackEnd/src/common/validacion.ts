import { PipeTransform, Injectable, ValidationError } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiError } from './api-error.js';

export const FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Importes como cadena decimal positiva con hasta dos decimales: "1250.50".
export const IMPORTE = /^(?!0+(\.0+)?$)\d{1,14}(\.\d{1,2})?$/;
export const ID = /^[1-9]\d{0,17}$/;
export const MENSAJE_FECHA = 'debe tener formato YYYY-MM-DD';
export const MENSAJE_IMPORTE =
  'debe ser un importe positivo con hasta dos decimales';

// Convierte "true"/"false" de la query string en booleanos.
export const ABooleano = () =>
  Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  );

export class PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export type Pagina<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

// Las consultas paginadas devuelven count(*) OVER () AS total en cada fila.
export function pagina<T extends { total?: number }>(
  filas: T[],
  { page, pageSize }: PaginacionDto,
): Pagina<Omit<T, 'total'>> {
  return {
    items: filas.map(({ total: _total, ...resto }) => resto),
    total: filas[0]?.total ?? 0,
    page,
    pageSize,
  };
}

export function desplazamiento({ page, pageSize }: PaginacionDto) {
  return (page - 1) * pageSize;
}

// Los IDs bigint viajan como cadena; un formato invalido es 400.
@Injectable()
export class IdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!ID.test(value)) {
      throw ApiError.entradaInvalida('Identificador inválido');
    }
    return value;
  }
}

export function errorDeValidacion(errores: ValidationError[]) {
  const details: Record<string, string[]> = {};
  const recorrer = (lista: ValidationError[], prefijo: string) => {
    for (const error of lista) {
      const ruta = prefijo ? `${prefijo}.${error.property}` : error.property;
      if (error.constraints) {
        details[ruta] = Object.values(error.constraints);
      }
      if (error.children?.length) recorrer(error.children, ruta);
    }
  };
  recorrer(errores, '');
  return ApiError.entradaInvalida('Datos de entrada inválidos', details);
}
