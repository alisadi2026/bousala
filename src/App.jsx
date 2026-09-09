import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import * as XLSX from "xlsx";
import { Plus, ClipboardPaste, Target, TrendingUp, Wallet, AlertTriangle, X, Check, Pencil, Baby, Clock, Bell, PiggyBank, BarChart3, Languages, Download, Upload, Settings, Search, ArrowUpDown, LogOut, ChevronDown, Eye, Link2, Lock, User, SlidersHorizontal } from "lucide-react";

// Plain localStorage-backed persistence for a normal standalone browser app (this is a real
// key/value browser store — appropriate here, unlike inside a Claude.ai artifact sandbox).
// Kept as a local variable (not attached to `window`) so it can't collide with anything else.
const storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value === null ? null : { value };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return true;
  },
  async delete(key) {
    localStorage.removeItem(key);
    return true;
  },
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
    authLoginTitle: "تسجيل الدخول", authSetupTitle: "إنشاء الحساب المحلي", authUsername: "اسم المستخدم", authPassword: "كلمة المرور", authPassword2: "تأكيد كلمة المرور", authLoginBtn: "دخول", authCreateBtn: "إنشاء الحساب", authSwitchSetup: "أول مرة؟ إنشاء حساب", authSwitchLogin: "لدي حساب بالفعل", authRequired: "أدخل اسم المستخدم وكلمة المرور", authPasswordShort: "كلمة المرور يجب أن تكون 4 أحرف على الأقل", authPasswordsMismatch: "كلمتا المرور غير متطابقتين", authInvalid: "اسم المستخدم أو كلمة المرور غير صحيحة", authCreated: "تم إنشاء الحساب بنجاح", settingsGeneral: "عام", settingsCategories: "الفئات", settingsBackup: "النسخ الاحتياطي", settingsAccount: "الحساب", exportMenu: "التصدير / الاستيراد", showDetails: "عرض التفاصيل", viewAll: "عرض الكل", linkedFixedLabel: "ربط بالمصروف الثابت", noLink: "بدون ربط", consumedLabel: "المستهلك", remainingLabel: "المتبقي", fixedConsumptionTitle: "استهلاك المصاريف الثابتة", noFixedLink: "لا يوجد ربط بمصروف ثابت", logout: "تسجيل الخروج", accountLocalNote: "هذا الدخول محلي على هذا المتصفح وليس نظام حسابات سحابياً.", recentViewAll: "عرض كل الحركات", financialDetails: "تفاصيل الوضع المالي", variableActualLabel: "المصاريف المتغيرة الفعلية", fixedActualConsumed: "المستهلك من المصاريف الثابتة", fixedBudgetLabel: "مخصص المصاريف الثابتة", totalActualLabel: "إجمالي المصروف الفعلي", close: "إغلاق", settingsButton: "الإعدادات", categoriesSettingsNote: "إدارة الفئات من هنا. تغيير الاسم يحدّث الحركات والميزانيات والمصاريف الثابتة المرتبطة بها.", addCategorySettings: "إضافة فئة", customCategories: "الفئات المخصصة", accountUsername: "المستخدم الحالي" , fixedLinkHelp: "إذا كانت الحركة دفعة لمصروف ثابت، اربطها هنا ليظهر الاستهلاك والمتبقي تلقائياً.", fixedConsumedOf: "{consumed} من {amount} د.أ" , linkedTag: "مرتبط" ,
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
    authLoginTitle: "Sign in", authSetupTitle: "Create local account", authUsername: "Username", authPassword: "Password", authPassword2: "Confirm password", authLoginBtn: "Sign in", authCreateBtn: "Create account", authSwitchSetup: "First time? Create account", authSwitchLogin: "I already have an account", authRequired: "Enter username and password", authPasswordShort: "Password must be at least 4 characters", authPasswordsMismatch: "Passwords do not match", authInvalid: "Invalid username or password", authCreated: "Account created", settingsGeneral: "General", settingsCategories: "Categories", settingsBackup: "Backup", settingsAccount: "Account", exportMenu: "Export / Import", showDetails: "View details", viewAll: "View all", linkedFixedLabel: "Link to fixed expense", noLink: "No link", consumedLabel: "Consumed", remainingLabel: "Remaining", fixedConsumptionTitle: "Fixed expense consumption", noFixedLink: "No fixed expense linked", logout: "Sign out", accountLocalNote: "This login is local to this browser, not a cloud account system.", recentViewAll: "View all transactions", financialDetails: "Financial details", variableActualLabel: "Actual variable spending", fixedActualConsumed: "Consumed from fixed expenses", fixedBudgetLabel: "Fixed expense allocation", totalActualLabel: "Total actual spending", close: "Close", settingsButton: "Settings", categoriesSettingsNote: "Manage categories here. Renaming updates linked transactions, budgets, and fixed expenses.", addCategorySettings: "Add category", customCategories: "Custom categories", accountUsername: "Current user", fixedLinkHelp: "If this transaction is a payment for a fixed expense, link it here to track consumed and remaining automatically.", fixedConsumedOf: "{consumed} of {amount} JOD", linkedTag: "Linked",
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
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [financialDetail, setFinancialDetail] = useState(null);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [fixedDetailId, setFixedDetailId] = useState(null);
  const [showAllFixedDetails, setShowAllFixedDetails] = useState(false);
  // ---------- local account (browser-only protection) ----------
  async function hashPassword(value) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(value);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return btoa(unescape(encodeURIComponent(value)));
  }

  async function submitAuth() {
    const username = loginUser.trim();
    if (!username || !loginPassword) return setAuthError(t("authRequired"));
    if (loginMode === "setup") {
      if (loginPassword.length < 4) return setAuthError(t("authPasswordShort"));
      if (loginPassword !== loginPassword2) return setAuthError(t("authPasswordsMismatch"));
      const passwordHash = await hashPassword(loginPassword);
      localStorage.setItem("expense-auth", JSON.stringify({ username, passwordHash }));
      localStorage.setItem("auth-session", JSON.stringify({ user: username, timestamp: Date.now() }));
      setIsAuthenticated(true); setAuthError(""); setLoginPassword(""); setLoginPassword2("");
      showToast(t("authCreated"));
      return;
    }
    const savedRaw = localStorage.getItem("expense-auth");
    if (!savedRaw) { setLoginMode("setup"); setAuthError(""); return; }
    try {
      const saved = JSON.parse(savedRaw);
      const passwordHash = await hashPassword(loginPassword);
      if (saved.username === username && saved.passwordHash === passwordHash) {
        localStorage.setItem("auth-session", JSON.stringify({ user: username, timestamp: Date.now() }));
        setIsAuthenticated(true); setAuthError(""); setLoginPassword("");
      } else setAuthError(t("authInvalid"));
    } catch { setAuthError(t("authInvalid")); }
  }

  function logout() {
    setIsAuthenticated(false);
    setLoginPassword("");
    setShowSettingsModal(false);
    setShowExportMenu(false);
    localStorage.removeItem("auth-session");
    storage.delete("auth-session").catch(()=>{});
  }

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      try {
        const sess = await storage.get("auth-session");
        if (sess && sess.value) {
          try {
            const parsed = JSON.parse(sess.value);
            if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < 30*24*60*60*1000) {
              setIsAuthenticated(true);
              if (parsed.user) setLoginUser(parsed.user);
            }
          } catch {}
        }
      } catch {}
      try {
        const e = await storage.get("expense-entries");
        if (e) setEntries(JSON.parse(e.value));
      } catch (err) {}
      try {
        const s = await storage.get("expense-settings");
        if (s) {
          const parsed = JSON.parse(s.value);
          if (parsed.incomeSources) {
            setIncomeSources(parsed.incomeSources);
          } else if (parsed.income) {
            // migrate old single-number income into one always-active source, so nothing is lost
            setIncomeSources([{ id: "income-migrated", name: "راتب", amount: parsed.income, startDate: "2000-01-01", endDate: null }]);
          }
          setGoals(parsed.goals || []);
          setFixedExpenses(migrateFixedExpenses(parsed.fixedExpenses || []));
          setCategories(parsed.categories && parsed.categories.length ? parsed.categories : DEFAULT_CATEGORIES);
          setSavingsLog(parsed.savingsLog || []);
          setBudgets(parsed.budgets || []);
          // Additive field with a safe default (empty = plain calendar months), so older saved
          // data that predates this feature is read exactly as before — nothing is lost or altered.
          setFiscalAnchors(parsed.fiscalAnchors && typeof parsed.fiscalAnchors === "object" ? parsed.fiscalAnchors : {});
          const migrated = migrateChildren(parsed.children || []);
          const normalizedChildren = migrated.map((c) => ({
            ...c,
            years: (c.years || []).map((y) => ({
              ...y,
              installments: (y.installments || []).map((ins) => {
                // One-time correction for the existing school/university installment
                // that was recorded as fully paid (420) although only 210 was paid
                // on 2026-08-29. Keep the original installment amount at 420 and
                // track the actual payment as 210, leaving 210 outstanding.
                const isKnownPartialPayment =
                  Number(ins.amount) === 420 &&
                  (ins.paymentDate || '') === '2026-08-29';
                return {
                  ...ins,
                  paidAmount: isKnownPartialPayment ? 210 : installmentPaidAmount(ins),
                  paid: isKnownPartialPayment ? false : !!ins.paid,
                  paymentDate: ins.paymentDate || null,
                };
              }),
            })),
          }));
          setChildren(normalizedChildren);
          const expanded = {};
          normalizedChildren.forEach((c) => (c.years || []).forEach((y) => (expanded[y.id] = true)));
          setExpandedYears(expanded);
        }
      } catch (err) {}
      try {
        const l = await storage.get("expense-lang");
        if (l && (l.value === "ar" || l.value === "en")) setLang(l.value);
      } catch (err) {}
      setLoaded(true);
      const savedAuth = localStorage.getItem("expense-auth");
      if (savedAuth) {
        try {
          const a = JSON.parse(savedAuth);
          setLoginUser(a.username || "");
          setLoginMode("login");
        } catch { setLoginMode("setup"); }
      } else {
        setLoginMode("setup");
      }
      setAuthReady(true);
    })();
  }, []);

  // Keep the new-entry date aligned with the month currently being reviewed.
  useEffect(() => {
    setForm((prev) => ({ ...prev, date: selectedMonthDefaultDate }));
  }, [selectedMonth]);

  // ---------- persist ----------
  useEffect(() => {
    if (!loaded) return;
    storage.set("expense-entries", JSON.stringify(entries)).catch(() => {});
  }, [entries, loaded]);
  useEffect(() => {
    if (!loaded) return;
    storage.set("expense-settings", JSON.stringify({ incomeSources, goals, fixedExpenses, children, categories, savingsLog, budgets, fiscalAnchors })).catch(() => {});
  }, [incomeSources, goals, fixedExpenses, children, categories, savingsLog, budgets, fiscalAnchors, loaded]);
  useEffect(() => {
    if (!loaded) return;
    storage.set("expense-lang", lang).catch(() => {});
  }, [lang, loaded]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  function addManual() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return showToast(t("toastValidAmount"));
    setEntries((prev) => [
      { id: Math.random().toString(36).slice(2), date: form.date, amount: amt, note: form.note || t("defaultNoteText"), category: form.category, linkedFixedExpenseId: form.linkedFixedExpenseId || null },
      ...prev,
    ]);
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
  function confirmPending() {
    const clean = pending.map(({ isDuplicate, ...rest }) => rest);
    setEntries((prev) => [...clean, ...prev]);
    const n = clean.length;
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
  function removeEntry(id) {
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
  function saveEditEntry() {
    const amt = parseFloat(editEntryForm.amount);
    if (!amt || amt <= 0) return showToast(t("toastValidAmount"));
    if (!editEntryForm.date) return showToast(t("toastPickDate"));
    setEntries((prev) =>
      prev.map((e) => (e.id === editingEntryId ? { ...e, date: editEntryForm.date, amount: amt, note: editEntryForm.note || t("defaultNoteText"), category: editEntryForm.category, linkedFixedExpenseId: editEntryForm.linkedFixedExpenseId || "" } : e))
    );
    setEditingEntryId(null);
    setEditEntryForm(null);
    showToast(t("toastEdited"));
  }

  function addCategory() {
    const name = categoryForm.name.trim();
    if (!name) return showToast(t("toastEnterCategoryName"));
    if (categories.some((c) => c.key === name)) return showToast(t("toastCategoryExists"));
    setCategories((prev) => [...prev.slice(0, -1), { key: name, color: categoryForm.color, words: [] }, prev[prev.length - 1]]);
    setCategoryForm({ name: "", color: CATEGORY_COLOR_CHOICES[0] });
    setShowCategoryForm(false);
    showToast(t("toastCategoryAdded"));
  }
  function removeCategory(key) {
    if (key === "أخرى") return;
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

  function addIncomeSource() {
    if (!incomeForm.name.trim()) return showToast(t("toastEnterIncomeName"));
    const amount = parseFloat(incomeForm.amount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!incomeForm.startDate) return showToast(t("toastPickStartDate"));
    if (incomeForm.endDate && incomeForm.endDate <= incomeForm.startDate) return showToast(t("toastEndBeforeStart"));
    setIncomeSources((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), name: incomeForm.name.trim(), amount, startDate: incomeForm.startDate, endDate: incomeForm.endDate || null },
    ]);
    setIncomeForm({ name: "", amount: "", startDate: todayISO(), endDate: "" });
    setShowIncomeForm(false);
    showToast(t("toastIncomeAdded"));
  }
  function removeIncomeSource(id) {
    setIncomeSources((prev) => prev.filter((s) => s.id !== id));
  }
  function startEditIncome(s) {
    setEditingIncomeId(s.id);
    setEditIncomeForm({ name: s.name, amount: s.amount, startDate: s.startDate, endDate: s.endDate || "" });
  }
  function cancelEditIncome() {
    setEditingIncomeId(null);
    setEditIncomeForm(null);
  }
  function saveEditIncome() {
    if (!editIncomeForm.name.trim()) return showToast(t("toastEnterIncomeName"));
    const amount = parseFloat(editIncomeForm.amount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!editIncomeForm.startDate) return showToast(t("toastPickStartDate"));
    if (editIncomeForm.endDate && editIncomeForm.endDate <= editIncomeForm.startDate) return showToast(t("toastEndBeforeStart"));
    setIncomeSources((prev) =>
      prev.map((s) =>
        s.id === editingIncomeId
          ? { ...s, name: editIncomeForm.name.trim(), amount, startDate: editIncomeForm.startDate, endDate: editIncomeForm.endDate || null }
          : s
      )
    );
    setEditingIncomeId(null);
    setEditIncomeForm(null);
    showToast(t("toastEdited"));
  }

  function addSavingsEntry() {
    if (!savingsForm.month) return showToast(t("toastPickMonth"));
    const amount = parseFloat(savingsForm.amount);
    if (isNaN(amount)) return showToast(t("toastValidAmount"));
    if (savingsLog.some((s) => s.month === savingsForm.month)) return showToast(t("toastMonthAlreadyLogged"));
    setSavingsLog((prev) => [...prev, { id: Math.random().toString(36).slice(2), month: savingsForm.month, amount, note: savingsForm.note || "" }]);
    setSavingsForm({ month: todayISO().slice(0, 7), amount: "", note: "" });
    setShowSavingsForm(false);
    showToast(t("toastSavingsAdded"));
  }
  function removeSavingsEntry(id) {
    setSavingsLog((prev) => prev.filter((s) => s.id !== id));
  }
  function startEditSavings(s) {
    setEditingSavingsId(s.id);
    setEditSavingsForm({ month: s.month, amount: s.amount, note: s.note || "" });
  }
  function cancelEditSavings() {
    setEditingSavingsId(null);
    setEditSavingsForm(null);
  }
  function saveEditSavings() {
    const amount = parseFloat(editSavingsForm.amount);
    if (isNaN(amount)) return showToast(t("toastValidAmount"));
    setSavingsLog((prev) => prev.map((s) => (s.id === editingSavingsId ? { ...s, month: editSavingsForm.month, amount, note: editSavingsForm.note || "" } : s)));
    setEditingSavingsId(null);
    setEditSavingsForm(null);
    showToast(t("toastEdited"));
  }

  function addGoal() {
    if (!goalForm.name.trim()) return showToast(t("toastEnterGoalName"));
    const target = parseFloat(goalForm.target);
    if (!target || target <= 0) return showToast(t("toastEnterGoalAmount"));
    if (!goalForm.deadline) return showToast(t("toastPickDeadline"));
    if (goalForm.funding === "fixed" && (!parseFloat(goalForm.fixedAmount) || parseFloat(goalForm.fixedAmount) <= 0)) {
      return showToast(t("toastEnterFixedMonthly"));
    }
    setGoals((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: goalForm.name.trim(),
        target,
        deadline: goalForm.deadline,
        funding: goalForm.funding,
        fixedAmount: parseFloat(goalForm.fixedAmount) || 0,
        saved: parseFloat(goalForm.saved) || 0,
        priority: parseInt(goalForm.priority) || 0,
        createdAt: todayISO(),
      },
    ]);
    setGoalForm({ name: "", target: "", deadline: "", funding: "auto", fixedAmount: "", saved: "", priority: "0" });
    setShowGoalForm(false);
    showToast(t("toastGoalAdded"));
  }
  function removeGoal(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }
  function updateSaved(id, value) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, saved: parseFloat(value) || 0 } : g)));
  }

  function addFixed() {
    if (!fixedForm.name.trim()) return showToast(t("toastEnterFixedName"));
    const amount = parseFloat(fixedForm.amount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!fixedForm.startDate) return showToast(t("toastPickStartDate"));
    if (fixedForm.endDate && fixedForm.endDate <= fixedForm.startDate) return showToast(t("toastEndBeforeStart"));
    const id = Math.random().toString(36).slice(2);
    setFixedExpenses((prev) => [
      ...prev,
      {
        id,
        name: fixedForm.name.trim(),
        category: fixedForm.category,
        startDate: fixedForm.startDate,
        endDate: fixedForm.endDate || null,
        amountHistory: [{ id: `${id}-a0`, amount, effectiveFrom: fixedForm.startDate }],
      },
    ]);
    setFixedForm({ name: "", amount: "", category: "فواتير", startDate: todayISO(), endDate: "" });
    setShowFixedForm(false);
    showToast(t("toastFixedAdded"));
  }
  function removeFixed(id) {
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  }
  function startEditFixed(f) {
    setEditingFixedId(f.id);
    setEditFixedForm({ name: f.name, category: f.category, startDate: f.startDate, endDate: f.endDate || "" });
  }
  function cancelEditFixed() {
    setEditingFixedId(null);
    setEditFixedForm(null);
  }
  function saveEditFixed() {
    if (!editFixedForm.name.trim()) return showToast(t("toastEnterExpenseName"));
    if (editFixedForm.endDate && editFixedForm.endDate <= editFixedForm.startDate) return showToast(t("toastEndBeforeStart"));
    setFixedExpenses((prev) =>
      prev.map((f) =>
        f.id === editingFixedId
          ? { ...f, name: editFixedForm.name.trim(), category: editFixedForm.category, startDate: editFixedForm.startDate, endDate: editFixedForm.endDate || null }
          : f
      )
    );
    setEditingFixedId(null);
    setEditFixedForm(null);
    showToast(t("toastEdited"));
  }
  function openAmountChangeForm(fixedId) {
    setAmountChangeFormFor(fixedId);
    setAmountChangeForm({ amount: "", effectiveFrom: todayISO() });
  }
  function closeAmountChangeForm() {
    setAmountChangeFormFor(null);
  }
  function addAmountChange() {
    const amount = parseFloat(amountChangeForm.amount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!amountChangeForm.effectiveFrom) return showToast(t("toastPickEffectiveDate"));
    setFixedExpenses((prev) =>
      prev.map((f) =>
        f.id !== amountChangeFormFor
          ? f
          : { ...f, amountHistory: [...(f.amountHistory || []), { id: Math.random().toString(36).slice(2), amount, effectiveFrom: amountChangeForm.effectiveFrom }] }
      )
    );
    setAmountChangeFormFor(null);
    showToast(t("toastValueChangeRecorded"));
  }
  function removeAmountChangeEntry(fixedId, entryId) {
    setFixedExpenses((prev) =>
      prev.map((f) => {
        if (f.id !== fixedId) return f;
        if ((f.amountHistory || []).length <= 1) return f; // keep at least one entry
        return { ...f, amountHistory: f.amountHistory.filter((h) => h.id !== entryId) };
      })
    );
  }
  function startEditAmountChange(fixedId, entry) {
    setEditingAmountChange({ fixedId, entryId: entry.id });
    setEditAmountChangeForm({ amount: entry.amount, effectiveFrom: entry.effectiveFrom });
  }
  function cancelEditAmountChange() {
    setEditingAmountChange(null);
    setEditAmountChangeForm(null);
  }
  function saveEditAmountChange() {
    const amount = parseFloat(editAmountChangeForm.amount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!editAmountChangeForm.effectiveFrom) return showToast(t("toastPickDate"));
    const { fixedId, entryId } = editingAmountChange;
    setFixedExpenses((prev) =>
      prev.map((f) =>
        f.id !== fixedId
          ? f
          : { ...f, amountHistory: f.amountHistory.map((h) => (h.id === entryId ? { ...h, amount, effectiveFrom: editAmountChangeForm.effectiveFrom } : h)) }
      )
    );
    setEditingAmountChange(null);
    setEditAmountChangeForm(null);
    showToast(t("toastEdited"));
  }

  function startEditGoal(g) {
    setEditingGoalId(g.id);
    setEditGoalForm({ name: g.name, target: g.target, deadline: g.deadline, funding: g.funding, fixedAmount: g.fixedAmount || "", saved: g.saved || 0, priority: g.priority ?? 0 });
  }
  function cancelEditGoal() {
    setEditingGoalId(null);
    setEditGoalForm(null);
  }
  function saveEditGoal() {
    if (!editGoalForm.name.trim()) return showToast(t("toastEnterGoalName"));
    const target = parseFloat(editGoalForm.target);
    if (!target || target <= 0) return showToast(t("toastEnterGoalAmount"));
    if (!editGoalForm.deadline) return showToast(t("toastPickDeadline"));
    if (editGoalForm.funding === "fixed" && (!parseFloat(editGoalForm.fixedAmount) || parseFloat(editGoalForm.fixedAmount) <= 0)) {
      return showToast(t("toastEnterFixedMonthly"));
    }
    setGoals((prev) =>
      prev.map((g) =>
        g.id === editingGoalId
          ? { ...g, name: editGoalForm.name.trim(), target, deadline: editGoalForm.deadline, funding: editGoalForm.funding, fixedAmount: parseFloat(editGoalForm.fixedAmount) || 0, saved: parseFloat(editGoalForm.saved) || 0, priority: parseInt(editGoalForm.priority) || 0 }
          : g
      )
    );
    setEditingGoalId(null);
    setEditGoalForm(null);
    showToast(t("toastEdited"));
  }
  function addChild() {
    if (!childForm.name.trim()) return showToast(t("toastEnterChildName"));
    setChildren((prev) => [...prev, { id: Math.random().toString(36).slice(2), name: childForm.name.trim(), years: [] }]);
    setChildForm({ name: "" });
    setShowChildForm(false);
    showToast(t("toastChildAdded"));
  }
  function removeChild(id) {
    setChildren((prev) => prev.filter((c) => c.id !== id));
  }

  function openYearForm(childId) {
    setYearFormFor(childId);
    setYearForm({ stage: "school", label: "", annualFee: "", downPayment: "", downPaymentDate: "", installmentsCount: "10", startDate: "" });
  }
  function closeYearForm() {
    setYearFormFor(null);
  }
  function addChildYear() {
    if (!parseFloat(yearForm.annualFee)) return showToast(t("toastEnterAnnualFee"));
    if (!yearForm.startDate) return showToast(t("toastPickFirstInstallmentDate"));
    if (!parseInt(yearForm.installmentsCount)) return showToast(t("toastEnterInstallmentsCount"));
    if (parseFloat(yearForm.downPayment) > 0 && !yearForm.downPaymentDate) return showToast(t("toastPickDownPaymentDate"));
    const id = Math.random().toString(36).slice(2);
    const y = {
      id,
      stage: yearForm.stage,
      label: yearForm.label.trim() || (yearForm.stage === "university" ? t("stageUniversity") : t("stageSchool")),
      annualFee: parseFloat(yearForm.annualFee) || 0,
      downPayment: parseFloat(yearForm.downPayment) || 0,
      downPaymentDate: yearForm.downPaymentDate || null,
      installmentsCount: parseInt(yearForm.installmentsCount) || 1,
      startDate: yearForm.startDate,
    };
    y.installments = generateInstallments(y);
    setChildren((prev) => prev.map((c) => (c.id === yearFormFor ? { ...c, years: [...c.years, y] } : c)));
    setExpandedYears((s) => ({ ...s, [id]: true }));
    setYearFormFor(null);
    showToast(t("toastYearAdded"));
  }
  function removeChildYear(childId, yearId) {
    setChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, years: c.years.filter((y) => y.id !== yearId) } : c)));
  }
  function startEditYear(childId, y) {
    setEditingYear({ childId, yearId: y.id });
    setEditYearForm({ stage: y.stage, label: y.label, annualFee: y.annualFee, downPayment: y.downPayment, downPaymentDate: y.downPaymentDate || "", installmentsCount: y.installmentsCount, startDate: y.startDate });
  }
  function cancelEditYear() {
    setEditingYear(null);
    setEditYearForm(null);
  }
  function saveEditYear() {
    if (!parseFloat(editYearForm.annualFee)) return showToast(t("toastEnterAnnualFee"));
    if (!editYearForm.startDate) return showToast(t("toastPickFirstInstallmentDate"));
    if (!parseInt(editYearForm.installmentsCount)) return showToast(t("toastEnterInstallmentsCount"));
    if (parseFloat(editYearForm.downPayment) > 0 && !editYearForm.downPaymentDate) return showToast(t("toastPickDownPaymentDate"));
    setChildren((prev) =>
      prev.map((c) => {
        if (c.id !== editingYear.childId) return c;
        return {
          ...c,
          years: c.years.map((y) => {
            if (y.id !== editingYear.yearId) return y;
            const updated = {
              ...y,
              stage: editYearForm.stage,
              label: editYearForm.label.trim() || (editYearForm.stage === "university" ? t("stageUniversity") : t("stageSchool")),
              annualFee: parseFloat(editYearForm.annualFee) || 0,
              downPayment: parseFloat(editYearForm.downPayment) || 0,
              downPaymentDate: editYearForm.downPaymentDate || null,
              installmentsCount: parseInt(editYearForm.installmentsCount) || 1,
              startDate: editYearForm.startDate,
            };
            const freshInstallments = generateInstallments(updated);
            // keep "paid" status for installments whose due month didn't change
            updated.installments = freshInstallments.map((ni) => {
              const old = y.installments.find((oi) => oi.month === ni.month);
              return old ? { ...ni, paid: old.paid, paidAmount: installmentPaidAmount(old), paymentDate: old.paymentDate || null } : ni;
            });
            return updated;
          }),
        };
      })
    );
    setEditingYear(null);
    setEditYearForm(null);
    showToast(t("toastYearUpdated"));
  }
  function toggleInstallmentPaid(childId, yearId, installmentId) {
    setChildren((prev) =>
      prev.map((c) =>
        c.id !== childId
          ? c
          : {
              ...c,
              years: c.years.map((y) =>
                y.id !== yearId ? y : { ...y, installments: y.installments.map((ins) => {
                  if (ins.id !== installmentId) return ins;
                  const willBePaid = !ins.paid;
                  const fullAmount = Number(ins.amount) || 0;
                  return { 
                    ...ins, 
                    paid: willBePaid,
                    paidAmount: willBePaid ? fullAmount : 0,
                    paymentDate: willBePaid ? (ins.paymentDate || todayISO()) : null
                  };
                }) }
              ),
            }
      )
    );
  }

  function updateInstallmentPaymentDate(childId, yearId, installmentId, newPaymentDate) {
    setChildren((prev) =>
      prev.map((c) =>
        c.id !== childId
          ? c
          : {
              ...c,
              years: c.years.map((y) =>
                y.id !== yearId ? y : { ...y, installments: y.installments.map((ins) => (ins.id === installmentId ? { ...ins, paymentDate: newPaymentDate || null } : ins)) }
              ),
            }
      )
    );
  }
  function startEditInstallmentAmount(childId, yearId, ins) {
    setEditingInstallment({ childId, yearId, installmentId: ins.id });
    setEditInstallmentAmount(String(Math.round(ins.amount)));
    setEditInstallmentDate(ins.month);
  }
  function cancelEditInstallmentAmount() {
    setEditingInstallment(null);
    setEditInstallmentAmount("");
    setEditInstallmentDate("");
  }
  function saveEditInstallmentAmount() {
    const amount = parseFloat(editInstallmentAmount);
    if (!amount || amount <= 0) return showToast(t("toastValidAmount"));
    if (!editInstallmentDate) return showToast(t("toastPickDate"));
    const { childId, yearId, installmentId } = editingInstallment;
    const newMonth = lastDayOfMonthISO(editInstallmentDate);
    let overshoot = false;
    setChildren((prev) =>
      prev.map((c) =>
        c.id !== childId
          ? c
          : {
              ...c,
              years: c.years.map((y) => {
                if (y.id !== yearId) return y;
                // apply the date change first, then rebalance amounts (rebalance also marks it locked)
                const withDate = { ...y, installments: y.installments.map((ins) => (ins.id === installmentId ? { ...ins, month: newMonth } : ins)) };
                const result = rebalanceInstallments(withDate, installmentId, amount);
                overshoot = result.overshoot;
                return { ...y, installments: result.installments };
              }),
            }
      )
    );

    setEditingInstallment(null);
    setEditInstallmentAmount("");
    setEditInstallmentDate("");
    showToast(overshoot ? t("toastOvershoot") : t("toastInstallmentEdited"));
  }
  function startEditInstallmentPayment(childId, yearId, ins) {
    setEditingInstallmentPayment({ childId, yearId, installmentId: ins.id });
    setEditInstallmentPaymentAmount(String(Math.round(installmentPaidAmount(ins))));
    setEditInstallmentPaymentDate(ins.paymentDate || new Date().toISOString().slice(0, 10));
  }
  function cancelEditInstallmentPayment() {
    setEditingInstallmentPayment(null);
    setEditInstallmentPaymentAmount("");
    setEditInstallmentPaymentDate("");
  }
  function saveEditInstallmentPayment() {
    const paidAmount = parseFloat(editInstallmentPaymentAmount);
    if (!Number.isFinite(paidAmount) || paidAmount < 0) return showToast(t("toastValidAmount"));
    if (paidAmount > 0 && !editInstallmentPaymentDate) return showToast(t("toastPickDate"));
    const { childId, yearId, installmentId } = editingInstallmentPayment;
    setChildren((prev) =>
      prev.map((c) =>
        c.id !== childId
          ? c
          : {
              ...c,
              years: c.years.map((y) =>
                y.id !== yearId
                  ? y
                  : {
                      ...y,
                      installments: y.installments.map((ins) => {
                        if (ins.id !== installmentId) return ins;
                        const capped = Math.min(Number(ins.amount) || 0, Math.max(0, paidAmount));
                        return {
                          ...ins,
                          paidAmount: capped,
                          paid: capped >= (Number(ins.amount) || 0),
                          paymentDate: capped > 0 ? editInstallmentPaymentDate : null,
                        };
                      }),
                    }
              ),
            }
      )
    );
    cancelEditInstallmentPayment();
    showToast(t("toastInstallmentEdited"));
  }
  function runDeferInstallment(childId, yearId, installmentId, mode) {
    setChildren((prev) =>
      prev.map((c) =>
        c.id !== childId
          ? c
          : { ...c, years: c.years.map((y) => (y.id !== yearId ? y : { ...y, installments: deferInstallment(y, installmentId, mode) })) }
      )
    );
    setDeferConfirm(null);
    showToast(mode === "append" ? t("toastDeferAppended") : t("toastDeferSpread"));
  }

  // ---------- budgets ----------
  function addBudget() {
    const monthlyLimit = parseFloat(budgetForm.monthlyLimit);
    if (!budgetForm.category) return showToast(t("toastPickCategory"));
    if (!monthlyLimit || monthlyLimit <= 0) return showToast(t("toastEnterValidBudget"));
    if (budgets.some((b) => b.category === budgetForm.category)) return showToast(t("toastBudgetExists"));
    setBudgets((prev) => [...prev, { id: Math.random().toString(36).slice(2), category: budgetForm.category, monthlyLimit, alertAt: parseFloat(budgetForm.alertAt) || 80 }]);
    setBudgetForm({ category: "بقالة", monthlyLimit: "", alertAt: "80" });
    setShowBudgetForm(false);
    showToast(t("toastBudgetAdded"));
  }
  function removeBudget(id) { setBudgets((prev) => prev.filter((b) => b.id !== id)); }
  function startEditBudget(b) { setEditingBudgetId(b.id); setEditBudgetForm({ category: b.category, monthlyLimit: b.monthlyLimit, alertAt: b.alertAt || 80 }); }
  function saveEditBudget() {
    const monthlyLimit = parseFloat(editBudgetForm.monthlyLimit);
    if (!monthlyLimit || monthlyLimit <= 0) return showToast(t("toastEnterValidBudget"));
    setBudgets((prev) => prev.map((b) => b.id === editingBudgetId ? { ...b, monthlyLimit, alertAt: parseFloat(editBudgetForm.alertAt) || 80 } : b));
    setEditingBudgetId(null); setEditBudgetForm(null); showToast(t("toastBudgetEdited"));
  }

  // ---------- backup / export / import ----------
  function exportJSON() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries, incomeSources, goals, fixedExpenses, children, categories, savingsLog, budgets, fiscalAnchors, lang,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `basla-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("toastExported"));
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const sheet = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);

    sheet(entries.map((e) => ({ id: e.id, date: e.date, amount: e.amount, note: e.note, category: e.category })), "entries");
    sheet(incomeSources.map((s) => ({ id: s.id, name: s.name, amount: s.amount, startDate: s.startDate, endDate: s.endDate || "" })), "income_sources");
    sheet(fixedExpenses.map((f) => ({ id: f.id, name: f.name, category: f.category, startDate: f.startDate, endDate: f.endDate || "" })), "fixed_expenses");

    const fixedHistory = [];
    fixedExpenses.forEach((f) => (f.amountHistory || []).forEach((h) => fixedHistory.push({ id: h.id, fixedExpenseId: f.id, amount: h.amount, effectiveFrom: h.effectiveFrom })));
    sheet(fixedHistory, "fixed_expense_amount_history");

    sheet(children.map((c) => ({ id: c.id, name: c.name })), "children");

    const years = [];
    children.forEach((c) => (c.years || []).forEach((y) => years.push({ id: y.id, childId: c.id, stage: y.stage, label: y.label, annualFee: y.annualFee, downPayment: y.downPayment, downPaymentDate: y.downPaymentDate || "", installmentsCount: y.installmentsCount, startDate: y.startDate })));
    sheet(years, "academic_years");

    const installments = [];
    children.forEach((c) => (c.years || []).forEach((y) => (y.installments || []).forEach((ins) => installments.push({ id: ins.id, academicYearId: y.id, month: ins.month, amount: ins.amount, paid: ins.paid, locked: !!ins.locked, isDownPayment: !!ins.isDownPayment }))));
    sheet(installments, "installments");

    sheet(goals.map((g) => ({ id: g.id, name: g.name, target: g.target, deadline: g.deadline, funding: g.funding, fixedAmount: g.fixedAmount || 0, saved: g.saved || 0, priority: g.priority || 0, createdAt: g.createdAt || "" })), "goals");
    sheet(savingsLog.map((s) => ({ id: s.id, month: s.month, amount: s.amount, note: s.note || "" })), "savings_log");
    sheet(budgets.map((b) => ({ id: b.id, category: b.category, monthlyLimit: b.monthlyLimit, alertAt: b.alertAt || 80 })), "budgets");
    sheet(categories.map((c) => ({ key: c.key, color: c.color })), "categories");
    sheet(Object.keys(fiscalAnchors).sort().map((k) => ({ monthKey: k, startDate: fiscalAnchors[k] })), "fiscal_periods");
    sheet([{ lang, exportedAt: new Date().toISOString() }], "settings");

    XLSX.writeFile(wb, `basla-backup-${todayISO()}.xlsx`);
    showToast(t("toastExported"));
  }

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setImportPending(data);
      } catch (err) {
        showToast(t("toastImportError"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function confirmImport() {
    const data = importPending;
    if (!data) return;
    if (Array.isArray(data.entries)) setEntries(data.entries);
    if (Array.isArray(data.incomeSources)) setIncomeSources(data.incomeSources);
    if (Array.isArray(data.goals)) setGoals(data.goals);
    if (Array.isArray(data.fixedExpenses)) setFixedExpenses(migrateFixedExpenses(data.fixedExpenses));
    if (Array.isArray(data.children)) setChildren(migrateChildren(data.children));
    if (Array.isArray(data.categories) && data.categories.length) setCategories(data.categories);
    if (Array.isArray(data.savingsLog)) setSavingsLog(data.savingsLog);
    if (Array.isArray(data.budgets)) setBudgets(data.budgets);
    if (data.fiscalAnchors && typeof data.fiscalAnchors === "object") {
      const clean = {};
      Object.keys(data.fiscalAnchors).forEach((k) => {
        const v = data.fiscalAnchors[k];
        const b = periodStartBounds(k);
        if (typeof v === "string" && v >= b.min && v <= b.max) clean[k] = v;
      });
      setFiscalAnchors(clean);
    }
    if (data.lang === "ar" || data.lang === "en") setLang(data.lang);
    setImportPending(null);
    showToast(t("toastImportSuccess"));
  }

  // ---------- selected (fiscal) month helpers ----------
  // "selectedMonth" (YYYY-MM) identifies which calendar month the fiscal period conceptually
  // belongs to. Its real start date can be overridden per-period in `fiscalAnchors`. With no
  // overrides (the default for all existing/older data) this is byte-for-byte identical to
  // plain calendar-month behavior.
  const todayIso = todayISO();
  const currentMonthKey = currentFiscalMonthKey(fiscalAnchors, todayIso);
  const period = useMemo(() => getFiscalPeriod(selectedMonth, fiscalAnchors), [selectedMonth, fiscalAnchors]);
  const selectedMonthStart = period.start;
  const selectedMonthEnd = period.end;
  const selectedMonthLabel = fiscalPeriodLabel(selectedMonth, period, lang);
  const selectedMonthIsCurrent = todayIso >= period.start && todayIso <= period.end;
  const selectedMonthIsPast = period.end < todayIso;
  const selectedMonthDefaultDate = selectedMonthIsCurrent ? todayIso : selectedMonthEnd;

  // ---------- calculations ----------
  const currentIncome = useMemo(() => {
    return incomeSources
      .filter((s) => s.startDate <= selectedMonthEnd && (!s.endDate || s.endDate >= selectedMonthStart))
      .reduce((sum, s) => sum + s.amount, 0);
  }, [incomeSources, selectedMonthStart, selectedMonthEnd]);

  const calc = useMemo(() => {
    const dim = period.days;
    const monthEntries = entries.filter((e) => e.date && e.date >= selectedMonthStart && e.date <= selectedMonthEnd);
    const variableEntries = monthEntries.filter((e) => !e.linkedFixedExpenseId);
    const totalSpent = monthEntries.reduce((sum, e) => sum + e.amount, 0);
    const variableSpent = variableEntries.reduce((sum, e) => sum + e.amount, 0);

    // Past periods are fully actual. Only the current period receives a projection.
    // dayNow is the day index WITHIN the fiscal period (1-based), not the calendar day-of-month,
    // since a fiscal period can span across a calendar month boundary (e.g. 26th to 25th).
    const dayNow = selectedMonthIsCurrent
      ? Math.round((new Date(todayIso) - new Date(selectedMonthStart)) / 86400000) + 1
      : selectedMonthIsPast ? dim : 0;
    const dailyRate = dayNow > 0 ? variableSpent / dayNow : 0;
    const projectedTotal = selectedMonthIsCurrent ? dailyRate * dim : selectedMonthIsPast ? variableSpent : 0;
    const projectedRemaining = currentIncome - projectedTotal;

    const byCategory = categories.map((r) => ({
      name: r.key,
      value: monthEntries.filter((e) => e.category === r.key).reduce((sum, e) => sum + e.amount, 0),
      color: r.color,
    })).filter((c) => c.value > 0);

    const chartData = [];
    for (let d = 1; d <= dim; d++) {
      const dayDate = addDaysISO(selectedMonthStart, d - 1);
      const actualSoFar = monthEntries
        .filter((e) => e.date <= dayDate)
        .reduce((sum, e) => sum + e.amount, 0);

      if (selectedMonthIsPast) {
        chartData.push({ day: d, actual: actualSoFar, projected: null });
      } else if (selectedMonthIsCurrent) {
        chartData.push({
          day: d,
          actual: d <= dayNow ? actualSoFar : null,
          projected: d >= dayNow ? (d === dayNow ? actualSoFar : dailyRate * d) : null,
        });
      } else {
        chartData.push({ day: d, actual: null, projected: null });
      }
    }

    return { totalSpent, variableSpent, dailyRate, projectedTotal, projectedRemaining, byCategory, chartData, dayNow, dim, monthEntries };
  }, [entries, currentIncome, categories, selectedMonthStart, selectedMonthEnd, selectedMonthIsCurrent, selectedMonthIsPast, period.days, todayIso]);

  // ---------- budgets / comparisons / smart alerts ----------
  const budgetCalc = useMemo(() => {
    return budgets.map((b) => {
      const spent = entries
        .filter((e) => e.category === b.category && e.date && e.date >= selectedMonthStart && e.date <= selectedMonthEnd)
        .reduce((sum, e) => sum + e.amount, 0);
      const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      return { ...b, spent, remaining: b.monthlyLimit - spent, percentage, exceeded: spent > b.monthlyLimit, warning: percentage >= (b.alertAt || 80) && percentage < 100 };
    });
  }, [budgets, entries, selectedMonthStart, selectedMonthEnd]);

  const monthlyComparison = useMemo(() => {
    const prevKey = addCalendarMonths(`${selectedMonth}-01`, -1).slice(0, 7);
    const prevPeriod = getFiscalPeriod(prevKey, fiscalAnchors);

    const currentTotal = entries.filter((e) => e.date && e.date >= selectedMonthStart && e.date <= selectedMonthEnd).reduce((sum, e) => sum + e.amount, 0);
    const previousTotal = entries.filter((e) => e.date && e.date >= prevPeriod.start && e.date <= prevPeriod.end).reduce((sum, e) => sum + e.amount, 0);
    const diff = currentTotal - previousTotal;
    const pct = previousTotal > 0 ? (diff / previousTotal) * 100 : null;

    const categoriesComparison = categories.map((c) => {
      const current = entries.filter((e) => e.category === c.key && e.date && e.date >= selectedMonthStart && e.date <= selectedMonthEnd).reduce((sum, e) => sum + e.amount, 0);
      const previous = entries.filter((e) => e.category === c.key && e.date && e.date >= prevPeriod.start && e.date <= prevPeriod.end).reduce((sum, e) => sum + e.amount, 0);
      if (!current && !previous) return null;
      return { name: c.key, current, previous, diff: current - previous, color: c.color };
    }).filter(Boolean).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return { currentTotal, previousTotal, diff, pct, categoriesComparison, previousKey: prevKey };
  }, [entries, categories, selectedMonth, selectedMonthStart, selectedMonthEnd, fiscalAnchors]);

  // ---------- per-goal projections ----------
  const goalsCalc = useMemo(() => {
    // Auto-funded goals are allocated the monthly surplus in priority order (lower priority
    // number = funded first), each getting up to what it actually needs, rather than splitting
    // the surplus evenly regardless of urgency or size.
    const autoGoalsSorted = goals
      .filter((g) => g.funding === "auto")
      .slice()
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    let remainingSurplus = Math.max(calc.projectedRemaining, 0);
    const autoAlloc = {};
    autoGoalsSorted.forEach((g) => {
      const remaining = Math.max(g.target - g.saved, 0);
      const monthsToDeadline = monthsBetween(todayISO(), g.deadline);
      const need = Math.max(remaining / monthsToDeadline, 0);
      const give = Math.min(need, remainingSurplus);
      autoAlloc[g.id] = give;
      remainingSurplus -= give;
    });

    return goals.map((g) => {
      const remaining = Math.max(g.target - g.saved, 0);
      const monthlyContribution = g.funding === "fixed" ? g.fixedAmount : (autoAlloc[g.id] || 0);
      const monthsNeeded = monthlyContribution > 0 ? remaining / monthlyContribution : Infinity;
      const projectedCompletion = monthlyContribution > 0 ? addMonthsISO(todayISO(), monthsNeeded) : null;
      const monthsToDeadline = monthsBetween(todayISO(), g.deadline);
      const neededMonthly = remaining / monthsToDeadline;
      const onTrack = monthlyContribution >= neededMonthly - 0.5 || remaining === 0;
      const progressPct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
      return { ...g, remaining, monthlyContribution, monthsNeeded, projectedCompletion, neededMonthly, onTrack, progressPct };
    });
  }, [goals, calc.projectedRemaining]);

  // ---------- fixed monthly expenses status + linked transaction consumption ----------
  const fixedCalc = useMemo(() => {
    // FIXED: use calendar month only for fixed expenses
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = lastDayOfMonthISO(monthStart);
    const list = fixedExpenses.map((f) => {
      const activeInMonth = f.startDate.slice(0,7) <= selectedMonth && (!f.endDate || f.endDate.slice(0,7) >= selectedMonth);
      const started = f.startDate.slice(0,7) <= selectedMonth;
      const ended = f.endDate && f.endDate.slice(0,7) < selectedMonth;
      const status = ended ? "ended" : activeInMonth ? "active" : started ? "ended" : "upcoming";
      const monthsLeft = f.endDate && status === "active" && !selectedMonthIsPast ? monthsBetween(monthStart, f.endDate) : null;
      const totalMonths = f.endDate ? monthsBetween(f.startDate, f.endDate) : null;
      const elapsedMonths = f.endDate ? monthsBetween(f.startDate, monthEnd) : null;
      const progressPct = totalMonths ? Math.min(100, Math.max(0, (elapsedMonths / totalMonths) * 100)) : null;
      const amount = currentFixedAmount(f, monthEnd);
      const consumed = entries.filter((e) => e.date && e.date.slice(0,7) === selectedMonth && e.linkedFixedExpenseId === f.id).reduce((sum, e) => sum + e.amount, 0);
      const remaining = Math.max(amount - consumed, 0);
      const consumptionPct = amount > 0 ? Math.min(100, (consumed / amount) * 100) : 0;
      return { ...f, status, monthsLeft, progressPct, amount, consumed, remaining, consumptionPct };
    });
    const activeTotal = list.filter((f) => f.status === "active").reduce((sum, f) => sum + f.amount, 0);
    const totalConsumed = list.filter((f) => f.status === "active").reduce((sum, f) => sum + f.consumed, 0);
    const endingSoon = list.filter((f) => f.status === "active" && f.monthsLeft !== null && f.monthsLeft <= 2);
    return { list, activeTotal, totalConsumed, endingSoon };
  }, [fixedExpenses, entries, selectedMonth, selectedMonthIsPast]);

  // ---------- children tuition: actual monthly installments (paid/unpaid ledger) ----------
  const childrenCalc = useMemo(() => {
    const list = children.map((c) => {
      const years = c.years || [];
      let dueThisMonth = 0;
      let dueThisMonthPaid = true;
      let dueThisMonthItems = [];
      let nextDue = null;
      let totalRemainingUnpaid = 0;

      years.forEach((y) => {
        (y.installments || []).forEach((ins) => {
          const paidAmount = installmentPaidAmount(ins);
          const remaining = installmentRemaining(ins);
          if (remaining > 0) totalRemainingUnpaid += remaining;

          if (ins.month >= selectedMonthStart && ins.month <= selectedMonthEnd) {
            // The monthly commitment shown to the user is what is still outstanding.
            dueThisMonth += remaining;
            dueThisMonthItems.push({ ...ins, paidAmount, remaining, yearId: y.id, yearLabel: y.label, stage: y.stage });
            if (remaining > 0) dueThisMonthPaid = false;
          }

          if (remaining > 0 && ins.month > selectedMonthEnd) {
            if (!nextDue || ins.month < nextDue.month) {
              nextDue = { ...ins, paidAmount, remaining, yearId: y.id, yearLabel: y.label, stage: y.stage };
            }
          }
        });
      });

      return { ...c, years, dueThisMonth, dueThisMonthUnpaid: dueThisMonth, dueThisMonthPaid, dueThisMonthItems, nextDue, totalRemainingUnpaid };
    });

    const unpaidDueSoon = list.filter((c) => c.nextDue && monthsBetween(selectedMonthStart, c.nextDue.month) <= 1);
    return { list, totalMonthly, totalMonthlyUnpaid, unpaidDueSoon };
  }, [children, selectedMonthStart, selectedMonthEnd]);

  // ---------- fixed expenses list combined with children's monthly tuition (for display) ----------
  const combinedFixedList = useMemo(() => {
    const childRows = childrenCalc.list
      .filter((c) => c.dueThisMonth > 0)
      .map((c) => ({
        id: `child-${c.id}`,
        isChild: true,
        childId: c.id,
        name: c.name,
        amount: c.dueThisMonth,
        paid: c.dueThisMonthPaid,
        items: c.dueThisMonthItems,
        category: "أقساط",
        status: "active",
        monthsLeft: null,
      }));
    return [...fixedCalc.list, ...childRows];
  }, [fixedCalc.list, childrenCalc.list]);

  // ---------- unified monthly overview (clear surplus/deficit) ----------
  const overview = useMemo(() => {
    // FIXED: exact situation only - income - fixed - children (unpaid), no variable expected
    const totalCommitted = fixedCalc.activeTotal + childrenCalc.totalMonthlyUnpaid;
    const totalOut = totalCommitted; // No variable expected
    const surplus = currentIncome - totalOut;
    return { totalCommitted, totalOut, surplus, totalCommittedAll: fixedCalc.activeTotal + childrenCalc.totalMonthly, variableNotIncluded: calc.projectedTotal };
  }, [fixedCalc.activeTotal, childrenCalc.totalMonthly, childrenCalc.totalMonthlyUnpaid, currentIncome]);

  const smartAlerts = useMemo(() => {
    const list = [];
    budgetCalc.filter((b) => b.exceeded).forEach((b) => list.push({ severity: "danger", title: t("alertBudgetExceededTitle"), message: t("alertBudgetExceededMsg", { cat: b.category, amt: fmt(Math.abs(b.remaining)) }) }));
    budgetCalc.filter((b) => b.warning).forEach((b) => list.push({ severity: "warning", title: t("alertBudgetWarningTitle"), message: t("alertBudgetWarningMsg", { pct: Math.round(b.percentage), cat: b.category }) }));
    if (overview.surplus < 0) list.push({ severity: "danger", title: t("alertDeficitTitle"), message: t("alertDeficitMsg", { amt: fmt(Math.abs(overview.surplus)) }) });
    fixedCalc.endingSoon.forEach((f) => list.push({ severity: "info", title: t("alertEndingSoonTitle"), message: t("alertEndingSoonMsg", { name: f.name }) }));
    childrenCalc.unpaidDueSoon.slice(0, 2).forEach((c) => list.push({ severity: "warning", title: t("alertInstallmentSoonTitle"), message: t("alertInstallmentSoonMsg", { name: c.name, amt: fmt(c.nextDue.amount), date: fmtDateL(c.nextDue.month, lang) }) }));
    goalsCalc.filter((g) => !g.onTrack).slice(0, 2).forEach((g) => list.push({ severity: "warning", title: t("alertGoalNeedsAttentionTitle"), message: t("alertGoalNeedsAttentionMsg", { name: g.name, amt: fmt(g.neededMonthly) }) }));
    return list.slice(0, 6);
  }, [budgetCalc, overview.surplus, fixedCalc.endingSoon, childrenCalc.unpaidDueSoon, goalsCalc, t, lang]);

  // ---------- spending trend across the last 12 fiscal periods ----------
  const trendData = useMemo(() => {
    const points = [];
    for (let i = 11; i >= 0; i--) {
      const key = addCalendarMonths(`${selectedMonth}-01`, -i).slice(0, 7);
      const p = getFiscalPeriod(key, fiscalAnchors);
      const total = entries.filter((e) => e.date >= p.start && e.date <= p.end).reduce((s, e) => s + e.amount, 0);
      const label = new Date(`${p.start}T00:00:00`).toLocaleDateString(lang === "en" ? "en-US" : "ar-JO-u-nu-latn", { month: "short" });
      points.push({ key, label, total });
    }
    return points;
  }, [entries, selectedMonth, fiscalAnchors, lang]);

  // ---------- actual savings log + long-term projection ----------
  const savingsCalc = useMemo(() => {
    const sorted = [...savingsLog].sort((a, b) => (a.month < b.month ? 1 : -1));
    const byYear = {};
    savingsLog.forEach((s) => {
      const y = s.month.slice(0, 4);
      byYear[y] = (byYear[y] || 0) + s.amount;
    });
    const years = Object.keys(byYear).sort((a, b) => b - a).map((y) => ({ year: y, total: byYear[y] }));
    const totalAllTime = savingsLog.reduce((s, e) => s + e.amount, 0);
    const avgMonthly = savingsLog.length > 0 ? totalAllTime / savingsLog.length : Math.max(overview.surplus, 0);
    const yearsN = parseFloat(projectionYears) || 0;
    const annualReturnPct = parseFloat(projectionReturnPct) || 0;
    const months = Math.round(yearsN * 12);
    const monthlyRate = annualReturnPct / 100 / 12;
    let projected = totalAllTime;
    if (months > 0) {
      if (monthlyRate > 0) {
        const growthOnExisting = totalAllTime * Math.pow(1 + monthlyRate, months);
        const growthOnContrib = avgMonthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
        projected = growthOnExisting + growthOnContrib;
      } else {
        projected = totalAllTime + avgMonthly * months;
      }
    }
    return { sorted, years, totalAllTime, avgMonthly, projected, months };
  }, [savingsLog, overview.surplus, projectionYears, projectionReturnPct]);

  if (loaded && authReady && !isAuthenticated) {
    return (
      <div dir={dir} style={{background:INK,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Tajawal','Segoe UI',Tahoma,sans-serif",color:PAPER}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap'); *{box-sizing:border-box} input,button{font-family:inherit}`}</style>
        <div className="card" style={{width:"100%",maxWidth:420,padding:26,borderColor:GOLD,boxShadow:"0 20px 60px #0008"}}>
          <div style={{textAlign:"center",marginBottom:22}}><div style={{width:58,height:58,borderRadius:"50%",border:`2px solid ${GOLD}`,margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={24} color={GOLD}/></div><div style={{fontSize:25,fontWeight:900}}>{t(loginMode==="setup"?"authSetupTitle":"authLoginTitle")}</div><div style={{fontSize:12,color:MUTED,marginTop:5}}>{t("appName")} · {t("tagline")}</div></div>
          <div style={{display:"grid",gap:12}}><div><Label>{t("authUsername")}</Label><input className="field" value={loginUser} onChange={e=>{setLoginUser(e.target.value);setAuthError("")}} autoFocus/></div><div><Label>{t("authPassword")}</Label><input className="field" type="password" value={loginPassword} onChange={e=>{setLoginPassword(e.target.value);setAuthError("")}} onKeyDown={e=>e.key==="Enter"&&submitAuth()}/></div>{loginMode==="setup"&&<div><Label>{t("authPassword2")}</Label><input className="field" type="password" value={loginPassword2} onChange={e=>setLoginPassword2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitAuth()}/></div>}{authError&&<div style={{color:RED,fontSize:12,background:`${RED}18`,padding:9,borderRadius:8}}>{authError}</div>}<button className="btn" onClick={submitAuth} style={{background:GOLD,color:INK,borderRadius:10,padding:"11px 16px",fontWeight:900,fontSize:14}}>{t(loginMode==="setup"?"authCreateBtn":"authLoginBtn")}</button><button className="btn" onClick={()=>{setLoginMode(loginMode==="setup"?"login":"setup");setAuthError("")}} style={{background:"transparent",color:GOLD,padding:6,fontSize:12,fontWeight:700}}>{t(loginMode==="setup"?"authSwitchLogin":"authSwitchSetup")}</button></div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div style={{ background: INK, minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontFamily: "Tajawal, sans-serif" }}>
        {t("loading")}
      </div>
    );
  }

  return (
    <div dir={dir} style={{ background: INK, minHeight: "100vh", fontFamily: "'Tajawal','Segoe UI',Tahoma,sans-serif", color: PAPER, padding: "28px 18px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; }
        input, select, textarea, button { font-family: inherit; }
        input::placeholder, textarea::placeholder { color: #6B7280; }
        .card { background: ${CARD}; border: 1px solid ${LINE}; border-radius: 16px; }
        .btn { cursor: pointer; border: none; transition: transform .12s ease, opacity .12s ease; }
        .btn:active { transform: scale(0.97); }
        .field { background: ${CARD_SOFT}; border: 1px solid ${LINE}; border-radius: 10px; color: ${PAPER}; padding: 10px 12px; width: 100%; }
        .field:focus { outline: none; border-color: ${GOLD}; }
        .tab { padding: 9px 18px; border-radius: 999px; cursor: pointer; font-size: 14px; font-weight: 700; }
      `}</style>

      {/* Header / Signature */}
      <div style={{ maxWidth: 980, margin: "0 auto 26px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%", border: `2px solid ${GOLD}`,
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            background: "transparent"
          }}>
            <div style={{
              width: 3, height: 16, background: calc.projectedRemaining >= 0 ? TEAL : RED, borderRadius: 2,
              transform: `rotate(${Math.max(-70, Math.min(70, (calc.projectedRemaining >= 0 ? 1 : -1) * 45))}deg)`,
              transformOrigin: "bottom center", position: "relative", top: -4
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 0.3 }}>{t("appName")}</div>
            <div style={{ fontSize: 12, color: MUTED }}>{t("tagline")}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
            className="btn"
            onClick={() => setLang((l) => (l === "ar" ? "en" : "ar"))}
            style={{ background: CARD_SOFT, color: PAPER, border: `1px solid ${LINE}`, borderRadius: 9, padding: "8px 13px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Languages size={14} color={GOLD} /> {t("langToggle")}
          </button>
          {toast && (
            <div style={{ background: CARD_SOFT, border: `1px solid ${GOLD}`, borderRadius: 10, padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} color={GOLD} /> {toast}
            </div>
          )}
        </div>
      </div>

      {/* Month selector */}
      <div className="card" style={{ maxWidth: 980, margin: "0 auto 18px", padding: 14, borderColor: GOLD }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{t("monthSelectorTitle")}</div>
            <div style={{ color: MUTED, fontSize: 11.5, marginTop: 3 }}>
              {t("monthSelectorSub")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button className="btn" onClick={() => setSelectedMonth(addCalendarMonths(`${selectedMonth}-01`, -1).slice(0, 7))} style={{ background: CARD_SOFT, color: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 10px", fontWeight: 700 }}>{dir === "rtl" ? "‹" : "‹"}</button>
            <input
              className="field"
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              style={{ width: 165, textAlign: "center", fontWeight: 800, borderColor: GOLD }}
            />
            <button className="btn" onClick={() => setSelectedMonth(addCalendarMonths(`${selectedMonth}-01`, 1).slice(0, 7))} style={{ background: CARD_SOFT, color: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 10px", fontWeight: 700 }}>{dir === "rtl" ? "›" : "›"}</button>
            {!selectedMonthIsCurrent && (
              <button className="btn" onClick={() => setSelectedMonth(currentMonthKey)} style={{ background: GOLD, color: INK, borderRadius: 8, padding: "7px 12px", fontWeight: 800 }}>
                {t("currentMonthBtn")}
              </button>
            )}
          </div>
          <div style={{ width: "100%", textAlign: "center", fontSize: 12, color: GOLD, fontWeight: 800 }}>
            {selectedMonthLabel}
          </div>
        </div>
      </div>

      {/* Compact top actions - FIXED with logout button */}
      <div style={{ maxWidth: 980, margin: "0 auto 18px", display: "flex", justifyContent: "flex-end", gap: 8, position: "relative" }}>
        <button className="btn" onClick={logout} style={{ background: "#C1523B", color: "#fff", border: `1px solid #C1523B`, borderRadius: 9, padding: "8px 13px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><LogOut size={14} /> {t("logout")}</button>
        <button className="btn" onClick={() => setShowSettingsModal(true)} style={{ background: CARD_SOFT, color: PAPER, border: `1px solid ${LINE}`, borderRadius: 9, padding: "8px 13px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Settings size={14} color={GOLD} /> {t("settingsButton")}</button>
        <button className="btn" onClick={() => setShowExportMenu((v) => !v)} style={{ background: CARD_SOFT, color: PAPER, border: `1px solid ${LINE}`, borderRadius: 9, padding: "8px 13px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Download size={14} color={GOLD} /> {t("exportMenu")} <ChevronDown size={13} /></button>
        {showExportMenu && <div style={{ position: "absolute", top: 43, insetInlineEnd: 0, zIndex: 50, background: CARD, border: `1px solid ${LINE}`, borderRadius: 10, padding: 7, minWidth: 190, boxShadow: "0 14px 30px #0008" }}>
          <button className="btn" onClick={() => { exportJSON(); setShowExportMenu(false); }} style={menuBtnStyle}><Download size={14} /> {t("exportJsonBtn")}</button>
          <button className="btn" onClick={() => { exportExcel(); setShowExportMenu(false); }} style={menuBtnStyle}><Download size={14} /> {t("exportExcelBtn")}</button>
          <button className="btn" onClick={() => { fileInputRef.current && fileInputRef.current.click(); setShowExportMenu(false); }} style={menuBtnStyle}><Upload size={14} /> {t("importJsonBtn")}</button>
        </div>}
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFileChange} style={{ display: "none" }} />
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>

        <div style={{ display:"flex", justifyContent:"center" }}>
          <button className="btn" onClick={()=>setShowDetailsSection(!showDetailsSection)} style={{ background:"transparent", color:MUTED, border:`1px dashed ${LINE}`, borderRadius:9, padding:"8px 16px", fontSize:12, fontWeight:700 }}>
            {showDetailsSection ? (lang==="en" ? "▲ Hide Details" : "▲ إخفاء التفاصيل") : (lang==="en" ? "▼ Show All Details" : "▼ عرض كل التفاصيل")}
          </button>
        </div>

        {/* Clear surplus/deficit banner */}
        {currentIncome > 0 && (
          <div className="card" style={{ padding: 22, borderColor: overview.surplus >= 0 ? TEAL : RED, background: `linear-gradient(135deg, ${CARD} 60%, ${overview.surplus >= 0 ? "#3E9C7C14" : "#C1523B14"})` }}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 14, fontWeight: 700 }}>{t("financialStatusTitle", { month: selectedMonthLabel })}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div onClick={()=>setFinancialDetail('income')} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", cursor:"pointer" }}>
                <span style={{ fontSize: 13.5, color: PAPER, display:"flex", alignItems:"center", gap:6 }}>{t("monthlyIncome")} <Eye size={12} color={GOLD}/></span>
                <span style={{ fontSize: 15, fontWeight: 700, color: TEAL }}>+{fmt(currentIncome)} {lang === "en" ? "JOD" : "د.أ"}</span>
              </div>
              <div onClick={()=>setFinancialDetail('fixed')} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px dashed ${LINE}`, cursor:"pointer" }}>
                <span style={{ fontSize: 13.5, color: PAPER, display:"flex", alignItems:"center", gap:6 }}>{t("fixedExpensesLine")} <Eye size={12} color={GOLD}/></span>
                <span style={{ fontSize: 15, fontWeight: 700, color: RED }}>-{fmt(fixedCalc.activeTotal)} {lang === "en" ? "JOD" : "د.أ"}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", padding: "9px 0", borderTop: `1px dashed ${LINE}` }}>
                <div onClick={()=>setFinancialDetail('children')} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor:"pointer" }}>
                  <span style={{ fontSize: 13.5, color: PAPER, display:"flex", alignItems:"center", gap:6 }}>{t("childrenInstallmentsLine")} <Eye size={12} color={GOLD}/></span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: RED }}>-{fmt(childrenCalc.totalMonthly)} {lang === "en" ? "JOD" : "د.أ"}</span>
                </div>
                {childrenCalc.list.filter(c=>c.dueThisMonth>0).length>0 && (
                  <div style={{ marginTop:8, background: CARD_SOFT, borderRadius:8, padding:"8px 10px" }}>
                    {childrenCalc.list.filter(c=>c.dueThisMonth>0).map(c=>(
                      <div key={c.id} style={{ fontSize:11.5, color:MUTED, marginBottom:4 }}>
                        <span style={{ color:PAPER, fontWeight:700 }}>{c.name}: </span>
                        {c.dueThisMonthItems.map((it,i)=>(
                          <span key={it.id} style={{ display:"inline-block", background: it.paid? "#3E9C7C22" : "#C1523B22", color: it.paid? TEAL : RED, borderRadius:6, padding:"2px 6px", margin:"2px 3px", fontSize:11 }}>
                            {fmtInstallmentMonthL(it.month, lang)} {fmt(it.amount)} {it.paid? "✓" : "✗"}{i < c.dueThisMonthItems.length-1 ? "" : ""}
                          </span>
                        ))}
                        <span style={{ color: PAPER }}> = {fmt(c.dueThisMonth)}</span>
                      </div>
                    ))}
                    
                  </div>
                )}
              </div>
              {/* Variable expected removed as per user request - exact situation only */}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 4px", marginTop: 8, borderTop: `2px solid ${overview.surplus >= 0 ? TEAL : RED}` }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: PAPER }}>{overview.surplus >= 0 ? t("projectedSurplus") : t("projectedDeficit")}</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: overview.surplus >= 0 ? TEAL : RED }}>
                {overview.surplus >= 0 ? "+" : "-"}{fmt(Math.abs(overview.surplus))} {lang === "en" ? "JOD" : "د.أ"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
              {overview.surplus >= 0
                ? t("surplusNote", { amt: fmt(overview.surplus) })
                : t("deficitNote", { amt: fmt(-overview.surplus) })}
            </div>
          </div>
        )}

        {/* COMPACT MAIN ACTIONS - Add transaction & Pay installment */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <button className="btn" onClick={()=>setShowAddEntryModal(true)} style={{ background:GOLD, color:INK, borderRadius:14, padding:"16px", fontWeight:900, fontSize:14, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <Plus size={22}/> {lang==="en" ? "Add Transaction" : "إضافة حركة"}
            <span style={{ fontSize:11, fontWeight:600, opacity:0.7 }}>{lang==="en" ? "Supermarket, bills..." : "سوبرماركت، فواتير..."}</span>
          </button>
          <button className="btn" onClick={()=>setShowPayModal(true)} style={{ background:CARD_SOFT, color:PAPER, border:`1px solid ${GOLD}`, borderRadius:14, padding:"16px", fontWeight:900, fontSize:14, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <Check size={22} color={GOLD}/> {lang==="en" ? "Pay Installment" : "تسديد قسط"}
            <span style={{ fontSize:11, fontWeight:600, color:MUTED }}>{fmt(childrenCalc.totalMonthlyUnpaid)} {lang==="en" ? "JOD due" : "د.أ مستحق"}</span>
          </button>
        </div>


        {showDetailsSection && (
        <div style={{ display:"grid", gap:18 }}>
        {/* Top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
          <StatCard icon={<Wallet size={18} color={GOLD} />} label={t("statSpentLabel")} value={`${fmt(calc.totalSpent)} ${lang === "en" ? "JOD" : "د.أ"}`} sub={selectedMonthIsCurrent ? t("statSpentSubCurrent", { day: calc.dayNow, dim: calc.dim }) : selectedMonthIsPast ? t("statSpentSubPast", { dim: calc.dim }) : t("statSpentSubFuture")} />
          <StatCard
            icon={<TrendingUp size={18} color={calc.projectedRemaining >= 0 ? TEAL : RED} />}
            label={t("statProjectedLabel")}
            value={`${fmt(calc.projectedTotal)} ${lang === "en" ? "JOD" : "د.أ"}`}
            sub={currentIncome > 0 ? (calc.projectedRemaining >= 0 ? t("statProjectedSubRemain", { amt: fmt(calc.projectedRemaining) }) : t("statProjectedSubShort", { amt: fmt(-calc.projectedRemaining) })) : t("statProjectedSubNoIncome")}
            accent={currentIncome > 0 ? (calc.projectedRemaining >= 0 ? TEAL : RED) : MUTED}
          />
          <StatCard
            icon={<Target size={18} color={GOLD} />}
            label={t("statGoalsLabel")}
            value={goalsCalc.length > 0 ? t("statGoalsValueSome", { n: goalsCalc.length }) : t("statGoalsValueNone")}
            sub={goalsCalc.length > 0 ? t("statGoalsSubSome", { onTrack: goalsCalc.filter((g) => g.onTrack).length, total: goalsCalc.length }) : t("statGoalsSubNone")}
            accent={goalsCalc.length > 0 ? (goalsCalc.every((g) => g.onTrack) ? TEAL : RED) : MUTED}
          />
          <StatCard
            icon={<Wallet size={18} color={GOLD} />}
            label={t("statCommitmentsLabel")}
            value={(fixedCalc.activeTotal + childrenCalc.totalMonthly) > 0 ? `${fmt(fixedCalc.activeTotal + childrenCalc.totalMonthly)} ${lang === "en" ? "JOD" : "د.أ"}` : t("statCommitmentsValueNone")}
            sub={fixedCalc.endingSoon.length > 0 || childrenCalc.unpaidDueSoon.length > 0 ? t("statCommitmentsSubChanges") : t("statCommitmentsSubDefault")}
            accent={fixedCalc.endingSoon.length > 0 || childrenCalc.unpaidDueSoon.length > 0 ? GOLD : MUTED}
          />
        </div>

        {/* Smart dashboard: alerts, budgets, comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Bell size={16} color={GOLD} /> {t("alertsTitle")}</div>
            {smartAlerts.length === 0 ? <div style={{ color: TEAL, fontSize: 13 }}>{t("alertsNone")}</div> : smartAlerts.map((a, i) => {
              const color = a.severity === "danger" ? RED : a.severity === "warning" ? GOLD : TEAL;
              return <div key={i} style={{ borderRight: `3px solid ${color}`, padding: "9px 10px", marginBottom: 8, background: CARD_SOFT, borderRadius: 8 }}><div style={{ fontWeight: 700, fontSize: 12.5, color }}>{a.title}</div><div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{a.message}</div></div>;
            })}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><BarChart3 size={16} color={GOLD} /> {t("comparisonTitle", { month: selectedMonthLabel })}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}><span style={{ color: MUTED, fontSize: 12 }}>{t("totalSpentLabel")}</span><b style={{ fontSize: 22 }}>{fmt(monthlyComparison.currentTotal)} {lang === "en" ? "JOD" : "د.أ"}</b></div>
            <div style={{ fontSize: 12.5, color: monthlyComparison.diff > 0 ? RED : monthlyComparison.diff < 0 ? TEAL : MUTED, marginBottom: 10 }}>{monthlyComparison.pct === null ? t("comparisonNoData") : `${monthlyComparison.diff > 0 ? t("comparisonUp") : monthlyComparison.diff < 0 ? t("comparisonDown") : t("comparisonSame")} ${Math.abs(monthlyComparison.pct).toFixed(0)}%`}</div>
            {monthlyComparison.categoriesComparison.slice(0,3).map((c) => <div key={c.name} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderTop:`1px solid ${LINE}` }}><span>{c.name}</span><span style={{ color: c.diff > 0 ? RED : c.diff < 0 ? TEAL : MUTED }}>{c.diff > 0 ? "↑" : c.diff < 0 ? "↓" : "—"} {fmt(Math.abs(c.diff))} {lang === "en" ? "JOD" : "د.أ"}</span></div>)}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}><div style={{ fontWeight:800, fontSize:14, display:"flex", alignItems:"center", gap:8 }}><PiggyBank size={16} color={GOLD} />{t("budgetsTitle", { month: selectedMonthLabel })}</div><button className="btn" onClick={() => setShowBudgetForm(!showBudgetForm)} style={{ background: showBudgetForm ? CARD_SOFT : GOLD, color: showBudgetForm ? PAPER : INK, borderRadius:8, padding:"6px 12px", fontWeight:700 }}>{showBudgetForm ? t("cancel") : t("addBudgetBtn")}</button></div>
          {showBudgetForm && <div style={{ background:CARD_SOFT, padding:12, borderRadius:10, marginBottom:14, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}><select className="field" value={budgetForm.category} onChange={(e)=>setBudgetForm({...budgetForm,category:e.target.value})}>{categories.map(c=><option key={c.key} value={c.key}>{c.key}</option>)}</select><input className="field" type="number" placeholder={t("monthlyBudgetPlaceholder")} value={budgetForm.monthlyLimit} onChange={(e)=>setBudgetForm({...budgetForm,monthlyLimit:e.target.value})}/><input className="field" type="number" placeholder={t("alertAtPlaceholder")} value={budgetForm.alertAt} onChange={(e)=>setBudgetForm({...budgetForm,alertAt:e.target.value})}/><button className="btn" onClick={addBudget} style={{ background:TEAL, color:INK, borderRadius:8, fontWeight:700 }}>{t("save")}</button></div>}
          {budgetCalc.length === 0 ? <div style={{ color:MUTED, fontSize:13 }}>{t("budgetsEmpty")}</div> : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:12 }}>{budgetCalc.map((b)=>{ const color=b.exceeded?RED:b.warning?GOLD:TEAL; return <div key={b.id} style={{ background:CARD_SOFT, borderRadius:10, padding:12, border:`1px solid ${LINE}` }}>{editingBudgetId===b.id ? <div style={{ display:"grid", gap:7 }}><input className="field" type="number" value={editBudgetForm.monthlyLimit} onChange={(e)=>setEditBudgetForm({...editBudgetForm,monthlyLimit:e.target.value})}/><input className="field" type="number" value={editBudgetForm.alertAt} onChange={(e)=>setEditBudgetForm({...editBudgetForm,alertAt:e.target.value})}/><div><button className="btn" onClick={saveEditBudget} style={{background:TEAL,color:INK,borderRadius:7,padding:"5px 9px",marginLeft:6}}>{t("save")}</button><button className="btn" onClick={()=>{setEditingBudgetId(null);setEditBudgetForm(null)}} style={{background:LINE,color:PAPER,borderRadius:7,padding:"5px 9px"}}>{t("cancel")}</button></div></div> : <><div style={{display:"flex",justifyContent:"space-between"}}><b>{b.category}</b><span style={{color:MUTED,fontSize:11,cursor:"pointer"}} onClick={()=>startEditBudget(b)}>✎</span></div><div style={{fontSize:12,color:MUTED,margin:"8px 0"}}>{fmt(b.spent)} / {fmt(b.monthlyLimit)} {lang === "en" ? "JOD" : "د.أ"}</div><div style={{height:8,background:LINE,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,b.percentage)}%`,background:color}} /></div><div style={{display:"flex",justifyContent:"space-between",marginTop:7,fontSize:11.5,color}}><span>{Math.round(b.percentage)}%</span><span>{b.remaining>=0?t("remaining", { amt: fmt(b.remaining) }):t("exceeded", { amt: fmt(-b.remaining) })}</span></div><div style={{marginTop:8}}><ConfirmDeleteButton t={t} size={13} onConfirm={()=>removeBudget(b.id)} /></div></>}</div>})}</div>}
        </div>

        {/* Income sources */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={16} color={GOLD} /> {t("incomeSourcesTitle")}
            </div>
            <button className="btn" onClick={() => setShowIncomeForm((s) => !s)} style={{ background: showIncomeForm ? CARD_SOFT : GOLD, color: showIncomeForm ? PAPER : INK, borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {showIncomeForm ? <><X size={13} /> {t("cancel")}</> : <><Plus size={13} /> {t("addIncomeBtn")}</>}
            </button>
          </div>

          {incomeSources.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD_SOFT, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: MUTED }}>{t("incomeTotalLabel")}</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: TEAL }}>{fmt(currentIncome)} {lang === "en" ? "JOD" : "د.أ"}</span>
            </div>
          )}

          {showIncomeForm && (
            <div style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("incomeNameLabel")}</Label>
                  <input className="field" value={incomeForm.name} onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })} placeholder={t("incomeNamePlaceholder")} />
                </div>
                <div>
                  <Label>{t("monthlyAmountLabel")}</Label>
                  <input className="field" type="number" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} placeholder="900" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("startDateLabel")}</Label>
                  <input className="field" type="date" value={incomeForm.startDate} onChange={(e) => setIncomeForm({ ...incomeForm, startDate: e.target.value })} />
                </div>
                <div>
                  <Label>{t("endDateOptionalLabel")}</Label>
                  <input className="field" type="date" value={incomeForm.endDate} onChange={(e) => setIncomeForm({ ...incomeForm, endDate: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={addIncomeSource} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, alignSelf: "flex-start", marginTop: 4 }}>
                {t("save")}
              </button>
            </div>
          )}

          {incomeSources.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "10px 0" }}>{t("incomeEmpty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {incomeSources.map((s) => {
                const active = s.startDate <= selectedMonthEnd && (!s.endDate || s.endDate >= selectedMonthStart);
                return (
                  <div key={s.id} style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, border: `1px solid ${LINE}`, opacity: active ? 1 : 0.55 }}>
                    {editingIncomeId === s.id ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                          <div>
                            <Label>{t("incomeNameLabel")}</Label>
                            <input className="field" value={editIncomeForm.name} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, name: e.target.value })} />
                          </div>
                          <div>
                            <Label>{t("monthlyAmountLabel")}</Label>
                            <input className="field" type="number" value={editIncomeForm.amount} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, amount: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <Label>{t("startDateLabel")}</Label>
                            <input className="field" type="date" value={editIncomeForm.startDate} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, startDate: e.target.value })} />
                          </div>
                          <div>
                            <Label>{t("endDateOptionalLabel")}</Label>
                            <input className="field" type="date" value={editIncomeForm.endDate} onChange={(e) => setEditIncomeForm({ ...editIncomeForm, endDate: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: MUTED }}>{t("incomeEditNote")}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" onClick={saveEditIncome} style={{ background: TEAL, color: INK, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("save")}</button>
                          <button className="btn" onClick={cancelEditIncome} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("cancel")}</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div>
                            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{fmt(s.amount)} {t("perMonth")} · {active ? t("incomeActive") : t("incomeInactive")}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Pencil size={14} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditIncome(s)} />
                            <ConfirmDeleteButton t={t} size={15} onConfirm={() => removeIncomeSource(s.id)} />
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
                          {s.endDate ? t("incomeFromTo", { from: fmtDateL(s.startDate, lang), to: fmtDateL(s.endDate, lang) }) : t("incomeFromOngoing", { from: fmtDateL(s.startDate, lang) })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {currentIncome > 0 && (fixedCalc.activeTotal + childrenCalc.totalMonthly) > 0 && (
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 14 }}>
              {t("availableAfterCommitments", { amt: fmt(currentIncome - fixedCalc.activeTotal - childrenCalc.totalMonthly) })}
            </div>
          )}
        </div>

        {/* Fixed monthly expenses */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={16} color={GOLD} /> {t("fixedExpensesTitle", { month: selectedMonthLabel })}
            </div>
            <button className="btn" onClick={() => setShowFixedForm((s) => !s)} style={{ background: showFixedForm ? CARD_SOFT : GOLD, color: showFixedForm ? PAPER : INK, borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {showFixedForm ? <><X size={13} /> {t("cancel")}</> : <><Plus size={13} /> {t("addFixedBtn")}</>}
            </button>
          </div>

          {(fixedCalc.activeTotal > 0 || childrenCalc.totalMonthly > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD_SOFT, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: MUTED }}>{t("fixedTotalLabel")}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{fmt(fixedCalc.activeTotal + childrenCalc.totalMonthly)} {t("perMonth")}</span>
            </div>
          )}

          {showFixedForm && (
            <div style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("fixedNameLabel")}</Label>
                  <input className="field" value={fixedForm.name} onChange={(e) => setFixedForm({ ...fixedForm, name: e.target.value })} placeholder={t("fixedNamePlaceholder")} />
                </div>
                <div>
                  <Label>{t("monthlyAmountLabel")}</Label>
                  <input className="field" type="number" value={fixedForm.amount} onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })} placeholder="150" />
                </div>
                <div>
                  <Label>{t("categoryLabel")}</Label>
                  <select className="field" value={fixedForm.category} onChange={(e) => setFixedForm({ ...fixedForm, category: e.target.value })}>
                    {categories.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("startDateLabel")}</Label>
                  <input className="field" type="date" value={fixedForm.startDate} onChange={(e) => setFixedForm({ ...fixedForm, startDate: e.target.value })} />
                </div>
                <div>
                  <Label>{t("fixedEndDateLabel")}</Label>
                  <input className="field" type="date" value={fixedForm.endDate} onChange={(e) => setFixedForm({ ...fixedForm, endDate: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={addFixed} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, alignSelf: "flex-start", marginTop: 4 }}>
                {t("saveFixedBtn")}
              </button>
            </div>
          )}

          {combinedFixedList.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "10px 0" }}>{t("fixedEmpty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {combinedFixedList.map((f) => f.isChild ? (
                <div key={f.id} style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, border: `1px solid ${f.paid ? LINE : GOLD}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorOf(f.category, categories) }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name} — {t("thisMonthInstallment")}</div>
                        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                          {f.category} · {fmt(f.amount)} {lang === "en" ? "JOD" : "د.أ"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: f.paid ? "#3E9C7C22" : "#C9A24B22", color: f.paid ? TEAL : GOLD }}>
                        {f.paid ? t("paid") : t("unpaid")}
                      </span>
                      <span style={{ fontSize: 11, color: MUTED, display: "flex", alignItems: "center", gap: 4 }}>
                        <Baby size={13} color={MUTED} /> {t("fromChildrenSection")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={f.id} style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, border: `1px solid ${f.monthsLeft !== null && f.monthsLeft <= 2 ? GOLD : LINE}`, opacity: f.status === "ended" ? 0.55 : 1 }}>
                  {editingFixedId === f.id ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
                        <div>
                          <Label>{t("fixedNameLabel")}</Label>
                          <input className="field" value={editFixedForm.name} onChange={(e) => setEditFixedForm({ ...editFixedForm, name: e.target.value })} />
                        </div>
                        <div>
                          <Label>{t("categoryLabel")}</Label>
                          <select className="field" value={editFixedForm.category} onChange={(e) => setEditFixedForm({ ...editFixedForm, category: e.target.value })}>
                            {categories.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <Label>{t("startDateLabel")}</Label>
                          <input className="field" type="date" value={editFixedForm.startDate} onChange={(e) => setEditFixedForm({ ...editFixedForm, startDate: e.target.value })} />
                        </div>
                        <div>
                          <Label>{t("endDateOptionalLabel")}</Label>
                          <input className="field" type="date" value={editFixedForm.endDate} onChange={(e) => setEditFixedForm({ ...editFixedForm, endDate: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: MUTED }}>{t("fixedEditNote")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={saveEditFixed} style={{ background: TEAL, color: INK, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("save")}</button>
                        <button className="btn" onClick={cancelEditFixed} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("cancel")}</button>
                      </div>
                    </div>
                  ) : (
                  <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorOf(f.category, categories) }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name}</div>
                        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                          {f.category} · {fmt(f.amount)} {t("currentValue")}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StatusBadge status={f.status} t={t} />
                      <Pencil size={14} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditFixed(f)} />
                      <ConfirmDeleteButton t={t} size={15} onConfirm={() => removeFixed(f.id)} />
                    </div>
                  </div>

                  {f.endDate && (
                    <>
                      <div style={{ margin: "10px 0 6px", background: LINE, borderRadius: 999, height: 6, overflow: "hidden" }}>
                        <div style={{ width: `${f.progressPct || 0}%`, height: "100%", background: f.monthsLeft !== null && f.monthsLeft <= 2 ? GOLD : TEAL, borderRadius: 999 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                        <span>{t("startedOn", { date: fmtDateL(f.startDate, lang) })}</span>
                        <span>
                          {f.status === "active" && f.monthsLeft !== null ? (f.monthsLeft < 1 ? t("lessThanMonth") : t("remainingMonths", { n: Math.round(f.monthsLeft) })) : ""}
                          {f.status === "ended" ? t("ended") : ""}
                          {f.status === "upcoming" ? t("notStartedYet") : ""}
                        </span>
                        <span>{t("endsOn", { date: fmtDateL(f.endDate, lang) })}</span>
                      </div>
                    </>
                  )}
                  {!f.endDate && (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{t("ongoingNoEnd", { date: fmtDateL(f.startDate, lang) })}</div>
                  )}
                  {f.monthsLeft !== null && f.monthsLeft <= 2 && f.status === "active" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: GOLD }}>
                      <AlertTriangle size={13} />
                      {t("endingSoonNote", { amt: fmt(f.amount) })}
                    </div>
                  )}

                  {/* value-change history */}
                  <div style={{ marginTop: 10, borderTop: `1px dashed ${LINE}`, paddingTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <button
                        onClick={() => setExpandedFixedHistory((s) => ({ ...s, [f.id]: !s[f.id] }))}
                        style={{ background: "none", border: "none", color: GOLD, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
                      >
                        {expandedFixedHistory[f.id] ? t("historyHide") : t("historyShow", { n: (f.amountHistory || []).length })}
                      </button>
                      <button className="btn" onClick={() => openAmountChangeForm(f.id)} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        {t("addValueChangeBtn")}
                      </button>
                    </div>

                    {amountChangeFormFor === f.id && (
                      <div style={{ display: "flex", gap: 8, alignItems: "end", marginTop: 8, flexWrap: "wrap", background: CARD, borderRadius: 8, padding: 10 }}>
                        <div>
                          <Label>{t("newValueLabel")}</Label>
                          <input className="field" type="number" value={amountChangeForm.amount} onChange={(e) => setAmountChangeForm({ ...amountChangeForm, amount: e.target.value })} style={{ width: 100 }} />
                        </div>
                        <div>
                          <Label>{t("effectiveFromLabel")}</Label>
                          <input className="field" type="date" value={amountChangeForm.effectiveFrom} onChange={(e) => setAmountChangeForm({ ...amountChangeForm, effectiveFrom: e.target.value })} />
                        </div>
                        <button className="btn" onClick={addAmountChange} style={{ background: GOLD, color: INK, borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12 }}>{t("save")}</button>
                        <button className="btn" onClick={closeAmountChangeForm} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12 }}>{t("cancel")}</button>
                      </div>
                    )}

                    {expandedFixedHistory[f.id] && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {[...(f.amountHistory || [])].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)).map((h) => {
                          const isEditingH = editingAmountChange && editingAmountChange.fixedId === f.id && editingAmountChange.entryId === h.id;
                          return (
                            <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: CARD, borderRadius: 6, padding: "6px 8px" }}>
                              {isEditingH ? (
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <input className="field" type="date" value={editAmountChangeForm.effectiveFrom} onChange={(e) => setEditAmountChangeForm({ ...editAmountChangeForm, effectiveFrom: e.target.value })} style={{ padding: "3px 6px", fontSize: 11, width: 125 }} />
                                  <input className="field" type="number" value={editAmountChangeForm.amount} onChange={(e) => setEditAmountChangeForm({ ...editAmountChangeForm, amount: e.target.value })} style={{ width: 70, padding: "3px 6px", fontSize: 11.5 }} />
                                  <Check size={14} color={TEAL} style={{ cursor: "pointer" }} onClick={saveEditAmountChange} />
                                  <X size={14} color={MUTED} style={{ cursor: "pointer" }} onClick={cancelEditAmountChange} />
                                </span>
                              ) : (
                                <>
                                  <span style={{ fontSize: 11.5, color: MUTED }}>{t("fromDate", { date: fmtDateL(h.effectiveFrom, lang) })}</span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(h.amount)} {lang === "en" ? "JOD" : "د.أ"}</span>
                                    <Pencil size={11} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditAmountChange(f.id, h)} />
                                    {(f.amountHistory || []).length > 1 && <X size={12} color={MUTED} style={{ cursor: "pointer" }} onClick={() => removeAmountChangeEntry(f.id, h.id)} />}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Children tuition */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Baby size={16} color={GOLD} /> {t("childrenTitle")}
            </div>
            <button className="btn" onClick={() => setShowChildForm((s) => !s)} style={{ background: showChildForm ? CARD_SOFT : GOLD, color: showChildForm ? PAPER : INK, borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {showChildForm ? <><X size={13} /> {t("cancel")}</> : <><Plus size={13} /> {t("addChildBtn")}</>}
            </button>
          </div>

          {childrenCalc.list.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD_SOFT, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: MUTED }}>{t("childrenTotalLabel")}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{fmt(childrenCalc.totalMonthly)} {lang === "en" ? "JOD" : "د.أ"}</span>
            </div>
          )}

          {showChildForm && (
            <div style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
              <div>
                <Label>{t("childNameLabel")}</Label>
                <input className="field" value={childForm.name} onChange={(e) => setChildForm({ ...childForm, name: e.target.value })} placeholder={t("childNamePlaceholder")} />
              </div>
              <div style={{ fontSize: 11.5, color: MUTED }}>{t("childFormNote")}</div>
              <button className="btn" onClick={addChild} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, alignSelf: "flex-start", marginTop: 4 }}>
                {t("save")}
              </button>
            </div>
          )}

          {childrenCalc.list.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "10px 0" }}>{t("childrenEmpty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {childrenCalc.list.map((c) => (
                <div key={c.id} style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, border: `1px solid ${!c.dueThisMonthPaid && c.dueThisMonth > 0 ? GOLD : LINE}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.name}</div>
                    {confirmDeleteChild === c.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                        <span style={{ color: RED }}>{t("confirmDeleteChild")}</span>
                        <button className="btn" onClick={() => { removeChild(c.id); setConfirmDeleteChild(null); }} style={{ background: RED, color: "#fff", borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 11.5 }}>{t("confirm")}</button>
                        <button className="btn" onClick={() => setConfirmDeleteChild(null)} style={{ background: LINE, color: PAPER, borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 11.5 }}>{t("cancel")}</button>
                      </div>
                    ) : (
                      <X size={15} color={MUTED} style={{ cursor: "pointer" }} onClick={() => setConfirmDeleteChild(c.id)} />
                    )}
                  </div>

                  {/* this month's due installments */}
                  {c.dueThisMonth > 0 ? (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {c.dueThisMonthItems.map((ins) => {
                        const isEditingAmt = editingInstallment && editingInstallment.childId === c.id && editingInstallment.yearId === ins.yearId && editingInstallment.installmentId === ins.id;
                        const isDeferring = deferConfirm && deferConfirm.childId === c.id && deferConfirm.yearId === ins.yearId && deferConfirm.installmentId === ins.id;
                        return (
                          <div key={ins.id} style={{ background: CARD, borderRadius: 8, padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap:"wrap", gap:6 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                                <input type="checkbox" checked={ins.paid} onChange={() => toggleInstallmentPaid(c.id, ins.yearId, ins.id)} />
                                {ins.yearLabel} · {ins.isDownPayment ? t("downPaymentTag") : t("monthlyInstallmentTag")} · {fmtInstallmentMonthL(ins.month, lang)}
                              </label>
                              {ins.paidAmount > 0 && !isEditingAmt && (
                                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                  <span style={{ fontSize:10.5, color:MUTED }}>
                                    {lang === "en" ? "Paid:" : "المدفوع:"} {fmt(ins.paidAmount)} {lang === "en" ? "JOD" : "د.أ"}
                                  </span>
                                  {ins.paymentDate && <span style={{ fontSize:10.5, color:MUTED }}>
                                    {lang === "en" ? "on" : "بتاريخ"} {fmtDateL(ins.paymentDate, lang)}
                                  </span>}
                                </div>
                              )}
                              {isEditingAmt ? (
                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <input className="field" type="date" value={editInstallmentDate} onChange={(e) => setEditInstallmentDate(e.target.value)} style={{ padding: "4px 6px", fontSize: 11.5, width: 130 }} />
                                  <input className="field" type="number" value={editInstallmentAmount} onChange={(e) => setEditInstallmentAmount(e.target.value)} style={{ width: 70, padding: "4px 6px", fontSize: 12 }} />
                                  <Check size={15} color={TEAL} style={{ cursor: "pointer" }} onClick={saveEditInstallmentAmount} />
                                  <X size={15} color={MUTED} style={{ cursor: "pointer" }} onClick={cancelEditInstallmentAmount} />
                                </span>
                              ) : (
                                <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap:"wrap" }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: ins.remaining <= 0 ? TEAL : (ins.paidAmount > 0 ? GOLD : GOLD) }}>
                                    {fmt(ins.remaining)} {lang === "en" ? "JOD" : "د.أ"} · {ins.remaining <= 0 ? t("paid") : (ins.paidAmount > 0 ? (lang === "en" ? "Partially paid" : "مدفوع جزئيًا") : t("notYet"))}{ins.locked ? " ✎" : ""}
                                  </span>
                                  <button className="btn" onClick={() => startEditInstallmentPayment(c.id, ins.yearId, ins)} style={{ background:"transparent", color:GOLD, border:`1px solid ${GOLD}`, borderRadius:6, padding:"2px 7px", fontSize:10.5, fontWeight:700 }}>
                                    {lang === "en" ? "Payment" : "تسجيل دفعة"}
                                  </button>
                                  {ins.remaining > 0 && <Clock size={12} color={MUTED} style={{ cursor: "pointer" }} onClick={() => setDeferConfirm({ childId: c.id, yearId: ins.yearId, installmentId: ins.id })} />}
                                  <Pencil size={12} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditInstallmentAmount(c.id, ins.yearId, ins)} />
                                </span>
                              )}
                              {editingInstallmentPayment && editingInstallmentPayment.childId === c.id && editingInstallmentPayment.yearId === ins.yearId && editingInstallmentPayment.installmentId === ins.id && (
                                <div style={{ display:"flex", alignItems:"end", gap:7, marginTop:8, flexWrap:"wrap", background:CARD_SOFT, borderRadius:8, padding:8 }}>
                                  <div>
                                    <div style={{fontSize:10.5,color:MUTED,marginBottom:3}}>{lang === "en" ? "Paid amount" : "المبلغ المدفوع"}</div>
                                    <input className="field" type="number" min="0" max={ins.amount} value={editInstallmentPaymentAmount} onChange={(e)=>setEditInstallmentPaymentAmount(e.target.value)} style={{width:90,padding:"4px 6px",fontSize:11.5}} />
                                  </div>
                                  <div>
                                    <div style={{fontSize:10.5,color:MUTED,marginBottom:3}}>{lang === "en" ? "Payment date" : "تاريخ الدفع"}</div>
                                    <input className="field" type="date" value={editInstallmentPaymentDate} onChange={(e)=>setEditInstallmentPaymentDate(e.target.value)} style={{width:135,padding:"4px 6px",fontSize:11.5}} />
                                  </div>
                                  <Check size={16} color={TEAL} style={{cursor:"pointer",marginBottom:5}} onClick={saveEditInstallmentPayment} />
                                  <X size={16} color={MUTED} style={{cursor:"pointer",marginBottom:5}} onClick={cancelEditInstallmentPayment} />
                                </div>
                              )}
                            </div>
                            {isDeferring && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap", fontSize: 11 }}>
                                <span style={{ color: MUTED }}>{t("deferThisInstallment")}</span>
                                <button className="btn" onClick={() => runDeferInstallment(c.id, ins.yearId, ins.id, "append")} style={{ background: GOLD, color: INK, borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 11 }}>{t("deferAppend")}</button>
                                <button className="btn" onClick={() => runDeferInstallment(c.id, ins.yearId, ins.id, "spread")} style={{ background: GOLD, color: INK, borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 11 }}>{t("deferSpread")}</button>
                                <button className="btn" onClick={() => setDeferConfirm(null)} style={{ background: LINE, color: PAPER, borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 11 }}>{t("cancel")}</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{t("noInstallmentDue")}</div>
                  )}

                  {c.nextDue && c.nextDue.month.slice(0, 7) !== selectedMonth && (
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>{t("nextDueLine", { date: fmtInstallmentMonthL(c.nextDue.month, lang), amt: fmt(c.nextDue.amount), label: c.nextDue.yearLabel })}</div>
                  )}

                  {/* years ledger */}
                  <div style={{ marginTop: 12, borderTop: `1px dashed ${LINE}`, paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 700 }}>{t("yearsLedgerTitle")}</span>
                      <button className="btn" onClick={() => openYearForm(c.id)} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <Plus size={12} /> {t("addYearBtn")}
                      </button>
                    </div>

                    {yearFormFor === c.id && (
                      <div style={{ background: CARD, borderRadius: 10, padding: 12, marginBottom: 10, display: "grid", gap: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <Label>{t("stageLabel")}</Label>
                            <select className="field" value={yearForm.stage} onChange={(e) => setYearForm({ ...yearForm, stage: e.target.value })}>
                              <option value="school">{t("stageSchool")}</option>
                              <option value="university">{t("stageUniversity")}</option>
                            </select>
                          </div>
                          <div>
                            <Label>{t("yearLabelLabel")}</Label>
                            <input className="field" value={yearForm.label} onChange={(e) => setYearForm({ ...yearForm, label: e.target.value })} placeholder={t("yearLabelPlaceholder")} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <Label>{t("annualFeeLabel")}</Label>
                            <input className="field" type="number" value={yearForm.annualFee} onChange={(e) => setYearForm({ ...yearForm, annualFee: e.target.value })} placeholder={t("annualFeePlaceholder")} />
                          </div>
                          <div>
                            <Label>{t("downPaymentLabel")}</Label>
                            <input className="field" type="number" value={yearForm.downPayment} onChange={(e) => setYearForm({ ...yearForm, downPayment: e.target.value })} placeholder="0" />
                          </div>
                        </div>
                        {parseFloat(yearForm.downPayment) > 0 && (
                          <div>
                            <Label>{t("downPaymentDateLabel")}</Label>
                            <input className="field" type="date" value={yearForm.downPaymentDate} onChange={(e) => setYearForm({ ...yearForm, downPaymentDate: e.target.value })} />
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <Label>{t("installmentsCountLabel")}</Label>
                            <input className="field" type="number" value={yearForm.installmentsCount} onChange={(e) => setYearForm({ ...yearForm, installmentsCount: e.target.value })} placeholder="10" />
                          </div>
                          <div>
                            <Label>{t("firstInstallmentDateLabel")}</Label>
                            <input className="field" type="date" value={yearForm.startDate} onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn" onClick={addChildYear} style={{ background: GOLD, color: INK, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("saveYearBtn")}</button>
                          <button className="btn" onClick={closeYearForm} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("cancel")}</button>
                        </div>
                      </div>
                    )}

                    {(c.years || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: MUTED }}>{t("noYearsYet")}</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {c.years.map((y) => {
                          const isEditing = editingYear && editingYear.childId === c.id && editingYear.yearId === y.id;
                          const unpaidCount = (y.installments || []).filter((i) => !i.paid).length;
                          const yearTotal = (y.installments || []).reduce((s, i) => s + i.amount, 0);
                          return (
                            <div key={y.id} style={{ background: CARD, borderRadius: 10, padding: 10 }}>
                              {isEditing ? (
                                <div style={{ display: "grid", gap: 8 }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div>
                                      <Label>{t("stageLabel")}</Label>
                                      <select className="field" value={editYearForm.stage} onChange={(e) => setEditYearForm({ ...editYearForm, stage: e.target.value })}>
                                        <option value="school">{t("stageSchool")}</option>
                                        <option value="university">{t("stageUniversity")}</option>
                                      </select>
                                    </div>
                                    <div>
                                      <Label>{t("yearLabelLabel")}</Label>
                                      <input className="field" value={editYearForm.label} onChange={(e) => setEditYearForm({ ...editYearForm, label: e.target.value })} />
                                    </div>
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div>
                                      <Label>{t("annualFeeLabel")}</Label>
                                      <input className="field" type="number" value={editYearForm.annualFee} onChange={(e) => setEditYearForm({ ...editYearForm, annualFee: e.target.value })} />
                                    </div>
                                    <div>
                                      <Label>{t("downPaymentLabel")}</Label>
                                      <input className="field" type="number" value={editYearForm.downPayment} onChange={(e) => setEditYearForm({ ...editYearForm, downPayment: e.target.value })} />
                                    </div>
                                  </div>
                                  {parseFloat(editYearForm.downPayment) > 0 && (
                                    <div>
                                      <Label>{t("downPaymentDateLabel")}</Label>
                                      <input className="field" type="date" value={editYearForm.downPaymentDate} onChange={(e) => setEditYearForm({ ...editYearForm, downPaymentDate: e.target.value })} />
                                    </div>
                                  )}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <div>
                                      <Label>{t("installmentsCountLabel")}</Label>
                                      <input className="field" type="number" value={editYearForm.installmentsCount} onChange={(e) => setEditYearForm({ ...editYearForm, installmentsCount: e.target.value })} />
                                    </div>
                                    <div>
                                      <Label>{t("firstInstallmentDateLabel")}</Label>
                                      <input className="field" type="date" value={editYearForm.startDate} onChange={(e) => setEditYearForm({ ...editYearForm, startDate: e.target.value })} />
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 11, color: MUTED }}>{t("editYearNote")}</div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn" onClick={saveEditYear} style={{ background: TEAL, color: INK, borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12 }}>{t("save")}</button>
                                    <button className="btn" onClick={cancelEditYear} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12 }}>{t("cancel")}</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: y.stage === "university" ? GOLD : TEAL, color: INK }}>
                                        {y.stage === "university" ? t("stageUniversity") : t("stageSchool")}
                                      </span>
                                      <span style={{ fontWeight: 700, fontSize: 13 }}>{y.label}</span>
                                    </div>
                                    {confirmDeleteYear && confirmDeleteYear.childId === c.id && confirmDeleteYear.yearId === y.id ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                                        <span style={{ color: RED }}>{t("confirmDeleteYear")}</span>
                                        <button className="btn" onClick={() => { removeChildYear(c.id, y.id); setConfirmDeleteYear(null); }} style={{ background: RED, color: "#fff", borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 11 }}>{t("confirm")}</button>
                                        <button className="btn" onClick={() => setConfirmDeleteYear(null)} style={{ background: LINE, color: PAPER, borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 11 }}>{t("cancel")}</button>
                                      </div>
                                    ) : (
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <Pencil size={13} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditYear(c.id, y)} />
                                        <X size={14} color={MUTED} style={{ cursor: "pointer" }} onClick={() => setConfirmDeleteYear({ childId: c.id, yearId: y.id })} />
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>
                                    {t("yearSummary", { total: fmt(yearTotal), unpaid: unpaidCount, count: y.installmentsCount })}{y.downPayment > 0 ? t("yearSummaryDownPayment", { amt: fmt(y.downPayment) }) : ""}
                                  </div>
                                  <button
                                    onClick={() => setExpandedYears((s) => ({ ...s, [y.id]: !s[y.id] }))}
                                    style={{ background: CARD, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 12px", borderRadius: 8, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5 }}
                                  >
                                    {expandedYears[y.id] ? t("hideSchedule") : t("showSchedule")}
                                  </button>
                                  {expandedYears[y.id] && y.installments && y.installments.length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                                      {y.installments.map((ins) => {
                                        const isEditingAmt = editingInstallment && editingInstallment.childId === c.id && editingInstallment.yearId === y.id && editingInstallment.installmentId === ins.id;
                                        const isDeferring = deferConfirm && deferConfirm.childId === c.id && deferConfirm.yearId === y.id && deferConfirm.installmentId === ins.id;
                                        return (
                                          <div key={ins.id} style={{ padding: "6px 8px", borderRadius: 6, background: CARD_SOFT }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                                                <input type="checkbox" checked={ins.paid} onChange={() => toggleInstallmentPaid(c.id, y.id, ins.id)} />
                                                {fmtInstallmentMonthL(ins.month, lang)} {ins.isDownPayment ? `(${t("downPaymentTag")})` : ""} {ins.paid && ins.paymentDate ? `· دفع: ${ins.paymentDate}` : ""}
                                              </label>
                                              {ins.paid && (
                                                <input className="field" type="date" value={ins.paymentDate || ""} onChange={(e)=>updateInstallmentPaymentDate(c.id, y.id, ins.id, e.target.value)} style={{ padding:"3px 6px", fontSize:10, width:125, marginInlineStart:8 }} />
                                              )}
                                              {isEditingAmt ? (
                                                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                  <input className="field" type="date" value={editInstallmentDate} onChange={(e) => setEditInstallmentDate(e.target.value)} style={{ padding: "3px 6px", fontSize: 11, width: 125 }} />
                                                  <input className="field" type="number" value={editInstallmentAmount} onChange={(e) => setEditInstallmentAmount(e.target.value)} style={{ width: 65, padding: "3px 6px", fontSize: 11.5 }} />
                                                  <Check size={14} color={TEAL} style={{ cursor: "pointer" }} onClick={saveEditInstallmentAmount} />
                                                  <X size={14} color={MUTED} style={{ cursor: "pointer" }} onClick={cancelEditInstallmentAmount} />
                                                </span>
                                              ) : (
                                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                  <span style={{ fontSize: 12, fontWeight: 700, color: ins.paid ? TEAL : MUTED }}>{fmt(ins.amount)} {lang === "en" ? "JOD" : "د.أ"}{ins.locked ? " ✎" : ""}</span>
                                                  {!ins.paid && <Clock size={11} color={MUTED} style={{ cursor: "pointer" }} onClick={() => setDeferConfirm({ childId: c.id, yearId: y.id, installmentId: ins.id })} />}
                                                  <Pencil size={11} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditInstallmentAmount(c.id, y.id, ins)} />
                                                </span>
                                              )}
                                            </div>
                                            {isDeferring && (
                                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap", fontSize: 10.5 }}>
                                                <span style={{ color: MUTED }}>{t("deferThisInstallment")}</span>
                                                <button className="btn" onClick={() => runDeferInstallment(c.id, y.id, ins.id, "append")} style={{ background: GOLD, color: INK, borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 10.5 }}>{t("deferAppend")}</button>
                                                <button className="btn" onClick={() => runDeferInstallment(c.id, y.id, ins.id, "spread")} style={{ background: GOLD, color: INK, borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 10.5 }}>{t("deferSpread")}</button>
                                                <button className="btn" onClick={() => setDeferConfirm(null)} style={{ background: LINE, color: PAPER, borderRadius: 6, padding: "3px 8px", fontWeight: 700, fontSize: 10.5 }}>{t("cancel")}</button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {expandedYears[y.id] && (!y.installments || y.installments.length === 0) && (
                                    <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{t("noInstallmentsGenerated")}</div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actual savings + long-term projection */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={16} color={GOLD} /> {t("savingsTitle")}
            </div>
            <button className="btn" onClick={() => setShowSavingsForm((s) => !s)} style={{ background: showSavingsForm ? CARD_SOFT : GOLD, color: showSavingsForm ? PAPER : INK, borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {showSavingsForm ? <><X size={13} /> {t("cancel")}</> : <><Plus size={13} /> {t("addSavingsBtn")}</>}
            </button>
          </div>

          {savingsLog.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD_SOFT, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: MUTED }}>{t("savingsTotalLabel")}</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: TEAL }}>{fmt(savingsCalc.totalAllTime)} {lang === "en" ? "JOD" : "د.أ"}</span>
            </div>
          )}

          {showSavingsForm && (
            <div style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: MUTED }}>{t("savingsFormNote")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("monthLabel")}</Label>
                  <input className="field" type="month" value={savingsForm.month} onChange={(e) => setSavingsForm({ ...savingsForm, month: e.target.value })} />
                </div>
                <div>
                  <Label>{t("savedAmountLabel")}</Label>
                  <input className="field" type="number" value={savingsForm.amount} onChange={(e) => setSavingsForm({ ...savingsForm, amount: e.target.value })} placeholder={t("savedAmountPlaceholder")} />
                </div>
              </div>
              <div>
                <Label>{t("noteOptionalLabel")}</Label>
                <input className="field" value={savingsForm.note} onChange={(e) => setSavingsForm({ ...savingsForm, note: e.target.value })} placeholder={t("notePlaceholder")} />
              </div>
              <button className="btn" onClick={addSavingsEntry} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, alignSelf: "flex-start", marginTop: 4 }}>
                {t("save")}
              </button>
            </div>
          )}

          {savingsLog.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "10px 0" }}>{t("savingsEmpty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {savingsCalc.years.map((y) => (
                <div key={y.year}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: MUTED, marginBottom: 6, fontWeight: 700 }}>
                    <span>{y.year}</span>
                    <span>{fmt(y.total)} {lang === "en" ? "JOD" : "د.أ"}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {savingsCalc.sorted.filter((s) => s.month.slice(0, 4) === y.year).map((s) => (
                      <div key={s.id} style={{ background: CARD_SOFT, borderRadius: 10, padding: "8px 12px" }}>
                        {editingSavingsId === s.id ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input className="field" type="month" value={editSavingsForm.month} onChange={(e) => setEditSavingsForm({ ...editSavingsForm, month: e.target.value })} style={{ padding: "4px 6px", fontSize: 12, width: 130 }} />
                            <input className="field" type="number" value={editSavingsForm.amount} onChange={(e) => setEditSavingsForm({ ...editSavingsForm, amount: e.target.value })} style={{ padding: "4px 6px", fontSize: 12, width: 80 }} />
                            <input className="field" value={editSavingsForm.note} onChange={(e) => setEditSavingsForm({ ...editSavingsForm, note: e.target.value })} style={{ padding: "4px 6px", fontSize: 12, flex: 1, minWidth: 100 }} placeholder={t("noteOptionalLabel")} />
                            <Check size={15} color={TEAL} style={{ cursor: "pointer" }} onClick={saveEditSavings} />
                            <X size={15} color={MUTED} style={{ cursor: "pointer" }} onClick={cancelEditSavings} />
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 13 }}>{s.month}</div>
                              {s.note && <div style={{ fontSize: 11, color: MUTED }}>{s.note}</div>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: s.amount >= 0 ? TEAL : RED }}>{s.amount >= 0 ? "+" : ""}{fmt(s.amount)} {lang === "en" ? "JOD" : "د.أ"}</div>
                              <Pencil size={13} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditSavings(s)} />
                              <ConfirmDeleteButton t={t} size={14} onConfirm={() => removeSavingsEntry(s.id)} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 18, borderTop: `1px dashed ${LINE}`, paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t("projectionTitle")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <Label>{t("yearsCountLabel")}</Label>
                <input className="field" type="number" value={projectionYears} onChange={(e) => setProjectionYears(e.target.value)} placeholder="5" />
              </div>
              <div>
                <Label>{t("returnPctLabel")}</Label>
                <input className="field" type="number" value={projectionReturnPct} onChange={(e) => setProjectionReturnPct(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
              {savingsLog.length > 0 ? t("avgMonthlyRecorded", { amt: fmt(savingsCalc.avgMonthly) }) : t("avgMonthlyProjected", { amt: fmt(savingsCalc.avgMonthly) })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD_SOFT, borderRadius: 10, padding: "12px 16px" }}>
              <span style={{ fontSize: 13, color: PAPER }}>{t("projectedAfterYears", { years: projectionYears || 0 })}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: TEAL }}>{fmt(savingsCalc.projected)} {lang === "en" ? "JOD" : "د.أ"}</span>
            </div>
          </div>
        </div>

        {/* Goals */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Target size={16} color={GOLD} /> {t("goalsTitle")}
            </div>
            <button className="btn" onClick={() => setShowGoalForm((s) => !s)} style={{ background: showGoalForm ? CARD_SOFT : GOLD, color: showGoalForm ? PAPER : INK, borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {showGoalForm ? <><X size={13} /> {t("cancel")}</> : <><Plus size={13} /> {t("addGoalBtn")}</>}
            </button>
          </div>

          {goalsCalc.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: CARD_SOFT, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: MUTED }}>{t("goalsTotalLabel")}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{fmt(goalsCalc.reduce((s, g) => s + g.neededMonthly, 0))} {t("perMonth")}</span>
            </div>
          )}

          {showGoalForm && (
            <div style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("goalNameLabel")}</Label>
                  <input className="field" value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} placeholder={t("goalNamePlaceholder")} />
                </div>
                <div>
                  <Label>{t("targetAmountLabel")}</Label>
                  <input className="field" type="number" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} placeholder="3000" />
                </div>
                <div>
                  <Label>{t("savedSoFarLabel")}</Label>
                  <input className="field" type="number" value={goalForm.saved} onChange={(e) => setGoalForm({ ...goalForm, saved: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <Label>{t("expectedDeadlineLabel")}</Label>
                  <input className="field" type="date" value={goalForm.deadline} onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })} />
                </div>
                <div>
                  <Label>{t("fundingMethodLabel")}</Label>
                  <select className="field" value={goalForm.funding} onChange={(e) => setGoalForm({ ...goalForm, funding: e.target.value })}>
                    <option value="auto">{t("fundingAuto")}</option>
                    <option value="fixed">{t("fundingFixed")}</option>
                  </select>
                </div>
                {goalForm.funding === "fixed" && (
                  <div>
                    <Label>{t("monthlyAmountLabel")}</Label>
                    <input className="field" type="number" value={goalForm.fixedAmount} onChange={(e) => setGoalForm({ ...goalForm, fixedAmount: e.target.value })} placeholder="150" />
                  </div>
                )}
                {goalForm.funding === "auto" && (
                  <div>
                    <Label>{t("priorityLabel")}</Label>
                    <input className="field" type="number" value={goalForm.priority} onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })} placeholder="0" />
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>{t("priorityHelp")}</div>
              <button className="btn" onClick={addGoal} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, alignSelf: "flex-start", marginTop: 4 }}>
                {t("save")}
              </button>
            </div>
          )}

          {goalsCalc.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "10px 0" }}>{t("goalsEmpty")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {goalsCalc.map((g) => (
                <div key={g.id} style={{ background: CARD_SOFT, borderRadius: 12, padding: 14, border: `1px solid ${g.onTrack ? LINE : RED}` }}>
                  {editingGoalId === g.id ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
                        <div>
                          <Label>{t("goalNameLabel")}</Label>
                          <input className="field" value={editGoalForm.name} onChange={(e) => setEditGoalForm({ ...editGoalForm, name: e.target.value })} />
                        </div>
                        <div>
                          <Label>{t("targetAmountLabel")}</Label>
                          <input className="field" type="number" value={editGoalForm.target} onChange={(e) => setEditGoalForm({ ...editGoalForm, target: e.target.value })} />
                        </div>
                        <div>
                          <Label>{t("savedSoFarLabel")}</Label>
                          <input className="field" type="number" value={editGoalForm.saved} onChange={(e) => setEditGoalForm({ ...editGoalForm, saved: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div>
                          <Label>{t("expectedDeadlineLabel")}</Label>
                          <input className="field" type="date" value={editGoalForm.deadline} onChange={(e) => setEditGoalForm({ ...editGoalForm, deadline: e.target.value })} />
                        </div>
                        <div>
                          <Label>{t("fundingMethodLabel")}</Label>
                          <select className="field" value={editGoalForm.funding} onChange={(e) => setEditGoalForm({ ...editGoalForm, funding: e.target.value })}>
                            <option value="auto">{t("fundingAuto")}</option>
                            <option value="fixed">{t("fundingFixed")}</option>
                          </select>
                        </div>
                        {editGoalForm.funding === "fixed" && (
                          <div>
                            <Label>{t("monthlyAmountLabel")}</Label>
                            <input className="field" type="number" value={editGoalForm.fixedAmount} onChange={(e) => setEditGoalForm({ ...editGoalForm, fixedAmount: e.target.value })} />
                          </div>
                        )}
                        {editGoalForm.funding === "auto" && (
                          <div>
                            <Label>{t("priorityLabel")}</Label>
                            <input className="field" type="number" value={editGoalForm.priority} onChange={(e) => setEditGoalForm({ ...editGoalForm, priority: e.target.value })} />
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={saveEditGoal} style={{ background: TEAL, color: INK, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("save")}</button>
                        <button className="btn" onClick={cancelEditGoal} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 12.5 }}>{t("cancel")}</button>
                      </div>
                    </div>
                  ) : (
                  <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.name}</div>
                      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{t(FUNDING_KEYS[g.funding])}{g.funding === "fixed" ? ` · ${fmt(g.fixedAmount)} ${t("perMonth")}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Pencil size={14} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditGoal(g)} />
                      <X size={15} color={MUTED} style={{ cursor: "pointer" }} onClick={() => removeGoal(g.id)} />
                    </div>
                  </div>

                  <div style={{ margin: "10px 0 6px", background: LINE, borderRadius: 999, height: 8, overflow: "hidden" }}>
                    <div style={{ width: `${g.progressPct}%`, height: "100%", background: g.onTrack ? TEAL : RED, borderRadius: 999, transition: "width .3s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED, marginBottom: 10 }}>
                    <span>{t("savedOfTarget", { saved: fmt(g.saved), target: fmt(g.target) })}</span>
                    <span>{g.progressPct.toFixed(0)}%</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                    <div>
                      <div style={{ color: MUTED }}>{t("goalDeadlineLabel")}</div>
                      <div style={{ fontWeight: 700 }}>{fmtDateL(g.deadline, lang)}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED }}>{t("projectedCompletionLabel")}</div>
                      <div style={{ fontWeight: 700, color: g.onTrack ? TEAL : RED }}>{g.projectedCompletion ? fmtDateL(g.projectedCompletion, lang) : t("notDetermined")}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED }}>{t("neededMonthlyLabel")}</div>
                      <div style={{ fontWeight: 700 }}>{fmt(g.neededMonthly)} {lang === "en" ? "JOD" : "د.أ"}</div>
                    </div>
                    <div>
                      <Label>{t("editSavedLabel")}</Label>
                      <input className="field" style={{ padding: "5px 8px", width: 90 }} type="number" value={g.saved} onChange={(e) => updateSaved(g.id, e.target.value)} />
                    </div>
                  </div>

                  {!g.onTrack && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: RED }}>
                      <AlertTriangle size={13} />
                      {t("goalBehindNote")}
                    </div>
                  )}
                  </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        {calc.chartData.some((d) => d.actual !== null) && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{t("chartTitle")}</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={calc.chartData}>
                <defs>
                  <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={MUTED} tick={{ fontSize: 11 }} />
                <YAxis stroke={MUTED} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: CARD_SOFT, border: `1px solid ${LINE}`, borderRadius: 8, direction: dir }} formatter={(value, name) => [value, name === "actual" ? t("actualLegend") : t("projectedLegend")]} />
                <Area type="monotone" dataKey="actual" name={t("actualLegend")} stroke={GOLD} strokeWidth={2} fill="url(#actualFill)" connectNulls />
                <Area type="monotone" dataKey="projected" name={t("projectedLegend")} stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" fill="none" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trend across fiscal periods */}
        {trendData.some((p) => p.total > 0) && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{t("trendChartTitle")}</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData}>
                <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke={MUTED} tick={{ fontSize: 11 }} />
                <YAxis stroke={MUTED} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: CARD_SOFT, border: `1px solid ${LINE}`, borderRadius: 8, direction: dir }} formatter={(value) => [`${fmt(value)} ${lang === "en" ? "JOD" : "د.أ"}`, ""]} />
                <Bar dataKey="total" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category breakdown */}
        {calc.byCategory.length > 0 && (
          <div className="card" style={{ padding: 18, display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "center" }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={calc.byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {calc.byCategory.map((c, i) => <Cell key={i} fill={c.color} stroke={INK} strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={{ background: CARD_SOFT, border: `1px solid ${LINE}`, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...calc.byCategory].sort((a, b) => b.value - a.value).map((c) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                    {c.name}
                  </span>
                  <span style={{ color: MUTED }}>{fmt(c.value)} {lang === "en" ? "JOD" : "د.أ"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add entry */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div className="tab" style={{ background: tab === "manual" ? GOLD : CARD_SOFT, color: tab === "manual" ? INK : PAPER }} onClick={() => setTab("manual")}>
              <Plus size={14} style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 4 }} /> {t("manualTab")}
            </div>
            <div className="tab" style={{ background: tab === "paste" ? GOLD : CARD_SOFT, color: tab === "paste" ? INK : PAPER }} onClick={() => setTab("paste")}>
              <ClipboardPaste size={14} style={{ display: "inline", verticalAlign: -2, marginInlineEnd: 4 }} /> {t("pasteTab")}
            </div>
          </div>

          {tab === "manual" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1.25fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <Label>{t("amountLabel")}</Label>
                <input className="field" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t("amountPlaceholder")} />
              </div>
              <div>
                <Label>{t("descriptionLabel")}</Label>
                <input className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("descriptionPlaceholder")} />
              </div>
              <div>
                <Label>{t("categoryLabel")}</Label>
                <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categories.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
                </select>
                {fixedCalc.list.some((f) => f.category === form.category && f.status === "active") && (
                  <div style={{ fontSize: 10.5, color: GOLD, marginTop: 4 }}>{t("fixedExpenseWarning")}</div>
                )}
              </div>
              <div>
                <Label>{t("dateLabel")}</Label>
                <input className="field" type="date" value={form.date} min={selectedMonthStart} max={selectedMonthEnd} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>{t("linkedFixedLabel")}</Label>
                <select className="field" value={form.linkedFixedExpenseId} onChange={(e) => setForm({ ...form, linkedFixedExpenseId: e.target.value })}>
                  <option value="">{t("noLink")}</option>
                  {fixedCalc.list.filter((f) => f.status === "active").map((f) => <option key={f.id} value={f.id}>{f.name} · {fmt(f.amount)} {lang === "en" ? "JOD" : "د.أ"}</option>)}
                </select>
              </div>
              <button className="btn" onClick={addManual} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "10px 20px", fontWeight: 700, height: 41 }}>
                {t("addBtn")}
              </button>
            </div>
          ) : (
            <div>
              <Label>{t("pasteAreaLabel")}</Label>
              <textarea className="field" rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={t("pastePlaceholder")} />
              <button className="btn" onClick={handleParse} style={{ background: GOLD, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, marginTop: 10 }}>
                {t("extractBtn")}
              </button>

              {pending.length > 0 && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 13, color: MUTED }}>{t("reviewBeforeAdding", { n: pending.length })}</div>
                  {pending.map((p) => (
                    <div key={p.id} style={{ background: p.isDuplicate ? "#C9A24B10" : "transparent", border: p.isDuplicate ? `1px solid ${GOLD}` : "1px solid transparent", borderRadius: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px auto", gap: 8, alignItems: "center", background: CARD_SOFT, padding: 8, borderRadius: 8 }}>
                        <input className="field" style={{ padding: "6px 8px" }} type="number" value={p.amount} onChange={(e) => updatePending(p.id, "amount", parseFloat(e.target.value) || 0)} />
                        <input className="field" style={{ padding: "6px 8px" }} value={p.note} onChange={(e) => updatePending(p.id, "note", e.target.value)} />
                        <select className="field" style={{ padding: "6px 8px" }} value={p.category} onChange={(e) => updatePending(p.id, "category", e.target.value)}>
                          {categories.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
                        </select>
                        <X size={16} color={RED} style={{ cursor: "pointer" }} onClick={() => removePending(p.id)} />
                      </div>
                      {p.isDuplicate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: GOLD, padding: "3px 8px" }}>
                          <AlertTriangle size={11} /> {t("duplicateTag")}
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn" onClick={confirmPending} style={{ background: TEAL, color: INK, borderRadius: 10, padding: "9px 18px", fontWeight: 700, alignSelf: "flex-start" }}>
                    {t("confirmAddAll")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent entries */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t("recentEntriesTitle")}</div>
            <button className="btn" onClick={() => setShowRecentModal(true)} style={{ background:CARD_SOFT, color:GOLD, border:`1px solid ${GOLD}`, borderRadius:8, padding:"6px 10px", fontSize:11.5, fontWeight:700 }}><Eye size={13} style={{verticalAlign:-2, marginInlineEnd:4}} />{t("recentViewAll")}</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
              <input
                className="field"
                value={entrySearch}
                onChange={(e) => setEntrySearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                style={{ paddingInlineStart: 32 }}
              />
              <Search size={14} color={MUTED} style={{ position: "absolute", top: 12, insetInlineStart: 10 }} />
            </div>
            <select className="field" style={{ maxWidth: 160 }} value={entryFilterCategory} onChange={(e) => setEntryFilterCategory(e.target.value)}>
              <option value="all">{t("filterAllCategories")}</option>
              {categories.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
            </select>
          </div>
          {(() => {
            const periodEntries = entries.filter((e) => e.date && e.date >= selectedMonthStart && e.date <= selectedMonthEnd);
            const filtered = periodEntries.filter((e) =>
              (entryFilterCategory === "all" || e.category === entryFilterCategory) &&
              (entrySearch.trim() === "" || e.note.toLowerCase().includes(entrySearch.trim().toLowerCase()))
            );
            if (periodEntries.length === 0) {
              return (
                <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "20px 0" }}>
                  {t("noEntriesInMonth", { month: selectedMonthLabel })}
                </div>
              );
            }
            if (filtered.length === 0) {
              return (
                <div style={{ color: MUTED, fontSize: 13.5, textAlign: "center", padding: "20px 0" }}>
                  {t("noEntriesMatchFilter")}
                </div>
              );
            }
            return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {filtered.slice(0, 8).map((e) => (
                <div key={e.id} style={{ padding: "8px 4px", borderBottom: `1px solid ${LINE}` }}>
                  {editingEntryId === e.id ? (
                    <div style={{ display: "grid", gap: 8, background: CARD_SOFT, borderRadius: 10, padding: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <Label>{t("descriptionLabel")}</Label>
                          <input className="field" value={editEntryForm.note} onChange={(ev) => setEditEntryForm({ ...editEntryForm, note: ev.target.value })} />
                        </div>
                        <div>
                          <Label>{t("monthlyAmountLabel").replace(t("perMonth"), "").trim() || t("amountLabel")}</Label>
                          <input className="field" type="number" value={editEntryForm.amount} onChange={(ev) => setEditEntryForm({ ...editEntryForm, amount: ev.target.value })} />
                        </div>
                        <div>
                          <Label>{t("categoryLabel")}</Label>
                          <select className="field" value={editEntryForm.category} onChange={(ev) => setEditEntryForm({ ...editEntryForm, category: ev.target.value })}>
                            {categories.map((r) => <option key={r.key} value={r.key}>{r.key}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label>{t("dateLabel")}</Label>
                        <input className="field" type="date" value={editEntryForm.date} onChange={(ev) => setEditEntryForm({ ...editEntryForm, date: ev.target.value })} style={{ maxWidth: 180 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={saveEditEntry} style={{ background: TEAL, color: INK, borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12.5 }}>{t("save")}</button>
                        <button className="btn" onClick={cancelEditEntry} style={{ background: LINE, color: PAPER, borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12.5 }}>{t("cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorOf(e.category, categories) }} />
                        <div>
                          <div style={{ fontSize: 13.5 }}>{e.note}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>{e.category} · {e.date}{e.linkedFixedExpenseId ? ` · ${t("linkedTag")}` : ""}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fmt(e.amount)} {lang === "en" ? "JOD" : "د.أ"}</div>
                        <Pencil size={13} color={MUTED} style={{ cursor: "pointer" }} onClick={() => startEditEntry(e)} />
                        <ConfirmDeleteButton t={t} size={14} onConfirm={() => removeEntry(e.id)} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            );
          })()}
        </div>

      {/* Settings modal */}
      {showSettingsModal && (
        <Modal title={t("settingsTitle")} onClose={() => setShowSettingsModal(false)} dir={dir}>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14 }}>
            {[['general',t("settingsGeneral")],['categories',t("settingsCategories")],['backup',t("settingsBackup")],['account',t("settingsAccount")]].map(([key,label]) => <button key={key} className="btn" onClick={() => setSettingsTab(key)} style={{ background:settingsTab===key?GOLD:CARD_SOFT, color:settingsTab===key?INK:PAPER, borderRadius:8, padding:"7px 12px", fontWeight:700 }}>{label}</button>)}
          </div>
          {settingsTab === "general" && <div>
            <Label>{t("periodStartLabel", { month: new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(lang === "en" ? "en-US" : "ar-JO-u-nu-latn", { month:"long", year:"numeric" }) })}</Label>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input className="field" type="date" value={fiscalAnchors[selectedMonth] || period.start} min={periodStartBounds(selectedMonth).min} max={periodStartBounds(selectedMonth).max} onChange={(e)=>{const v=e.target.value;if(!v)return;const b=periodStartBounds(selectedMonth);if(v<b.min||v>b.max)return showToast(t("periodStartOutOfRange",{min:fmtDateL(b.min,lang),max:fmtDateL(b.max,lang)}));setFiscalAnchors(p=>({...p,[selectedMonth]:v}));}} style={{maxWidth:190}}/>
              {fiscalAnchors[selectedMonth] && <button className="btn" onClick={()=>setFiscalAnchors(p=>{const n={...p};delete n[selectedMonth];return n;})} style={{background:CARD_SOFT,color:MUTED,border:`1px solid ${LINE}`,borderRadius:8,padding:"7px 10px",fontWeight:700}}>{t("resetToDefault")}</button>}
            </div>
            <div style={{fontSize:11,color:MUTED,marginTop:7}}>{t("periodStartAllowedRange",{min:fmtDateL(periodStartBounds(selectedMonth).min,lang),max:fmtDateL(periodStartBounds(selectedMonth).max,lang)})}</div>
            <div style={{fontSize:11,color:MUTED,marginTop:8}}>{t("periodStartHelp")}</div>
            <div style={{fontSize:11,color:GOLD,fontWeight:700,marginTop:7}}>{t("periodEndAuto",{date:fmtDateL(period.end,lang)})}</div>
            {Object.keys(fiscalAnchors).length>0 && <div style={{marginTop:14}}>{Object.keys(fiscalAnchors).sort().map(k=><div key={k} style={{display:"flex",justifyContent:"space-between",background:CARD_SOFT,padding:"7px 9px",borderRadius:7,marginBottom:5,fontSize:11}}><span>{k} → {fmtDateL(fiscalAnchors[k],lang)}</span><X size={12} color={MUTED} style={{cursor:"pointer"}} onClick={()=>setFiscalAnchors(p=>{const n={...p};delete n[k];return n;})}/></div>)}</div>}
          </div>}
          {settingsTab === "categories" && <div>
            <div style={{fontSize:11.5,color:MUTED,marginBottom:12}}>{t("categoriesSettingsNote")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {categories.map(c=><div key={c.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:CARD_SOFT,borderRadius:9,padding:"8px 10px"}}>
                {renamingCategory===c.key ? <div style={{display:"flex",gap:6,alignItems:"center",flex:1}}><input className="field" value={renameValue} onChange={e=>setRenameValue(e.target.value)} autoFocus style={{maxWidth:220}}/><Check size={15} color={TEAL} style={{cursor:"pointer"}} onClick={()=>{renameCategory(c.key,renameValue);setRenamingCategory(null)}}/><X size={15} color={MUTED} style={{cursor:"pointer"}} onClick={()=>setRenamingCategory(null)}/></div> : <><span style={{display:"flex",alignItems:"center",gap:7}}><span style={{width:9,height:9,borderRadius:"50%",background:c.color}}/>{c.key}</span><span style={{display:"flex",gap:10}}>{c.key!=="أخرى"&&<Pencil size={13} color={MUTED} style={{cursor:"pointer"}} onClick={()=>{setRenamingCategory(c.key);setRenameValue(c.key)}}/>}{c.key!=="أخرى"&&<ConfirmDeleteButton t={t} size={14} onConfirm={()=>removeCategory(c.key)}/>}</span></>}
              </div>)}
            </div>
            <div style={{marginTop:14,background:CARD_SOFT,borderRadius:10,padding:12}}>
              {!showCategoryForm ? <button className="btn" onClick={()=>setShowCategoryForm(true)} style={{background:GOLD,color:INK,borderRadius:8,padding:"7px 12px",fontWeight:700}}>{t("addCategorySettings")}</button> : <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}><div><Label>{t("categoryNameLabel")}</Label><input className="field" value={categoryForm.name} onChange={e=>setCategoryForm({...categoryForm,name:e.target.value})} placeholder={t("categoryNamePlaceholder")} style={{width:170}}/></div><div style={{display:"flex",gap:5}}>{CATEGORY_COLOR_CHOICES.map(c=><span key={c} onClick={()=>setCategoryForm({...categoryForm,color:c})} style={{width:20,height:20,borderRadius:"50%",background:c,cursor:"pointer",border:categoryForm.color===c?`2px solid ${PAPER}`:"2px solid transparent"}}/>)}</div><button className="btn" onClick={addCategory} style={{background:GOLD,color:INK,borderRadius:8,padding:"7px 13px",fontWeight:700}}>{t("save")}</button><button className="btn" onClick={()=>setShowCategoryForm(false)} style={{background:LINE,color:PAPER,borderRadius:8,padding:"7px 13px",fontWeight:700}}>{t("cancel")}</button></div>}
            </div>
          </div>}
          {settingsTab === "backup" && <div><div style={{fontSize:12,color:MUTED,marginBottom:12}}>{t("backupDesc")}</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" onClick={exportJSON} style={modalActionStyle}><Download size={14}/>{t("exportJsonBtn")}</button><button className="btn" onClick={exportExcel} style={modalActionStyle}><Download size={14}/>{t("exportExcelBtn")}</button><button className="btn" onClick={()=>fileInputRef.current&&fileInputRef.current.click()} style={modalActionStyle}><Upload size={14}/>{t("importJsonBtn")}</button></div>{importPending&&<div style={{marginTop:12,background:CARD_SOFT,border:`1px solid ${RED}`,borderRadius:9,padding:12}}><div style={{fontWeight:700,color:RED,fontSize:13}}>{t("importConfirmTitle")}</div><div style={{fontSize:11.5,color:MUTED,margin:"6px 0 10px"}}>{t("importConfirmMsg")}</div><button className="btn" onClick={confirmImport} style={{background:RED,color:"#fff",borderRadius:7,padding:"6px 12px",fontWeight:700}}>{t("importConfirmBtn")}</button></div>}</div>}
          {settingsTab === "account" && <div><div style={{background:CARD_SOFT,borderRadius:10,padding:14}}><div style={{display:"flex",alignItems:"center",gap:8,fontWeight:800}}><User size={16} color={GOLD}/>{t("accountUsername")}</div><div style={{fontSize:14,marginTop:8}}>{loginUser}</div><div style={{fontSize:11,color:MUTED,marginTop:8}}>{t("accountLocalNote")}</div></div></div>}
        </Modal>
      )}

        </div>
        )}
      </div>
      {/* COMPACT MODALS */}
      {showAddEntryModal && (
        <Modal title={lang==="en" ? "Add Transaction" : "إضافة حركة"} onClose={()=>setShowAddEntryModal(false)} dir={dir}>
          <div style={{ display:"grid", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><Label>{t("amountLabel")}</Label><input className="field" type="number" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} placeholder="50" /></div>
              <div><Label>{t("dateLabel")}</Label><input className="field" type="date" value={form.date} onChange={(e)=>setForm({...form, date:e.target.value})} /></div>
            </div>
            <div><Label>{t("descriptionLabel")}</Label><input className="field" value={form.note} onChange={(e)=>setForm({...form, note:e.target.value})} placeholder={t("defaultNoteText")} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><Label>{t("categoryLabel")}</Label><select className="field" value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})}>{categories.map((r)=><option key={r.key} value={r.key}>{r.key}</option>)}</select></div>
              <div><Label>{t("linkedFixedLabel")}</Label><select className="field" value={form.linkedFixedExpenseId} onChange={(e)=>setForm({...form, linkedFixedExpenseId:e.target.value})}><option value="">{t("noLink")}</option>{fixedCalc.list.filter(f=>f.status==="active").map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" onClick={()=>{addManual(); setShowAddEntryModal(false);}} style={{ background:GOLD, color:INK, borderRadius:10, padding:"10px 18px", fontWeight:800, flex:1 }}>{t("save")}</button>
              <button className="btn" onClick={()=>setShowAddEntryModal(false)} style={{ background:CARD_SOFT, color:PAPER, borderRadius:10, padding:"10px 18px", fontWeight:700 }}>{t("cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {showPayModal && (
        <Modal title={lang==="en" ? "Pay Installments" : "تسديد الأقساط"} onClose={()=>setShowPayModal(false)} dir={dir}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {childrenCalc.list.filter(c=>c.dueThisMonthUnpaid>0).length===0 ? (
              <div style={{ color:TEAL, fontSize:13, textAlign:"center", padding:20 }}>{lang==="en" ? "No unpaid installments this month" : "ما فيه أقساط غير مدفوعة هذا الشهر"}</div>
            ) : childrenCalc.list.filter(c=>c.dueThisMonthUnpaid>0).map((c)=>(
              <div key={c.id} style={{ background:CARD_SOFT, borderRadius:12, padding:12 }}>
                <div style={{ fontWeight:800, marginBottom:8 }}>{c.name} - {fmt(c.dueThisMonthUnpaid)} {lang==="en"?"JOD":"د.أ"}</div>
                {c.dueThisMonthItems.filter(ins=>ins.remaining>0).map((ins)=>(
                  <div key={ins.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:CARD, borderRadius:8, padding:"8px 10px", marginBottom:6 }}>
                    <span style={{ fontSize:12.5 }}>{ins.yearLabel} - {fmtInstallmentMonthL(ins.month, lang)} - {fmt(ins.remaining)}</span>
                    <button className="btn" onClick={()=>{toggleInstallmentPaid(c.id, ins.yearId, ins.id); showToast(t("toastPaid")||"تم التسديد");}} style={{ background:TEAL, color:"#fff", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700 }}>{lang==="en"?"Pay":"تسديد"}</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Financial detail modal */}
      {financialDetail && <Modal title={t("financialDetails")} onClose={()=>setFinancialDetail(null)} dir={dir}>
        {financialDetail === "income" && <DetailList items={incomeSources.filter(s=>s.startDate<=selectedMonthEnd&&(!s.endDate||s.endDate>=selectedMonthStart)).map(s=>({name:s.name,value:s.amount,sub:fmtDateL(s.startDate,lang)}))} empty={t("incomeEmpty")} lang={lang}/>}
        {financialDetail === "fixed" && <div>{fixedCalc.list.filter(f=>f.status==="active").map(f=><div key={f.id} style={{background:CARD_SOFT,borderRadius:10,padding:12,marginBottom:8,cursor:"pointer"}} onClick={()=>setFixedDetailId(f.id)}><div style={{display:"flex",justifyContent:"space-between"}}><b>{f.name}</b><b>{fmt(f.amount)} {lang==="en"?"JOD":"د.أ"}</b></div><div style={{fontSize:11,color:MUTED,marginTop:6}}>{t("consumedLabel")}: {fmt(f.consumed)} · {t("remainingLabel")}: {fmt(f.remaining)}</div><div style={{height:7,background:LINE,borderRadius:99,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${f.consumptionPct}%`,background:f.consumptionPct>=100?RED:TEAL}}/></div></div>)}</div>}
        {financialDetail === "children" && <DetailList items={childrenCalc.list.filter(c=>c.dueThisMonth>0).map(c=>({name:c.name,value:c.dueThisMonth,sub:c.dueThisMonthPaid?t("paid"):t("unpaid")}))} empty={t("noInstallmentDue")} lang={lang}/>}
        {financialDetail === "variable" && <DetailList items={calc.byCategory.map(c=>({name:c.name,value:c.value,sub:""}))} empty={t("noEntriesInMonth",{month:selectedMonthLabel})} lang={lang}/>}
      </Modal>}

      {/* All recent transactions modal */}
      {showRecentModal && <Modal title={t("recentEntriesTitle")} onClose={()=>setShowRecentModal(false)} dir={dir}>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}><div style={{position:"relative",flex:1,minWidth:180}}><input className="field" value={entrySearch} onChange={e=>setEntrySearch(e.target.value)} placeholder={t("searchPlaceholder")} style={{paddingInlineStart:32}}/><Search size={14} color={MUTED} style={{position:"absolute",top:12,insetInlineStart:10}}/></div><select className="field" style={{maxWidth:180}} value={entryFilterCategory} onChange={e=>setEntryFilterCategory(e.target.value)}><option value="all">{t("filterAllCategories")}</option>{categories.map(r=><option key={r.key} value={r.key}>{r.key}</option>)}</select></div>
        <EntryList entries={entries.filter(e=>e.date&&e.date>=selectedMonthStart&&e.date<=selectedMonthEnd).filter(e=>(entryFilterCategory==="all"||e.category===entryFilterCategory)&&(entrySearch.trim()===""||e.note.toLowerCase().includes(entrySearch.trim().toLowerCase())))} categories={categories} lang={lang} t={t} editingEntryId={editingEntryId} editEntryForm={editEntryForm} setEditEntryForm={setEditEntryForm} startEditEntry={startEditEntry} saveEditEntry={saveEditEntry} cancelEditEntry={cancelEditEntry} removeEntry={removeEntry} fixedCalc={fixedCalc} selectedMonthStart={selectedMonthStart} selectedMonthEnd={selectedMonthEnd}/>
      </Modal>}

      {/* Fixed expense detail modal */}
      {fixedDetailId && <Modal title={t("fixedConsumptionTitle")} onClose={()=>setFixedDetailId(null)} dir={dir}>{(()=>{const f=fixedCalc.list.find(x=>x.id===fixedDetailId); if(!f)return null; const linked=entries.filter(e=>e.linkedFixedExpenseId===f.id&&e.date>=selectedMonthStart&&e.date<=selectedMonthEnd); return <div><div style={{background:CARD_SOFT,borderRadius:10,padding:14,marginBottom:12}}><div style={{fontWeight:800,fontSize:17}}>{f.name}</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12}}><Metric label={t("fixedBudgetLabel")} value={fmt(f.amount)}/><Metric label={t("consumedLabel")} value={fmt(f.consumed)}/><Metric label={t("remainingLabel")} value={fmt(f.remaining)}/></div><div style={{height:9,background:LINE,borderRadius:99,overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:`${f.consumptionPct}%`,background:f.consumptionPct>=100?RED:TEAL}}/></div></div>{linked.length===0?<div style={{color:MUTED,fontSize:13}}>{t("noEntriesMatchFilter")}</div>:linked.map(e=><div key={e.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 4px",borderBottom:`1px solid ${LINE}`}}><span>{e.note}<span style={{display:"block",fontSize:11,color:MUTED}}>{e.date}</span></span><b>{fmt(e.amount)} {lang==="en"?"JOD":"د.أ"}</b></div>)}</div>})()}</Modal>}

    </div>
  );
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
