import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import * as XLSX from "xlsx";
import { Plus, ClipboardPaste, Target, TrendingUp, Wallet, AlertTriangle, X, Check, Pencil, Baby, Clock, Bell, PiggyBank, BarChart3, Languages, Download, Upload, Settings, Search, ArrowUpDown, LogOut, ChevronDown, Eye, Link2, Lock, User, SlidersHorizontal, Shield, Building2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// FIX LOGIN FLAKINESS - Vercel env vars fallback + debug
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hhuoqsambeoedxumamli.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("⚠️ VITE_SUPABASE_URL or ANON_KEY missing in Vercel! Using fallback. Set them in Vercel Settings > Environment Variables");
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------- Supabase Client replaced storage ----------
const storage = {
  async get(k){ return null; },
  async set(k,v){ return true; },
  async delete(k){ return true; }
};

// ---------- Design tokens ----------
const INK = "#12161F";
const CARD = "#1B2130";
const CARD_SOFT = "#20273A";
const LINE = "#2C3348";
const PAPER = "#EDE7D9";
const GOLD = "#C9A24B";
const TEAL = "#3E9C7C";
const RED = "#C1523B";
const MUTED = "#8B92A8";

// ---------- Category keyword map (Arabic - category names stay as user-facing data, not translated) ----------
const DEFAULT_CATEGORIES = [
  { key: "بقالة", color: "#3E9C7C", words: ["سوبرماركت", "بقالة", "كارفور", "سيفوي", "هايبر", "market", "سوبر ماركت"] },
  { key: "فواتير", color: "#C9A24B", words: ["كهرباء", "مي", "ماء", "غاز", "فاتورة", "انترنت", "اتصالات", "زين", "امنية", "اورانج"] },
  { key: "مواصلات", color: "#5B8DEF", words: ["بنزين", "محروقات", "تكسي", "اوبر", "كريم", "مواصلات", "باص", "وقود"] },
  { key: "مطاعم", color: "#C1523B", words: ["مطعم", "كافيه", "قهوة", "ستاربكس", "توصيل طلبات", "طلبات", "كريسبي"] },
  { key: "صحة", color: "#8E6BC9", words: ["صيدلية", "دكتور", "طبيب", "مستشفى", "تحليل", "دواء"] },
  { key: "تسوق", color: "#D98E3D", words: ["ملابس", "شوبنج", "امازون", "نون", "تسوق"] },
  { key: "أقساط", color: "#4AA3B0", words: ["قسط", "اقساط", "بنك", "قرض", "تقسيط"] },
  { key: "أخرى", color: "#6B7280", words: [] },
];
const CATEGORY_COLOR_CHOICES = ["#3E9C7C", "#C9A24B", "#5B8DEF", "#C1523B", "#8E6BC9", "#D98E3D", "#4AA3B0", "#E0668C", "#A0A85C", "#6B7280"];

function guessCategory(text, cats) {
  const list = cats || DEFAULT_CATEGORIES;
  const t = (text || "").toLowerCase();
  for (const rule of list) {
    if (rule.key === "أخرى") continue;
    if ((rule.words || []).some((w) => t.includes(w))) return rule.key;
  }
  return list[list.length - 1] ? list[list.length - 1].key : "أخرى";
}
function colorOf(cat, cats) {
  const list = cats || DEFAULT_CATEGORIES;
  return (list.find((r) => r.key === cat) || list[list.length - 1] || { color: MUTED }).color;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}
function fmt(n) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
}
function monthsBetween(fromISO, toISO) {
  const from = new Date(fromISO), to = new Date(toISO);
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() - from.getDate()) / 30;
  return Math.max(months, 1 / 30);
}
function addMonthsISO(fromISO, months) {
  const d = new Date(fromISO);
  d.setDate(d.getDate() + Math.round(months * 30));
  return d.toISOString().slice(0, 10);
}
function addCalendarMonths(iso, n) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function lastDayOfMonthISO(iso) {
  const d = new Date(iso);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}
