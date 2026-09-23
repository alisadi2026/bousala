import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhuoqsambeoedxumamli.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key);
}
function signToken(user) {
  const secret = process.env.JWT_SECRET || 'bousala_dev_secret_change_me_32_chars_long_123';
  return jwt.sign({ id: user.id, email: user.email, is_super_admin: user.is_super_admin }, secret, { expiresIn: '30d' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Server not configured' });
  
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const { data: profile, error } = await supabase.from('profiles').select('*').ilike('email', email).single();
    if (error || !profile) return res.status(401).json({ error: 'Invalid email or password' });
    if (!profile.password_hash) return res.status(401).json({ error: 'Account needs password reset' });
    
    const ok = await bcrypt.compare(password, profile.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    
    await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);
    const token = signToken(profile);
    try { await supabase.from('auth_sessions').insert({ user_id: profile.id, token, expires_at: new Date(Date.now()+30*24*60*60*1000).toISOString() }); } catch(e){}
    const { password_hash, ...safe } = profile;
    return res.json({ user: safe, token });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: e.message });
  }
}
