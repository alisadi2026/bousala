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
  const [entries, setEntries] = useState([]);
  const [children, setChildren] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [debug, setDebug] = useState("");
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
    setDebug("Loading profile...");
    const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profErr) setDebug(`Profile error: ${profErr.message}`);
    setProfile(prof);
    setIsSuperAdmin(!!prof?.is_super_admin);
    
    // FIX: No RLS filter, get all orgs
    const { data: orgs, error: orgErr } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    if (orgErr) setDebug(`Orgs error: ${orgErr.message}`);
    setAllOrgs(orgs || []);
    
    let targetOrg = currentOrgId;
    if (!targetOrg) {
      // Try to get from membership
      const { data: mem } = await supabase.from('organization_members').select('organization_id').eq('user_id', userId).limit(1).maybeSingle();
      targetOrg = mem?.organization_id || orgs?.[0]?.id;
    }
    
    if (targetOrg) {
      setCurrentOrgId(targetOrg);
      localStorage.setItem("bousala_org", targetOrg);
      const found = orgs?.find(o=>o.id===targetOrg);
      setOrgName(found?.name || targetOrg.slice(0,8));
      await fetchData(targetOrg);
    } else {
      setDebug("No org found");
    }
  };

  const fetchData = async (orgId) => {
    if (!orgId) return;
    setLoading(true);
    setDebug(`Fetching data for org: ${orgId}`);
    
    // FIX: Remove deleted_at filter that causes 0 results
    const { data: eData, error: eErr } = await supabase.from('expense_entries').select('*').eq('organization_id', orgId);
    const { data: cData, error: cErr } = await supabase.from('children').select('*').eq('organization_id', orgId);
    const { data: syData, error: syErr } = await supabase.from('school_years').select('*').eq('organization_id', orgId);
    const { data: instData, error: instErr } = await supabase.from('installments').select('*').eq('organization_id', orgId);
    const { data: incData } = await supabase.from('income_sources').select('*').eq('organization_id', orgId);
    const { data: fixData } = await supabase.from('fixed_expenses').select('*').eq('organization_id', orgId);

    if (eErr) setDebug(`Entries error: ${eErr.message}`);
    if (instErr) setDebug(`Installments error: ${instErr.message}`);

    setCounts({
      entries: eData?.length || 0,
      children: cData?.length || 0,
      years: syData?.length || 0,
      installments: instData?.length || 0,
      income: incData?.length || 0,
      fixed: fixData?.length || 0,
    });
    
    setEntries(eData || []);
    setChildren(cData || []);
    setInstallments(instData || []);
    setDebug(`Loaded: ${eData?.length} entries, ${cData?.length} children, ${instData?.length} installments for org ${orgId}`);
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

  const testQuery = async () => {
    // Direct test of data location
    const { data: allInst } = await supabase.from('installments').select('organization_id').limit(100);
    const orgCounts = {};
    allInst?.forEach(r => orgCounts[r.organization_id] = (orgCounts[r.organization_id]||0)+1);
    setDebug(`All installments by org: ${JSON.stringify(orgCounts)} | Current: ${currentOrgId}`);
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>جاري التحميل... بوصلة V2 - {debug}</div>;
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#12161F', color: '#EDE7D9', fontFamily: 'system-ui' }}>
        <div style={{ background: '#1B2130', padding: 32, borderRadius: 16, width: 380 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>بوصلة V2 - تسجيل الدخول</h2>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #2C3348', background: '#20273A', color: '#EDE7D9', marginTop: 16 }} />
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #2C3348', background: '#20273A', color: '#EDE7D9', marginTop: 10 }} />
          {authError && <div style={{ color: '#C1523B', fontSize: 12, marginTop: 10 }}>{authError}</div>}
          <button onClick={handleAuth} style={{ width: '100%', padding: 12, borderRadius: 8, background: '#C9A24B', color: '#12161F', fontWeight: 800, border: 'none', marginTop: 16, cursor: 'pointer' }}>
            {authMode === "login" ? "دخول" : "إنشاء حساب"}
          </button>
          <button onClick={()=>setAuthMode(authMode==="login"?"signup":"login")} style={{ width: '100%', background: 'transparent', color: '#8B92A8', border: 'none', marginTop: 10, cursor: 'pointer', fontSize: 12 }}>
            {authMode==="login" ? "أول مرة؟ إنشاء حساب" : "عندك حساب؟ دخول"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#12161F', color: '#EDE7D9', padding: 24, fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>بوصلة V2 OK - FIXED</h1>
            <div style={{ color: '#8B92A8', fontSize: 13 }}>{orgName} • {user.email} {isSuperAdmin && "• Super Admin 🛡️"}</div>
            <div style={{ color: '#3E9C7C', fontSize: 11, marginTop: 4 }}>{debug}</div>
          </div>
          <button onClick={logout} style={{ padding: '8px 14px', borderRadius: 8, background: '#2C3348', color: '#EDE7D9', border: 'none', cursor: 'pointer' }}>خروج</button>
        </div>

        {isSuperAdmin && (
          <div style={{ background: '#1B2130', border: '1px solid #C9A24B', borderRadius: 12, padding: 16, marginTop: 20 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>🛡️ Super Admin - كل المنظمات ({allOrgs.length})</div>
            <select value={currentOrgId||""} onChange={e=>{setCurrentOrgId(e.target.value); localStorage.setItem("bousala_org", e.target.value);}} style={{ width: '100%', padding: 10, borderRadius: 8, background: '#20273A', color: '#EDE7D9', border: '1px solid #2C3348' }}>
              {allOrgs.map(org => <option key={org.id} value={org.id}>{org.name} - {org.id.slice(0,8)} - {org.id===currentOrgId?"CURRENT":""}</option>)}
            </select>
            <button onClick={testQuery} style={{ marginTop: 10, padding: '6px 10px', borderRadius: 6, background: '#2C3348', color: '#EDE7D9', border: 'none', fontSize: 12 }}>فحص وين الداتا</button>
          </div>
        )}

        {counts && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 20 }}>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12 }}><div style={{ fontSize: 12, color: '#8B92A8' }}>مصاريف</div><div style={{ fontSize: 22, fontWeight: 900 }}>{counts.entries}</div></div>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12 }}><div style={{ fontSize: 12, color: '#8B92A8' }}>أولاد</div><div style={{ fontSize: 22, fontWeight: 900 }}>{counts.children}</div></div>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12 }}><div style={{ fontSize: 12, color: '#8B92A8' }}>سنوات دراسية</div><div style={{ fontSize: 22, fontWeight: 900 }}>{counts.years}</div></div>
            <div style={{ background: '#1B2130', padding: 16, borderRadius: 12, border: counts.installments>0?'1px solid #3E9C7C':'1px solid #C1523B' }}><div style={{ fontSize: 12, color: '#8B92A8' }}>أقساط (حل 340)</div><div style={{ fontSize: 22, fontWeight: 900, color: counts.installments>0?'#3E9C7C':'#C1523B' }}>{counts.installments}</div></div>
          </div>
        )}

        {entries.length > 0 && (
          <div style={{ background: '#1B2130', padding: 16, borderRadius: 12, marginTop: 20 }}>
            <h3>آخر 5 مصاريف (تأكيد الداتا):</h3>
            {entries.slice(0,5).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2C3348', fontSize: 13 }}>
                <span>{e.note}</span><span>{e.amount} - {e.date}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: '#20273A', padding: 16, borderRadius: 12, marginTop: 20 }}>
          <div>Org ID الحالي: {currentOrgId}</div>
          <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 6 }}>{debug}</div>
          {counts?.entries === 0 && <div style={{ color: '#C1523B', marginTop: 10 }}>⚠️ الداتا 0 مع انه في SQL شفنا 13,3,33 - اضغط "فحص وين الداتا" فوق وشوف الـ debug</div>}
        </div>
      </div>
    </div>
  );
}