// Locale-aware date formatting: pass current UI language ("ar" | "en")
function fmtDateL(iso, lang) {
  if (!iso) return "—";
  return lang === "en"
    ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date(iso).toLocaleDateString("ar-JO-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
}
function fmtInstallmentMonthL(iso, lang) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (lang === "en") {
    const monthName = d.toLocaleDateString("en-US", { month: "long" });
    return `${monthName} (Month ${d.getMonth() + 1}) ${d.getFullYear()}`;
  }
  const monthName = d.toLocaleDateString("ar-JO-u-nu-latn", { month: "long" });
  return `${monthName} (الشهر ${d.getMonth() + 1}) ${d.getFullYear()}`;
}
// ---------- Fiscal (custom-anchor) month period helpers ----------
// Each fiscal period is identified by `monthKey` ("YYYY-MM" — the calendar month it
// conceptually belongs to). Its actual start date can be explicitly overridden (e.g. "the
// September period actually starts 2026-08-27" to match a salary date) via the `anchors` map
// { monthKey: "YYYY-MM-DD" }. A period's end is always "the day before the NEXT period's start"
// — so overriding October's start automatically pulls back September's end to match. When a
// monthKey has no override, its default start is the 1st of that calendar month, which makes
// the whole system reduce exactly to plain calendar months when `anchors` is empty (the default
// for all existing/older saved data — nothing is lost or altered unless the user sets an override).
function shiftMonthKey(monthKey, n) {
  return addCalendarMonths(`${monthKey}-01`, n).slice(0, 7);
}
function defaultPeriodStart(monthKey) {
  return `${monthKey}-01`;
}
function addDaysISO(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getFiscalPeriod(monthKey, anchors) {
  // Find explicit anchor for this month, or inherit day from most recent previous anchor
  const [yStr,mStr] = monthKey.split("-");
  const y = parseInt(yStr), m = parseInt(mStr);
  let start;
  if (anchors && anchors[monthKey]) {
    start = anchors[monthKey];
  } else {
    // Inherit day from most recent anchor
    let inheritedDay = 1;
    let found = false;
    for(let i=1;i<=24;i++){
      const prevKey = shiftMonthKey(monthKey, -i);
      if(anchors && anchors[prevKey]){
        inheritedDay = parseInt(anchors[prevKey].slice(8,10));
        found = true;
        break;
      }
    }
    if(found){
      const dim = daysInMonth(y, m-1);
      const d = Math.min(inheritedDay, dim);
      start = `${yStr}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    } else {
      start = defaultPeriodStart(monthKey);
    }
  }
  // Next period start - explicit or inherit same day as current start
  const nextKey = shiftMonthKey(monthKey, 1);
  let nextStart;
  if (anchors && anchors[nextKey]) {
    nextStart = anchors[nextKey];
  } else {
    const day = parseInt(start.slice(8,10));
    const [nyStr,nmStr] = nextKey.split("-");
    const ny = parseInt(nyStr), nm = parseInt(nmStr);
    const dim = daysInMonth(ny, nm-1);
    const d = Math.min(day, dim);
    nextStart = `${nyStr}-${String(nm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  const end = addDaysISO(nextStart, -1);
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  return { start, end, days };
}
// A period's start override must stay close to that calendar month's real boundary (roughly
// the 25th of the previous month through the 5th of this month) so a fiscal period can shift
// by a few days to match a salary date, but can't be set to some unrelated, far-off date.
function periodStartBounds(monthKey) {
  const prevKey = shiftMonthKey(monthKey, -1);
  return { min: `${prevKey}-25`, max: `${monthKey}-05` };
}
function currentFiscalMonthKey(anchors, todayIso) {
  const calKey = todayIso.slice(0, 7);
  // A fiscal period is roughly a month long, so checking the neighboring calendar months
  // is enough to find which period today actually falls into, even with an override.
  for (const key of [shiftMonthKey(calKey, -1), calKey, shiftMonthKey(calKey, 1)]) {
    const p = getFiscalPeriod(key, anchors);
    if (todayIso >= p.start && todayIso <= p.end) return key;
  }
  return calKey;
}
function fiscalPeriodLabel(monthKey, period, lang) {
  const locale = lang === "en" ? "en-US" : "ar-JO-u-nu-latn";
  const isDefault = period.start === defaultPeriodStart(monthKey) && period.end === lastDayOfMonthISO(defaultPeriodStart(monthKey));
  if (isDefault) {
    return new Date(`${period.start}T00:00:00`).toLocaleDateString(locale, { year: "numeric", month: "long" });
  }
  const startD = new Date(`${period.start}T00:00:00`);
  const endD = new Date(`${period.end}T00:00:00`);
  const startStr = startD.toLocaleDateString(locale, { day: "numeric", month: "long" });
  const endStr = endD.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  return `${startStr} – ${endStr}`;
}
// Parses a numeric token from a pasted statement line, handling both "1,234.500" (comma as
// thousands separator) and "24,5" (comma as decimal separator) formats.
function parseAmountToken(raw) {
  let s = (raw || "").trim();
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  return parseFloat(s);
}
function generateInstallments(y) {
  const items = [];
  const downPayment = parseFloat(y.downPayment) || 0;
  if (downPayment > 0 && y.downPaymentDate) {
    items.push({ id: `${y.id}-dp`, month: lastDayOfMonthISO(y.downPaymentDate), amount: downPayment, paid: false, paymentDate: null, paidAmount: 0, locked: false, isDownPayment: true });
  }
  const remaining = (parseFloat(y.annualFee) || 0) - downPayment;
  const count = Math.max(1, parseInt(y.installmentsCount) || 1);
  const per = remaining / count;
  for (let i = 0; i < count; i++) {
    items.push({ id: `${y.id}-${i}`, month: lastDayOfMonthISO(addCalendarMonths(y.startDate, i)), amount: per, paid: false, paymentDate: null, paidAmount: 0, locked: false, isDownPayment: false });
  }
  return items;
}

// Keep backward compatibility with installments saved before partial-payment support.
function installmentPaidAmount(ins) {
  const amount = Number(ins.amount) || 0;
  if (Number.isFinite(Number(ins.paidAmount)) && Number(ins.paidAmount) > 0) {
    return Math.min(amount, Math.max(0, Number(ins.paidAmount)));
  }
  return ins.paid ? amount : 0;
}
function installmentRemaining(ins) {
  return Math.max(0, (Number(ins.amount) || 0) - installmentPaidAmount(ins));
}
// After a specific installment's amount or date is manually edited, redistribute the leftover of the annual
// fee across the other installments that are still auto-calculated (not paid, not manually edited).
function rebalanceInstallments(y, editedId, newAmount) {
  const updated = y.installments.map((ins) => (ins.id === editedId ? { ...ins, amount: newAmount, locked: true } : ins));
  const fixedSum = updated.filter((ins) => ins.locked || ins.paid || ins.isDownPayment).reduce((s, ins) => s + ins.amount, 0);
  const flexible = updated.filter((ins) => !ins.locked && !ins.paid && !ins.isDownPayment);
  const remaining = (parseFloat(y.annualFee) || 0) - fixedSum;
  const per = flexible.length > 0 ? remaining / flexible.length : 0;
  return { installments: updated.map((ins) => (!ins.locked && !ins.paid && !ins.isDownPayment ? { ...ins, amount: per } : ins)), overshoot: remaining < 0 };
}
// Defer (postpone) a single installment: either push it to a new slot after the last scheduled
// installment, or remove it and spread its amount across the remaining flexible installments.
function deferInstallment(y, installmentId, mode) {
  const target = y.installments.find((i) => i.id === installmentId);
  if (!target || target.paid) return y.installments;
  const rest = y.installments.filter((i) => i.id !== installmentId);
  if (mode === "append") {
    const maxMonth = rest.reduce((m, i) => (i.month > m ? i.month : m), target.month);
    const newIns = { id: Math.random().toString(36).slice(2), month: lastDayOfMonthISO(addCalendarMonths(maxMonth, 1)), amount: target.amount, paid: false, paymentDate: null, locked: true, isDownPayment: false };
    return [...rest, newIns];
  }
  // spread: remove the target and let its share fold into the remaining auto-calculated installments
  const fixedSum = rest.filter((i) => i.locked || i.paid || i.isDownPayment).reduce((s, i) => s + i.amount, 0);
  const flexible = rest.filter((i) => !i.locked && !i.paid && !i.isDownPayment);
  const remaining = (parseFloat(y.annualFee) || 0) - fixedSum;
  const per = flexible.length > 0 ? remaining / flexible.length : 0;
  return rest.map((i) => (!i.locked && !i.paid && !i.isDownPayment ? { ...i, amount: per } : i));
}
function migrateChildren(children) {
  return children.map((c) => {
    if (c.years) {
      return {
        ...c,
        years: c.years.map((y) => ({
          ...y,
          installments: (y.installments || []).map((ins) => ({
            ...ins,
            paymentDate: ins.paymentDate || ins.month
          }))
        }))
      };
    }
    const years = [];
    if (c.schoolStart && c.schoolFee) {
      const y = { id: `${c.id}-y-school`, stage: "school", label: "المدرسة", annualFee: c.schoolFee, downPayment: 0, installmentsCount: 10, startDate: c.schoolStart };
      years.push({ ...y, installments: generateInstallments(y) });
    }
    if (c.universityStart && c.universityFee) {
      const y = { id: `${c.id}-y-uni`, stage: "university", label: "الجامعة", annualFee: c.universityFee, downPayment: 0, installmentsCount: 10, startDate: c.universityStart };
      years.push({ ...y, installments: generateInstallments(y) });
    }
    return { id: c.id, name: c.name, years };
  });
}
function migrateFixedExpenses(list) {
  // Convert old shape (single top-level `amount`) into an amount-history ledger, so a fixed
  // expense's paid value can change over time without losing what was true for past months.
  return (list || []).map((f) => {
    if (f.amountHistory) return f;
    return { ...f, amountHistory: [{ id: `${f.id}-a0`, amount: f.amount, effectiveFrom: f.startDate }] };
  });
}
function currentFixedAmount(f, todayIso, monthKey) {
  if (monthKey && f.monthlyOverrides && f.monthlyOverrides[monthKey] !== undefined) {
    return f.monthlyOverrides[monthKey];
  }
  const hist = [...(f.amountHistory || [])].filter((h) => h.effectiveFrom <= todayIso).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  if (hist.length > 0) return hist[0].amount;
  const all = [...(f.amountHistory || [])].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  return all.length > 0 ? all[0].amount : f.amount || 0;
}

// ---------- Parse pasted statement text ----------
function parsePastedText(raw, cats, entryDate, defaultNote) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const match = line.match(/(-?[\d.,]*\d)\s*$/) || line.match(/^(-?[\d.,]*\d)/);
    if (!match) continue;
    const amount = Math.abs(parseAmountToken(match[1]));
    if (!amount || isNaN(amount)) continue;
    const note = line.replace(match[0], "").trim() || defaultNote;
    out.push({
      id: Math.random().toString(36).slice(2),
      date: entryDate,
      amount,
      note,
      category: guessCategory(note, cats),
    });
  }
  return out;
}

// ---------- Translations (UI chrome only — user-entered data like names/notes/categories is never translated) ----------
const translations = {
  ar: {
    appName: "بوصلة",
    tagline: "مصاريفك اليوم، واتجاهك المالي بكرة",
    loading: "جاري التحميل...",
    authLoginTitle: "تسجيل الدخول", authSetupTitle: "إنشاء الحساب المحلي", authUsername: "اسم المستخدم", authPassword: "كلمة المرور", authPassword2: "تأكيد كلمة المرور", authLoginBtn: "دخول", authCreateBtn: "إنشاء الحساب", authSwitchSetup: "أول مرة؟ إنشاء حساب", authSwitchLogin: "لدي حساب بالفعل", authRequired: "أدخل اسم المستخدم وكلمة المرور", authPasswordShort: "كلمة المرور يجب أن تكون 4 أحرف على الأقل", authPasswordsMismatch: "كلمتا المرور غير متطابقتين", authInvalid: "اسم المستخدم أو كلمة المرور غير صحيحة", authCreated: "تم إنشاء الحساب بنجاح", settingsGeneral: "عام", settingsCategories: "الفئات", settingsBackup: "النسخ الاحتياطي", settingsAccount: "الحساب", exportMenu: "التصدير / الاستيراد", showDetails: "عرض التفاصيل", viewAll: "عرض الكل", linkedFixedLabel: "ربط بالمصروف الثابت", noLink: "بدون ربط", consumedLabel: "المستهلك", remainingLabel: "المتبقي", fixedConsumptionTitle: "استهلاك المصاريف الثابتة", noFixedLink: "لا يوجد ربط بمصروف ثابت", logout: "تسجيل الخروج", accountLocalNote: "دخول سحابي آمن عبر Supabase - متاح من أي جهاز.", recentViewAll: "عرض كل الحركات", financialDetails: "تفاصيل الوضع المالي", variableActualLabel: "المصاريف المتغيرة الفعلية", fixedActualConsumed: "المستهلك من المصاريف الثابتة", fixedBudgetLabel: "مخصص المصاريف الثابتة", totalActualLabel: "إجمالي المصروف الفعلي", close: "إغلاق", settingsButton: "الإعدادات", categoriesSettingsNote: "إدارة الفئات من هنا. تغيير الاسم يحدّث الحركات والميزانيات والمصاريف الثابتة المرتبطة بها.", addCategorySettings: "إضافة فئة", customCategories: "الفئات المخصصة", accountUsername: "المستخدم الحالي" , fixedLinkHelp: "إذا كانت الحركة دفعة لمصروف ثابت، اربطها هنا ليظهر الاستهلاك والمتبقي تلقائياً.", fixedConsumedOf: "{consumed} من {amount} د.أ" , linkedTag: "مرتبط" ,
    langToggle: "English",

    monthSelectorTitle: "الشهر المعروض",
    monthSelectorSub: "كل الأرقام واللوحات أدناه تعتمد على هذا الشهر — بيانات الأشهر السابقة تبقى محفوظة.",
    currentMonthBtn: "الشهر الحالي",

    financialStatusTitle: "وضعك المالي المتوقع لشهر {month}",
    monthlyIncome: "دخلك الشهري",
    fixedExpensesLine: "مصاريف ثابتة (فواتير، أقساط، مدرسة...)",
    childrenInstallmentsLine: "أقساط الأولاد (مدرسة/جامعة)",
    variableExpensesLine: "مصاريف متغيرة متوقعة (سوبرماركت، مواصلات...)",
    projectedSurplus: "= فائض متوقع",
    projectedDeficit: "= عجز متوقع",
    surplusNote: "يعني بعد كل التزاماتك الثابتة ومصروفك المتوقع، رح يفضل معك تقريباً {amt} د.أ آخر الشهر.",
    deficitNote: "يعني بعد كل التزاماتك الثابتة ومصروفك المتوقع، رح تحتاج {amt} د.أ إضافية عشان توازن الشهر.",

    statSpentLabel: "مصروف الشهر المعروض",
    statSpentSubCurrent: "يوم {day} من {dim}",
    statSpentSubPast: "شهر مكتمل · {dim} يوم",
    statSpentSubFuture: "شهر مستقبلي",
    statProjectedLabel: "متوقع نهاية الشهر",
    statProjectedSubRemain: "رح يفضل معك {amt} د.أ",
    statProjectedSubShort: "رح تنقصك {amt} د.أ",
    statProjectedSubNoIncome: "أدخل دخلك الشهري بالأسفل",
    statGoalsLabel: "أهدافك",
    statGoalsValueSome: "{n} هدف",
    statGoalsValueNone: "ما فيه أهداف بعد",
    statGoalsSubSome: "{onTrack} على المسار من {total}",
    statGoalsSubNone: "أضفها بالأسفل",
    statCommitmentsLabel: "التزامات ثابتة شهرياً",
    statCommitmentsSubChanges: "فيه تغييرات قريبة",
    statCommitmentsSubDefault: "مدرسة، فواتير، أقساط...",
    statCommitmentsValueNone: "ما فيه بعد",

    alertsTitle: "تنبيهات بوصلة الذكية",
    alertsNone: "ممتاز، لا توجد تنبيهات مهمة حالياً 🎉",
    alertBudgetExceededTitle: "تجاوزت الميزانية",
    alertBudgetExceededMsg: "تجاوزت ميزانية {cat} بـ {amt} د.أ",
    alertBudgetWarningTitle: "اقتربت من الحد",
    alertBudgetWarningMsg: "استهلكت {pct}% من ميزانية {cat}",
    alertDeficitTitle: "عجز متوقع",
    alertDeficitMsg: "إذا استمر الصرف الحالي قد تنهي الشهر بعجز {amt} د.أ",
    alertEndingSoonTitle: "التزام سينتهي قريباً",
    alertEndingSoonMsg: "{name} ينتهي خلال أقل من شهرين",
    alertInstallmentSoonTitle: "قسط قريب",
    alertInstallmentSoonMsg: "{name}: قسط {amt} د.أ مستحق {date}",
    alertGoalNeedsAttentionTitle: "هدف يحتاج متابعة",
    alertGoalNeedsAttentionMsg: "{name} يحتاج تقريباً {amt} د.أ شهرياً للوصول بالموعد",

    comparisonTitle: "مقارنة {month} بالشهر السابق",
    totalSpentLabel: "إجمالي المصروف",
    comparisonNoData: "لا توجد بيانات كافية للشهر السابق",
    comparisonUp: "↑ زيادة",
    comparisonDown: "↓ انخفاض",
    comparisonSame: "— بدون تغيير",

    budgetsTitle: "الميزانيات الشهرية — {month}",
    addBudgetBtn: "+ ميزانية",
    cancel: "إلغاء",
    monthlyBudgetPlaceholder: "الميزانية الشهرية",
    alertAtPlaceholder: "تنبيه عند %",
    save: "حفظ",
    budgetsEmpty: "أضف ميزانية شهرية لكل فئة لمراقبة التزامك وتنبيهك عند الاقتراب من الحد.",
    remaining: "متبقي {amt}",
    exceeded: "تجاوزت {amt}",
    delete: "حذف",

    incomeSourcesTitle: "مصادر الدخل",
    addIncomeBtn: "مصدر دخل",
    incomeTotalLabel: "مجموع الدخل في الشهر المعروض",
    incomeNameLabel: "اسم المصدر (راتب، فريلانس، دخل إضافي...)",
    incomeNamePlaceholder: "مثال: راتب أساسي",
    monthlyAmountLabel: "المبلغ الشهري (د.أ)",
    startDateLabel: "تاريخ البداية",
    endDateOptionalLabel: "تاريخ الانتهاء (اختياري)",
    incomeEmpty: "ما فيه مصادر دخل مضافة بعد — أضف راتبك أو أي دخل ثاني",
    incomeActive: "فعّال في الشهر المعروض",
    incomeInactive: "غير فعّال في الشهر المعروض",
    incomeFromTo: "من {from} إلى {to}",
    incomeFromOngoing: "من {from} · مستمر بدون تاريخ انتهاء",
    incomeEditNote: "تعديل تاريخ البداية/الانتهاء ما بيمسح السجل — الأشهر القديمة بتضل تحسب على القيمة اللي كانت سارية وقتها.",
    availableAfterCommitments: "المتاح بعد الالتزامات الثابتة وأقساط الأولاد: {amt} د.أ شهرياً",
    perMonth: "د.أ/شهر",

    fixedExpensesTitle: "المصاريف الثابتة — {month}",
    addFixedBtn: "مصروف ثابت",
    fixedTotalLabel: "مجموع المصاريف الثابتة (يشمل أقساط الأولاد)",
    fixedNameLabel: "اسم المصروف",
    fixedNamePlaceholder: "مثال: قسط سيارة، مدرسة",
    categoryLabel: "الفئة",
    fixedEndDateLabel: "تاريخ الانتهاء المتوقع (اختياري)",
    saveFixedBtn: "حفظ المصروف الثابت",
    fixedEmpty: "ما فيه مصاريف ثابتة بعد — أضف مدرسة، فواتير، أقساط...",
    thisMonthInstallment: "قسط هذا الشهر",
    paid: "مدفوع",
    unpaid: "غير مدفوع",
    fromChildrenSection: "من قسم الأولاد",
    fixedEditNote: 'لتعديل المبلغ نفسه استخدم "سجل تغييرات القيمة" تحت — هيك تضل القيم القديمة صحيحة تاريخياً.',
    currentValue: "د.أ/شهر (القيمة الحالية)",
    startedOn: "بدأ {date}",
    endsOn: "ينتهي {date}",
    remainingMonths: "باقي {n} شهر",
    lessThanMonth: "أقل من شهر",
    ended: "انتهى",
    notStartedYet: "لسا ما بدأ",
    ongoingNoEnd: "بدأ {date} · مستمر بدون تاريخ انتهاء محدد",
    endingSoonNote: "قريب ينتهي — بعده رح يزيد الفائض المتاح إلك شهرياً بمقدار {amt} د.أ",
    historyHide: "▲ إخفاء سجل تغييرات القيمة",
    historyShow: "▼ سجل تغييرات القيمة ({n})",
    addValueChangeBtn: "+ تغيير قيمة",
    newValueLabel: "القيمة الجديدة (د.أ)",
    effectiveFromLabel: "سارية من تاريخ",
    fromDate: "من {date}",

    childrenTitle: "مدارس وجامعات الأولاد",
    addChildBtn: "ابن/ابنة",
    childrenTotalLabel: "مجموع الأقساط المستحقة هذا الشهر",
    childNameLabel: "اسم الابن/الابنة",
    childNamePlaceholder: "مثال: ليان",
    childFormNote: "بعد ما تضيفه، بتقدر تضيفله سنة دراسية (مدرسة أو جامعة) بقسطها وعدد أشهر التقسيط.",
    childrenEmpty: "ما فيه أولاد مضافين بعد — ضيف ابن أو ابنة وبعدين سنتهم الدراسية",
    confirmDeleteChild: "حذف كل بياناته؟",
    confirm: "تأكيد",
    downPaymentTag: "دفعة أولى",
    monthlyInstallmentTag: "قسط شهري",
    notYet: "لسا",
    deferThisInstallment: "تأجيل هالقسط:",
    deferAppend: "أضفه بآخر الجدول",
    deferSpread: "وزّعه على الباقي",
    noInstallmentDue: "ما فيه قسط مستحق في الشهر المعروض",
    nextDueLine: "أقرب قسط قادم: {date} · {amt} د.أ ({label})",
    yearsLedgerTitle: "سجل السنوات الدراسية",
    addYearBtn: "سنة جديدة",
    stageLabel: "المرحلة",
    stageSchool: "مدرسة",
    stageUniversity: "جامعة",
    yearLabelLabel: "تسمية السنة (اختياري)",
    yearLabelPlaceholder: "مثال: 2026/2027",
    annualFeeLabel: "القسط السنوي (د.أ)",
    annualFeePlaceholder: "2680",
    downPaymentLabel: "دفعة أولى/تسجيل (اختياري)",
    downPaymentDateLabel: "تاريخ الدفعة الأولى (هذي فعلياً القسط الأول)",
    installmentsCountLabel: "عدد أشهر تقسيط الباقي",
    firstInstallmentDateLabel: "تاريخ أول قسط شهري (ممكن يكون بعد الدفعة الأولى بأي عدد أشهر)",
    saveYearBtn: "حفظ السنة",
    noYearsYet: "ما فيه سنوات مضافة بعد",
    yearSummary: "{total} د.أ إجمالي · {unpaid} قسط لسا ما تدفع · مقسّم على {count} شهر",
    yearSummaryDownPayment: " + دفعة أولى {amt} د.أ",
    hideSchedule: "▲ إخفاء جدول الأقساط",
    showSchedule: "▼ عرض جدول الأقساط",
    confirmDeleteYear: "حذف هذي السنة؟",
    editYearNote: "ملاحظة: تعديل هذه البيانات بيعيد توليد جدول الأقساط (بيحافظ على حالة الدفع للأشهر اللي ما تغيّر تاريخها، بس بيلغي أي تعديل يدوي على أقساط فردية).",
    noInstallmentsGenerated: "ما فيه أقساط مولّدة لهذي السنة — عدّلها من القلم فوق وحدد القسط السنوي وعدد الأشهر.",

    savingsTitle: "التوفير الفعلي",
    addSavingsBtn: "توفير شهر",
    savingsTotalLabel: "إجمالي التوفير الفعلي المسجّل",
    savingsFormNote: "سجّل هون كم فعلياً وفّرت (أو زاد/نقص) آخر الشهر — رقم حقيقي، مش المتوقع.",
    monthLabel: "الشهر",
    savedAmountLabel: "المبلغ الموفّر فعلياً (د.أ)",
    savedAmountPlaceholder: "مثال: 150",
    noteOptionalLabel: "ملاحظة (اختياري)",
    notePlaceholder: "مثال: مكافأة إضافية هالشهر",
    savingsEmpty: "ما فيه توفير مسجّل بعد — سجّل أول شهر وبنبلش نبني الصورة الكاملة",
    projectionTitle: "المتوقع بعد عدد من السنوات",
    yearsCountLabel: "عدد السنوات",
    returnPctLabel: "نسبة عائد سنوي متوقعة % (اختياري)",
    avgMonthlyRecorded: "مبني على متوسط توفيرك الشهري المسجّل: {amt} د.أ/شهر",
    avgMonthlyProjected: "مبني على متوسط توفيرك الشهري المتوقع من فائضك الحالي (لسا ما سجّلت أي شهر فعلي): {amt} د.أ/شهر",
    projectedAfterYears: "المتوقع بعد {years} سنة",

    goalsTitle: "أهدافك المالية",
    addGoalBtn: "هدف جديد",
    goalsTotalLabel: "مجموع المحتاج شهرياً لكل الأهداف",
    goalNameLabel: "اسم الهدف",
    goalNamePlaceholder: "مثال: سيارة، عمرة، زواج",
    targetAmountLabel: "المبلغ المطلوب (د.أ)",
    savedSoFarLabel: "موفر لحد الآن (د.أ)",
    expectedDeadlineLabel: "تاريخ التحقيق المتوقع",
    fundingMethodLabel: "طريقة التمويل",
    fundingAuto: "من الفائض الشهري تلقائياً",
    fundingFixed: "مبلغ ثابت كل شهر",
    goalsEmpty: "ما فيه أهداف بعد — أضف أول هدف مالي إلك",
    savedOfTarget: "موفر {saved} من {target} د.أ",
    goalDeadlineLabel: "هدفك بتاريخ",
    projectedCompletionLabel: "متوقع تتحقق",
    notDetermined: "غير محدد",
    neededMonthlyLabel: "محتاج شهرياً",
    editSavedLabel: "عدّل الموفر",
    goalBehindNote: "بمعدل التمويل الحالي رح تتأخر عن تاريخ هدفك — زيد المبلغ الشهري أو أخّر التاريخ",

    chartTitle: "مسار الصرف خلال الشهر المعروض",
    actualLegend: "فعلي",
    projectedLegend: "متوقع",

    manualTab: "إضافة يدوية",
    pasteTab: "لصق من كشف حساب",
    addCategoryBtn: "+ فئة جديدة",
    categoryNameLabel: "اسم الفئة",
    categoryNamePlaceholder: "مثال: تعليم",
    amountLabel: "المبلغ",
    amountPlaceholder: "0.00",
    descriptionLabel: "الوصف",
    descriptionPlaceholder: "مثال: سوبرماركت",
    dateLabel: "التاريخ",
    addBtn: "إضافة",
    pasteAreaLabel: "الصق سطور المصاريف (مبلغ ووصف بكل سطر)",
    pastePlaceholder: "سوبرماركت كارفور 24.500\nفاتورة كهرباء 38\nستاربكس 6.2",
    extractBtn: "استخراج الحركات",
    reviewBeforeAdding: "راجع الحركات قبل الإضافة ({n})",
    confirmAddAll: "تأكيد إضافة الكل",

    recentEntriesTitle: "آخر الحركات",
    noEntriesInMonth: "ما فيه حركات في {month}",

    // toast / validation messages
    toastValidAmount: "أدخل مبلغ صحيح",
    toastAdded: "تمت الإضافة",
    toastNoAmountsFound: "ما قدرت ألاقي مبالغ بالنص",
    toastEntriesAdded: "تمت إضافة {n} حركة",
    toastPickDate: "حدد التاريخ",
    toastEdited: "تم التعديل",
    toastEnterCategoryName: "أدخل اسم الفئة",
    toastCategoryExists: "هاي الفئة موجودة أصلاً",
    toastCategoryAdded: "تمت إضافة الفئة",
    toastEnterIncomeName: "أدخل اسم مصدر الدخل",
    toastPickStartDate: "حدد تاريخ البداية",
    toastIncomeAdded: "تمت إضافة مصدر الدخل",
    toastPickMonth: "حدد الشهر",
    toastMonthAlreadyLogged: "فيه سجل مضاف لهذا الشهر أصلاً — عدّله من القلم",
    toastSavingsAdded: "تمت إضافة التوفير الفعلي لهذا الشهر",
    toastEnterGoalName: "أدخل اسم الهدف",
    toastEnterGoalAmount: "أدخل مبلغ الهدف",
    toastPickDeadline: "حدد تاريخ متوقع للتحقيق",
    toastEnterFixedMonthly: "أدخل المبلغ الشهري الثابت",
    toastGoalAdded: "تمت إضافة الهدف",
    toastEnterFixedName: "أدخل اسم المصروف الثابت",
    toastFixedAdded: "تمت إضافة المصروف الثابت",
    toastEnterExpenseName: "أدخل اسم المصروف",
    toastPickEffectiveDate: "حدد تاريخ سريان القيمة الجديدة",
    toastValueChangeRecorded: "تم تسجيل التغيير بالقيمة",
    toastEnterChildName: "أدخل اسم الابن/الابنة",
    toastChildAdded: "تمت إضافة الابن/الابنة — دورك تضيف سنة دراسية إلها",
    toastEnterAnnualFee: "أدخل القسط السنوي",
    toastPickFirstInstallmentDate: "حدد تاريخ أول قسط شهري",
    toastEnterInstallmentsCount: "أدخل عدد أشهر التقسيط",
    toastPickDownPaymentDate: "حدد تاريخ الدفعة الأولى",
    toastYearAdded: "تمت إضافة السنة الدراسية",
    toastYearUpdated: "تم تحديث جدول الأقساط لهذي السنة",
    toastOvershoot: "تنبيه: مجموع الأقساط صار أكبر من القسط السنوي الكلي",
    toastInstallmentEdited: "تم تعديل القسط وإعادة توزيع الباقي على باقي الأقساط",
    toastDeferAppended: "تم تأجيل القسط لآخر الجدول",
    toastDeferSpread: "تم توزيع القسط على باقي الأشهر",
    toastPickCategory: "اختر الفئة",
    toastEnterValidBudget: "أدخل ميزانية شهرية صحيحة",
    toastBudgetExists: "يوجد ميزانية لهذه الفئة بالفعل",
    toastBudgetAdded: "تمت إضافة الميزانية",
    toastBudgetEdited: "تم تعديل الميزانية",
    defaultNoteText: "بدون وصف",

    statusActive: "نشط",
    statusUpcoming: "لسا ما بدأ",
    statusEnded: "انتهى",

    // fiscal month settings
    settingsTitle: "الإعدادات",
    periodStartLabel: "تاريخ بداية فترة {month}",
    periodStartHelp: "بدل ما تبلش كل فترة يوم 1 دايماً، حدد تاريخ البداية الفعلي (مثلاً حسب تاريخ نزول الراتب). نهاية الفترة بتنحسب تلقائياً = يوم قبل بداية الفترة يلي بعدها.",
    periodEndAuto: "نهاية هذه الفترة (تلقائي): {date}",
    resetToDefault: "استخدام الافتراضي (أول الشهر)",
    overridesListTitle: "الفترات المخصصة",
    periodStartOutOfRange: "تاريخ البداية لازم يكون بين {min} و {max}",
    periodStartAllowedRange: "المسموح: بين {min} و {max}",
    fiscalStartDayNote: "التغيير ما بيمسح ولا بيغيّر أي بيانات محفوظة — بس بيغيّر شلون بتنعرض وتنحسب.",

    // backup / import
    backupTitle: "نسخة احتياطية واستيراد",
    backupDesc: "بياناتك محفوظة بس على هذا المتصفح. صدّر نسخة احتياطية بشكل دوري عشان ما تضيع.",
    exportJsonBtn: "تصدير JSON",
    exportExcelBtn: "تصدير Excel",
    importJsonBtn: "استيراد من JSON",
    importConfirmTitle: "استيراد بيانات جديدة؟",
    importConfirmMsg: "هاد رح يستبدل كل بياناتك الحالية بالبيانات من الملف. لو بدك تحتفظ ببياناتك الحالية، صدّرها كنسخة احتياطية الأول.",
    importConfirmBtn: "تأكيد الاستيراد",
    toastImportSuccess: "تم استيراد البيانات بنجاح",
    toastImportError: "الملف مش صالح — تأكد إنه ملف JSON مصدّر من هذا البرنامج",
    toastExported: "تم التصدير",

    // generic confirm delete
    confirmDeleteGeneric: "تأكيد الحذف؟",

    // category rename
    toastCategoryRenamed: "تم تغيير اسم الفئة",

    // double-count warning
    fixedExpenseWarning: "فيه مصروف ثابت نشط بهذه الفئة هالشهر — تأكد إنك ما تسجل نفس الدفعة مرتين",

    // duplicate detection in paste
    toastDuplicatesFlagged: "تنبيه: {n} حركة تشبه حركات موجودة أصلاً — راجعها قبل التأكيد",
    duplicateTag: "تكرار محتمل",

    // goal priority
    priorityLabel: "الأولوية (رقم أصغر = أولوية أعلى)",
    priorityHelp: "الأهداف الأعلى أولوية بتاخذ من الفائض الشهري أول.",

    // trend chart
    trendChartTitle: "اتجاه الصرف — آخر 12 شهر مالي",

    // search / filter entries
    searchPlaceholder: "بحث بالوصف...",
    filterAllCategories: "كل الفئات",
    noEntriesMatchFilter: "ما فيه حركات تطابق البحث/الفلتر",

    // validation
    toastEndBeforeStart: "تاريخ الانتهاء لازم يكون بعد تاريخ البداية",
  },
  en: {
    appName: "Compass",
    tagline: "Today's spending, tomorrow's direction",
    loading: "Loading...",
    authLoginTitle: "Sign in", authSetupTitle: "Create local account", authUsername: "Username", authPassword: "Password", authPassword2: "Confirm password", authLoginBtn: "Sign in", authCreateBtn: "Create account", authSwitchSetup: "First time? Create account", authSwitchLogin: "I already have an account", authRequired: "Enter username and password", authPasswordShort: "Password must be at least 4 characters", authPasswordsMismatch: "Passwords do not match", authInvalid: "Invalid username or password", authCreated: "Account created", settingsGeneral: "General", settingsCategories: "Categories", settingsBackup: "Backup", settingsAccount: "Account", exportMenu: "Export / Import", showDetails: "View details", viewAll: "View all", linkedFixedLabel: "Link to fixed expense", noLink: "No link", consumedLabel: "Consumed", remainingLabel: "Remaining", fixedConsumptionTitle: "Fixed expense consumption", noFixedLink: "No fixed expense linked", logout: "Sign out", accountLocalNote: "Cloud login via Supabase - available from any device.", recentViewAll: "View all transactions", financialDetails: "Financial details", variableActualLabel: "Actual variable spending", fixedActualConsumed: "Consumed from fixed expenses", fixedBudgetLabel: "Fixed expense allocation", totalActualLabel: "Total actual spending", close: "Close", settingsButton: "Settings", categoriesSettingsNote: "Manage categories here. Renaming updates linked transactions, budgets, and fixed expenses.", addCategorySettings: "Add category", customCategories: "Custom categories", accountUsername: "Current user", fixedLinkHelp: "If this transaction is a payment for a fixed expense, link it here to track consumed and remaining automatically.", fixedConsumedOf: "{consumed} of {amount} JOD", linkedTag: "Linked",
    langToggle: "عربي",

    monthSelectorTitle: "Month in view",
    monthSelectorSub: "All figures and panels below are based on this month — data from past months stays saved.",
    currentMonthBtn: "Current month",

    financialStatusTitle: "Your projected finances for {month}",
    monthlyIncome: "Monthly income",
    fixedExpensesLine: "Fixed expenses (bills, installments, school...)",
    childrenInstallmentsLine: "Children's tuition (school/university)",
    variableExpensesLine: "Projected variable expenses (groceries, transport...)",
    projectedSurplus: "= Projected surplus",
    projectedDeficit: "= Projected deficit",
    surplusNote: "After all your fixed commitments and projected spending, you should have around {amt} JOD left at month end.",
    deficitNote: "After all your fixed commitments and projected spending, you'll need {amt} JOD more to balance the month.",

    statSpentLabel: "Spending this month",
    statSpentSubCurrent: "Day {day} of {dim}",
    statSpentSubPast: "Completed month · {dim} days",
    statSpentSubFuture: "Future month",
    statProjectedLabel: "Projected month end",
    statProjectedSubRemain: "You'll have {amt} JOD left",
    statProjectedSubShort: "You'll be short {amt} JOD",
    statProjectedSubNoIncome: "Add your monthly income below",
    statGoalsLabel: "Your goals",
    statGoalsValueSome: "{n} goals",
    statGoalsValueNone: "No goals yet",
    statGoalsSubSome: "{onTrack} on track out of {total}",
    statGoalsSubNone: "Add one below",
    statCommitmentsLabel: "Fixed monthly commitments",
    statCommitmentsSubChanges: "Some changes coming up",
    statCommitmentsSubDefault: "School, bills, installments...",
    statCommitmentsValueNone: "None yet",

    alertsTitle: "Compass smart alerts",
    alertsNone: "All good, no important alerts right now 🎉",
    alertBudgetExceededTitle: "Budget exceeded",
    alertBudgetExceededMsg: "You went {amt} JOD over your {cat} budget",
    alertBudgetWarningTitle: "Approaching the limit",
    alertBudgetWarningMsg: "You've used {pct}% of your {cat} budget",
    alertDeficitTitle: "Projected deficit",
    alertDeficitMsg: "If spending continues at this rate, you may end the month {amt} JOD short",
    alertEndingSoonTitle: "Commitment ending soon",
    alertEndingSoonMsg: "{name} ends within less than two months",
    alertInstallmentSoonTitle: "Installment coming up",
    alertInstallmentSoonMsg: "{name}: {amt} JOD installment due {date}",
    alertGoalNeedsAttentionTitle: "Goal needs attention",
    alertGoalNeedsAttentionMsg: "{name} needs about {amt} JOD/month to stay on schedule",

    comparisonTitle: "{month} vs. previous month",
    totalSpentLabel: "Total spent",
    comparisonNoData: "Not enough data for the previous month",
    comparisonUp: "↑ Up",
    comparisonDown: "↓ Down",
    comparisonSame: "— No change",

    budgetsTitle: "Monthly budgets — {month}",
    addBudgetBtn: "+ Budget",
    cancel: "Cancel",
    monthlyBudgetPlaceholder: "Monthly budget",
    alertAtPlaceholder: "Alert at %",
    save: "Save",
    budgetsEmpty: "Add a monthly budget per category to track spending and get alerted as you approach the limit.",
    remaining: "{amt} left",
    exceeded: "{amt} over",
    delete: "Delete",

    incomeSourcesTitle: "Income sources",
    addIncomeBtn: "Income source",
    incomeTotalLabel: "Total income this month",
    incomeNameLabel: "Source name (salary, freelance, side income...)",
    incomeNamePlaceholder: "e.g. Main salary",
    monthlyAmountLabel: "Monthly amount (JOD)",
    startDateLabel: "Start date",
    endDateOptionalLabel: "End date (optional)",
    incomeEmpty: "No income sources added yet — add your salary or any other income",
    incomeActive: "Active this month",
    incomeInactive: "Inactive this month",
    incomeFromTo: "From {from} to {to}",
    incomeFromOngoing: "From {from} · ongoing, no end date",
    incomeEditNote: "Editing the start/end date doesn't erase history — past months still use the value that was active then.",
    availableAfterCommitments: "Available after fixed commitments and children's tuition: {amt} JOD monthly",
    perMonth: "JOD/month",

    fixedExpensesTitle: "Fixed expenses — {month}",
    addFixedBtn: "Fixed expense",
    fixedTotalLabel: "Total fixed expenses (includes children's tuition)",
    fixedNameLabel: "Expense name",
    fixedNamePlaceholder: "e.g. Car installment, school",
    categoryLabel: "Category",
    fixedEndDateLabel: "Expected end date (optional)",
    saveFixedBtn: "Save fixed expense",
    fixedEmpty: "No fixed expenses yet — add school, bills, installments...",
    thisMonthInstallment: "This month's installment",
    paid: "Paid",
    unpaid: "Unpaid",
    fromChildrenSection: "From children section",
    fixedEditNote: 'To change the amount itself, use "Value change history" below — this way past values stay historically accurate.',
    currentValue: "JOD/month (current value)",
    startedOn: "Started {date}",
    endsOn: "Ends {date}",
    remainingMonths: "{n} months left",
    lessThanMonth: "Less than a month",
    ended: "Ended",
    notStartedYet: "Not started yet",
    ongoingNoEnd: "Started {date} · ongoing, no set end date",
    endingSoonNote: "Ending soon — after that your available monthly surplus will increase by {amt} JOD",
    historyHide: "▲ Hide value change history",
    historyShow: "▼ Value change history ({n})",
    addValueChangeBtn: "+ Value change",
    newValueLabel: "New value (JOD)",
    effectiveFromLabel: "Effective from",
    fromDate: "From {date}",

    childrenTitle: "Children's schools & universities",
    addChildBtn: "Child",
    childrenTotalLabel: "Total installments due this month",
    childNameLabel: "Child's name",
    childNamePlaceholder: "e.g. Layan",
    childFormNote: "After adding them, you can add an academic year (school or university) with its fee and installment count.",
    childrenEmpty: "No children added yet — add a child, then their academic year",
    confirmDeleteChild: "Delete all their data?",
    confirm: "Confirm",
    downPaymentTag: "down payment",
    monthlyInstallmentTag: "monthly installment",
    notYet: "Not yet",
    deferThisInstallment: "Defer this installment:",
    deferAppend: "Append to end of schedule",
    deferSpread: "Spread across the rest",
    noInstallmentDue: "No installment due this month",
    nextDueLine: "Next installment: {date} · {amt} JOD ({label})",
    yearsLedgerTitle: "Academic years log",
    addYearBtn: "New year",
    stageLabel: "Stage",
    stageSchool: "School",
    stageUniversity: "University",
    yearLabelLabel: "Year label (optional)",
    yearLabelPlaceholder: "e.g. 2026/2027",
    annualFeeLabel: "Annual fee (JOD)",
    annualFeePlaceholder: "2680",
    downPaymentLabel: "Down payment/registration (optional)",
    downPaymentDateLabel: "Down payment date (this counts as the first installment)",
    installmentsCountLabel: "Months to split the rest over",
    firstInstallmentDateLabel: "First monthly installment date (can be any number of months after the down payment)",
    saveYearBtn: "Save year",
    noYearsYet: "No years added yet",
    yearSummary: "{total} JOD total · {unpaid} installments still unpaid · split over {count} months",
    yearSummaryDownPayment: " + {amt} JOD down payment",
    hideSchedule: "▲ Hide installment schedule",
    showSchedule: "▼ Show installment schedule",
    confirmDeleteYear: "Delete this year?",
    editYearNote: "Note: editing this data regenerates the installment schedule (it keeps the paid status for months whose date didn't change, but it discards any manual edits to individual installments).",
    noInstallmentsGenerated: "No installments generated for this year yet — edit it above and set the annual fee and number of months.",

    savingsTitle: "Actual savings",
    addSavingsBtn: "Log a month",
    savingsTotalLabel: "Total actual savings logged",
    savingsFormNote: "Log here how much you actually saved (or lost) last month — a real number, not the projection.",
    monthLabel: "Month",
    savedAmountLabel: "Amount actually saved (JOD)",
    savedAmountPlaceholder: "e.g. 150",
    noteOptionalLabel: "Note (optional)",
    notePlaceholder: "e.g. Extra bonus this month",
    savingsEmpty: "No savings logged yet — log your first month and we'll start building the full picture",
    projectionTitle: "Projected after a number of years",
    yearsCountLabel: "Number of years",
    returnPctLabel: "Expected annual return % (optional)",
    avgMonthlyRecorded: "Based on your logged average monthly savings: {amt} JOD/month",
    avgMonthlyProjected: "Based on your projected average monthly savings from your current surplus (you haven't logged any actual month yet): {amt} JOD/month",
    projectedAfterYears: "Projected after {years} years",

    goalsTitle: "Your financial goals",
    addGoalBtn: "New goal",
    goalsTotalLabel: "Total needed monthly for all goals",
    goalNameLabel: "Goal name",
    goalNamePlaceholder: "e.g. Car, Umrah, wedding",
    targetAmountLabel: "Target amount (JOD)",
    savedSoFarLabel: "Saved so far (JOD)",
    expectedDeadlineLabel: "Expected completion date",
    fundingMethodLabel: "Funding method",
    fundingAuto: "From monthly surplus automatically",
    fundingFixed: "Fixed amount every month",
    goalsEmpty: "No goals yet — add your first financial goal",
    savedOfTarget: "Saved {saved} of {target} JOD",
    goalDeadlineLabel: "Your target date",
    projectedCompletionLabel: "Expected completion",
    notDetermined: "Not determined",
    neededMonthlyLabel: "Needed monthly",
    editSavedLabel: "Edit saved amount",
    goalBehindNote: "At the current funding rate you'll miss your target date — increase the monthly amount or push back the date",

    chartTitle: "Spending path this month",
    actualLegend: "Actual",
    projectedLegend: "Projected",

    manualTab: "Manual entry",
    pasteTab: "Paste from statement",
    addCategoryBtn: "+ New category",
    categoryNameLabel: "Category name",
    categoryNamePlaceholder: "e.g. Education",
    amountLabel: "Amount",
    amountPlaceholder: "0.00",
    descriptionLabel: "Description",
    descriptionPlaceholder: "e.g. Supermarket",
    dateLabel: "Date",
    addBtn: "Add",
    pasteAreaLabel: "Paste expense lines (amount and description per line)",
    pastePlaceholder: "Carrefour supermarket 24.500\nElectricity bill 38\nStarbucks 6.2",
    extractBtn: "Extract transactions",
    reviewBeforeAdding: "Review before adding ({n})",
    confirmAddAll: "Confirm add all",

    recentEntriesTitle: "Recent transactions",
    noEntriesInMonth: "No transactions in {month}",

    // toast / validation messages
    toastValidAmount: "Enter a valid amount",
    toastAdded: "Added",
    toastNoAmountsFound: "Couldn't find any amounts in the text",
    toastEntriesAdded: "Added {n} transactions",
    toastPickDate: "Pick a date",
    toastEdited: "Updated",
    toastEnterCategoryName: "Enter a category name",
    toastCategoryExists: "This category already exists",
    toastCategoryAdded: "Category added",
    toastEnterIncomeName: "Enter the income source name",
    toastPickStartDate: "Pick a start date",
    toastIncomeAdded: "Income source added",
    toastPickMonth: "Pick a month",
    toastMonthAlreadyLogged: "This month is already logged — edit it with the pencil",
    toastSavingsAdded: "This month's actual savings added",
    toastEnterGoalName: "Enter the goal name",
    toastEnterGoalAmount: "Enter the goal amount",
    toastPickDeadline: "Pick an expected completion date",
    toastEnterFixedMonthly: "Enter the fixed monthly amount",
    toastGoalAdded: "Goal added",
    toastEnterFixedName: "Enter the fixed expense name",
    toastFixedAdded: "Fixed expense added",
    toastEnterExpenseName: "Enter the expense name",
    toastPickEffectiveDate: "Pick the date the new value takes effect",
    toastValueChangeRecorded: "Value change recorded",
    toastEnterChildName: "Enter the child's name",
    toastChildAdded: "Child added — now add an academic year for them",
    toastEnterAnnualFee: "Enter the annual fee",
    toastPickFirstInstallmentDate: "Pick the first monthly installment date",
    toastEnterInstallmentsCount: "Enter the number of installment months",
    toastPickDownPaymentDate: "Pick the down payment date",
    toastYearAdded: "Academic year added",
    toastYearUpdated: "Installment schedule updated for this year",
    toastOvershoot: "Warning: total installments now exceed the full annual fee",
    toastInstallmentEdited: "Installment updated and the rest redistributed",
    toastDeferAppended: "Installment deferred to the end of the schedule",
    toastDeferSpread: "Installment spread across the remaining months",
    toastPickCategory: "Choose a category",
    toastEnterValidBudget: "Enter a valid monthly budget",
    toastBudgetExists: "A budget already exists for this category",
    toastBudgetAdded: "Budget added",
    toastBudgetEdited: "Budget updated",
    defaultNoteText: "No description",

    statusActive: "Active",
    statusUpcoming: "Not started",
    statusEnded: "Ended",

    // fiscal month settings
    settingsTitle: "Settings",
    periodStartLabel: "Start date for the {month} period",
    periodStartHelp: "Instead of every period always starting on the 1st, set the actual start date (e.g. to match a salary date). The period's end is calculated automatically as the day before the next period's start.",
    periodEndAuto: "This period's end (automatic): {date}",
    resetToDefault: "Use default (1st of the month)",
    overridesListTitle: "Custom periods",
    periodStartOutOfRange: "Start date must be between {min} and {max}",
    periodStartAllowedRange: "Allowed: between {min} and {max}",
    fiscalStartDayNote: "Changing this doesn't delete or alter any saved data — it only changes how things are displayed and calculated.",

    // backup / import
    backupTitle: "Backup & Import",
    backupDesc: "Your data is only saved on this browser. Export a backup regularly so it doesn't get lost.",
    exportJsonBtn: "Export JSON",
    exportExcelBtn: "Export Excel",
    importJsonBtn: "Import from JSON",
    importConfirmTitle: "Import new data?",
    importConfirmMsg: "This will replace all your current data with the data from the file. If you want to keep your current data, export a backup first.",
    importConfirmBtn: "Confirm import",
    toastImportSuccess: "Data imported successfully",
    toastImportError: "Invalid file — make sure it's a JSON file exported from this app",
    toastExported: "Exported",

    // generic confirm delete
    confirmDeleteGeneric: "Confirm delete?",

    // category rename
    toastCategoryRenamed: "Category renamed",

    // double-count warning
    fixedExpenseWarning: "There's an active fixed expense in this category this month — make sure you're not logging the same payment twice",

    // duplicate detection in paste
    toastDuplicatesFlagged: "Heads up: {n} transactions look like duplicates of existing ones — review before confirming",
    duplicateTag: "Possible duplicate",

    // goal priority
    priorityLabel: "Priority (lower number = higher priority)",
    priorityHelp: "Higher-priority goals get funded from the monthly surplus first.",

    // trend chart
    trendChartTitle: "Spending trend — last 12 fiscal months",

    // search / filter entries
    searchPlaceholder: "Search description...",
    filterAllCategories: "All categories",
    noEntriesMatchFilter: "No transactions match the search/filter",

    // validation
    toastEndBeforeStart: "End date must be after the start date",
  },
};

function makeT(lang) {
  const dict = translations[lang] || translations.ar;
  const fallback = translations.ar;
  return (key, vars) => {
    let str = dict[key] !== undefined ? dict[key] : fallback[key] !== undefined ? fallback[key] : key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.split(`{${k}}`).join(vars[k]);
      });
    }
    return str;
  };
}

