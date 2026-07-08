const supabase = require('./supabaseClient');
const config = require('./config');
const { locateDate } = require('./weeklyDateMap');
const { findWeekBlockRows } = require('./weeklyBlocks');
const { getValues, batchUpdateValues } = require('./sheetsClient');
const { getSyncedValue, setSyncedValue } = require('./syncState');

function a1(tab, col, row) {
  return `'${tab}'!${col}${row}`;
}

// Las columnas de dia (DAY_COLUMNS) son siempre una sola letra (C..I).
function colLetterToIndex(col) {
  return col.charCodeAt(0) - 65;
}

// Offset de fila respecto a la fila real de "ENTRENAMIENTO" del bloque
// (encontrada dinamicamente por findWeekBlockRows, no asumida).
const ROW_OFFSET = { entrenamiento: 0, neatPasos: 1, pesoCorporal: 2, horasSueno: 3, comentarios: 4 };

async function syncWeeklySheet() {
  const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: rows, error } = await supabase
    .from('daily_metrics')
    .select('date, steps, weight_kg, sleep_hours, activity, notes')
    .eq('client_id', config.clientId)
    .gte('date', since)
    .order('date', { ascending: true });
  if (error) throw error;

  const tabCache = {}; // tab -> { values, blockRows }
  async function getTabInfo(tab) {
    if (!tabCache[tab]) {
      const values = await getValues(config.spreadsheetIdWeekly, `'${tab}'!A1:L400`);
      tabCache[tab] = { values, blockRows: findWeekBlockRows(values) };
    }
    return tabCache[tab];
  }

  const candidates = []; // {tab, col, row, range, value}
  const commentCandidates = []; // {cellRef, range, value}

  for (const row of rows) {
    const loc = locateDate(row.date, config.anchorMonday);
    if (!loc) continue;

    const { blockRows } = await getTabInfo(loc.tab);
    const anchorRow = blockRows[loc.semanaIndex];
    if (!anchorRow) {
      console.warn(`[weekly] No se encontro el bloque de semana ${loc.semanaIndex + 1} en la pestaña "${loc.tab}" (fecha ${row.date}). Revisa la estructura de la hoja.`);
      continue;
    }

    const entrenamientoRow = anchorRow + ROW_OFFSET.entrenamiento;
    const neatRow = anchorRow + ROW_OFFSET.neatPasos;
    const pesoRow = anchorRow + ROW_OFFSET.pesoCorporal;
    const horasRow = anchorRow + ROW_OFFSET.horasSueno;
    const comentariosRow = anchorRow + ROW_OFFSET.comentarios;

    if (row.activity != null) {
      candidates.push({ tab: loc.tab, col: loc.col, row: entrenamientoRow, range: a1(loc.tab, loc.col, entrenamientoRow), value: row.activity });
    }
    if (row.steps != null) {
      candidates.push({ tab: loc.tab, col: loc.col, row: neatRow, range: a1(loc.tab, loc.col, neatRow), value: row.steps });
    }
    if (row.weight_kg != null) {
      candidates.push({ tab: loc.tab, col: loc.col, row: pesoRow, range: a1(loc.tab, loc.col, pesoRow), value: row.weight_kg });
    }
    if (row.sleep_hours != null) {
      candidates.push({ tab: loc.tab, col: loc.col, row: horasRow, range: a1(loc.tab, loc.col, horasRow), value: row.sleep_hours });
    }
    if (row.notes != null && row.notes !== '') {
      const range = a1(loc.tab, loc.col, comentariosRow);
      commentCandidates.push({ cellRef: `weekly:${loc.tab}:${loc.col}${comentariosRow}`, range, value: row.notes });
    }
  }

  // Nunca tocar una celda que ya tiene algo escrito (a mano o de una sincronizacion
  // anterior): solo se rellenan celdas que estan vacias.
  const writes = [];
  for (const c of candidates) {
    const { values } = await getTabInfo(c.tab);
    const currentValue = ((values[c.row - 1] || [])[colLetterToIndex(c.col)] || '').toString().trim();
    if (!currentValue) {
      writes.push({ range: c.range, values: [[c.value]] });
    } else {
      console.warn(`[weekly] ${c.range} ya tiene un valor ("${currentValue}"), no se sobrescribe.`);
    }
  }

  // Los comentarios son zona compartida con el coach: solo se sobrescriben si
  // la celda sigue igual a lo ultimo que escribimos nosotros (o esta vacia).
  for (const c of commentCandidates) {
    const [currentValue] = await getValues(config.spreadsheetIdWeekly, c.range).then((v) => (v[0] ? v[0] : ['']));
    const lastSynced = await getSyncedValue(c.cellRef);
    const currentIsOurs = !currentValue || currentValue === lastSynced;
    if (currentIsOurs) {
      writes.push({ range: c.range, values: [[c.value]] });
      await setSyncedValue(c.cellRef, c.value);
    } else {
      console.warn(`[weekly] Comentario del ${c.cellRef} tiene texto manual distinto, no se sobrescribe.`);
    }
  }

  await batchUpdateValues(config.spreadsheetIdWeekly, writes);
  console.log(`[weekly] ${writes.length} celdas actualizadas.`);
}

module.exports = { syncWeeklySheet };
