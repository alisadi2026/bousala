import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getClient() {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 chars' });
  
  const supabase = getClient();
  const lowerEmail = email.trim().toLowerCase();
  
  const { data: existing } = await supabase.from('profiles').select('id').ilike('email', lowerEmail).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  
  const hash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();
  
  const { error } = await supabase.from('profiles').insert({
    id: userId,
    email: lowerEmail,
    username: lowerEmail.split('@')[0],
    full_name: lowerEmail.split('@')[0],
    password_hash: hash,
    is_super_admin: false
  });
  
  if (error) return res.status(500).json({ error: error.message });
  
  const { data: org } = await supabase.from('organizations').insert({ name: 'حسابي الشخصي', owner_id: userId, created_by: userId }).select().single();
  if (org) {
    await supabase.from('organization_members').insert({ organization_id: org.id, user_id: userId, role: 'owner' });
    const { data: prog } = await supabase.from('programs').select('id').eq('slug','bousala').single();
    if (prog) await supabase.from('organization_subscriptions').insert({ organization_id: org.id, program_id: prog.id });
  }
  
  const token = `tok_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  const expiresAt = new Date(Date.now() + 30*24*60*60*1000).toISOString();
  await supabase.from('auth_sessions').insert({ user_id: userId, token, expires_at: expiresAt });
  
  return res.status(200).json({
    token,
    user: { id: userId, email: lowerEmail, username: lowerEmail.split('@')[0], is_super_admin: false }
  });
}
