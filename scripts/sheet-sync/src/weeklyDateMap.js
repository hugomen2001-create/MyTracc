const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_COLUMNS = ['C', 'D', 'E', 'F', 'G', 'H', 'I']; // LUNES..DOMINGO

// Devuelve la pestaña MES, el indice de semana (0-3) dentro del mes y la
// columna de dia para una fecha dada, o null si la fecha es anterior al ancla.
// No calcula filas: la fila real de cada bloque de semana varia entre bloques
// (ver weeklyBlocks.js), asi que eso se resuelve escaneando la hoja, no con
// aritmetica fija.
function locateDate(dateStr, anchorMonday) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const anchor = new Date(anchorMonday + 'T00:00:00Z');
  const days = Math.round((d - anchor) / MS_PER_DAY);
  if (days < 0) return null;

  const mesIndex = Math.floor(days / 28);
  const rem = days % 28;
  const semanaIndex = Math.floor(rem / 7);
  const dayIndex = rem % 7;

  return {
    tab: `MES ${mesIndex + 1}`,
    semanaIndex,
    col: DAY_COLUMNS[dayIndex],
  };
}

module.exports = { locateDate };
