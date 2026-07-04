const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_COLUMNS = ['C', 'D', 'E', 'F', 'G', 'H', 'I']; // LUNES..DOMINGO

// Cada bloque de semana ocupa 12 filas fijas dentro de una pestaña MES,
// empezando en la fila 3 (ver memoria del proyecto / mapeo manual del sheet).
const BLOCK_FIRST_ROW = 3;
const ROWS_PER_BLOCK = 12;
const ROW_OFFSET = {
  entrenamiento: 2,
  neatPasos: 3,
  pesoCorporal: 4,
  horasSueno: 5,
  comentarios: 7,
};

// Devuelve la ubicacion (pestaña MES, columna de dia, filas de cada metrica)
// para una fecha dada, o null si la fecha es anterior al ancla.
function locateDate(dateStr, anchorMonday) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const anchor = new Date(anchorMonday + 'T00:00:00Z');
  const days = Math.round((d - anchor) / MS_PER_DAY);
  if (days < 0) return null;

  const mesIndex = Math.floor(days / 28);
  const rem = days % 28;
  const semanaIndex = Math.floor(rem / 7);
  const dayIndex = rem % 7;

  const blockTitleRow = BLOCK_FIRST_ROW + ROWS_PER_BLOCK * semanaIndex;
  const col = DAY_COLUMNS[dayIndex];

  return {
    tab: `MES ${mesIndex + 1}`,
    col,
    rows: {
      entrenamiento: blockTitleRow + ROW_OFFSET.entrenamiento,
      neatPasos: blockTitleRow + ROW_OFFSET.neatPasos,
      pesoCorporal: blockTitleRow + ROW_OFFSET.pesoCorporal,
      horasSueno: blockTitleRow + ROW_OFFSET.horasSueno,
      comentarios: blockTitleRow + ROW_OFFSET.comentarios,
    },
  };
}

module.exports = { locateDate };
