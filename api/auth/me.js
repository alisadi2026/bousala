import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhuoqsambeoedxumamli.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key);
}
function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'bousala_dev_secret_change_me_32_chars_long_123';
  return jwt.verify(token, secret);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = verifyToken(token);
    const { data: profile, error } = await supabase.from('profiles').select('id, email, username, full_name, is_super_admin').eq('id', decoded.id).single();
    if (error || !profile) return res.status(401).json({ error: 'User not found' });
    return res.json({ user: profile });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token', details: e.message });
  }
}
