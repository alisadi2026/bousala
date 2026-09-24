export async function portableLogin(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  localStorage.setItem('bousala_token', data.token);
  localStorage.setItem('bousala_user', JSON.stringify(data.user));
  return data.user;
}

export async function portableLogout() {
  const token = localStorage.getItem('bousala_token');
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  localStorage.removeItem('bousala_token');
  localStorage.removeItem('bousala_user');
}

export function getPortableUser() {
  try {
    return JSON.parse(localStorage.getItem('bousala_user') || 'null');
  } catch { return null; }
}

export function getPortableToken() {
  return localStorage.getItem('bousala_token');
}
