function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

module.exports = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  clientId: required('CLIENT_ID'),
  googleServiceAccountJsonB64: required('GOOGLE_SERVICE_ACCOUNT_JSON_B64'),
  spreadsheetIdWeekly: required('SPREADSHEET_ID_WEEKLY'),
  spreadsheetIdPlan: required('SPREADSHEET_ID_PLAN'),
  // Lunes de la PRIMERA SEMANA del MES 1 en "REGISTRO SEMANAL NUEVO".
  // Verificado contra datos reales: peso 70kg el 2026-01-05 (lunes) y 68.8kg el
  // 2026-01-08 (jueves) coinciden exactamente con lo ya escrito a mano en MES 1.
  anchorMonday: process.env.ANCHOR_MONDAY || '2026-01-05',
  // Pestaña activa del plan de entrenamiento. Actualizar cuando el coach cambie
  // de mesociclo (ver README de este directorio).
  activeMesocicloTab: process.env.ACTIVE_MESOCICLO_TAB || 'MESOCICLO 2',
  // Cuantos dias hacia atras revisar en cada ejecucion (cubre el caso de que
  // el script no se ejecute una noche, o de subida tardia de datos).
  lookbackDays: parseInt(process.env.LOOKBACK_DAYS || '40', 10),
};
