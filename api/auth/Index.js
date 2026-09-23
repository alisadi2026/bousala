export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.json({ status: 'Bousala Auth API running', endpoints: ['/api/auth/login','/api/auth/register','/api/auth/me','/api/auth/logout'] });
}
