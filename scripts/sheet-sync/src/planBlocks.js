// Descubre dinamicamente los bloques de sesion (PUSH/PULL/LEG/TORSO...) dentro
// de una pestaña de mesociclo, en vez de asumir numeros de fila fijos: cada
// mesociclo tiene un numero de ejercicios distinto y las filas se desplazan.
function findBlocks(values) {
  const blocks = [];

  for (let i = 0; i < values.length - 1; i++) {
    const row = values[i] || [];
    const nextRow = values[i + 1] || [];
    const sesionIdx = row.indexOf('Sesión');
    const ordenIdx = nextRow.indexOf('Orden');
    if (sesionIdx === -1 || ordenIdx === -1) continue;

    const headerRow = row;
    const subHeaderRow = nextRow;
    const sessionType = (headerRow[sesionIdx + 1] || '').trim();
    const exerciseCol = subHeaderRow.indexOf('Ejercicio');
    const commentCol = subHeaderRow.indexOf('COMENTARIOS');
    if (exerciseCol === -1 || commentCol === -1 || !sessionType) continue;

    const sessionCols = [];
    subHeaderRow.forEach((cell, idx) => {
      const n = parseInt((cell || '').trim(), 10);
      if (!Number.isNaN(n) && String(n) === (cell || '').trim()) {
        sessionCols.push({ n, colIndex: idx });
      }
    });
    sessionCols.sort((a, b) => a.n - b.n);

    // Las filas de ejercicio empiezan tras la fila "Gym/Fecha/Hora" y siguen
    // mientras la columna Orden tenga un numero.
    let r = i + 2;
    while (r < values.length && !/^\d+$/.test(((values[r] || [])[ordenIdx] || '').trim())) {
      r++;
    }
    const exerciseRows = [];
    while (r < values.length && /^\d+$/.test(((values[r] || [])[ordenIdx] || '').trim())) {
      const exerciseName = ((values[r] || [])[exerciseCol] || '').trim();
      if (exerciseName) {
        exerciseRows.push({ sheetRow: r + 1, exerciseName });
      }
      r++;
    }

    blocks.push({ sessionType, exerciseCol, commentCol, sessionCols, exerciseRows });
  }

  return blocks;
}

module.exports = { findBlocks };
