import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { importe } from '../lib/formato.js';

// Paleta validada (skill dataviz): azul para lo cobrado, naranja para la
// referencia esperada. Barras frente a línea: no dependen solo del color.
const AZUL = '#2a78d6';
const NARANJA = '#eb6834';
// Rampa ordinal de un solo tono para los rangos de mora (más oscuro = más mora).
const RAMPA_MORA = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const TINTA = '#27313a';
const TENUE = '#63717b';
const REJILLA = '#e9edf0';
const EJE = '#bcc6ce';

const ejeTexto = { fill: TENUE, fontSize: 11 };
const tooltipEstilo = {
  contentStyle: { border: `1px solid ${EJE}`, borderRadius: 4, fontSize: 12, color: TINTA },
  labelStyle: { color: TINTA, fontWeight: 600 },
  // El texto va en tinta; el color identifica solo a las marcas.
  itemStyle: { color: TINTA },
  cursor: { fill: '#435b6c14' },
};

const mesCorto = new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' });
function mes(periodo) {
  return mesCorto.format(new Date(`${periodo}-01T00:00:00Z`));
}

// Ejes en miles para que las etiquetas no se encimen.
const compacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

export function GraficaPagos({ datos }) {
  const filas = datos.map((p) => ({ periodo: mes(p.periodo), pagado: Number(p.monto), esperado: Number(p.esperado), pagos: p.pagos }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={filas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={REJILLA} />
        <XAxis dataKey="periodo" tick={ejeTexto} tickLine={false} axisLine={{ stroke: EJE }} />
        <YAxis tick={ejeTexto} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => compacto.format(v)} />
        <Tooltip
          {...tooltipEstilo}
          formatter={(valor, nombre) => [importe(valor), nombre]}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} formatter={(nombre) => <span style={{ color: TINTA }}>{nombre}</span>} />
        <Bar dataKey="pagado" name="Pagado" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line
          dataKey="esperado"
          name="Esperado (cuotas que vencían)"
          type="monotone"
          stroke={NARANJA}
          strokeWidth={2}
          dot={{ r: 4, fill: NARANJA, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const ESTADOS = [
  ['alCorriente', 'Al corriente'],
  ['atrasadas', 'Atrasadas'],
  ['cubiertas', 'Cubiertas sin liquidar'],
  ['liquidadas', 'Liquidadas'],
];

// Una sola serie: el nombre de cada barra va en el eje, no hace falta leyenda.
export function GraficaCartera({ totales }) {
  const filas = ESTADOS.map(([clave, nombre]) => ({ nombre, cuentas: totales[clave] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={filas} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap="25%">
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="nombre" tick={ejeTexto} tickLine={false} axisLine={false} width={130} />
        <Tooltip {...tooltipEstilo} formatter={(valor) => [`${valor} cuentas`, 'Cuentas']} />
        <Bar dataKey="cuentas" name="Cuentas" fill={AZUL} radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="cuentas" position="right" fill={TINTA} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const RANGOS = { sin_mora: 'Sin mora', '1-30': '1–30 días', '31-60': '31–60', '61-90': '61–90', '90+': 'Más de 90' };

export function GraficaMorosidad({ datos }) {
  const filas = datos.map((r) => ({ rango: RANGOS[r.rango] ?? r.rango, cuentas: r.cuentas, vencido: Number(r.montoVencido) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={filas} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={REJILLA} />
        <XAxis dataKey="rango" tick={ejeTexto} tickLine={false} axisLine={{ stroke: EJE }} />
        <YAxis tick={ejeTexto} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <Tooltip
          {...tooltipEstilo}
          formatter={(valor, nombre, item) => [`${valor} cuentas · vencido ${importe(item.payload.vencido)}`, 'Cuentas']}
        />
        <Bar dataKey="cuentas" name="Cuentas" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {filas.map((f, i) => (
            <Cell key={f.rango} fill={RAMPA_MORA[i] ?? RAMPA_MORA.at(-1)} />
          ))}
          <LabelList dataKey="cuentas" position="top" fill={TINTA} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
