import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState(localStorage.getItem("bousala_org"));
  const [allOrgs, setAllOrgs] = useState([]);
  const [orgName, setOrgName] = useState("");
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadProfileAndOrgs(session.user.id);
      }
      setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (e, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadProfileAndOrgs(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentOrgId && user) {
      localStorage.setItem("bousala_org", currentOrgId);
      fetchData(currentOrgId);
    }
  }, [currentOrgId, user]);

  const loadProfileAndOrgs = async (userId) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(prof);
    setIsSuperAdmin(!!prof?.is_super_admin);
    if (prof?.is_super_admin) {
      const { data: orgs } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      setAllOrgs(orgs || []);
      const orgId = currentOrgId || orgs?.[0]?.id;
      if (orgId) {
        setCurrentOrgId(orgId);
        setOrgName(orgs.find(o=>o.id===orgId)?.name || "");
        await fetchData(orgId);
      }
    } else {
      const { data: memberships } = await supabase.from('organization_members').select('organization_id, organizations!inner(id, name)').eq('user_id', userId);
      const orgs = (memberships||[]).map(m=>m.organizations);
      setAllOrgs(orgs);
      const orgId = currentOrgId || orgs?.[0]?.id;
      if (orgId) {
        setCurrentOrgId(orgId);
        setOrgName(orgs.find(o=>o.id===orgId)?.name || "");
        await fetchData(orgId);
      }
    }
  };

  const fetchData = async (orgId) => {
    if (!orgId) return;
    setLoading(true);
    const [e, c, sy, inst, inc, fix, g, fa] = await Promise.all([
      supabase.from('expense_entries').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('children').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('school_years').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('installments').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('income_sources').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('fixed_expenses').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('goals').select('id', { count: 'exact' }).eq('organization_id', orgId),
      supabase.from('fiscal_anchors').select('id', { count: 'exact' }).eq('organization_id', orgId),
    ]);
    setCounts({
      entries: e.count || 0,
      children: c.count || 0,
      years: sy.count || 0,
      installments: inst.count || 0,
      income: inc.count || 0,
      fixed: fix.count || 0,
      goals: g.count || 0,
      anchors: fa.count || 0,
    });
    setLoading(false);
  };

  const handleAuth = async () => {
    setAuthError("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({ id: data.user.id, username: email.split('@')[0], full_name: email.split('@')[0] });
          const { data: org } = await supabase.from('organizations').insert({ name: 'حسابي الشخصي', owner_id: data.user.id, created_by: data.user.id }).select().single();
          if (org) {
            await supabase.from('organization_members').insert({ organization_id: org.id, user_id: data.user.id, role: 'owner' });
            const { data: prog } = await supabase.from('programs').select('id').eq('slug','bousala').single();
            if (prog) await supabase.from('organization_subscriptions').insert({ organization_id: org.id, program_id: prog.id });
            setCurrentOrgId(org.id);
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("bousala_org");
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>جاري التحميل... V2</div>;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#12161F', color: '#EDE7D9' }}>
        <div style={{ background: '#1B2130', padding: 32, borderRadius: 16, width: 380 }}>
          <h2>بوصلة V2</h2>
          <p style={{ color: '#8B92A8', fontSize: 13 }}>Multi-Org + Super Admin</p>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{ width: '100%', padding: 12, borderRadius: 8, marginTop: 16 }} />
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" style={{ width: '100%', padding: 12, borderRadius: 8, marginTop: 10 }} />
          {authError && <div style={{ color: '#C1523B', fontSize: 12, marginTop: 10 }}>{authError}</div>}
          <button onClick={handleAuth} style={{ width: '100%', padding: 12, borderRadius: 8, background: '#C9A24B', color: '#12161F', fontWeight: 800, border: 'none', marginTop: 16 }}>{authMode === "login" ? "دخول" : "إنشاء حساب"}</button>
          <button onClick={()=>setAuthMode(authMode==="login"?"signup":"login")} style={{ width: '100%', background: 'transparent', color: '#8B92A8', border: 'none', marginTop: 10, fontSize: 12 }}>{authMode==="login" ? "إنشاء حساب" : "دخول"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#12161F', color: '#EDE7D9', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><h1>بوصلة V2 OK</h1><div>{orgName} - {user.email} {isSuperAdmin && " Super Admin"}</div></div>
          <button onClick={logout} style={{ padding: '8px 14px', borderRadius: 8 }}>خروج</button>
        </div>
        {isSuperAdmin && (
          <div style={{ background: '#1B2130', border: '1px solid #C9A24B', borderRadius: 12, padding: 16, marginTop: 20 }}>
            <div>Super Admin - كل المنظمات ({allOrgs.length})</div>
            <select value={currentOrgId||""} onChange={e=>setCurrentOrgId(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 10 }}>
              {allOrgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </div>
        )}
        {counts && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12 }}><div>مصاريف</div><div style={{ fontSize: 22, fontWeight: 900 }}>{counts.entries}</div></div>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12 }}><div>اولاد</div><div style={{ fontSize: 22, fontWeight: 900 }}>{counts.children}</div></div>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12 }}><div>سنوات</div><div style={{ fontSize: 22, fontWeight: 900 }}>{counts.years}</div></div>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12, border: '1px solid #3E9C7C' }}><div>اقساط</div><div style={{ fontSize: 22, fontWeight: 900, color: '#3E9C7C' }}>{counts.installments}</div></div>
          </div>
        )}
        <div style={{ marginTop: 20, padding: 16, background: '#1B2130', borderRadius: 12 }}>
          {counts ? `Migration ناجح: ${counts.entries} مصروف, ${counts.children} اولاد, ${counts.installments} قسط` : 'ما في داتا'}
          <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 6 }}>Org: {currentOrgId}</div>
        </div>
      </div>
    </div>
  );
}
