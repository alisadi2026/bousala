// /api/auth/[...path].js - Fixed for Vercel - لا يعمل throw في البداية
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
  return jwt.sign(
    { id: user.id, email: user.email, is_super_admin: user.is_super_admin },
    secret,
    { expiresIn: '30d' }
  );
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
    return res.status(500).json({ 
      error: 'Server not configured',
      message: 'SUPABASE_SERVICE_ROLE_KEY missing in Vercel Env Vars. Go to Vercel > Settings > Environment Variables and add it.' 
    });
  }

  const { path } = req.query;
  const endpoint = (Array.isArray(path) ? path.join('/') : path || '').toLowerCase();

  try {
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

    if (endpoint === 'login' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      
      const { data: profile, error } = await supabase.from('profiles').select('*').ilike('email', email).single();
      
      if (error || !profile) return res.status(401).json({ error: 'Invalid email or password' });
      if (!profile.password_hash) return res.status(401).json({ error: 'Account needs password reset - contact admin' });

      const ok = await bcrypt.compare(password, profile.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

      await supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);

      const token = signToken(profile);
      try {
        await supabase.from('auth_sessions').insert({ user_id: profile.id, token, expires_at: new Date(Date.now()+30*24*60*60*1000).toISOString() });
      } catch(e) { /* ignore if table missing */ }

      const { password_hash, ...safe } = profile;
      return res.json({ user: safe, token });
    }

    if (endpoint === 'me' && req.method === 'GET') {
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

    if (endpoint === 'logout') {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (token) {
        try { await supabase.from('auth_sessions').delete().eq('token', token); } catch(e){}
      }
      return res.json({ success: true });
    }

    if (endpoint === 'change-password' && req.method === 'POST') {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token' });
      const decoded = verifyToken(token);
      const { current, next } = req.body;
      
      const { data: profile } = await supabase.from('profiles').select('password_hash').eq('id', decoded.id).single();
      if (!profile?.password_hash) return res.status(400).json({ error: 'No password set' });
      const ok = await bcrypt.compare(current, profile.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
      
      const newHash = await bcrypt.hash(next, 10);
      await supabase.from('profiles').update({ password_hash: newHash }).eq('id', decoded.id);
      return res.json({ success: true });
    }

    // For me endpoint without token, return friendly error not 500
    if (!endpoint) {
      return res.json({ status: 'Bousala Auth API running', endpoints: ['/api/auth/login', '/api/auth/me', '/api/auth/register'] });
    }

    return res.status(404).json({ error: 'Not found: ' + endpoint });
  } catch (e) {
    console.error('Auth API error:', e);
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0,500) });
  }
}
