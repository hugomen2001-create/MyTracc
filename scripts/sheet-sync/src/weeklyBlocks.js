// Encuentra dinamicamente la fila real de cada bloque de semana (identificado
// por la etiqueta "ENTRENAMIENTO" en la columna B) dentro de una pestaña MES,
// en vez de asumir un espaciado fijo de filas entre bloques. El espaciado real
// no es uniforme (algunas pestañas tienen 12 filas entre el bloque 1 y el 2,
// pero solo 10 entre el 2-3 y el 3-4), y asumir 12 fijo causaba que el script
// escribiera en la fila equivocada para la tercera y cuarta semana.
function findWeekBlockRows(values) {
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const label = ((values[i] || [])[1] || '').toString().trim();
    if (label === 'ENTRENAMIENTO') rows.push(i + 1); // fila 1-indexed de la hoja
  }
  return rows;
}

module.exports = { findWeekBlockRows };
