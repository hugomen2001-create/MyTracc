const { syncWeeklySheet } = require('./weeklySync');
const { syncPlanSheet } = require('./planSync');

async function main() {
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
