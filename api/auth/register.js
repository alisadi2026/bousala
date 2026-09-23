import { getSupabase, signToken, cors } from './_lib.js';
import bcrypt from 'bcryptjs';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Server not configured: SUPABASE_SERVICE_ROLE_KEY missing' });
  try {
    const { email, password, username, full_name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password min 8 chars' });
    const { data: exists } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (exists) return res.status(409).json({ error: 'Email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('profiles').insert({
      email: email.toLowerCase().trim(),
      username: username || email.split('@')[0],
      full_name: full_name || null,
      password_hash: hash,
      is_super_admin: false
    }).select('id, email, username, full_name, is_super_admin').single();
    if (error) throw error;
    const token = signToken(data);
    return res.status(201).json({ user: data, token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
