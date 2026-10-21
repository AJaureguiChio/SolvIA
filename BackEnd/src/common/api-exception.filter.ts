import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

type CuerpoError = {
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
};

const CODIGO_POR_ESTADO: Record<number, string> = {
  400: 'INVALID_INPUT',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'BUSINESS_RULE',
  429: 'RATE_LIMITED',
};

// Los triggers de la base lanzan RAISE EXCEPTION (SQLSTATE P0001) con
// mensajes en español pensados para el usuario; aqui se les asigna un codigo.
const REGLAS_TRIGGER: [RegExp, number, string][] = [
  [/excede el saldo/i, 422, 'SALDO_INSUFICIENTE'],
  [/fecha del (pago|movimiento)/i, 422, 'FECHA_FUERA_DE_RANGO'],
  [/gestor activo asignado/i, 403, 'FORBIDDEN'],
  [/Reasigne las cuentas/i, 409, 'USER_HAS_ACCOUNTS'],
  [/cuotas|plan de pago|acuerdo precede/i, 422, 'PLAN_INVALID'],
  [/responsable|asignacion/i, 422, 'INVALID_ASSIGNMENT'],
  [
    /saldo negativo|revertir|reembolso|movimientos de saldo/i,
    422,
    'MOVEMENT_INVALID',
  ],
  [/inmutable/i, 409, 'IMMUTABLE_RECORD'],
];

type ErrorPg = {
  code: string;
  message: string;
  constraint?: string;
  detail?: string;
};

function esErrorPg(error: unknown): error is ErrorPg {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ErrorPg).code === 'string' &&
    /^[0-9A-Z]{5}$/.test((error as ErrorPg).code)
  );
}

function traducirErrorPg(error: ErrorPg): CuerpoError | null {
  const details: Record<string, unknown> = error.constraint
    ? { constraint: error.constraint }
    : {};

  switch (error.code) {
    case 'P0001': {
      const regla = REGLAS_TRIGGER.find(([patron]) =>
        patron.test(error.message),
      );
      const [, status, code] = regla ?? [null, 422, 'BUSINESS_RULE'];
      return { status, code, message: error.message, details };
    }
    case '23505':
      return {
        status: 409,
        code: 'DUPLICATE_IDENTIFIER',
        message: 'Ya existe un registro con ese identificador',
        details,
      };
    case '23514':
      return {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Los datos no cumplen las reglas de formato',
        details,
      };
    case '23503':
      return {
        status: 422,
        code: 'INVALID_REFERENCE',
        message: 'El registro relacionado no existe',
        details,
      };
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
      return {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Formato de dato inválido',
        details,
      };
    default:
      return null;
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const cuerpo = this.convertir(exception);

    response.status(cuerpo.status).json({
      error: {
        code: cuerpo.code,
        message: cuerpo.message,
        details: cuerpo.details,
      },
    });
  }

  private convertir(exception: unknown): CuerpoError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const respuesta = exception.getResponse();
      const datos =
        typeof respuesta === 'object' && respuesta !== null
          ? (respuesta as Record<string, unknown>)
          : {};
      const mensaje = Array.isArray(datos.message)
        ? datos.message.join('; ')
        : typeof datos.message === 'string'
          ? datos.message
          : exception.message;

      return {
        status,
        code:
          typeof datos.code === 'string'
            ? datos.code
            : (CODIGO_POR_ESTADO[status] ?? 'ERROR'),
        message: mensaje,
        details:
          typeof datos.details === 'object' && datos.details !== null
            ? (datos.details as Record<string, unknown>)
            : {},
      };
    }

    if (esErrorPg(exception)) {
      const traducido = traducirErrorPg(exception);
      if (traducido) return traducido;
    }

    this.logger.error(exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      details: {},
    };
  }
}
