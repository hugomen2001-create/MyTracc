const supabase = require('./supabaseClient');
const config = require('./config');
const { getValues, batchUpdateValues } = require('./sheetsClient');
const { findBlocks } = require('./planBlocks');
const { colIndexToLetter } = require('./columns');
const { formatSessionExercise } = require('./formatSets');

// Compara nombres de ejercicio ignorando mayusculas/minusculas y espacios
// repetidos, para que una coma o doble espacio en la hoja no bloquee la
// sincronizacion de ese ejercicio.
function normalizeExerciseName(name) {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function fetchActiveMesocicloStartDate() {
  const { data, error } = await supabase
    .from('mesocycles')
    .select('start_date')
    .eq('client_id', config.clientId)
    .eq('is_active', true)
    .single();
  if (error) throw error;
  return data.start_date;
}

async function fetchSessionsByType(sessionType, sinceDate) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, session_date, workout_sets(exercise_name, set_number, reps_done, weight_kg), exercise_notes(exercise_name, note)')
    .eq('client_id', config.clientId)
    .eq('session_type', sessionType)
    .gte('session_date', sinceDate)
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

  // Solo sesiones del mesociclo activo: evita arrastrar el historial de
  // mesociclos anteriores cuando un ejercicio se repite de un mesociclo a otro.
  const mesoStartDate = await fetchActiveMesocicloStartDate();

  const writes = [];

  for (const block of blocks) {
    const sessions = await fetchSessionsByType(block.sessionType, mesoStartDate);

    for (const ex of block.exerciseRows) {
      const targetName = normalizeExerciseName(ex.exerciseName);
      const relevant = sessions.filter((s) => s.workout_sets.some((ws) => normalizeExerciseName(ws.exercise_name) === targetName));

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
        const sets = session.workout_sets.filter((ws) => normalizeExerciseName(ws.exercise_name) === targetName);
        const value = formatSessionExercise(sets);
        writes.push({ range: `'${tab}'!${colLetter}${ex.sheetRow}`, values: [[value]] });

        const note = session.exercise_notes.find((n) => normalizeExerciseName(n.exercise_name) === targetName);
        if (note) lastNote = note.note;
      });

      if (lastNote != null) {
        const currentComment = (values[ex.sheetRow - 1] || [])[block.commentCol];
        if (!currentComment) {
          const commentColLetter = colIndexToLetter(block.commentCol);
          writes.push({ range: `'${tab}'!${commentColLetter}${ex.sheetRow}`, values: [[lastNote]] });
        } else {
          console.warn(`[plan] Comentario de "${ex.exerciseName}" (${block.sessionType}) ya tiene texto, no se sobrescribe.`);
        }
      }
    }
  }

  await batchUpdateValues(config.spreadsheetIdPlan, writes);
  console.log(`[plan] ${writes.length} celdas actualizadas en "${tab}".`);
}

module.exports = { syncPlanSheet };
