
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhuoqsambeoedxumamli.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key);
}
export function signToken(user) {
  const secret = process.env.JWT_SECRET || 'bousala_dev_secret_change_me_32_chars_long_123';
  return jwt.sign({ id: user.id, email: user.email, is_super_admin: user.is_super_admin }, secret, { expiresIn: '30d' });
}
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'bousala_dev_secret_change_me_32_chars_long_123';
  return jwt.verify(token, secret);
}
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
