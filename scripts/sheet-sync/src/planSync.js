const supabase = require('./supabaseClient');
const config = require('./config');
const { getValues, batchUpdateValues } = require('./sheetsClient');
const { findBlocks } = require('./planBlocks');
const { colIndexToLetter } = require('./columns');
const { formatSessionExercise } = require('./formatSets');

async function fetchSessionsByType(sessionType) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, session_date, workout_sets(exercise_name, set_number, reps_done, weight_kg), exercise_notes(exercise_name, note)')
    .eq('client_id', config.clientId)
    .eq('session_type', sessionType)
    .order('session_date', { ascending: true });
  if (error) throw error;
  return data;
}

async function syncPlanSheet() {
  const tab = config.activeMesocicloTab;
  const values = await getValues(config.spreadsheetIdPlan, `'${tab}'!A1:Z300`);
  const blocks = findBlocks(values);

  if (blocks.length === 0) {
    console.warn(`[plan] No se encontro ningun bloque de sesion en la pestaña "${tab}". Revisa ACTIVE_MESOCICLO_TAB.`);
    return;
  }

  const writes = [];

  for (const block of blocks) {
    const sessions = await fetchSessionsByType(block.sessionType);

    for (const ex of block.exerciseRows) {
      const relevant = sessions.filter((s) => s.workout_sets.some((ws) => ws.exercise_name === ex.exerciseName));

      let lastFilledIdx = 0;
      for (let n = block.sessionCols.length; n >= 1; n--) {
        const colIndex = block.sessionCols[n - 1].colIndex;
        const cell = (values[ex.sheetRow - 1] || [])[colIndex];
        if (cell) {
          lastFilledIdx = n;
          break;
        }
      }

      const newOnes = relevant.slice(lastFilledIdx);
      let lastNote = null;

      newOnes.forEach((session, p) => {
        const targetIdx = lastFilledIdx + p;
        if (targetIdx >= block.sessionCols.length) {
          console.warn(
            `[plan] "${ex.exerciseName}" (${block.sessionType}) tiene más sesiones nuevas que columnas disponibles. Añade columnas o crea el siguiente mesociclo.`
          );
          return;
        }
        const colLetter = colIndexToLetter(block.sessionCols[targetIdx].colIndex);
        const sets = session.workout_sets.filter((ws) => ws.exercise_name === ex.exerciseName);
        const value = formatSessionExercise(sets);
        writes.push({ range: `'${tab}'!${colLetter}${ex.sheetRow}`, values: [[value]] });

        const note = session.exercise_notes.find((n) => n.exercise_name === ex.exerciseName);
        if (note) lastNote = note.note;
      });

      if (lastNote != null) {
        const commentColLetter = colIndexToLetter(block.commentCol);
        writes.push({ range: `'${tab}'!${commentColLetter}${ex.sheetRow}`, values: [[lastNote]] });
      }
    }
  }

  await batchUpdateValues(config.spreadsheetIdPlan, writes);
  console.log(`[plan] ${writes.length} celdas actualizadas en "${tab}".`);
}

module.exports = { syncPlanSheet };
