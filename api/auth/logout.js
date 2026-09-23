import { getSupabase, cors } from './_lib.js';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const supabase = getSupabase();
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token && supabase) { try { await supabase.from('auth_sessions').delete().eq('token', token); } catch(e){} }
  return res.json({ success: true });
}
