import { getSupabase, cors } from './_lib.js';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  return res.json({ status: 'Bousala Auth API running', endpoints: ['/api/auth/login','/api/auth/register','/api/auth/me'] });
}
