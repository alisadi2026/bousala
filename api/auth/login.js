import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getClient() {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method!== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if (!email ||!password) return res.status(400).json({ error: 'Email and password required' });
  const supabase = getClient();
  const { data: profile } = await supabase.from('profiles').select('*').ilike('email', email.trim()).maybeSingle();
  if (!profile ||!profile.password_hash) return res.status(401).json({ error: 'Invalid email or password' });
  const isValid = await bcrypt.compare(password, profile.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid email or password' });
  const token = `tok_${profile.id}_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  const expiresAt = new Date(Date.now() + 30*24*60*60*1000).toISOString();
  await supabase.from('auth_sessions').insert({ user_id: profile.id, token, expires_at: expiresAt });
  await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);
  return res.status(200).json({ token, user: { id: profile.id, email: profile.email, username: profile.username, full_name: profile.full_name, is_super_admin: profile.is_super_admin } });
}
