import { getSupabase, verifyToken, cors } from './_lib.js';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Server not configured' });
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = verifyToken(token);
    const { data: profile, error } = await supabase.from('profiles').select('id, email, username, full_name, is_super_admin').eq('id', decoded.id).single();
    if (error || !profile) return res.status(401).json({ error: 'User not found' });
    return res.json({ user: profile });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
