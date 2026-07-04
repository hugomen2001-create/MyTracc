// Reproduce el formato que Hugo ya usa a mano en el registro: "9x10/8x10/9x7,5"
// (reps x peso por serie, coma decimal, series separadas por "/").
function formatWeight(w) {
  if (w == null) return '';
  const n = Number(w);
  if (Number.isInteger(n)) return String(n);
  return n.toString().replace('.', ',');
}

function formatSessionExercise(sets) {
  return sets
    .slice()
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => `${s.reps_done ?? ''}x${formatWeight(s.weight_kg)}`)
    .join('/');
}

module.exports = { formatSessionExercise };
