import { createClient } from '@supabase/supabase-js';
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhuoqsambeoedxumamli.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key);
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const supabase = getSupabase();
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token && supabase) { try { await supabase.from('auth_sessions').delete().eq('token', token); } catch(e){} }
  return res.json({ success: true });
}
