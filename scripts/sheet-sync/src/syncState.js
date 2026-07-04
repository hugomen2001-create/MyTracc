const supabase = require('./supabaseClient');
const config = require('./config');

async function getSyncedValue(cellRef) {
  const { data, error } = await supabase
    .from('sheet_sync_state')
    .select('last_value')
    .eq('client_id', config.clientId)
    .eq('cell_ref', cellRef)
    .maybeSingle();
  if (error) throw error;
  return data ? data.last_value : null;
}

async function setSyncedValue(cellRef, value) {
  const { error } = await supabase.from('sheet_sync_state').upsert(
    {
      client_id: config.clientId,
      cell_ref: cellRef,
      last_value: value,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,cell_ref' }
  );
  if (error) throw error;
}

module.exports = { getSyncedValue, setSyncedValue };
