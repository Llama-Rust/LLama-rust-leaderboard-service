import { getRconSnapshot } from './rcon/real';
// import { ConsoleStorage } from './storage/console';
import { SupabaseStorage } from './storage/supabase';

export async function pollOnce() {
  const snap = await getRconSnapshot();
  const store = new SupabaseStorage();  // swap to DB
  await store.writeSnapshot(snap);
  return snap;
}
