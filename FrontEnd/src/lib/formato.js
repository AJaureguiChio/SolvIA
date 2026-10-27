// La API envía importes como cadena ("1250.50") y fechas como YYYY-MM-DD.
const ZONA = 'America/Mexico_City';

const moneda = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function importe(valor, codigo = 'MXN') {
  if (valor == null || valor === '') return '—';
  const texto = moneda.format(Number(valor));
  return codigo ? `${codigo} ${texto}` : texto;
}

const fechaCorta = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function fecha(valor) {
  if (!valor) return '—';
  return fechaCorta.format(new Date(`${valor.slice(0, 10)}T00:00:00Z`));
}

const instante = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: ZONA,
});

export function fechaHora(valor) {
  return valor ? instante.format(new Date(valor)) : '—';
}

// "Hoy" para el backend es la fecha en America/Mexico_City, no la UTC.
export function hoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
}

export const ESTADO_PLAN = {
  al_corriente: 'Al corriente',
  atrasado: 'Atrasado',
  cubierto: 'Cubierto',
};

export const ESTADO_CUOTA = {
  pagada: 'Pagada',
  vencida: 'Vencida',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
};

export const TIPO_MOVIMIENTO = {
  interes: 'Interés',
  recargo: 'Recargo',
  reembolso: 'Reembolso',
  reversion_pago: 'Reversión de pago',
  ajuste_cargo: 'Ajuste de cargo',
  descuento: 'Descuento',
  condonacion: 'Condonación',
  ajuste_abono: 'Ajuste de abono',
};

export function nombreUsuario(usuario) {
  if (!usuario) return 'Sin asignar';
  return usuario.nombre || usuario.email;
}
