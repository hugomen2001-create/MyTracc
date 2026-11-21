// Carga en la app (client_plans) el plan de una pestaña MESOCICLO del coach.
// - Sesiones cuyo listado de ejercicios cambia: archiva sus filas activas
//   (is_active=false, no se borra nada) e inserta las nuevas.
// - Sesiones con los mismos ejercicios: solo actualiza series/reps/descanso
//   si han cambiado.
// Sin APPLY=true solo enseña lo que haria.
const supabase = require('./supabaseClient');
const config = require('./config');
const { getValues } = require('./sheetsClient');
const { findBlocks } = require('./planBlocks');


const clean = (s) => (s || '').trim().replace(/\s+/g, ' ');
const norm = (s) => clean(s).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').toLowerCase();

function restSec(text) {
  const m = (text || '').match(/(\d+(?:[.,]\d+)?)\s*'/);
  return m ? Math.round(parseFloat(m[1].replace(',', '.')) * 60) : null;
}

function parseSheet(values) {
  return findBlocks(values).map((b) => {
    const first = b.exerciseRows[0].sheetRow - 1;
    let header = null;
    for (let r = first - 1; r >= Math.max(0, first - 4); r--) {
      if ((values[r] || []).includes('Repeticiones')) { header = values[r]; break; }
    }
    const col = (names) => header ? header.findIndex((c) => names.includes(clean(c))) : -1;
    const cSeries = col(['Series']);
    const cReps = col(['Repeticiones']);
    const cRest = col(['Descanso recomendado']);
    const cLink = col(['Enlace', 'Enlaces']);
    const exercises = b.exerciseRows.map((ex, i) => {
      const row = values[ex.sheetRow - 1] || [];
      return {
        order: i + 1,
        name: clean(ex.exerciseName),
        sets: parseInt(row[cSeries], 10) || null,
        reps: clean(row[cReps]) || null,
        rest_sec: restSec(row[cRest]),
        video_url: /^https?:\/\//.test(clean(row[cLink])) ? clean(row[cLink]) : null,
      };
    });
    return { sessionType: b.sessionType, exercises };
  });
}

const sessionKey = (s) => s.toUpperCase().replace(/\s+/g, ' ').trim();

async function applyMesoPlan({ tab: TAB, apply: APPLY }) {
  console.log(`[meso] Pestaña "${TAB}" — ${APPLY ? 'APLICANDO' : 'SOLO PRUEBA (APPLY!=true)'}`);
  const values = await getValues(config.spreadsheetIdPlan, `'${TAB}'!A1:Z300`);
  const blocks = parseSheet(values);
  if (!blocks.length) throw new Error('No hay bloques en la pestaña');

  const { data: plans, error } = await supabase
    .from('client_plans')
    .select('*, exercises(id, name, video_url, default_rest_sec)')
    .eq('client_id', config.clientId)
    .eq('is_active', true)
    .order('exercise_order');
  if (error) throw error;

  const { data: allEx, error: e2 } = await supabase.from('exercises').select('*');
  if (e2) throw e2;
  console.log(`[meso] Columnas de exercises: ${Object.keys(allEx[0] || {}).join(', ')}`);
  console.log(`[meso] Columnas de client_plans: ${Object.keys(plans[0] || {}).join(', ')}`);
  const exByName = new Map(allEx.map((e) => [norm(e.name), e]));

  const appTypes = [...new Set(plans.map((p) => p.session_type))];
  let failures = 0;

  for (const block of blocks) {
    const type = appTypes.find((t) => sessionKey(t) === sessionKey(block.sessionType));
    if (!type) { console.log(`[meso] AVISO: la sesión "${block.sessionType}" no existe en la app, se salta`); failures++; continue; }
    const current = plans.filter((p) => p.session_type === type).sort((a, b) => a.exercise_order - b.exercise_order);
    const sameList = current.length === block.exercises.length &&
      current.every((p, i) => p.exercises && norm(p.exercises.name) === norm(block.exercises[i].name));

    console.log(`\n[meso] ${type}: ${sameList ? 'mismos ejercicios' : 'CAMBIA'}`);
    console.log('  antes: ' + current.map((p) => `${p.exercise_order}.${p.exercises && p.exercises.name} (${p.sets}|${p.reps}|${p.rest_sec})`).join(' · '));
    console.log('  ahora: ' + block.exercises.map((e) => `${e.order}.${e.name} (${e.sets}|${e.reps}|${e.rest_sec})${e.video_url ? '' : ' [sin vídeo]'}`).join(' · '));

    if (sameList) {
      for (let i = 0; i < current.length; i++) {
        const p = current[i];
        const e = block.exercises[i];
        const patch = {};
        if (e.sets && e.sets !== p.sets) patch.sets = e.sets;
        if (e.reps && e.reps !== p.reps) patch.reps = e.reps;
        if (e.rest_sec && e.rest_sec !== p.rest_sec) patch.rest_sec = e.rest_sec;
        if (!Object.keys(patch).length) continue;
        console.log(`  actualiza ${e.name}: ${JSON.stringify(patch)}`);
        if (APPLY) {
          const { error: ue } = await supabase.from('client_plans').update(patch).eq('id', p.id);
          if (ue) { console.log('  ERROR ' + ue.message); failures++; }
        }
      }
      continue;
    }

    // Ejercicios nuevos en la tabla exercises
    const ids = [];
    for (const e of block.exercises) {
      let ex = exByName.get(norm(e.name));
      if (!ex) {
        const row = { name: e.name, video_url: e.video_url, default_rest_sec: e.rest_sec || 120 };
        console.log(`  ejercicio nuevo: ${e.name}`);
        if (APPLY) {
          const { data: ins, error: ie } = await supabase.from('exercises').insert(row).select().single();
          if (ie) throw new Error(`No se pudo crear el ejercicio "${e.name}": ${ie.message}`);
          ex = ins;
          exByName.set(norm(e.name), ex);
        } else {
          ex = { id: '(nuevo)' };
        }
      } else if (!ex.video_url && e.video_url && APPLY) {
        await supabase.from('exercises').update({ video_url: e.video_url }).eq('id', ex.id);
      }
      ids.push(ex.id);
    }

    const template = { ...current[0] };
    delete template.id; delete template.created_at; delete template.updated_at; delete template.exercises;
    const rows = block.exercises.map((e, i) => ({
      ...template,
      session_type: type,
      exercise_order: e.order,
      exercise_id: ids[i],
      sets: e.sets || 3,
      reps: e.reps,
      rest_sec: e.rest_sec || 120,
      is_active: true,
    }));

    if (APPLY) {
      const { data: inserted, error: ie } = await supabase.from('client_plans').insert(rows).select('id');
      if (ie) throw new Error(`No se pudo insertar el plan de ${type}: ${ie.message}`);
      const { error: ae } = await supabase.from('client_plans').update({ is_active: false }).in('id', current.map((p) => p.id));
      if (ae) {
        // deshacer para no dejar la sesion duplicada
        await supabase.from('client_plans').delete().in('id', inserted.map((r) => r.id));
        throw new Error(`No se pudo archivar el plan anterior de ${type}: ${ae.message}`);
      }
      console.log(`  OK: ${inserted.length} filas nuevas, ${current.length} archivadas`);
    }
  }

  // Comprobacion final contra la hoja
  if (APPLY) {
    const { data: after, error: fe } = await supabase
      .from('client_plans').select('session_type, exercise_order, sets, reps, exercises(name)')
      .eq('client_id', config.clientId).eq('is_active', true).order('exercise_order');
    if (fe) throw fe;
    for (const block of blocks) {
      const type = appTypes.find((t) => sessionKey(t) === sessionKey(block.sessionType));
      if (!type) continue;
      const got = after.filter((p) => p.session_type === type).map((p) => norm(p.exercises && p.exercises.name));
      const want = block.exercises.map((e) => norm(e.name));
      const ok = JSON.stringify(got) === JSON.stringify(want);
      console.log(`[comprobación] ${type}: ${ok ? 'OK' : 'NO CUADRA'} (${got.length} ejercicios)`);
      if (!ok) failures++;
    }
  }
  return { failures };
}

module.exports = { applyMesoPlan };
