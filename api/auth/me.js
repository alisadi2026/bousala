import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
function getClient() { return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }); }
export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });
  const supabase = getClient();
  const { data: sess } = await supabase.from('auth_sessions').select('user_id').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!sess) return res.status(401).json({ error: 'Invalid token' });
  const { data: p } = await supabase.from('profiles').select('id, email, username, full_name, is_super_admin').eq('id', sess.user_id).single();
  return res.status(200).json({ user: p });
}
