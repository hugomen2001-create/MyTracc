const { syncWeeklySheet } = require('./weeklySync');
const { syncPlanSheet } = require('./planSync');

async function main() {
  await syncWeeklySheet();
  await syncPlanSheet();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