const FUNDING_KEYS = { auto: "fundingAuto", fixed: "fundingFixed" };

export default function App() {

  // ---------- V2 Supabase State ----------
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [currentOrgId, setCurrentOrgId] = useState(() => localStorage.getItem("bousala_org") || null);
  const [profile, setProfile] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allOrgs, setAllOrgs] = useState([]);
  const [orgName, setOrgName] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  const fetchProfileAndOrg = async (userId) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (prof) {
      setProfile(prof);
      setIsSuperAdmin(!!prof.is_super_admin);
    }
    // Fetch orgs where user is member - RLS open now
    const { data: orgs } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    if (orgs) {
      setAllOrgs(orgs);
      let targetOrgId = currentOrgId;
      if (!targetOrgId) {
        const { data: membership } = await supabase.from('organization_members').select('organization_id').eq('user_id', userId).limit(1).single();
        targetOrgId = membership?.organization_id || orgs[0]?.id;
      }
      if (targetOrgId) {
        setCurrentOrgId(targetOrgId);
        localStorage.setItem("bousala_org", targetOrgId);
        const found = orgs.find(o=>o.id===targetOrgId);
        if (found) setOrgName(found.name);
        return targetOrgId;
      }
    }
    return currentOrgId;
  };

  const fetchAllData = async (orgId) => {
    if (!orgId) return;
    setLoadingData(true);
    try {
      // First fetch fixed expenses to get their IDs for history filtering (security fix)
      const [
        { data: entriesData },
        { data: incomeData },
        { data: fixedData },
        { data: childrenData },
        { data: yearsData },
        { data: installmentsData },
        { data: goalsData },
        { data: anchorsData },
        { data: categoriesData },
      ] = await Promise.all([
        supabase.from('expense_entries').select('*').eq('organization_id', orgId).order('date', { ascending: false }),
        supabase.from('income_sources').select('*').eq('organization_id', orgId),
        supabase.from('fixed_expenses').select('*').eq('organization_id', orgId),
        supabase.from('children').select('*').eq('organization_id', orgId),
        supabase.from('school_years').select('*').eq('organization_id', orgId),
        supabase.from('installments').select('*').eq('organization_id', orgId).order('month', { ascending: true }),
        supabase.from('goals').select('*').eq('organization_id', orgId),
        supabase.from('fiscal_anchors').select('*').eq('organization_id', orgId),
        supabase.from('categories').select('*').eq('organization_id', orgId),
      ]);
      
      // SECURITY FIX: fetch amount history only for this org's fixed expenses
      let fixedHistData = [];
      if (fixedData && fixedData.length > 0) {
        const fixedIds = fixedData.map(f => f.id);
        const { data: hist } = await supabase.from('fixed_expense_amount_history').select('*').in('fixed_expense_id', fixedIds);
        fixedHistData = hist || [];
      }
      if (entriesData) setEntries(entriesData.map(e=>({ ...e, linkedFixedExpenseId: e.linked_fixed_expense_id })));
      if (incomeData) setIncomeSources(incomeData.map(i=>({ id: i.id, name: i.name, amount: Number(i.amount), startDate: i.start_date, endDate: i.end_date })));
      if (fixedData) {
        setFixedExpenses(fixedData.map(f=>{
          const hist = (fixedHistData||[]).filter(h=>h.fixed_expense_id===f.id).map(h=>({ id: h.id, amount: Number(h.amount), effectiveFrom: h.effective_from }));
          return { id: f.id, name: f.name, amount: Number(f.current_amount), startDate: f.start_date, endDate: f.end_date, amountHistory: hist.length?hist:[{ id: `${f.id}-a0`, amount: Number(f.current_amount), effectiveFrom: f.start_date }] };
        }));
      }
      if (childrenData && yearsData && installmentsData) {
        const reconstructed = childrenData.map(c=>{
          const yrs = (yearsData||[]).filter(y=>y.child_id===c.id).map(y=>{
            const insts = (installmentsData||[]).filter(ins=>ins.year_id===y.id).map(ins=>({
              id: ins.id,
              month: ins.month,
              amount: Number(ins.amount),
              paid: ins.paid,
              paidAmount: Number(ins.paid_amount||0),
              paymentDate: ins.payment_date,
              locked: ins.locked,
              isDownPayment: ins.is_down_payment
            }));
            return { id: y.id, label: y.label, stage: y.stage, annualFee: Number(y.annual_fee), downPayment: Number(y.down_payment), downPaymentDate: y.down_payment_date, installmentsCount: y.installments_count, startDate: y.start_date, installments: insts };
          });
          return { id: c.id, name: c.name, years: yrs };
        });
        setChildren(reconstructed);
        const exp = {};
        reconstructed.forEach(c=>c.years.forEach(y=>exp[y.id]=true));
        setExpandedYears(exp);
      }
      if (goalsData) setGoals(goalsData.map(g=>({ id: g.id, name: g.name, target: Number(g.target_amount), saved: Number(g.current_amount), deadline: g.deadline, funding: 'auto', fixedAmount: '', priority: '0' })));
      if (anchorsData) {
        const anc = {};
        anchorsData.forEach(a=>anc[a.month_key]=a.start_date);
        setFiscalAnchors(anc);
      }
      if (categoriesData && categoriesData.length>0) {
        setCategories(categoriesData.map(c=>({ key: c.key, color: c.color, words: c.words||[] })));
      }
    } catch (e) { console.error(e); }
    finally { setLoadingData(false); setLoaded(true); }
  };


  const [lang, setLang] = useState("ar");
  const t = useMemo(() => makeT(lang), [lang]);
  const dir = lang === "en" ? "ltr" : "rtl";

  const [entries, setEntries] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [incomeForm, setIncomeForm] = useState({ name: "", amount: "", startDate: todayISO(), endDate: "" });
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [editIncomeForm, setEditIncomeForm] = useState(null);
  const [savingsLog, setSavingsLog] = useState([]);
  const [savingsForm, setSavingsForm] = useState({ month: todayISO().slice(0, 7), amount: "", note: "" });
  const [showSavingsForm, setShowSavingsForm] = useState(false);
  const [editingSavingsId, setEditingSavingsId] = useState(null);
  const [editSavingsForm, setEditSavingsForm] = useState(null);
  const [projectionYears, setProjectionYears] = useState("5");
  const [projectionReturnPct, setProjectionReturnPct] = useState("0");
  const [goals, setGoals] = useState([]);
  const [goalForm, setGoalForm] = useState({ name: "", target: "", deadline: "", funding: "auto", fixedAmount: "", saved: "", priority: "0" });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [fixedForm, setFixedForm] = useState({ name: "", amount: "", category: "فواتير", startDate: todayISO(), endDate: "" });
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [editFixedForm, setEditFixedForm] = useState(null);
  const [amountChangeFormFor, setAmountChangeFormFor] = useState(null); // fixedExpense id
  const [amountChangeForm, setAmountChangeForm] = useState({ amount: "", effectiveFrom: todayISO() });
  const [editingAmountChange, setEditingAmountChange] = useState(null); // { fixedId, entryId }
  const [editAmountChangeForm, setEditAmountChangeForm] = useState(null);
  const [expandedFixedHistory, setExpandedFixedHistory] = useState({}); // fixedId -> bool
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editGoalForm, setEditGoalForm] = useState(null);
  const [children, setChildren] = useState([]);
  const [childForm, setChildForm] = useState({ name: "" });
  const [showChildForm, setShowChildForm] = useState(false);
  const [yearFormFor, setYearFormFor] = useState(null); // childId currently adding a year for
  const [yearForm, setYearForm] = useState({ stage: "school", label: "", annualFee: "", downPayment: "", downPaymentDate: "", installmentsCount: "10", startDate: "" });
  const [editingYear, setEditingYear] = useState(null); // { childId, yearId }
  const [editYearForm, setEditYearForm] = useState(null);
  const [expandedYears, setExpandedYears] = useState({}); // yearId -> bool
  const [confirmDeleteChild, setConfirmDeleteChild] = useState(null); // childId pending delete confirmation
  const [confirmDeleteYear, setConfirmDeleteYear] = useState(null); // { childId, yearId } pending delete confirmation
  const [editingInstallment, setEditingInstallment] = useState(null); // { childId, yearId, installmentId }
  const [editInstallmentAmount, setEditInstallmentAmount] = useState("");
  const [editInstallmentDate, setEditInstallmentDate] = useState("");
  const [editingInstallmentPayment, setEditingInstallmentPayment] = useState(null); // { childId, yearId, installmentId }
  const [editInstallmentPaymentAmount, setEditInstallmentPaymentAmount] = useState("");
  const [editInstallmentPaymentDate, setEditInstallmentPaymentDate] = useState("");
  const [deferConfirm, setDeferConfirm] = useState(null); // { childId, yearId, installmentId }
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editEntryForm, setEditEntryForm] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: CATEGORY_COLOR_CHOICES[0] });
  const [loaded, setLoaded] = useState(false);
  // UI-only month selector. It is intentionally NOT persisted.
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const [tab, setTab] = useState("manual"); // manual | paste
  const [form, setForm] = useState({ amount: "", note: "", category: "بقالة", date: todayISO(), linkedFixedExpenseId: "" });
  const [pasteText, setPasteText] = useState("");
  const [pending, setPending] = useState([]);
  const [toast, setToast] = useState("");
  // ---------- Budgets / smart dashboard ----------
  const [budgets, setBudgets] = useState([]);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: "بقالة", monthlyLimit: "", alertAt: "80" });
  const [editingBudgetId, setEditingBudgetId] = useState(null);
  const [editBudgetForm, setEditBudgetForm] = useState(null);
  // ---------- fiscal month / settings ----------
  const [fiscalAnchors, setFiscalAnchors] = useState({});
  // ---------- category rename ----------
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  // ---------- recent entries search/filter ----------
  const [entrySearch, setEntrySearch] = useState("");
  const [entryFilterCategory, setEntryFilterCategory] = useState("all");
  // ---------- backup / import ----------
  const [importPending, setImportPending] = useState(null);
  const fileInputRef = useRef(null);

  // ---------- UX / account / modal state ----------
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loginMode, setLoginMode] = useState("login");
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPassword2, setLoginPassword2] = useState("");
  const [authError, setAuthError] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDetailsSection, setShowDetailsSection] = useState(false);
  const [financialDetail, setFinancialDetail] = useState(null);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [fixedDetailId, setFixedDetailId] = useState(null);
  const [showAllFixedDetails, setShowAllFixedDetails] = useState(false);
  // ---------- Supabase Auth V2 ----------
  async function hashPassword(v){ return v; }
  async function submitAuth() {
    const email = loginUser.trim();
    if (!email || !loginPassword) return setAuthError(t("authRequired"));
    setAuthError("");
    try {
      if (loginMode === "setup") {
        if (loginPassword.length < 6) return setAuthError("كلمة المرور 6 أحرف على الأقل");
        if (loginPassword !== loginPassword2) return setAuthError(t("authPasswordsMismatch"));
        const { data, error } = await supabase.auth.signUp({ email, password: loginPassword });
        if (error) return setAuthError(error.message);
        if (data.user) {
          await supabase.from('profiles').insert({ id: data.user.id, username: email.split('@')[0], full_name: email.split('@')[0] });
          const { data: org } = await supabase.from('organizations').insert({ name: 'حسابي الشخصي', owner_id: data.user.id, created_by: data.user.id }).select().single();
          if (org) {
            await supabase.from('organization_members').insert({ organization_id: org.id, user_id: data.user.id, role: 'owner' });
            const { data: prog } = await supabase.from('programs').select('id').eq('slug','bousala').single();
            if (prog) await supabase.from('organization_subscriptions').insert({ organization_id: org.id, program_id: prog.id });
            setCurrentOrgId(org.id);
            localStorage.setItem("bousala_org", org.id);
          }
          setSupabaseUser(data.user);
          setIsAuthenticated(true);
          showToast(t("authCreated"));
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: loginPassword });
        if (error) return setAuthError(t("authInvalid") + ": " + error.message);
        setSupabaseUser(data.user);
        setIsAuthenticated(true);
      }
    } catch (e) { setAuthError(e.message); }
  }
  async function logout() {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setSupabaseUser(null);
    setLoginPassword("");
    setShowSettingsModal(false);
    setShowExportMenu(false);
    localStorage.removeItem("bousala_org");
    setCurrentOrgId(null);
  }


  // ---------- Supabase Auth & Initial Load V2 ----------
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSupabaseUser(session.user);
        setIsAuthenticated(true);
        setLoginUser(session.user.email);
        const orgId = await fetchProfileAndOrg(session.user.id);
        if (orgId) await fetchAllData(orgId);
        else { setLoaded(true); setAuthReady(true); }
      } else {
        setAuthReady(true);
        setLoaded(true);
      }
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        setIsAuthenticated(true);
        setLoginUser(session.user.email);
        const orgId = await fetchProfileAndOrg(session.user.id);
        if (orgId) await fetchAllData(orgId);
      } else {
        setSupabaseUser(null);
        setIsAuthenticated(false);
        setAuthReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentOrgId && supabaseUser) {
      fetchAllData(currentOrgId);
      localStorage.setItem("bousala_org", currentOrgId);
      const org = allOrgs.find(o=>o.id===currentOrgId);
      if (org) setOrgName(org.name);
    }
  }, [currentOrgId]);


  // Keep the new-entry date aligned with the month currently being reviewed.
  useEffect(() => {
    setForm((prev) => ({ ...prev, date: selectedMonthDefaultDate }));
  }, [selectedMonth]);

  // ---------- persist removed - Supabase handles it ----------

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  async function addManual() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return showToast(t("toastValidAmount"));
    if (!currentOrgId) return showToast("لا يوجد منظمة");
    const { data, error } = await supabase.from('expense_entries').insert({
      organization_id: currentOrgId,
      date: form.date,
      amount: amt,
      note: form.note || t("defaultNoteText"),
      category: form.category,
      linked_fixed_expense_id: form.linkedFixedExpenseId || null
    }).select().single();
    if (error) { console.error(error); return showToast(error.message); }
    setEntries((prev) => [{ id: data.id, date: data.date, amount: Number(data.amount), note: data.note, category: data.category, linkedFixedExpenseId: data.linked_fixed_expense_id }, ...prev]);
    setForm({ amount: "", note: "", category: form.category, date: selectedMonthDefaultDate, linkedFixedExpenseId: "" });
    showToast(t("toastAdded"));
  }

  function handleParse() {
    const parsed = parsePastedText(pasteText, categories, selectedMonthDefaultDate, t("defaultNoteText"));
    if (!parsed.length) return showToast(t("toastNoAmountsFound"));
    const flagged = parsed.map((p) => ({
      ...p,
      isDuplicate: entries.some((e) => e.date === p.date && e.amount === p.amount && e.note === p.note),
    }));
    setPending(flagged);
    const dupCount = flagged.filter((p) => p.isDuplicate).length;
    if (dupCount > 0) showToast(t("toastDuplicatesFlagged", { n: dupCount }));
  }
  async function confirmPending() {
    const clean = pending.map(({ isDuplicate, ...rest }) => rest);
    if (!currentOrgId) return showToast("لا يوجد منظمة");
    if (clean.length === 0) return;
    const toInsert = clean.map(e => ({
      organization_id: currentOrgId,
      date: e.date,
      amount: e.amount,
      note: e.note,
      category: e.category,
      linked_fixed_expense_id: e.linkedFixedExpenseId || null
    }));
    const { data, error } = await supabase.from('expense_entries').insert(toInsert).select();
    if (error) return showToast(error.message);
    const mapped = (data||[]).map(e=>({ id: e.id, date: e.date, amount: Number(e.amount), note: e.note, category: e.category, linkedFixedExpenseId: e.linked_fixed_expense_id }));
    setEntries((prev) => [...mapped, ...prev]);
    const n = mapped.length;
    setPending([]);
    setPasteText("");
    showToast(t("toastEntriesAdded", { n }));
  }
  function updatePending(id, field, value) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }
  function removePending(id) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }
  async function removeEntry(id) {
    const { error } = await supabase.from('expense_entries').delete().eq('id', id);
    if (error) return showToast(error.message);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }
  function startEditEntry(e) {
    setEditingEntryId(e.id);
    setEditEntryForm({ date: e.date, amount: e.amount, note: e.note, category: e.category, linkedFixedExpenseId: e.linkedFixedExpenseId || "" });
  }
  function cancelEditEntry() {
    setEditingEntryId(null);
    setEditEntryForm(null);
  }
  async function saveEditEntry() {
    const amt = parseFloat(editEntryForm.amount);
    if (!amt || amt <= 0) return showToast(t("toastValidAmount"));
    if (!editEntryForm.date) return showToast(t("toastPickDate"));
    if (!currentOrgId) return showToast("لا يوجد منظمة");
    const { error } = await supabase.from('expense_entries').update({
      date: editEntryForm.date,
      amount: amt,
      note: editEntryForm.note || t("defaultNoteText"),
      category: editEntryForm.category,
      linked_fixed_expense_id: editEntryForm.linkedFixedExpenseId || null
    }).eq('id', editingEntryId);
    if (error) return showToast(error.message);
    setEntries((prev) =>
      prev.map((e) => (e.id === editingEntryId ? { ...e, date: editEntryForm.date, amount: amt, note: editEntryForm.note || t("defaultNoteText"), category: editEntryForm.category, linkedFixedExpenseId: editEntryForm.linkedFixedExpenseId || "" } : e))
    );
    setEditingEntryId(null);
    setEditEntryForm(null);
    showToast(t("toastEdited"));
  }

  async function addCategory() {
    const name = categoryForm.name.trim();
    if (!name) return showToast(t("toastEnterCategoryName"));
    if (categories.some((c) => c.key === name)) return showToast(t("toastCategoryExists"));
    if (!currentOrgId) return showToast("لا يوجد منظمة");
    const { data, error } = await supabase.from('categories').insert({
      organization_id: currentOrgId,
      key: name,
      color: categoryForm.color
    }).select().single();
    if (error) return showToast(error.message);
    setCategories((prev) => [...prev.slice(0, -1), { key: data.key, color: data.color, words: [] }, prev[prev.length - 1]]);
    setCategoryForm({ name: "", color: CATEGORY_COLOR_CHOICES[0] });
    setShowCategoryForm(false);
    showToast(t("toastCategoryAdded"));
  }
  async function removeCategory(key) {
    if (key === "أخرى") return;
    const { error } = await supabase.from('categories').delete().eq('organization_id', currentOrgId).eq('key', key);
    if (error) return showToast(error.message);
    setCategories((prev) => prev.filter((c) => c.key !== key));
  }
  function renameCategory(oldKey, newKey) {
    if (oldKey === "أخرى") return;
    const trimmed = (newKey || "").trim();
    if (!trimmed || trimmed === oldKey) return;
    if (categories.some((c) => c.key === trimmed)) return showToast(t("toastCategoryExists"));
    setCategories((prev) => prev.map((c) => (c.key === oldKey ? { ...c, key: trimmed } : c)));
    // Cascade the rename everywhere the old category key is referenced, so nothing becomes orphaned.
    setEntries((prev) => prev.map((e) => (e.category === oldKey ? { ...e, category: trimmed } : e)));
    setFixedExpenses((prev) => prev.map((f) => (f.category === oldKey ? { ...f, category: trimmed } : f)));
    setBudgets((prev) => prev.map((b) => (b.category === oldKey ? { ...b, category: trimmed } : b)));
    setForm((prev) => (prev.category === oldKey ? { ...prev, category: trimmed } : prev));
    setFixedForm((prev) => (prev.category === oldKey ? { ...prev, category: trimmed } : prev));
    setBudgetForm((prev) => (prev.category === oldKey ? { ...prev, category: trimmed } : prev));
    showToast(t("toastCategoryRenamed"));
  }

  async function addIncomeSource() {
    if (!incomeForm.name.trim()) return showToast(t("toastEnterIncomeName"));
    const amount = parseFloat(incomeForm.amount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!incomeForm.startDate) return showToast(t("toastPickStartDate"));
    if (incomeForm.endDate && incomeForm.endDate <= incomeForm.startDate) return showToast(t("toastEndBeforeStart"));
    if (!currentOrgId) return showToast("لا يوجد منظمة");
    const { data, error } = await supabase.from('income_sources').insert({
      organization_id: currentOrgId,
      name: incomeForm.name.trim(),
      amount,
      start_date: incomeForm.startDate,
      end_date: incomeForm.endDate || null
    }).select().single();
    if (error) return showToast(error.message);
    setIncomeSources((prev) => [
      ...prev,
      { id: data.id, name: data.name, amount: Number(data.amount), startDate: data.start_date, endDate: data.end_date },
    ]);
    setIncomeForm({ name: "", amount: "", startDate: todayISO(), endDate: "" });
    setShowIncomeForm(false);
    showToast(t("toastIncomeAdded"));
  }
  async function removeIncomeSource(id) {
    const { error } = await supabase.from('income_sources').delete().eq('id', id);
    if (error) return showToast(error.message);
    setIncomeSources((prev) => prev.filter((s) => s.id !== id));
  }

