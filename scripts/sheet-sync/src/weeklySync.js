const supabase = require('./supabaseClient');
const config = require('./config');
const { locateDate } = require('./weeklyDateMap');
const { getValues, batchUpdateValues } = require('./sheetsClient');
const { getSyncedValue, setSyncedValue } = require('./syncState');

function a1(tab, col, row) {
  return `'${tab}'!${col}${row}`;
}

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

  const writes = []; // {range, values: [[value]]}
  const commentCandidates = []; // {cellRef, range, value}

  for (const row of rows) {
    const loc = locateDate(row.date, config.anchorMonday);
    if (!loc) continue;

    if (row.activity != null) {
      writes.push({ range: a1(loc.tab, loc.col, loc.rows.entrenamiento), values: [[row.activity]] });
    }
    if (row.steps != null) {
      writes.push({ range: a1(loc.tab, loc.col, loc.rows.neatPasos), values: [[row.steps]] });
    }
    if (row.weight_kg != null) {
      writes.push({ range: a1(loc.tab, loc.col, loc.rows.pesoCorporal), values: [[row.weight_kg]] });
    }
    if (row.sleep_hours != null) {
      writes.push({ range: a1(loc.tab, loc.col, loc.rows.horasSueno), values: [[row.sleep_hours]] });
    }
    if (row.notes != null && row.notes !== '') {
      const range = a1(loc.tab, loc.col, loc.rows.comentarios);
      commentCandidates.push({ cellRef: `weekly:${loc.tab}:${loc.col}${loc.rows.comentarios}`, range, value: row.notes });
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
