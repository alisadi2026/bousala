import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
function getClient() { return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }); }

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim() || req.body?.token;
  if (!token) return res.status(200).json({ ok: true });
  const supabase = getClient();
  await supabase.from('auth_sessions').delete().eq('token', token);
  return res.status(200).json({ ok: true });
}