const menuBtnStyle = { width:"100%", background:"transparent", color:PAPER, borderRadius:7, padding:"8px 9px", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", gap:8, textAlign:"start" };
const modalActionStyle = { background:CARD_SOFT, color:PAPER, border:`1px solid ${GOLD}`, borderRadius:8, padding:"8px 12px", fontWeight:700, display:"flex", alignItems:"center", gap:6 };
function Modal({ title, children, onClose, dir }) { return <div onMouseDown={(e)=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:100,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div dir={dir} className="card" style={{width:"100%",maxWidth:860,maxHeight:"90vh",overflowY:"auto",padding:20,boxShadow:"0 25px 70px #000c"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontSize:18,fontWeight:900}}>{title}</div><button className="btn" onClick={onClose} style={{background:CARD_SOFT,color:PAPER,borderRadius:8,padding:6}}><X size={17}/></button></div>{children}</div></div> }
function DetailList({items,empty,lang}) { if(!items.length)return <div style={{color:MUTED,fontSize:13,padding:10}}>{empty}</div>; return <div style={{display:"flex",flexDirection:"column",gap:7}}>{items.map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",background:CARD_SOFT,borderRadius:9,padding:"10px 12px"}}><div><b>{x.name}</b>{x.sub&&<div style={{fontSize:11,color:MUTED,marginTop:3}}>{x.sub}</div>}</div><b style={{color:TEAL}}>{fmt(x.value)} {lang==="en"?"JOD":"د.أ"}</b></div>)}</div> }
function Metric({label,value}) { return <div><div style={{fontSize:10.5,color:MUTED}}>{label}</div><div style={{fontWeight:900,fontSize:16,marginTop:3}}>{value}</div></div> }
function EntryList({entries,categories,lang,t,editingEntryId,editEntryForm,setEditEntryForm,startEditEntry,saveEditEntry,cancelEditEntry,removeEntry,fixedCalc,selectedMonthStart,selectedMonthEnd}) { if(!entries.length)return <div style={{color:MUTED,fontSize:13,textAlign:"center",padding:20}}>{t("noEntriesMatchFilter")}</div>; return <div style={{display:"flex",flexDirection:"column",gap:6}}>{entries.map(e=><div key={e.id} style={{padding:"8px 4px",borderBottom:`1px solid ${LINE}`}}>{editingEntryId===e.id?<div style={{display:"grid",gap:8,background:CARD_SOFT,borderRadius:10,padding:10}}><div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr",gap:8}}><div><Label>{t("descriptionLabel")}</Label><input className="field" value={editEntryForm.note} onChange={ev=>setEditEntryForm({...editEntryForm,note:ev.target.value})}/></div><div><Label>{t("amountLabel")}</Label><input className="field" type="number" value={editEntryForm.amount} onChange={ev=>setEditEntryForm({...editEntryForm,amount:ev.target.value})}/></div><div><Label>{t("categoryLabel")}</Label><select className="field" value={editEntryForm.category} onChange={ev=>setEditEntryForm({...editEntryForm,category:ev.target.value})}>{categories.map(r=><option key={r.key} value={r.key}>{r.key}</option>)}</select></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><Label>{t("dateLabel")}</Label><input className="field" type="date" value={editEntryForm.date} min={selectedMonthStart} max={selectedMonthEnd} onChange={ev=>setEditEntryForm({...editEntryForm,date:ev.target.value})}/></div><div><Label>{t("linkedFixedLabel")}</Label><select className="field" value={editEntryForm.linkedFixedExpenseId||""} onChange={ev=>setEditEntryForm({...editEntryForm,linkedFixedExpenseId:ev.target.value})}><option value="">{t("noLink")}</option>{fixedCalc.list.filter(f=>f.status==="active").map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div></div><div style={{display:"flex",gap:8}}><button className="btn" onClick={saveEditEntry} style={{background:TEAL,color:INK,borderRadius:8,padding:"6px 14px",fontWeight:700}}>{t("save")}</button><button className="btn" onClick={cancelEditEntry} style={{background:LINE,color:PAPER,borderRadius:8,padding:"6px 14px",fontWeight:700}}>{t("cancel")}</button></div></div>:<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><div><div style={{fontSize:13.5}}>{e.note}</div><div style={{fontSize:11,color:MUTED}}>{e.category} · {e.date}{e.linkedFixedExpenseId?` · ${t("linkedTag")}`:""}</div></div><div style={{display:"flex",alignItems:"center",gap:9}}><b>{fmt(e.amount)} {lang==="en"?"JOD":"د.أ"}</b><Pencil size={13} color={MUTED} style={{cursor:"pointer"}} onClick={()=>startEditEntry(e)}/><ConfirmDeleteButton t={t} size={14} onConfirm={()=>removeEntry(e.id)}/></div></div>}</div>)}</div> }

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12.5, color: MUTED }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || "#EDE7D9" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
function Label({ children }) {
  return <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 5 }}>{children}</div>;
}
function StatusBadge({ status, t }) {
  const map = {
    active: { label: t("statusActive"), bg: "#3E9C7C22", color: "#3E9C7C" },
    upcoming: { label: t("statusUpcoming"), bg: "#8B92A822", color: "#8B92A8" },
    ended: { label: t("statusEnded"), bg: "#6B728022", color: "#6B7280" },
  };
  const s = map[status] || map.active;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
      {s.label}
    </span>
  );
}
// Reusable inline delete confirmation: clicking the X shows a confirm/cancel pair before
// anything is actually deleted, used consistently across every list in the app.
function ConfirmDeleteButton({ onConfirm, t, size = 15 }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        <button
          className="btn"
          onClick={() => { onConfirm(); setConfirming(false); }}
          style={{ background: RED, color: "#fff", borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 11 }}
        >
          {t("confirm")}
        </button>
        <button
          className="btn"
          onClick={() => setConfirming(false)}
          style={{ background: LINE, color: PAPER, borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 11 }}
        >
          {t("cancel")}
        </button>
      </span>
    );
  }
  return <X size={size} color={MUTED} style={{ cursor: "pointer" }} onClick={() => setConfirming(true)} />;
}
