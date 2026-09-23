// /api/auth/[...path].js - Fully Independent - بدون Supabase Auth
// كلشي بيعتمد على profiles.password_hash فقط

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-THIS-TO-32-CHARS-RANDOM-STRING!!!';

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for independent auth');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_super_admin: user.is_super_admin },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  const endpoint = (Array.isArray(path) ? path.join('/') : path || '').toLowerCase();

  try {
    // REGISTER
    if (endpoint === 'register' && req.method === 'POST') {
      const { email, password, username, full_name } = req.body;
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
    }

    // LOGIN - مستقل تماماً
    if (endpoint === 'login' && req.method === 'POST') {
      const { email, password } = req.body;
      const { data: profile, error } = await supabase.from('profiles').select('*').ilike('email', email).single();
      
      if (error || !profile) return res.status(401).json({ error: 'Invalid email or password' });
      if (!profile.password_hash) return res.status(401).json({ error: 'Account needs password reset - contact admin' });

      const ok = await bcrypt.compare(password, profile.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);

      const token = signToken(profile);
      await supabase.from('auth_sessions').insert({ user_id: profile.id, token, expires_at: new Date(Date.now()+30*24*60*60*1000).toISOString() });

      const { password_hash, ...safe } = profile;
      return res.json({ user: safe, token });
    }

    // ME
    if (endpoint === 'me' && req.method === 'GET') {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token' });
      try {
        const decoded = verifyToken(token);
        const { data: profile } = await supabase.from('profiles').select('id, email, username, full_name, is_super_admin').eq('id', decoded.id).single();
        if (!profile) return res.status(401).json({ error: 'User not found' });
        return res.json({ user: profile });
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // LOGOUT
    if (endpoint === 'logout') {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (token) await supabase.from('auth_sessions').delete().eq('token', token);
      return res.json({ success: true });
    }

    // CHANGE PASSWORD
    if (endpoint === 'change-password' && req.method === 'POST') {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      const decoded = verifyToken(token);
      const { current, next } = req.body;
      
      const { data: profile } = await supabase.from('profiles').select('password_hash').eq('id', decoded.id).single();
      const ok = await bcrypt.compare(current, profile.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
      
      const newHash = await bcrypt.hash(next, 10);
      await supabase.from('profiles').update({ password_hash: newHash }).eq('id', decoded.id);
      return res.json({ success: true });
    }

    // DATA API - كل الداتا بتمر من هون بدون RLS (service_role بيتجاوز RLS)
    // GET /api/auth/data?table=expense_entries&org_id=...
    if (endpoint === 'data' && req.method === 'GET') {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      const decoded = verifyToken(token);
      const { table, org_id } = req.query;
      
      // تحقق إن الـ user عضو في المنظمة
      if (org_id) {
        const { data: member } = await supabase.from('organization_members').select('id').eq('organization_id', org_id).eq('user_id', decoded.id).maybeSingle();
        if (!member && !decoded.is_super_admin) return res.status(403).json({ error: 'Not member of org' });
      }

      const { data, error } = await supabase.from(table).select('*').eq('organization_id', org_id);
      if (error) throw error;
      return res.json({ data });
    }

    return res.status(404).json({ error: 'Not found: ' + endpoint });
  } catch (e) {
    console.error('Auth API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
