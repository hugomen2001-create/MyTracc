const { syncWeeklySheet } = require('./weeklySync');
const { syncPlanSheet } = require('./planSync');
const { applyMesoPlan } = require('./applyMesoPlan');
const fs = require('fs');
const path = require('path');

async function main() {
  // Cambio de mesociclo pendiente: plan-change.json = { "tab": "MESOCICLO 4", "apply": true }
  const changeFile = path.join(__dirname, '..', 'plan-change.json');
  if (fs.existsSync(changeFile)) {
    const change = JSON.parse(fs.readFileSync(changeFile, 'utf8'));
    const res = await applyMesoPlan(change);
    if (res.failures) process.exitCode = 1;
  }
  const weekly = await syncWeeklySheet();
  await syncPlanSheet();
  // Si falta alguna pestaña MES, la ejecucion acaba en error para que GitHub
  // avise por correo (lo demas ya se ha escrito).
  if (weekly && weekly.missingTabs.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
