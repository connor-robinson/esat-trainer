import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { supabase } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { useDisplayName } from "./hooks/useDisplayName";
import GlobalLeaderboard from "./components/GlobalLeaderboard";
import { saveSessionEntry, listSessionEntries } from "./data/sessions";
import { hasRunOnce, markRunOnce } from "./lib/once";
import { createPreset, listPresets, deletePreset } from "./data/presets";
import PortalTooltip from "./components/PortalTooltip";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { LogOut, LogIn, Pencil, X, HelpCircle, Send, Play, Save, Clock, FolderOpen, BookOpen, User2, Check, Trash2, Trophy, Globe2, Eye, GripVertical, Wrench, Plus, ChevronLeft, ChevronRight, ArrowLeft, AlertTriangle} from "lucide-react";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { DndContext, useDroppable, useDraggable, pointerWithin, DragOverlay } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
/*
  ESAT Minimal Dark Trainer — V3.1 (FlashBox fix + Symbols)
  - Flash Timer editor now spans full width in Session Folder (green outline fully wraps the input)
  - Added mini symbols inserter during sessions (√, π, ^, (), ×, ÷, /)
  - Parser: accepts sqrt(), √, brackets, caret ^, pi/π, and also plain 'sqrt2' → Math.sqrt(2)
*/
// create this file if you used 7a

function TopicRow({ id, label, onAdd }) {
  const { attributes, listeners, setNodeRef, transform } =
    useDraggable({ id: `src-${id}` });

  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-white/90 hover:bg-white/10 select-none"
    >
      {/* drag handle + label */}
      <div className="flex items-center gap-2">
        <button
          className="p-1 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${label}`}
          type="button"
        >
          <GripVertical size={16} />
        </button>
        <span className="truncate">{label}</span>
      </div>

      {/* subtle + inside the same pill */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="h-7 w-7 inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
        aria-label={`Add ${label}`}
        title="Add to session"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// ---------- Styling helpers ----------
// Parse scientific notation variants: "a×10^n", "a*10^-n", "a e n"
function parseSci(s) {
  const t = (s||"").trim()
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/⋅/g, "*")
    .replace(/\^/g, "^")
    .toLowerCase();

  // a*10^n
  let m = t.match(/^([+-]?\d+(?:\.\d+)?)\*10\^([+-]?\d+)$/);
  if (m) return { a:+m[1], n:+m[2] };

  // a*10^-n (already covered by previous), kept for safety
  m = t.match(/^([+-]?\d+(?:\.\d+)?)\*10\^([+-]?\d+)$/);
  if (m) return { a:+m[1], n:+m[2] };

  // a e n
  m = t.match(/^([+-]?\d+(?:\.\d+)?)[e]([+-]?\d+)$/);
  if (m) return { a:+m[1], n:+m[2] };

  return null;
}

function toScientific(x) {
  if (x === 0) return { a: 0, n: 0 };
  const n = Math.floor(Math.log10(Math.abs(x)));
  const a = x / Math.pow(10, n);
  // normalize to [1,10)
  let A = a, N = n;
  if (Math.abs(A) >= 10) { A /= 10; N += 1; }
  if (Math.abs(A) < 1)   { A *= 10; N -= 1; }
  // round A to a sensible length
  const Ar = Math.round(A * 1000) / 1000;
  return { a: Ar, n: N };
}


const median = (a) => {
  if (a.length===0) return 0;
  const s=[...a].sort((x,y)=>x-y), m=Math.floor(s.length/2);
  return s.length%2 ? s[m] : 0.5*(s[m-1]+s[m]);
};
const mad = (a, m = median(a)) => {
  if (a.length===0) return 0;
  const dev = a.map(x=>Math.abs(x-m));
  return median(dev) || 0;
};
const winsorizeAround = (a, centre, spread, k=3) => {
  if (!a.length) return a;
  const lo = centre - k*spread;
  const hi = centre + k*spread;
  return a.map(x => clamp(x, lo, hi));
};
function wilsonLowerBound(successes, trials, z = 1.96) {
  if (!trials || trials <= 0) return 0;
  const p = successes / trials;
  const denom  = 1 + (z*z)/trials;
  const centre = p + (z*z)/(2*trials);
  const margin = z * Math.sqrt((p*(1-p) + (z*z)/(4*trials)) / trials);
  return Math.max(0, (centre - margin) / denom);
}
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z*z/2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}
// map blended z to 1..1000 via Normal CDF
function zToScore01k(z) {
  const p = normalCDF(z); // 0..1
  return Math.round(1 + 999 * clamp(p, 0, 1));
}
const cardBase =
  "rounded-2xl bg-[#171a20]/90 backdrop-blur border border-white/5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]";
const panel = `${cardBase} p-4 sm:p-6`;
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50";
const btnPrimary = `${buttonBase} bg-emerald-500/90 hover:bg-emerald-500 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_25px_-10px_rgba(16,185,129,0.7)]`;
const btnGhost = `${buttonBase} bg-white/5 hover:bg-white/10 text-white`;
const btnPrimaryLite = `${buttonBase} bg-emerald-500/80 hover:bg-emerald-500 text-black`;
const btnSoft = `${buttonBase} bg-white/5 hover:bg-white/10 text-white border border-white/10 shadow-none`;
// ---------- Data ----------
const CATEGORIES = {
  CALCULATION: [
    { id: "mental_add", label: "Addition" },
    { id: "mental_sub", label: "Subtraction" },
    { id: "mental_mul", label: "Multiplication" },
    { id: "mul_of_5", label: "Multiples of 5" },
    { id: "mul_focus_multiples", label: "Multiplication (2 Digit)" },
    { id: "mental_div", label: "Division" },
    { id: "squares", label: "Squares" },
    { id: "cubes", label: "Cubes" },
    { id: "quadratics_eval", label: "Quadratic Functions" },
    { id: "percent_calc", label: "Percentages" },
    { id: "speed_basic", label: "Speed = Distance / Time" },
    { id: "prime_factorise", label: "Prime Factorisation" },   // ⬅️ new
    { id: "powers_mixed", label: "Powers of 2" },
    { id: "divisibility_rules", label: "Divisbility Rule" },
    { id: "sci_rewrite", label: "Divisbility Rule" },
  ],
  FRACTIONS: [
    { id: "common_frac_to_dec_2dp", label: "Fractions and Decimals" },
    { id: "simplify_fraction", label: "Simplifying fractions" },
  ],
  ALGEBRA: [
    { id: "factorise_quadratics", label: "Factorise Quadratics" },
    { id: "complete_square", label: "Complete the Square" },
    { id: "inequalities", label: "Inequalities" },
    { id: "binomial_expand", label: "Binomial Expansion" },
  ],
  EQUATIONS: [
    { id: "suvat_solve", label: "SUVAT" },
    { id: "units_con vert", label: "Units (SI)" },
    { id: "sphere_volume", label: "Sphere Volume" },
    { id: "circle_theorems", label: "Circle Theorems" },
    { id: "sphere_area", label: "Sphere Surface Area" },
    { id: "cylinder_sa", label: "Cylinder Surface Area" },
    { id: "cone_sa", label: "Cone Surface Area" },
    { id: "square_pyramid_sa", label: "Square Pyramid SA" },
  ],
  TRIGONOMETRY: [
    { id: "trig_recall", label: "Trig Ratios " },
    { id: "trig_inverse_recall", label: "Inverse Trig Ratios " },
    { id: "trig_eval", label: "Using trig functions" },
    { id: "tri_special", label: "Special Triangles" },
  ],
  TOOLS: [
    { id: "flash_timer", label: "Flash Timer (special)" },
  ],
};

const PRESETS = [
  { name: "MENTAL CALCULATIONS", topics: ["mental_add", "mental_sub", "mental_mul", "mul_focus_multiples", "mental_div"] },
  { name: "TRIGONOMETRY", topics: ["trig_recall", "trig_eval"] },
  { name: "GEOMETRY SA/V", topics: ["sphere_volume","sphere_area","cylinder_sa","cone_sa","square_pyramid_sa"] },
  { name: "EQUATIONS MIX", topics: ["suvat_solve", "speed_basic", "units_convert"] },
];
const TUTORIAL_SLIDES = [
  {
    title: "Build a session",
    video: "/tutorial/dragging.mp4",
    caption: "Pick topics from the left and drag them into the Session Folder. Use the “+” button for a quick add without dragging."
  },
  {
    title: "Flash timer",
    video: "/tutorial/flashtimer.mp4",
    caption: "Add a Flash Timer inside the folder and set the seconds. It hides questions until time’s up so you can test quick recall."
  },
  {
    title: "Save a preset",
    video: "/tutorial/savedsessions.mp4",
    caption: "Save your current set of topics as a preset. Next time, load it instantly without rebuilding the session from scratch."
  },
  {
    title: "Start a session",
    video: "/tutorial/loadsession.mp4",
    caption: "Set your timer, hit Start, and answer as many questions as you can within that time window."
  },
  {
    title: "During practice",
    video: "/tutorial/symbolbar.mp4",
    caption: "Type answers directly, use the mini symbols for maths, and press Enter to check. Wrong → try again → reveal → move on."
  },
  {
    title: "Performance",
    video: "/tutorial/performance.mp4",
    caption: "See how you’re doing by topic. The REL bar compares each score against your own baseline, so you know what’s strong and what needs more work."
  },
];


// ---------- Local storage ----------
const LS_KEY = "esat_trainer_sessions_v2";
const LS_LEADER = "esat_trainer_leaderboard_v2";
function useSavedSessions() {
  const [sessions, setSessions] = useState(() => {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(sessions)); }, [sessions]);
  return [sessions, setSessions];
}
function useLeaderboard() {
  const [entries, setEntries] = useState(() => {
    try { const raw = localStorage.getItem(LS_LEADER); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(LS_LEADER, JSON.stringify(entries)); }, [entries]);
  return [entries, setEntries];
}

// ---------- Utils ----------
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

// Superscript for nice-looking exponents in prompts
const SUP = { "-":"⁻", "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹" };
function toSup(n){ return String(n).split("").map(ch => SUP[ch] ?? ch).join(""); }

// ----- Superscript helpers (for input beautify + parsing) -----
const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUP_MINUS = "⁻";
const DIGITS = "0123456789";

function mean(arr){ return arr.length ? arr.reduce((s,x)=>s+x,0) / arr.length : 0; }

// Use entry.accuracy if present (it’s already Laplace-smoothed in computeScore),
// else fall back to (correct+1)/(attempts+2)
function entryAcc(e){
  if (Number.isFinite(e?.accuracy)) return e.accuracy;
  const c = e?.correct ?? 0, a = e?.attempts ?? 0;
  return (c + 1) / (a + 2);
}

function toSuperscriptFromCaret(text) {
  // turn ^-12, ^10, ^3 etc. into superscripts
  return text.replace(/\^(-?\d+)/g, (_, num) => {
    const isNeg = num.startsWith("-");
    const abs = isNeg ? num.slice(1) : num;
    const mapped = abs
      .split("")
      .map(d => SUP_DIGITS[DIGITS.indexOf(d)] ?? d)
      .join("");
    return (isNeg ? SUP_MINUS : "") + mapped;
  });
}

function beautifyInline(s) {
  return toSuperscriptFromCaret(
    s
      .replace(/sqrt\(/gi, "√(") // make sqrt look nice
      .replace(/\*/g, "×")       // optional: show × instead of *
  );
}

// Fractions helpers
function reduceFraction(p, q){
  const g = gcd(p, q);
  p /= g; q /= g;
  if (q < 0) { p = -p; q = -q; } // normalize sign
  return [p, q];
}
function formatFraction(p, q){
  const [P, Q] = reduceFraction(p, q);
  return Q === 1 ? String(P) : `${P}/${Q}`;
}
// Parser helpers (accepts fractions, sqrt(), π, etc.)
const UNDEF_SET = new Set([
  "undef", "undefined", "e", "doesnotexist", "noanswer", "novalue",
  "no value", "n/a", "nan", "∞", "-∞", "infinity", "-infinity", "inf", "-inf"
]);

function isUndefLike(s) {
  const n = normalizeString(s);
  return UNDEF_SET.has(n);
}
function normalizeString(s){ return (s??"").toString().trim().toLowerCase().replace(/\s+/g,""); }


function answersMatch(user, correct) {
  // 0) Special "undefined/no value" handling
  if (isUndefLike(user) && isUndefLike(correct)) return true;

  // 1) Numeric compare (most robust)
  const u = tryNumeric(user);
  const c = tryNumeric(correct);
  if (u != null && c != null && Number.isFinite(u) && Number.isFinite(c)) {
    return Math.abs(u - c) < 1e-6;
  }

  // 2) Fallback to normalized expression text compare
  const norm = (s) => toJSExpr(String(s)).replace(/\s+/g, '').toLowerCase();
  return norm(user) === norm(correct);
}


// ---- One true normalizer → JS-safe expression -----------------



// numeric evaluator using the normalizer
function tryNumeric(value) {
  if (value == null) return null;
  const js = normalizeToJS(value);
  try {
    const out = Function(`"use strict"; return (${js})`)();
    return (typeof out === "number" && isFinite(out)) ? out : null;
  } catch {
    return null;
  }
}

// expose the JS string for debug/functional compare
function toJSExpr(expr) {
  return normalizeToJS(expr);
}

function evalExprAtX(expr, x) {
  const js = normalizeToJS(expr);
  const fn = new Function("x", `with (Math) { return (${js}); }`);
  return fn(x);
}


function equalish(userInput, expected){
  const uNorm = normalizeString(userInput);
  const eNorm = normalizeString(expected);
  if (UNDEF_SET.has(eNorm)) return UNDEF_SET.has(uNorm);
  if (uNorm === eNorm) return true;

  const uNum = tryNumeric(userInput);
  const eNum = tryNumeric(expected);
  if (uNum != null && eNum != null) return Math.abs(uNum - eNum) <= 1e-2;

  // Algebraic fallback: compare functions of x
  const maybeAlgebra = /[a-z]/i.test(userInput + expected) || /[²³]/.test(userInput + expected);
  if (maybeAlgebra) {
    const xs = [-3,-2,-1,-0.5,0,0.5,1,2,3,4];
    let ok = 0, tot = 0;
    for (const x of xs) {
      try {
        const a = evalExprAtX(userInput, x);
        const b = evalExprAtX(expected, x);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          tot++; if (Math.abs(a - b) <= 1e-2) ok++;
        }
      } catch { /* ignore bad x (domain issues) */ }
    }
    return tot > 0 && ok / tot > 0.99; // allow rare domain hiccup
  }

  return false;
}

// helper to identify CALCULATION-only topics (for Flash)
async function updateGlobalDisplayName(userId, displayName) {
  const now = new Date().toISOString();

  // 1) profiles (authoritative)
  const { error: pErr } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, display_name: displayName, updated_at: now });
  if (pErr) throw pErr;

  // 2) leaderboard (denormalized copy on past rows)
  const { error: lErr } = await supabase
    .from("leaderboard")
    .update({ display_name: displayName })
    .eq("user_id", userId);
  if (lErr) throw lErr;
}

const CALC_IDS = new Set(CATEGORIES.CALCULATION.map(t=>t.id));
const isCalc = (id)=> CALC_IDS.has(id);
// ---------- MathJax helpers ----------
function normalizeToJS(expr) {
  if (expr == null) return "";
  let s = String(expr);

  // basic cleanups
  s = s.replace(/[−—]/g, "-").replace(/\s+/g, "");
  s = s.replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/\^/g, "**");

  // sqrt forms
  s = s.replace(/√\s*\(([^)]+)\)/g, (_, inner) => `Math.sqrt(${inner})`);
  s = s.replace(/√\s*([A-Za-z_]\w*|\d+(?:\.\d+)?)/g, (_, inner) => `Math.sqrt(${inner})`);
  s = s.replace(/\bsqrt\s*\(([^)]+)\)/gi, (_, inner) => `Math.sqrt(${inner})`);
  s = s.replace(/\bsqrt(\d+(?:\.\d+)?)/gi, (_, num) => `Math.sqrt(${num})`);

  // constants
  s = s.replace(/\bpi\b/gi, "Math.PI").replace(/π/gi, "Math.PI");

  // user typed "math." → "Math."
  s = s.replace(/(^|[^A-Za-z])math\./g, "$1Math.");

  // ---- FULL superscript support (0–9 and minus) ----
  const SUP_TO_ASC = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁻":"-" };
  s = s.replace(/([A-Za-z0-9_.\)])([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, base, sup) => {
    const dec = sup.split("").map(ch => SUP_TO_ASC[ch] ?? "").join("");
    return `(${base})**${dec}`;
  });

  // guard against accidental double prefixes
  s = s.replace(/(?:Math\.){2,}/g, "Math.");

  return s;
}

// convert your plain typing to a *simple* LaTeX for preview
function toTexFromPlain(s) {
  if (!s) return "";
  let t = s;

  // quick escapes
  t = t.replaceAll('\\', '\\textbackslash ');
  t = t.replace(/_/g, '\\_');

  // sqrt( ... ) -> \sqrt{ ... }
  t = t.replace(/sqrt\s*\(\s*/gi, '\\sqrt{');
  // try to balance the closing brace when user types ')'
  // we won't be perfect, but good enough for live preview
  let open = 0;
  t = t.replace(/\{/g, m => (open++, m)).replace(/\}/g, m => (open = Math.max(0, open-1), m));
  // replace ')' with '}' only to close \sqrt{...}
  t = t.replace(/\)/g, () => open > 0 ? '}' : ')');

  // our ^{} insertion becomes ^{...}
  // (user types inside the braces already, so just keep it)
  // allow plain 2^3 too: turn "a^b" into "a^{b}" if not already braced
  t = t.replace(/(\w|\))\^(\w)/g, '$1^{\$2}').replace(/\$\{2\}/g, '{');

  // basic fractions: things like (a)/(b) or a/b → \dfrac{a}{b}
  // safer rule: only convert if user already grouped: ( ... )/( ... ) or \frac already
  t = t.replace(/\(([^\)]+)\)\s*\/\s*\(([^\)]+)\)/g, '\\dfrac{$1}{$2}');
  // very simple a/b with small tokens (digits/letters), avoid URLs, etc.
  t = t.replace(/\b([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)\b/g, '\\dfrac{$1}{$2}');

  // x√3 etc already render fine, but replace unicode √ with \sqrt{}
  t = t.replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}');

  return t;
}

function MathPreview({ latex }) {
  const ref = useRef(null);

  useEffect(() => {
    const mj = window.MathJax;
    if (!mj || !latex || !ref.current) return;
    (mj.startup?.promise ?? Promise.resolve()).then(() =>
      mj.typesetPromise([ref.current])
    );
  }, [latex]);

  if (!latex) return null;

  return (
    <div ref={ref} className="mt-1 text-white/80 text-base">
      {/* MathJax will render the \( ... \) inline */}
      <span>{`\\(${latex}\\)`}</span>
    </div>
  );
}


// ---------- DnD primitives ----------
function DraggableTopic({ id, label }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `src-${id}` });
  const style = { transform: CSS.Translate.toString(transform) };
  return (
    <motion.div
      layout ref={setNodeRef} style={style}
      {...attributes} {...listeners}
      className={`${cardBase} px-3 py-2 text-sm text-white/90 hover:text-white cursor-grab active:cursor-grabbing select-none border-white/10 bg-white/[0.03] transform-gpu will-change-transform`}
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
    >{label}</motion.div>
  );
}

// Special card: Flash Timer with drag **handle** only (prevents input from starting drag)
function DraggableFlashTimer() {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: "src-flash_timer" });
  const style = { transform: CSS.Translate.toString(transform) };
  return (
    <motion.div layout ref={setNodeRef} style={style} className={`${cardBase} p-3 border-white/10 bg-emerald-500/5`}
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-emerald-300">Flash Timer</div>
          <div className="text-xs text-white/50">Drag with the handle • Adjust time in Session Folder</div>
        </div>
        <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10" {...listeners} {...attributes} aria-label="Drag Flash Timer">
          <GripVertical size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function DroppableFolder({ id, children }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${panel} min-h-[140px] flex flex-col gap-3 justify-center items-center text-white/80 relative overflow-hidden ${isOver ? "ring-2 ring-emerald-400/50" : ""}`}
    >
      <div className="pointer-events-none absolute -top-20 right-0 h-40 w-72 rotate-12 bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
      {children}
    </div>
  );
}

function SortableTopicChip({ id, label, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 text-white/90 text-sm">
        {/* Drag handle only */}
        <button
          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${label}`}
        >
          <GripVertical size={14} />
        </button>

        <span className="truncate">{label}</span>

        {/* Remove button that doesn't start a drag */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // <- crucial
            onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()} // kill drag before it starts
          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/60 hover:text-white ml-auto"
          aria-label={`Remove ${label}`}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}


// Editable Flash Timer when inside the folder — now full width
function FolderFlashTimerEditor({ value, onChange, onRemove }){
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: "flash_timer" });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="group col-span-full">
      <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 ring-1 ring-emerald-400/20 text-white/90 text-sm w-full">
        <div className="flex items-center gap-2 text-emerald-300/90">
          <GripVertical size={14} {...attributes} {...listeners} />
          <span className="font-semibold">Flash Timer</span>
        </div>
        <label className="flex items-center gap-2 ml-2 text-xs">
          <span className="text-white/60">Hide after</span>
          <input type="number" step="0.1" min={0.1} value={value}
            onChange={(e)=>onChange(parseFloat(e.target.value)||0)}
            className="bg-transparent outline-none border-none w-20 text-white placeholder:text-white/40" />
          <span className="text-white/60">s</span>
        </label>
        <button onClick={onRemove} className="ml-auto opacity-60 hover:opacity-100" aria-label="Remove Flash Timer"><X size={14}/></button>
      </div>
    </div>
  );
}

function gcd(a, b){ a=Math.abs(a); b=Math.abs(b); while (b){ [a,b]=[b, a%b]; } return a || 1; }

function weightedPick(entries){
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [,w])=>s+w, 0);
  let r = Math.random() * total;
  for (const [v,w] of entries){
    if ((r -= w) <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

function weightedPick2(entries){
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [,w])=>s+w, 0);
  let r = Math.random() * total;
  for (const [v,w] of entries){
    if ((r -= w) <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
function isTerminatingDenom(q){
  // q should be the reduced denominator
  let x = q;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  return x === 1;
}

// ---------- Question generators ----------
function genQuestion(topic) {
  switch (topic) {
    // Mental arithmetic
    case "sci_rewrite": {
      function randomSciNumber() {
        const exponent = randInt(-6, 6); // between 10^-6 and 10^6
        const mantissa = (Math.random() * 9 + 1); // between 1 and 10
        const num = mantissa * Math.pow(10, exponent);
        return parseFloat(num.toPrecision(3)); // cleaner form
      }

      // Generate a simple number that clearly demonstrates shifting decimal
      const pool = Array.from({ length: 20 }, () => randomSciNumber());
      const x = pick(pool) * (Math.random() < 0.2 ? -1 : 1);

      const { a, n } = toScientific(x);

      const showA = (Number.isInteger(a) ? String(a) : String(a));
      const prompt = `Rewrite ${x} in the form a×10^n (scientific notation).`;

      const canonical = `${showA}×10^${n}`;         // pretty
      const acceptable = [
        canonical,
        `${showA}*10^${n}`,
        `${showA}e${n}`,
      ];

      const checker = (user) => {
        const parsed = parseSci(user);
        if (!parsed) return false;
        // compare exponent exactly, mantissa ~ within small tolerance
        if (parsed.n !== n) return false;
        return Math.abs(parsed.a - a) <= 1e-3;
      };

      return { prompt, answer: canonical, acceptableAnswers: acceptable, checker };
    }

    case "mental_add": { const a = randInt(10, 999), b = randInt(10, 999); return { prompt: `${a} + ${b}`, answer: String(a + b) }; }
    case "mental_sub": { const a = randInt(100, 999), b = randInt(10, 999); const [x, y] = a > b ? [a, b] : [b, a]; return { prompt: `${x} - ${y}`, answer: String(x - y) }; }
    case "mental_mul": { const a = randInt(10, 99), b = randInt(2, 9); return { prompt: `${a} × ${b}`, answer: String(a * b) }; }
    case "mul_focus_multiples": { const a = pick([12,13,14,15,16,25]); const b = randInt(1, 12); return { prompt: `${a} × ${b}`, answer: String(a * b) }; }
    case "tri_special": {
      // Canonical layout: right angle at A (bottom-left), base=AB (horizontal), vertical=AC (up)
      const type = pick(["30-60-90", "45-45-90"]);
      const mode = pick(["length", "angle"]); // "length" (find x) OR "angle" (find θ)
      const u = randInt(2, 20);

      const makeAns = (exactStr, numericVal) => {
        const approx = String(Math.round(numericVal * 1000) / 1000);
        return {
          exact: exactStr,
          acceptable: [
            exactStr,
            exactStr.replace("√3", "sqrt(3)").replace("√2", "sqrt(2)").replace(/\s+/g,''),
            approx,
          ],
        };
      };

      if (type === "30-60-90") {
        // sides: short = u (AC), long = u√3 (AB), hyp = 2u (BC)
        const exact = { short: `${u}`, long: `${u}√3`, hyp: `${2*u}` };
        const numeric = { short: u, long: u*Math.sqrt(3), hyp: 2*u };

        if (mode === "length") {
          const sides = ["short","long","hyp"];
          const given = pick(sides);
          const unknown = sides.find(s => s !== given);

          const ans = makeAns(exact[unknown], numeric[unknown]);
          const labels = { base: "", vertical: "", hyp: "" };
          const setLabel = (side,text)=>{
            if (side==="long") labels.base = text;
            else if (side==="short") labels.vertical = text;
            else labels.hyp = text;
          };
          setLabel(given, exact[given]);
          setLabel(unknown, "x");

          // Angle hint (always include to avoid underspecification)
          // In our canonical layout: ∠B = 30°, ∠C = 60°
          const angleHint = pick(["30B","60C"]);

          return {
            prompt: "Find x",
            answer: ans.exact,
            acceptableAnswers: ans.acceptable,
            diagram: {
              type: "30-60-90",
              lengths: { base: numeric.long, vertical: numeric.short },
              labels,
              angleHint,
              isoRight: false,
              thetaAt: null,
            },
          };
        } else {
          // ANGLE mode: give ANY TWO sides + right angle, ask for θ at B or C.
          // Choose which two numeric sides to show:
          const two = pick([
            ["short","hyp"],  // determines 30° at B
            ["long","hyp"],   // determines 60° at B
            ["short","long"]  // also sufficient
          ]);
          const labels = { base:"", vertical:"", hyp:"" };
          const put = (side, text)=>{
            if (side==="long") labels.base = text;
            else if (side==="short") labels.vertical = text;
            else labels.hyp = text;
          };
          put(two[0], exact[two[0]]);
          put(two[1], exact[two[1]]);

          // Decide θ location
          // If we place θ at B: opposite is vertical (short) → 30°
          // If we place θ at C: opposite is base (long) → 60°
          const thetaAt = pick(["B","C"]);
          const theta = (thetaAt === "B") ? 30 : 60;

          return {
            prompt: "Find θ (in degrees)",
            answer: String(theta),
            acceptableAnswers: [String(theta), `${theta}°`],
            diagram: {
              type: "30-60-90",
              lengths: { base: numeric.long, vertical: numeric.short },
              labels,
              angleHint: null,   // keep only θ marked
              isoRight: false,
              thetaAt,
            },
          };
        }
      } else {
        // 45-45-90: legs = u (AB & AC), hyp = u√2 (BC)
        const exact = { leg: `${u}`, hyp: `${u}√2` };
        const numeric = { leg: u, hyp: u*Math.sqrt(2) };

        if (mode === "length") {
          const sides = ["leg","hyp"];
          const given = pick(sides);
          const unknown = sides.find(s => s !== given);

          const ans = makeAns(unknown==="leg" ? exact.leg : exact.hyp, unknown==="leg" ? numeric.leg : numeric.hyp);
          const labels = { base: "", vertical: "", hyp: "" };
          if (given === "leg") labels.base = exact.leg; else labels.hyp = exact.hyp;
          if (unknown === "leg") { if (labels.base) labels.vertical = "x"; else labels.base = "x"; } else { labels.hyp = "x"; }

          return {
            prompt: "Find x",
            answer: ans.exact,
            acceptableAnswers: ans.acceptable,
            diagram: {
              type: "45-45-90",
              lengths: { base: numeric.leg, vertical: numeric.leg },
              labels,
              angleHint: null,
              isoRight: true,   // draw equal-leg ticks
              thetaAt: null,
            },
          };
        } else {
          // ANGLE mode: any two sides + right angle ⇒ θ is 45° at B or C
          const labels = { base: exact.leg, vertical: exact.leg, hyp: "" }; // show both legs
          const thetaAt = pick(["B","C"]);
          const theta = 45;

          return {
            prompt: "Find θ (in degrees)",
            answer: "45",
            acceptableAnswers: ["45","45°"],
            diagram: {
              type: "45-45-90",
              lengths: { base: numeric.leg, vertical: numeric.leg },
              labels,
              angleHint: null,
              isoRight: true,
              thetaAt,
            },
          };
        }
      }
    }
    case "factorise_quadratic": {
      // Two difficulty modes:
      // - easy: small a, c (both factor nicely)
      // - slightly harder: a = 1 but |c| can be larger (e.g., 176), clean b
      const mode = Math.random() < 0.5 ? "easy" : "hard";

      let a, b, c, A, B, C, D;

      if (mode === "easy") {
        // Pick (Ax+B)(Cx+D) with small coefficients, random signs
        A = pick([1, 1, 2, 3]);
        C = pick([1, 2, 3]);
        const q = pick([-9, -8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8, 9]);
        const s = pick([-9, -8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8, 9]);
        B = q; D = s;

        ({ a, b, c } = expandFactors(A, B, C, D));
        // Make sure it's not degenerate and reasonably sized
        if (Math.abs(a) > 9 || Math.abs(b) > 60 || Math.abs(c) > 120) {
          // regenerate once
          A = 2; C = 1; B = 3; D = 2;
          ({ a, b, c } = expandFactors(A, B, C, D));
        }
      } else {
        // Slightly harder: a = 1, |c| larger, but factorable; choose b nice
        // Pick p, q as integer roots → (x+p)(x+q)
        const p = pick([-20, -16, -15, -12, -11, -10, -9, -8, -7, -6, -5, -4, 4, 5, 6, 7, 8, 9, 10, 12, 14]);
        const q = pick([-12, -11, -10, -9, -8, -7, -6, -5, -4, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        A = 1; C = 1; B = p; D = q;
        ({ a, b, c } = expandFactors(A, B, C, D));
        // Ensure |c| is “harder”
        if (Math.abs(c) < 60) {
          // tweak q
          const q2 = q * pick([2, -2]);
          D = q2;
          ({ a, b, c } = expandFactors(A, B, C, D));
        }
      }

      const polyStr = `${a === 1 ? "" : a}x^2 ${b >= 0 ? "+ " + b : "− " + Math.abs(b)}x ${c >= 0 ? "+ " + c : "− " + Math.abs(c)}`;

      // Canonical answer (one ordering)
      const ans1 = `(${A === 1 ? "x" : A + "x"}${B >= 0 ? "+" + B : B})(${C === 1 ? "x" : C + "x"}${D >= 0 ? "+" + D : D})`;
      const ans2 = `(${C === 1 ? "x" : C + "x"}${D >= 0 ? "+" + D : D})(${A === 1 ? "x" : A + "x"}${B >= 0 ? "+" + B : B})`;

      const target = { a, b, c };

      return {
        prompt: `Factorise: ${polyStr}`,
        answer: ans1,
        acceptableAnswers: [ans1, ans2],
        checker: (user) => {
          const u = user.replace(/\s+/g, "");
          // quick accept if matches one of the strings (order)
          if (u === ans1.replace(/\s+/g, "") || u === ans2.replace(/\s+/g, "")) return true;

          // robust: parse (Ax+B)(Cx+D), multiply and compare
          const parsed = parseBinomialProduct(u);
          if (!parsed) return false;
          const exp = expandFactors(parsed.A, parsed.B, parsed.C, parsed.D);
          return sameQuad(exp, target);
        }
      };
    }
    
    case "divisibility_rules": {
      const divisors = [3, 4, 6, 7, 8, 9, 11];
      const d = pick(divisors);

      // Decide if we want a YES or NO instance
      const wantDivisible = Math.random() < 0.5;
      let N;

      if (wantDivisible) {
        // choose a multiple of d in [100..999]
        const kMin = Math.ceil(100 / d), kMax = Math.floor(999 / d);
        const k = randInt(kMin, kMax);
        N = k * d;
      } else {
        // choose non-multiple in [100..999]
        while (true) {
          const t = randInt(100, 999);
          if (t % d !== 0) { N = t; break; }
        }
      }

      const prompt = `Is ${N} divisible by ${d}? (yes/no)`;
      const correct = wantDivisible ? "yes" : "no";

      return {
        prompt,
        answer: correct,
        acceptableAnswers: wantDivisible ? ["yes", "y", "Yes", "Y"] : ["no", "n", "No", "N"],
        checker: (user) => {
          const s = String(user).trim().toLowerCase();
          const yn = (s === "yes" || s === "y") ? "yes" :
            (s === "no" || s === "n") ? "no" : null;
          if (!yn) return false;
          return yn === correct;
        },
        // <-- NEW: show this in your Reveal UI under the Answer line
        explanation: explainDivisibility(N, d),
      };
    }


    case "circle_theorems": {
      // helpers
      const nice = x => String(Math.round(x));
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];
      const centerDegs = [15, 50, 100, 150, 210, 260, 320];

      const giveDeg = d => ({ answer: nice(d), acceptable: [nice(d), `${nice(d)}°`] });
      const giveNum = v => {
        const n = Math.round(v * 100) / 100;
        return { answer: String(n), acceptable: [String(n), String(Math.round(n)), n.toFixed(2)] };
      };

      // choose scenario
      const scenario = pick([
        "center_twice_circ",
        "same_segment",
        "semicircle_right",         // no square (infer 90°)
        "cyclic_quad",
        "equal_tangents_isosceles", // PA = PB
        "alternate_segment",        // tangent–chord
        "reflex_center",
        "intersecting_chords_inside",
        "secants_from_external",
        "tangent_secant_power"
      ]);

      let diagram = {
        type: "circle",
        points: [],
        chords: [],
        radii: [],
        tangent: null,
        secantLines: [],
        angleLabels: [],
        rightAngles: [],
        equalTicks: [],
        sideLabels: [],
        thetaAt: null,
        thetaUsesChord: null,
      };

      let prompt = "Find θ (in degrees)";
      let answer, acceptable;

      if (scenario === "center_twice_circ") {
        const A = pick(centerDegs), B = (A + pick([80, 100, 120])) % 360, C = (A + 40) % 360;
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "O", deg: null }];
        diagram.chords = [["A", "B"], ["A", "C"], ["B", "C"]];
        diagram.radii = [["O", "A"], ["O", "B"]];
        const central = Math.abs(((B - A + 360) % 360));
        const minor = central > 180 ? 360 - central : central;
        const circ = minor / 2;
        diagram.angleLabels.push({ at: "O", from: "A", to: "B", text: `${nice(minor)}°` });
        diagram.thetaAt = "C";
        ({ answer, acceptable } = giveDeg(circ));

      } else if (scenario === "same_segment") {
        const A = pick(centerDegs), B = (A + pick([70, 90, 110])) % 360, C = (B + 40) % 360, D = (A + 320) % 360;
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "D", deg: D }];
        diagram.chords = [["A", "B"], ["A", "C"], ["B", "C"], ["A", "D"], ["B", "D"]];
        const central = Math.abs(((B - A + 360) % 360));
        const arc = (central > 180 ? 360 - central : central) / 2;
        diagram.angleLabels.push({ at: "C", from: "A", to: "B", text: `${nice(arc)}°` });
        diagram.thetaAt = "D";
        ({ answer, acceptable } = giveDeg(arc));

      } else if (scenario === "semicircle_right") {
        // diameter AB → ∠ACB = 90°, but DON'T draw the right-angle square.
        const A = pick(centerDegs), B = (A + 180) % 360, C = (A + pick([40, 140])) % 360;
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "O", deg: null }];
        diagram.chords = [["A", "B"], ["A", "C"], ["B", "C"]];
        diagram.radii = [["O", "A"], ["O", "B"]];
        const givenAt = pick(["A", "B"]);
        const given = pick([28, 32, 35, 40, 48, 55]);
        diagram.angleLabels.push({ at: givenAt, text: `${given}°` });
        diagram.thetaAt = givenAt === "A" ? "B" : "A";
        ({ answer, acceptable } = giveDeg(90 - given));

      } else if (scenario === "cyclic_quad") {
        const start = pick(centerDegs), step = pick([60, 80, 100]);
        const A = start, B = (A + step) % 360, C = (B + step) % 360, D = (C + step) % 360;
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "D", deg: D }];
        diagram.chords = [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]];
        const angA = pick([70, 80, 95, 100, 110]);
        diagram.angleLabels.push({ at: "A", from: "D", to: "B", text: `${angA}°` });
        diagram.thetaAt = "C";
        ({ answer, acceptable } = giveDeg(180 - angA));

      } else if (scenario === "equal_tangents_isosceles") {
        const A = pick(centerDegs), B = (A + pick([60, 80, 100])) % 360;
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "O", deg: null }];
        // create external P via equal tangents? we only need the isosceles idea visually; keep as lengths
        const base = pick([35, 40, 50, 60]);
        // show base angle at A, ask apex at P (not drawn; pure angle task)
        diagram.angleLabels.push({ at: "A", text: `${base}°` });
        diagram.thetaAt = "P";
        // we won't draw P for this one to keep diagram clean; it's a pure reasoning angle
        ({ answer, acceptable } = giveDeg(180 - 2 * base));

      } else if (scenario === "alternate_segment") {
        const T = pick(centerDegs), C = (T + pick([60, 80, 100])) % 360, B = (T + 180 + 20) % 360;
        diagram.points = [{ name: "T", deg: T }, { name: "C", deg: C }, { name: "B", deg: B }, { name: "O", deg: null }];
        diagram.tangent = { at: "T" };
        diagram.chords = [["T", "C"], ["B", "C"]];
        const opp = pick([35, 40, 50, 60]);
        diagram.angleLabels.push({ at: "B", from: "C", to: "T", text: `${opp}°` });
        diagram.thetaAt = "T";
        diagram.thetaUsesChord = "TC";
        ({ answer, acceptable } = giveDeg(opp));

      } else if (scenario === "reflex_center") {
        const A = pick(centerDegs), B = (A + pick([220, 240, 260])) % 360, C = (A + 40) % 360;
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "O", deg: null }];
        diagram.chords = [["A", "B"], ["A", "C"], ["B", "C"]];
        diagram.radii = [["O", "A"], ["O", "B"]];
        const central = Math.abs(((B - A + 360) % 360)); // reflex
        const minor = 360 - central;
        const circ = minor / 2;
        diagram.angleLabels.push({ at: "O", from: "A", to: "B", text: `${nice(central)}°`, reflex: true });
        diagram.thetaAt = "C";
        ({ answer, acceptable } = giveDeg(circ));

      } else if (scenario === "intersecting_chords_inside") {
        // chords AB and CD intersect at X inside: AX·BX = CX·DX
        const A = 20, B = 200, C = 300, D = 80; // positions that guarantee inside crossing
        
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "D", deg: D }, { name: "O", deg: null }];
        diagram.chords = [["A", "B"], ["C", "D"]];

        // choose nice numbers
        const AX = pick([3, 4, 5, 6]), BX = pick([4, 5, 6, 8]), CX = pick([2, 3, 4, 5]);
        const DX = (AX * BX) / CX; // x
        // label the correct halves (renderer now supports sub-segments like 'AX', 'BX' etc.)
        diagram.sideLabels.push({ of: "AX", text: `AX=${AX}` });
        diagram.sideLabels.push({ of: "BX", text: `BX=${BX}` });
        diagram.sideLabels.push({ of: "CX", text: `CX=${CX}` });
        diagram.sideLabels.push({ of: "DX", text: `DX=x` });

        // ask for x
        prompt = "Find x (chords intersect inside): AX·BX = CX·DX";
        ({ answer, acceptable } = giveNum(DX));

      } else if (scenario === "secants_from_external") {
        // two secants from same external point P: (PA·PB) = (PC·PD)
        const A = 340, B = 200, C = 120, D = 40;  // arrange so extended lines intersect outside (right side)
        diagram.points = [{ name: "A", deg: A }, { name: "B", deg: B }, { name: "C", deg: C }, { name: "D", deg: D }, { name: "O", deg: null }];
        diagram.secantLines = [["A", "B"], ["C", "D"]];  // CircleDiagram will compute P and draw both lines

        const PA = pick([3, 4, 5, 6, 8]), PB = pick([8, 10, 12, 15]), PC = pick([4, 5, 6, 8]);
        const PD = (PA * PB) / PC;
        diagram.sideLabels.push({ of: "PA", text: `PA=${PA}` });
        diagram.sideLabels.push({ of: "PB", text: `PB=${PB}` });
        diagram.sideLabels.push({ of: "PC", text: `PC=${PC}` });
        diagram.sideLabels.push({ of: "PD", text: `PD=x` });

        prompt = "Find x (two secants from P): PA·PB = PC·PD";
        ({ answer, acceptable } = giveNum(PD));

      } else { // "tangent_secant_power"
        // Points on circle
        const T = 30, A = 210, B = 320;
        diagram.points = [
          { name: "T", deg: T },
          { name: "A", deg: A },
          { name: "B", deg: B },
          { name: "O", deg: null }
        ];

        // Put external point P on the tangent at T (so PT is a true tangent)
        diagram.tangent = { at: "T", externalFromT: true, pDist: 1.5 };

        // Draw the *secant* through A–B from the same P
        diagram.secantLines = [["A", "B"]];

        // Numbers & labels
        const PT = pick([5, 6, 7, 8, 9]);
        const PA = pick([4, 5, 6, 8, 10]);
        const PB = (PT * PT) / PA;

        diagram.sideLabels.push({ of: "PT", text: `PT=${PT}` });
        diagram.sideLabels.push({ of: "PA", text: `PA=${PA}` });
        diagram.sideLabels.push({ of: "PB", text: `PB=x` });

        prompt = "Find x (tangent & secant): PT² = PA·PB";
        ({ answer, acceptable } = giveNum(PB));
      }

      return { prompt, answer, acceptableAnswers: acceptable, diagram };
    }



    case "indices_simplify": {
      const base = pick([2,3,5,10]);
      const termCount = pick([2,3,3,4]); // mostly 3 terms

      let numerator = [];
      let denominator = [];
      let net = 0;

      for (let i = 0; i < termCount; i++) {
        const exp = pick([-9,-6,-4,-3,-2,-1,1,2,3,4,5,6,7,8]);
        const piece = `${base}${toSup(exp)}`;
        if (i === 0 || Math.random() < 0.6) {
          numerator.push(piece); net += exp;
        } else {
          denominator.push(piece); net -= exp;
        }
      }

      // textual version (fallback)
      const exprText = denominator.length > 0
        ? `(${numerator.join(" × ")}) / (${denominator.join(" × ")})`
        : numerator.join(" × ");

      // 35% of the time: render a **nested TeX fraction** prompt (pretty)
      const asNested = Math.random() < 0.35;

      function toTexPower(p) {
        // "2⁻³" → "2^{-3}"
        const m = p.match(/^(\d+)([⁻⁰¹²³⁴⁵⁶⁷⁸⁹-]+)$/);
        if (!m) return p;
        const b = m[1];
        const sup = m[2]
          .replace(/⁻/g,'-')
          .replace(/⁰/g,'0').replace(/¹/g,'1').replace(/²/g,'2').replace(/³/g,'3')
          .replace(/⁴/g,'4').replace(/⁵/g,'5').replace(/⁶/g,'6').replace(/⁷/g,'7')
          .replace(/⁸/g,'8').replace(/⁹/g,'9');
        return `${b}^{${sup}}`;
      }
      function buildNestedTex(numArr, denArr) {
        // up to 3-level nesting: \dfrac{ a × \dfrac{...}{...} }{ ... }
        const texListNum = numArr.map(toTexPower);
        const texListDen = denArr.map(toTexPower);

        const mkProd = arr => arr.length ? arr.join('\\,\\cdot\\,') : '1';

        // zero/one/two levels based on available terms
        if (!texListDen.length) return mkProd(texListNum);

        // level 1
        let top = mkProd(texListNum.slice(0, Math.max(1, Math.ceil(texListNum.length/2))));
        let bottom = mkProd(texListDen.slice(0, Math.max(1, Math.ceil(texListDen.length/2))));
        let frac1 = `\\dfrac{${top}}{${bottom}}`;

        // maybe level 2
        const restNum = texListNum.slice(Math.max(1, Math.ceil(texListNum.length/2)));
        const restDen = texListDen.slice(Math.max(1, Math.ceil(texListDen.length/2)));
        if (restNum.length || restDen.length) {
          const top2 = restNum.length ? mkProd(restNum) : '1';
          const bot2 = restDen.length ? mkProd(restDen) : '1';
          frac1 = `\\dfrac{${frac1}}{\\dfrac{${top2}}{${bot2}}}`;
        }

        return frac1;
      }

      const promptPretty = `Simplify: ${exprText}`;  // plain text only, no TeX


      // Correct answer in simplified index form
      let answerStr;
      if (net === 0) {
        answerStr = "1";
      } else if (net > 0) {
        answerStr = `${base}^${net}`;
      } else {
        const k = -net; answerStr = `1/${base}^${k}`;
      }
      const value = Math.pow(base, net);
      const numeric = String(value);

      return {
        prompt: promptPretty,
        answer: answerStr,
        acceptableAnswers: [answerStr, numeric, answerStr.replace(/\^/g,"**")],
      };
    }



    case "powers_mixed": {
      const base = pick([2,4,8]);
      const expLimits = { 2: 10, 4: 6, 8: 4 };
      const e = randInt(0, expLimits[base]);
      const val = Math.pow(base, e);

      return {
        prompt: `Compute: ${base}${toSup(e)}`,
        answer: String(val),
      };
    }


    case "metric_convert": {
    // Choose dimension and prefixes
      const dim = pick([
        { base: "m", name: "length", prefixes: ["µ","m","c","", "k"] },  // micro, milli, centi, (base), kilo
        { base: "g", name: "mass",   prefixes: ["µ","m","", "k"] },      // centi-gram is uncommon, omit
        { base: "s", name: "time",   prefixes: ["", "m", "k"] }          // base seconds, milli, kilo (rare but fine)
      ]);

      // Map prefix to factor vs base
      const factor = (p) => ({
        "µ": 1e-6, "m": 1e-3, "c": 1e-2, "": 1, "k": 1e3
      }[p]);

      const fromP = pick(dim.prefixes);
      const toP   = pick(dim.prefixes.filter(p => p !== fromP));

      // value (avoid too many decimals when converting)
      const v = randInt(1, 5000);
      const fromUnit = `${fromP}${dim.base}`.replace(/^µ/,"µ");
      const toUnit   = `${toP}${dim.base}`.replace(/^µ/,"µ");

      const valInBase = v * factor(fromP);
      const conv = valInBase / factor(toP);
      const ans = String(Math.round(conv * 10000) / 10000);  // up to 4 d.p.

      return {
        prompt: `Convert ${v} ${fromUnit} to ${toUnit}`,
        answer: ans
      };
    }

    case "simplify_fraction": {
      // ---------- helpers ----------
      const parseFraction = (s) => {
        if (!s) return null;
        const t = s.trim();
        if (/^[+-]?\d+$/.test(t)) return [Number(t), 1];
        const m = t.match(/^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/);
        if (!m) return null;
        const p = Number(m[1]), q = Number(m[2]);
        if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return null;
        return [p, q];
      };
      function randomCoprimePair(min = 2, max = 40) {
        while (true) {
          const a = randInt(min, max);
          const b = randInt(min, max);
          if (gcd(a, b) === 1) return [a, b];
        }
      }
      // simple TeX helpers
      const texFrac = (num, den) => `\\dfrac{${num}}{${den}}`;
      const texParen = s => `{${s}}`; // braces are grouping in TeX

      // ---------- choose flat or nested ----------
      // ~30% nested; nested uses smaller numbers
      const makeNested = Math.random() < 0.3;

      let P, Q;             // the unsimplified numeric fraction to show (as text fallback)
      let promptLatex;      // the TeX we render
      let textPrompt;       // plain text fallback like "Simplify: (a/b)/c"

      if (!makeNested) {
        // ------- FLAT: your original pattern -------
        const factors = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20];
        const [n0, d0] = randomCoprimePair(2, 40);
        const k = pick(factors);
        P = n0 * k;
        Q = d0 * k;
        if (Math.random() < 0.25) P = -P;

        promptLatex = `${texFrac(P, Q)}`;            // e.g. \dfrac{24}{36}
        textPrompt = `Simplify: ${P}/${Q}`;
      } else {
        // ------- NESTED: simpler integers -------
        // Two patterns:
        //  A) (a/b)/c  ==> a/(b*c)
        //  B) a/(b/c)  ==> (a*c)/b
        const pattern = Math.random() < 0.5 ? "overC" : "overBoverC";

        // keep numbers small & coprime where it matters
        const [a, b] = randomCoprimePair(2, 12);
        const c = randInt(2, 12);

        if (pattern === "overC") {
          // (a/b)/c → a/(b*c)
          const sign = Math.random() < 0.25 ? -1 : 1; // random sign on numerator
          P = sign * a;
          Q = b * c;
          promptLatex = texFrac(texFrac(sign * a, b), c);      // \dfrac{\dfrac{a}{b}}{c}
          textPrompt = `Simplify: (${sign * a}/${b})/${c}`;
        } else {
          // a/(b/c) → (a*c)/b
          const sign = Math.random() < 0.25 ? -1 : 1;
          P = sign * (a * c);
          Q = b;
          promptLatex = texFrac(a, texFrac(b, c));            // \dfrac{a}{\dfrac{b}{c}}
          textPrompt = `Simplify: ${a}/(${b}/${c})`;
          if (sign < 0) {
            // apply sign to overall numerator visually
            promptLatex = texFrac("-" + a, texFrac(b, c));
          }
        }
      }

      // ---------- canonical answer & checker ----------
      const [ANS_P, ANS_Q] = reduceFraction(P, Q);     // denominator positive
      const answer = formatFraction(ANS_P, ANS_Q);

      const checker = (user) => {
        const parsed = parseFraction(user);
        if (!parsed) return false;
        let [a, b] = parsed;
        if (ANS_Q !== 1 && b === 1) return false;             // must be a fraction unless integer is correct
        const g0 = gcd(Math.abs(a), Math.abs(b));
        if (g0 !== 1) return false;                           // lowest terms
        const [A, B] = reduceFraction(a, b);
        return A === ANS_P && B === ANS_Q;
      };

      return {
        prompt: textPrompt,
        promptLatex: `\\text{Simplify:}\\;${promptLatex}`,   // render with KaTeX
        answer,
        checker,
      };
    }


    case "mul_of_5": 
    { const a = pick([5, 15, 25]); 
      let b;
      if (a===5){b = randInt(11, 30);}
      else{
        b = randInt(1, 12);
      }
      return { prompt: `${a} × ${b}`, answer: String(a * b) }; }

    case "mental_div": { const b = randInt(2, 12); const a = b * randInt(2, 50); return { prompt: `${a} ÷ ${b}`, answer: String(Math.floor(a / b)) }; }
    case "squares": { const a = randInt(2, 35); return { prompt: `${a}²`, answer: String(a * a) }; }
    case "cubes": { const a = randInt(2, 15); return { prompt: `${a}³`, answer: String(a * a * a) }; }
    case "quadratics_eval": { const a = randInt(1, 5), b = randInt(-5, 5), c = randInt(-5, 5), x = randInt(-5, 5); const val = a * x * x + b * x + c; return { prompt: `Evaluate: ${a}x² ${b>=0?"+":"-"} ${Math.abs(b)}x ${c>=0?"+":"-"} ${Math.abs(c)} at x=${x}`.replaceAll("+ -", "- "), answer: String(val) }; }
    case "prime_factorise": {
      // Pick some "nice" numbers that come up in mental maths/ESAT style
      // They’ll be products of small primes, not huge randoms
      const pool = [
        72, 84, 90, 96, 120, 126, 132, 144, 168, 180, 192, 200,
        210, 216, 240, 252, 264, 270, 288, 300, 324, 336, 360,
        384, 400, 420, 432, 450, 480, 500, 512, 540, 560, 576, 600
      ];
      const n = pick(pool);

      // Factorise into primes
      function factorise(num) {
        let factors = {};
        let d = 2;
        let x = num;
        while (d * d <= x) {
          while (x % d === 0) {
            factors[d] = (factors[d] || 0) + 1;
            x /= d;
          }
          d++;
        }
        if (x > 1) factors[x] = (factors[x] || 0) + 1;
        return factors;
      }

      const factors = factorise(n);
      const answer = Object.entries(factors)
        .map(([p, e]) => (e === 1 ? p : `${p}^${e}`))
        .join(" × ");

      return {
        prompt: `Prime factorise: ${n}`,
        answer: answer
      };
    }

    // Percentages — fairly nice but varied
    case "percent_calc": {
      const p = pick([4,5,6,7,8,9,10,12,15,18,20,22,25]);
      let base = randInt(40, 600);
      base = Math.round(base / 5) * 5;
      const value = (p/100) * base;
      return { prompt: `${p}% of ${base}`, answer: String(Math.round(value*1000)/1000) };
    }

    // Algebra
    case "complete_square": {
      // force b to be even so p = b/2 is always integer
      let b = randInt(-15, 15);
      if (b % 2 !== 0) b += 1;  // adjust to nearest even
      const c = randInt(-15, 15);

      // p = b/2, q = (4c - b^2)/4
      const p = b / 2;
      const q = (4 * c - b * b) / 4;

      // Clean decimal formatter (no forced 2dp)
      const fmt = (n) => {
        const z = Math.abs(n) < 1e-12 ? 0 : n;
        if (Number.isInteger(z)) return String(z);
        return String(z)
          .replace(/(\.\d*?[1-9])0+$/, "$1") // trim trailing zeros
          .replace(/\.0+$/, "");             // trim ".0"
      };

      const sgn = (n) => (n >= 0 ? "+" : "-");
      const absS = (n) => fmt(Math.abs(n));

      // Build (x ± p)² part; collapse if p == 0
      const squarePart = Math.abs(p) < 1e-12 ? "x²" : `(x ${sgn(p)} ${absS(p)})²`;
      // Append constant; drop if q == 0
      const constPart = Math.abs(q) < 1e-12 ? "" : ` ${sgn(q)} ${absS(q)}`;

      const ans = `${squarePart}${constPart}`.trim();
      const ansCaret = ans.replace(/²/g, "^2"); // alternative ^2 version

      const prompt = `Complete the square: x² ${b >= 0 ? "+" : "-"} ${Math.abs(b)}x ${c >= 0 ? "+" : "-"} ${Math.abs(c)}`;

      return {
        prompt,
        answer: ans,
        acceptableAnswers: [ans, ansCaret],
      };
    }



    case "inequalities": { const a = pick([2,3,4,5,-2,-3]); const b = randInt(-10, 10); const c = randInt(-10, 10); let bound = (c - b) / a; const dir = a > 0 ? "<" : ">"; const fmt = (n)=> Number.isInteger(n)? `${n}` : n.toFixed(2); return { prompt: `Solve: ${a}x ${b>=0?"+":"-"} ${Math.abs(b)} ${"<"} ${c}`.replace("<", dir), answer: `x ${dir} ${fmt(bound)}` }; }
    case "binomial_expand": {
      // a can be positive or negative; bias to non-zero
      const Aabs = randInt(1, 6);
      const a = Math.random() < 0.5 ? Aabs : -Aabs; // negative sometimes, not always
      const n = pick([2, 3, 4, 5, 6]);

      const signToken = a >= 0 ? "+" : "−";
      const A = Math.abs(a);

      // Full expansions kept ONLY for n=2 or 3 (as requested)
      if (n === 2) {
        const expansion = `x² ${a >= 0 ? "+" : "−"} ${2 * A}x + ${A * A}`;
        return {
          prompt: `Expand: (x ${signToken} ${A})²`,
          answer: expansion,
          checker: (user) => user.replace(/\s+/g, "") === expansion.replace(/\s+/g, ""),
        };
      }
      if (n === 3) {
        const expansion =
          `x³ ${a >= 0 ? "+" : "−"} ${3 * A}x² + ${3 * A * A}x ${a >= 0 ? "+" : "−"} ${A * A * A}`;
        return {
          prompt: `Expand: (x ${signToken} ${A})³`,
          answer: expansion,
          checker: (user) => user.replace(/\s+/g, "") === expansion.replace(/\s+/g, ""),
        };
      }

      // For n = 4..6 → ask for the coefficient of x^k
      const k = randInt(0, n); // exponent to ask for
      // In (x + a)^n, coeff of x^k equals C(n,k) * a^(n-k)
      const coeff = nCk(n, k) * Math.sign(a) ** (n - k) * Math.pow(Math.abs(a), n - k);

      return {
        prompt: `In (x ${signToken} ${A})^${n}, what is the coefficient of x^${k}?`,
        answer: String(coeff),
        checker: (user) => {
          const v = Number(user.trim());
          return Number.isFinite(v) && v === coeff;
        },
      };
    }

    
    // Equations
    case "suvat_solve": {
      const eq = pick(["s=ut+0.5at^2","v=u+at","v^2=u^2+2as"]);
      const u = randInt(-5, 15); const a = randInt(-4, 6); const t = randInt(1, 8);
      const s = Math.round((u*t + 0.5*a*t*t)*100)/100; const v = Math.round((u + a*t)*100)/100;
      const pickVar = pick(eq === "v^2=u^2+2as" ? ["v","u","a","s"] : ["s","u","v","a","t"]);
      const known = { u, a, t, s, v };
      const prompt = `Eqn: ${eq}. Find ${pickVar}. Known: ${Object.entries(known).filter(([k])=>k!==pickVar).map(([k,v])=>`${k}=${v}`).join(", ")}`;
      let ans;
      if (eq === "v=u+at") { if (pickVar === "v") ans = v; if (pickVar === "u") ans = v - a*t; if (pickVar === "a") ans = (v - u)/t; if (pickVar === "t") ans = (v - u)/a; }
      else if (eq === "s=ut+0.5at^2") { if (pickVar === "s") ans = s; if (pickVar === "u") ans = (s - 0.5*a*t*t)/t; if (pickVar === "a") ans = (2*(s - u*t)) / (t*t); if (pickVar === "t") ans = t; }
      else { if (pickVar === "v") ans = Math.sign(u + a) * Math.sqrt(Math.max(0, u*u + 2*a*s)); if (pickVar === "u") ans = Math.sqrt(Math.max(0, v*v - 2*a*s)); if (pickVar === "a") ans = (v*v - u*u) / (2*s || 1); if (pickVar === "s") ans = (v*v - u*u) / (2*a || 1); }
      const answer = Number.isFinite(ans) ? String(Math.round(ans*100)/100) : ""; return { prompt, answer };
    }
    case "speed_basic": {
      // unknown: one of 'speed' v, 'distance' s, 'time' t
      const target = pick(["speed", "distance", "time"]);

      // choose tiny integers that divide cleanly
      let v, s, t;
      if (target === "speed") {
        t = randInt(2, 12);
        v = randInt(2, 12);
        s = v * t;
      } else if (target === "distance") {
        v = randInt(2, 12);
        t = randInt(2, 12);
        s = v * t;
      } else { // time
        v = randInt(2, 12);
        t = randInt(2, 12);
        s = v * t;
      }

      let prompt, numericAnswer;
      if (target === "speed") {
        prompt = `If distance = ${s} and time = ${t}, what is speed?`;
        numericAnswer = v;
      } else if (target === "distance") {
        prompt = `If speed = ${v} and time = ${t}, what is distance?`;
        numericAnswer = s;
      } else {
        prompt = `If speed = ${v} and distance = ${s}, what is time?`;
        numericAnswer = t;
      }

      return {
        prompt,
        answer: String(numericAnswer),
        checker: (user) => Number(user) === numericAnswer,
      };
    }
    case "trig_inverse_recall": {
      // mode: ask in degrees OR radians (answer format matches)
      const mode = pick(["deg", "rad"]);
      const invName = pick(["arcsin", "arccos", "arctan", "sin⁻¹", "cos⁻¹", "tan⁻¹"]);

      // exact-value pool (only defined values)
      const pool = [
        { f: "sin", val: "0", deg: 0, rad: "0" },
        { f: "sin", val: "1/2", deg: 30, rad: "π/6" },
        { f: "sin", val: "sqrt(2)/2", deg: 45, rad: "π/4" },
        { f: "sin", val: "sqrt(3)/2", deg: 60, rad: "π/3" },
        { f: "sin", val: "1", deg: 90, rad: "π/2" },

        { f: "cos", val: "1", deg: 0, rad: "0" },
        { f: "cos", val: "sqrt(3)/2", deg: 30, rad: "π/6" },
        { f: "cos", val: "sqrt(2)/2", deg: 45, rad: "π/4" },
        { f: "cos", val: "1/2", deg: 60, rad: "π/3" },
        { f: "cos", val: "0", deg: 90, rad: "π/2" },

        { f: "tan", val: "0", deg: 0, rad: "0" },
        { f: "tan", val: "1/sqrt(3)", deg: 30, rad: "π/6" },
        { f: "tan", val: "1", deg: 45, rad: "π/4" },
        { f: "tan", val: "sqrt(3)", deg: 60, rad: "π/3" },
        // (exclude 90° / π/2 where tan undefined)
      ];

      // map inverse label to base function
      const invToBase = (name) =>
        name.startsWith("arc") ? name.slice(3) : name.slice(0, 3); // arcsin→sin, sin⁻¹→sin

      const base = invToBase(invName); // "sin"|"cos"|"tan"
      const candidates = pool.filter(p => p.f === base);
      const pickOne = pick(candidates);

      const prettyFn = invName; // e.g., "arcsin" or "sin⁻¹"
      const prompt = `${prettyFn}(${pickOne.val})`;

      const ans = mode === "deg" ? `${pickOne.deg}°` : pickOne.rad;
      const acceptable = mode === "deg"
        ? [String(pickOne.deg), `${pickOne.deg}°`]
        : [pickOne.rad, pickOne.rad.replace("π", "pi")];

      // allow some common equivalent forms
      const checker = (user) => {
        const u = (user || "").trim().toLowerCase().replace(/\s+/g, "");
        const set = new Set(acceptable.map(x => x.toLowerCase().replace(/\s+/g, "")));
        return set.has(u);
      };

      return { prompt, answer: ans, acceptableAnswers: acceptable, checker };
    }

    case "units_convert": { const mode = pick(["k2m","m2k"]); if (mode==="k2m") { const v = randInt(10, 120); const ms = Math.round((v * 1000/3600)*100)/100; return { prompt: `Convert ${v} km/h to m/s`, answer: String(ms) }; } else { const v = randInt(3, 40); const k = Math.round((v * 3.6)*100)/100; return { prompt: `Convert ${v} m/s to km/h`, answer: String(k) }; } }

    // Formulae (answers to 2 d.p.)
    case "sphere_volume": { const r = randInt(1, 12); const val = (4/3)*Math.PI*r**3; return { prompt: `Volume of sphere, r=${r}. Give 2 d.p.`, answer: (Math.round(val*100)/100).toFixed(2) }; }
    case "sphere_area": { const r = randInt(1, 15); const val = 4*Math.PI*r**2; return { prompt: `Surface area of sphere, r=${r}. Give 2 d.p.`, answer: (Math.round(val*100)/100).toFixed(2) }; }
    case "cylinder_sa": { const r = randInt(1, 12), h = randInt(1, 20); const val = 2*Math.PI*r*(h + r); return { prompt: `Surface area of closed cylinder, r=${r}, h=${h}. Give 2 d.p.`, answer: (Math.round(val*100)/100).toFixed(2) }; }
    case "cone_sa": { const r = randInt(1, 15), l = randInt(r+1, r+15); const val = Math.PI*r*(r + l); return { prompt: `Surface area of cone, r=${r}, slant l=${l}. Give 2 d.p.`, answer: (Math.round(val*100)/100).toFixed(2) }; }
    case "square_pyramid_sa": { const a = randInt(2, 20), l = randInt(2, 25); const val = a*a + 2*a*l; return { prompt: `Surface area of square pyramid, base a=${a}, slant l=${l}. Give 2 d.p.`, answer: (Math.round(val*100)/100).toFixed(2) }; }
    case "common_frac_to_dec_2dp": {
      // ----- helpers -----
      const to2dp = (x) => Number.isFinite(x) ? (Math.round(x * 100) / 100).toFixed(2) : "";
      const toMinDpUpTo2 = (x) => {
        if (!Number.isFinite(x)) return "";
        const s = (Math.round(x * 100) / 100).toFixed(2);
        return s.replace(/\.?0+$/, ""); // trim trailing zeros and dot
      };
      const reduce = (p, q) => {
        const g = gcd(p, q);
        p /= g; q /= g;
        if (q < 0) { p = -p; q = -q; }
        return [p, q];
      };
      const isTerm = (q) => isTerminatingDenom(q);

      // Convert recurring decimal i . nonRep (rep)  -> fraction p/q
      function recurringToFraction(intPart, nonRepStr, repStr) {
        const m = nonRepStr.length;          // non-repeating length
        const n = repStr.length;             // repeating length
        const i = intPart | 0;
        const A = nonRepStr ? parseInt(nonRepStr, 10) : 0;
        const B = parseInt(repStr, 10);

        const pow10m = Math.pow(10, m);
        const pow10n = Math.pow(10, n);

        // value = i + A/10^m + B / (10^m * (10^n - 1))
        let num = i * pow10m * (pow10n - 1) + A * (pow10n - 1) + B;
        let den = pow10m * (pow10n - 1);

        return reduce(num, den);
      }

      // ----- choose mode -----
      // 50% FRACTION→DECIMAL(2dp), 50% DECIMAL→FRACTION (finite or recurring)
      const toDecimal = Math.random() < 0.5;

      if (toDecimal) {
        // pick denominator and numerator
        const q = weightedPick2([
          [3, 1], [4, 1], [5, 1],
          [6, 1], [7, 0.5], [8, 1], [9, 1], [11, 1]
        ]);

        const hard = q >= 6;
        const maxNum = hard ? (q + 1) : 30;
        let p = randInt(1, Math.max(2, maxNum));
        if (p % q === 0) p = Math.max(1, p - 1); // avoid integer
        if (q === 7) p = 1;                      // nicer 1/7 etc.

        const [P, Q] = reduce(p, q);
        const val = P / Q;

        const answer = to2dp(val); // always 2 d.p.

        return {
          prompt: `Convert to 2 d.p.: ${P}/${Q}`,
          answer
        };
      } else {
        // DECIMAL → FRACTION
        const useRecurring = Math.random() < 0.45; // ~45% recurring, rest finite

        if (useRecurring) {
          // Build a recurring decimal like 0.(3), 0.(27), 1.2(7), 2.0(45)
          const intPart = randInt(0, 3);
          const nonRepLen = weightedPick2([[0, 1], [1, 1], [2, 0.6]]);   // 0–2 non-repeating digits
          const repLen = weightedPick2([[1, 1], [2, 0.9]]);         // 1–2 repeating digits

          const digit = () => String(randInt(0, 9));
          const nonRep = Array.from({ length: nonRepLen }, digit).join("");
          let rep = Array.from({ length: repLen }, digit).join("");

          // avoid trivial repeat "0", and avoid repeating '0' only
          if (/^0+$/.test(rep)) rep = "3";

          // fraction
          const [p, q] = recurringToFraction(intPart, nonRep, rep);
          const [P, Q] = reduce(p, q);
          const shown = `${intPart}.${nonRep}(${rep})`.replace(/\.$/, ""); // e.g. "0.(3)" or "1.2(7)"

          return {
            prompt: `Convert to a fraction (lowest terms): ${shown}`,
            answer: `${P}/${Q}`
          };
        } else {
          // finite decimal with up to 2 d.p. (exact, not rounded)
          const intPart = randInt(0, 20);
          const dp = weightedPick2([[0, 0.6], [1, 1], [2, 1]]); // bias towards 1–2 d.p.
          const base = intPart + randInt(0, 99) / 100;     // seed
          const val = Math.round(base * Math.pow(10, dp)) / Math.pow(10, dp);
          const shown = toMinDpUpTo2(val);

          // to fraction
          let P, Q;
          if (dp === 0) { P = Math.round(val); Q = 1; }
          else if (dp === 1) { P = Math.round(val * 10); Q = 10; }
          else { P = Math.round(val * 100); Q = 100; }
          [P, Q] = reduce(P, Q);

          return {
            prompt: `Convert to a fraction in lowest terms: ${shown}`,
            answer: `${P}/${Q}`
          };
        }
      }
    }


    // Trig
    case "trig_recall": {
      // Randomly choose degrees or radians
      const mode = pick(["deg", "rad"]);

      if (mode === "deg") {
        const angle = pick([0, 30, 45, 60, 90]);
        const f = pick(["sin", "cos", "tan"]);
        const table = {
          sin: { 0: "0", 30: "1/2", 45: "sqrt(2)/2", 60: "sqrt(3)/2", 90: "1" },
          cos: { 0: "1", 30: "sqrt(3)/2", 45: "sqrt(2)/2", 60: "1/2", 90: "0" },
          tan: { 0: "0", 30: "sqrt(3)/3", 45: "1", 60: "sqrt(3)", 90: "undef" },
        };
        return { prompt: `${f}(${angle}°)`, answer: table[f][angle] };
      } else {
        // radians: 0, π/6, π/4, π/3, π/2
        const angles = [
          { txt: "0", val: 0, tag: "0" },
          { txt: "π/6", val: Math.PI / 6, tag: "pi/6" },
          { txt: "π/4", val: Math.PI / 4, tag: "pi/4" },
          { txt: "π/3", val: Math.PI / 3, tag: "pi/3" },
          { txt: "π/2", val: Math.PI / 2, tag: "pi/2" },
        ];
        const A = pick(angles);
        const f = pick(["sin", "cos", "tan"]);

        const table = {
          sin: { "0": "0", "pi/6": "1/2", "pi/4": "sqrt(2)/2", "pi/3": "sqrt(3)/2", "pi/2": "1" },
          cos: { "0": "1", "pi/6": "sqrt(3)/2", "pi/4": "sqrt(2)/2", "pi/3": "1/2", "pi/2": "0" },
          tan: { "0": "0", "pi/6": "sqrt(3)/3", "pi/4": "1", "pi/3": "sqrt(3)", "pi/2": "undef" },
        };
        return { prompt: `${f}(${A.txt})`, answer: table[f][A.tag] };
      }
    }
    case "trig_eval": { const triples = [[3,4,5],[5,12,13],[8,15,17]]; const [a,b,c] = pick(triples); const which = pick(["sin","cos","tan"]); const answers = { sin: `${a}/${c}`, cos: `${b}/${c}`, tan: `${a}/${b}` }; return { prompt: `Right △ with sides ${a}-${b}-${c}. Compute ${which}(θ) for angle opposite ${a}.`, answer: answers[which] }; }

    default: return { prompt: "Coming soon", answer: "" };
  }
}

// ---------- Scoring ----------
function computeScore({ correct, attempts, durationSec }) {
  const accuracy = attempts ? (correct+1) / (attempts+2) : 0;

  const rate = durationSec > 0 ? correct / durationSec : 0;

  const targetRate = 0.67; 
  const speedNorm = Math.min(1, rate / targetRate);

  const score = Math.round(
    1000 * (0.6 * accuracy + 0.4 * speedNorm)
  );
  return { score, accuracy, rate };
}


// ---------- App ----------
export default function App(){
  console.log("VITE_SUPABASE_URL =", import.meta.env.VITE_SUPABASE_URL);
  console.log("VITE_SUPABASE_ANON_KEY =", import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0,8) + "…");
  const { user, loading } = useAuth(); 
  const [authBusy, setAuthBusy] = useState(false);
  const [view, setView] = useState("builder");

  const dn = useDisplayName(user);
  useEffect(() => {
    (async () => {
      if (!user) return;                               // only when logged in
      const FLAG = "migrated_local_sessions_v1";
      if (hasRunOnce(FLAG)) return;                    // already migrated

      // 1) Pull local leaderboard entries
      const raw = localStorage.getItem("esat_trainer_leaderboard_v2");
      const localEntries = raw ? JSON.parse(raw) : [];

      if (Array.isArray(localEntries) && localEntries.length) {
        // 2) Save in small batches to Supabase
        for (const entry of localEntries) {
          try {
            await saveSessionEntry(entry);
          } catch (e) {
            console.error("Failed to upload an entry:", e);
          }
        }
      }
      markRunOnce(FLAG);                               // never upload again
    })();
  }, [user?.id]);

    useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        try {
          const rows = await listSessionEntries();
          const cloudBoard = rows.map(r => r.payload);
          setBoard(cloudBoard);
        } catch (e) {
          console.error("Load cloud board failed:", e);
        }
      }
    })();
  }, [user?.id]);
  const [folderTopics, setFolderTopics] = useState([]); // ids
  const [activeId, setActiveId] = useState(null);
  const [durationMin, setDurationMin] = useState(1);
  const [flashSeconds, setFlashSeconds] = useState(0);
  const [sessions, setSessions] = useSavedSessions();
  const [board, setBoard] = useLeaderboard();
  const [lastEntryId, setLastEntryId] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const topicMap = useMemo(()=>{ const m = new Map(); Object.entries(CATEGORIES).forEach(([,items])=>items.forEach(it=>m.set(it.id,it))); return m; },[]);
  const hasOnlyFlash = useMemo(()=> folderTopics.length===1 && folderTopics[0]==="flash_timer", [folderTopics]);
  const canStart = useMemo(()=> folderTopics.length>0 && !hasOnlyFlash && (!folderTopics.includes("flash_timer") || flashSeconds>0), [folderTopics, hasOnlyFlash, flashSeconds]);

  function onDragEnd(e){
    const { over, active } = e;
    setActiveId(null);
    if (!over || over.id !== "SESSION_FOLDER") return;
    const dropId = String(active.id).startsWith("src-") ? String(active.id).slice(4) : String(active.id);
    setFolderTopics(prev => (prev.includes(dropId) ? prev : [...prev, dropId]));
  }
  function onDragStart(e){ setActiveId(e.active.id); }

function saveSession(name){
  if (!name) return;
  const compact = Array.from(new Set(folderTopics));
  const entry = {
    name,
    topics: compact,
    ...(compact.includes("flash_timer") ? { flashSeconds: Number(flashSeconds) || 0 } : {})
  };

  // local (keep)
  setSessions(prev => [entry, ...prev].slice(0, 24));

  // cloud (if logged in)
  supabase.auth.getUser().then(async ({ data }) => {
    if (!data.user) return;
    try {
      await supabase.from("profiles").upsert({
      user_id: data.user.id,
      display_name: name,
      updated_at: new Date().toISOString()
    });
      await createPreset({
        name: entry.name,
        topics: entry.topics,
        flashSeconds: entry.flashSeconds
      });
    } catch (e) {
      console.error("Preset save failed:", e);
    }
  });
}

  function loadPreset(p){ setFolderTopics([...p.topics]); }
  function loadSession(s){
    setFolderTopics([...s.topics]);
    // backward compatible: older saves won’t have flashSeconds
    setFlashSeconds(typeof s.flashSeconds === "number" ? s.flashSeconds : 0);
  }
  return (
    <div className="min-h-screen w-full bg-[#0e0f13] text-white antialiased overflow-x-hidden" style={{fontFamily:"ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, 'SF Pro', 'Helvetica Neue', Arial"}}>
      <div className="sticky top-0 z-40 border-b border-white/5 bg-[#0e0f13]/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-emerald-400 to-red-300 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)]" />
            <div className="text-white/70 font-semibold tracking-tight">NO-CALC</div>
            <div className="text-white/30 font-semibold tracking-tight">Trainer for non-calculator exams</div>
          </div>
          <div className="flex items-center gap-2">
            <button className={btnGhost} onClick={() => setShowTutorial(true)}>
              <BookOpen size={16} /> Tutorial
            </button>

            {loading ? null : user ? (
              <div className="flex items-center gap-2">
                {/* Label that turns editable on click */}
                {!dn.editing ? (
                  <button
                    onClick={() => dn.setEditing(true)}
                    className="inline-flex items-center h-9 rounded-2xl px-3 bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-white/10"
                    title="Edit display name"
                  >
                    <span className="truncate max-w-[10rem]">{dn.name || "Set name"}</span>
                    <Pencil size={14} className="ml-2 opacity-60" />
                  </button>
                ) : (
                  <div className="inline-flex items-center h-9 rounded-2xl px-2 bg-white/5 border border-white/10">
                    <input
                      autoFocus
                      value={dn.name}
                      onChange={(e) => dn.setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") dn.save(dn.name);
                        if (e.key === "Escape") dn.setEditing(false);
                      }}
                      className="bg-transparent outline-none text-sm text-white/90 placeholder:text-white/40 w-44"
                      placeholder="Your display name"
                      maxLength={32}
                    />
                    <button
                      onClick={() => dn.save(dn.name)}
                      className="ml-1 rounded-xl px-2 py-1 text-xs bg-emerald-500/80 text-black hover:bg-emerald-500"
                      disabled={dn.saving}
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => dn.setEditing(false)}
                      className="ml-1 rounded-xl px-2 py-1 text-xs bg-white/10 text-white hover:bg-white/15"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {dn.error && (
                  <span className="text-xs text-amber-300/90 ml-1">{dn.error}</span>
                )}
                {dn.saving && !dn.error && (
                  <span className="text-xs text-white/50 ml-1">Saving…</span>
                )}

                <button onClick={() => supabase.auth.signOut()} className={btnGhost} title="Sign out">
                  <LogOut size={16} /> Leave
                </button>
              </div>
            ) : (
              <button
                className={btnGhost}
                onClick={() =>
                  supabase.auth.signInWithOAuth({
                    provider: "google",
                    // let Supabase use its Site URL, or set an absolute URL:
                    // options: { redirectTo: "https://nocalc.xyz" }
                  })
                }
              >
                <LogIn size={16} /> Sign in
              </button>
            )}
          </div>


        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {view === "builder" ? (
          <BuilderView
            folderTopics={folderTopics} setFolderTopics={setFolderTopics}
            activeId={activeId} onDragStart={onDragStart} onDragEnd={onDragEnd}
            topicMap={topicMap}
            durationMin={durationMin} setDurationMin={setDurationMin}
            onStart={()=>setView("quiz")}
            saveSession={saveSession} sessions={sessions} setSessions={setSessions}
            loadPreset={loadPreset} loadSession={loadSession}
            board={board} setBoard={setBoard}
            flashSeconds={flashSeconds} setFlashSeconds={setFlashSeconds}
            canStart={canStart} hasOnlyFlash={hasOnlyFlash} lastEntryId={lastEntryId}
          />
        ) : (
          <QuizView
            topicIds={folderTopics}
            topicMap={topicMap}
            durationMin={durationMin}
            flashSeconds={flashSeconds}
            includesFlash={folderTopics.includes("flash_timer")}
            onExit={()=>setView("builder")}
              onFinish={async (entry) => {
                // local (existing)
                setBoard(prev => [entry, ...prev].slice(0, 200));
                setLastEntryId(entry.id);

                // cloud (only if signed in)
                const { data } = await supabase.auth.getUser();
                if (data.user) {
                  try {
                    await saveSessionEntry(entry); // you can store entry directly as payload
                    await supabase.from("leaderboard").insert([{
                      user_id: data.user.id,
                      score: entry.score,
                      accuracy: entry.accuracy,
                      attempts: entry.attempts,
                      correct: entry.correct,
                      duration_sec: entry.duration_sec,
                      topics: entry.topics, // make sure this is an array
                      created_at: new Date().toISOString()
                    }]);

                  } catch (e) {
                    console.error("Cloud save failed:", e);
                  }
                }
              }}

              />
              
        )}
      </main>

      <div className="relative">
        <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-80 w-[60rem] rounded-full bg-emerald-500/10 blur-3xl overflow-hidden" />
      </div>
      <TutorialModal
        open={showTutorial}
        slides={TUTORIAL_SLIDES}
        onClose={() => setShowTutorial(false)}
      />

    </div>
  );
}

function BuilderView({
  folderTopics, setFolderTopics,
  activeId, onDragStart, onDragEnd,
  topicMap,
  durationMin, setDurationMin,
  onStart, saveSession, sessions, setSessions,
  loadPreset, /* no longer used */
  loadSession,
  board, setBoard,
  flashSeconds, setFlashSeconds,
  canStart, hasOnlyFlash, 
  lastEntryId
}) {



  const [highlightId, setHighlightId] = useState(null);

  const [topicQuery, setTopicQuery] = useState("");
  const [triedStart, setTriedStart] = useState(false);
  const [showStartWarning, setShowStartWarning] = useState(false);

const startBlockReason = !folderTopics.length
  ? (triedStart ? "Add at least one topic" : "")
  : hasOnlyFlash
  ? "Add another topic (Flash Timer can’t be the only one)"
  : (folderTopics.includes("flash_timer") && !flashSeconds)
  ? "Set Flash Timer seconds"
  : "";

  const [durationStr, setDurationStr] = useState(String(durationMin));

  useEffect(() => {
    // keep input in sync if durationMin changes elsewhere
    setDurationStr(String(durationMin));
  }, [durationMin]);

  function isValidDurationDecimal(s) {
    if (s.trim() === "") return false;
    // allow digits with optional single decimal point
    if (!/^\d*\.?\d*$/.test(s)) return false;
    const n = Number(s);
    return Number.isFinite(n) && n > 0;
  }
  return (
    <DndContext
  collisionDetection={pointerWithin}
  onDragStart={onDragStart}
  onDragEnd={onDragEnd}
  autoScroll={{ enabled: true, layoutShiftCompensation: false, interval: 12, acceleration: 1 }}
  modifiers={[restrictToWindowEdges]}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Topic selector ONLY */}
        <div className="flex flex-col gap-6">
          <div className={`${panel} relative isolate`}>
            <PanelGloss />

            {/* Sticky mini header inside the panel */}
            <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#171a20]/90 backdrop-blur px-1 py-2 -mx-1 z-10 border-b border-white/5">
              <h2 className="text-lg font-semibold tracking-tight">Choose Topics</h2>
              <span className="text-xs text-white/50">Drag or click "+"</span>
            </div>
            <div className="mb-3">
              <input
                type="text"
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                placeholder="Search topics…"
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-white/10 focus:ring-2 focus:ring-emerald-400/40 placeholder:text-white/40"
              />
            </div>

          {/* Saved Sessions (now part of the Topics panel) */}


            {/* Scrollable content area */}
            <div
              className="
    grid grid-cols-1 md:grid-cols-2 gap-4
    max-h-[calc(100vh-220px)]
    overflow-y-auto overflow-x-hidden
    scrollbar-stealth"
    style={{ scrollbarGutter: 'stable both-edges' }}>              
              {Object.entries(CATEGORIES).map(([cat, items]) => {
                const list = topicQuery
                  ? items.filter(t =>
                      t.label.toLowerCase().includes(topicQuery.toLowerCase())
                    )
                  : items;

                // Hide this category section if there are no matches while searching
                if (topicQuery && list.length === 0) return null;

                return (
                  <div
                    key={cat}
                    className={`space-y-2 ${cat === "CALCULATION" ? "md:col-span-2" : ""}`}
                  >
                    <div className="text-xs uppercase tracking-wider text-white/50">{cat}</div>

                    <div
                      className={
                        cat === "CALCULATION"
                          ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
                          : "grid grid-cols-1 gap-2"
                      }
                    >
                      {cat === "TOOLS" ? (
                        <DraggableFlashTimer />
                      ) : (
                          list.map(t => (
                            <TopicRow
                              key={t.id}
                              id={t.id}
                              label={t.label}
                              onAdd={() =>
                                setFolderTopics(prev =>
                                  prev.includes(t.id) ? prev : [...prev, t.id]
                                )
                              }
                            />
                          ))

                      )}
                    </div>
                  </div>
                );
              })}
            </div>
                        <div className="my-3 border-t border-white/10" />

                        <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-white/50 mb-2">
                Saved Sessions
              </div>

              {sessions.length === 0 ? (
                <div className="text-white/50 text-sm">No saved sessions yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sessions.map((s, i) => (
                    <div key={i} className={`${cardBase} p-4`}>
                      <div className="font-semibold truncate">{s.name}</div>
                      <div className="text-xs text-white/50 mt-1 line-clamp-2">
                        {s.topics.map(id => topicMap.get(id)?.label || id).join(", ")}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => {setTriedStart(true); loadSession(s)}} className={btnGhost}>Load</button>
                        <button
                          onClick={() => {
                            const copy = [...sessions];
                            copy.splice(i, 1);
                            setSessions(copy);
                          }}
                          className={btnGhost}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {/* Session Folder (moved here) */}
          <div className="lg:sticky lg:top-20">
            <DroppableFolder id="SESSION_FOLDER">
              <div className="flex items-center gap-2 text-white/80">
                <FolderOpen size={18}/>
                <div className="font-semibold">Session Folder</div>
                <span className="text-xs text-white/50">({folderTopics.length} topics)</span>
              </div>

              <div className="w-full">
                <SortableContext items={folderTopics} strategy={verticalListSortingStrategy}>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full auto-rows-auto">
                    {folderTopics.length === 0 && (
                      <div className="col-span-full w-full">
                        <div className="
      rounded-2xl border-2 border-dashed border-white/10 hover:border-white/20
      bg-white/[0.02] text-white/60
      p-6 flex flex-col items-center justify-center gap-2
      transition-colors">
                          <div className="flex items-center gap-2 text-sm">
                            <GripVertical size={16} className="opacity-70" />
                            <span className="font-medium">Drag topics here</span>
                          </div>
                          <div className="text-xs text-white/40">Add a topic to start a session</div>
                        </div>
                      </div>
                    )}
                    {folderTopics.map(id => (
                      id === "flash_timer" ? (
                        <FolderFlashTimerEditor
                          key={id}
                          value={flashSeconds}
                          onChange={setFlashSeconds}
                          onRemove={()=>setFolderTopics(prev=>prev.filter(x=>x!==id))}
                        />
                      ) : (
                        <SortableTopicChip
                          key={id}
                          id={id}
                          label={topicMap.get(id)?.label || id}
                          onRemove={()=>setFolderTopics(prev=>prev.filter(x=>x!==id))}
                        />
                      )
                    ))}
                  </div>
                </SortableContext>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className={`${btnSoft} px-3 py-2`}>
                  <Clock size={16} className="text-white/60" />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={durationStr}
                    onChange={(e) => setDurationStr(e.target.value)}
                    onBlur={() => {
                      if (isValidDurationDecimal(durationStr)) setDurationMin(parseFloat(durationStr));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (isValidDurationDecimal(durationStr)) setDurationMin(parseFloat(durationStr));
                      }
                    }}
                    aria-invalid={durationStr !== "" && !isValidDurationDecimal(durationStr)}
                    className={`bg-transparent outline-none w-14 text-white placeholder:text-white/40 text-sm text-center`}
                    placeholder="min"
                  />
                  <span className="text-white/60">min</span>
                </div>

                <button onClick={() => saveSession(prompt("Save session as:"))} className={btnSoft}>
                  <Save size={16} />Save
                </button>
                <button onClick={() => setFolderTopics([])} className={btnSoft}>
                  <Trash2 size={16} />Clear
                </button>
                <button disabled={!canStart} onClick={onStart} className={`${btnPrimaryLite} disabled:opacity-50`}>
                  <Play size={16} />Start
                </button>

                {durationStr !== "" && !isValidDurationDecimal(durationStr) && (
                  <span className="text-xs text-red-400 ml-2">Enter a positive number</span>
                )}

              </div>

            </DroppableFolder>
          </div>
          {/* Guards now under the folder */}
          {hasOnlyFlash && (
            <div className="text-xs text-red-300/80">
              Flash Timer can't be the only topic. Add at least one CALCULATION topic.
            </div>
          )}
          {folderTopics.includes("flash_timer") && flashSeconds<=0 && (
            <div className="text-xs text-amber-300/80">
              Enter a flash time (seconds) for Flash Timer to take effect.
            </div>
          )}

          {/* ⬇️ Presets section removed entirely */}

          {/* Saved Sessions */}

          {/* Leaderboard */}
          <AnalyticsShell
            board={board}
            setBoard={setBoard}
            topicMap={topicMap}
            highlightId={highlightId}
            maxShown={5}
            currentUser={useAuth().user}
          />
          <SuggestionsPanel /> 
          </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <motion.div initial={{scale:0.95, opacity:0.9}} animate={{scale:1, opacity:1}} className={`${cardBase} px-3 py-2 text-sm`}>
            {(() => {
            const raw = String(activeId).startsWith("src-") ? String(activeId).slice(4) : String(activeId);
            return Object.values(CATEGORIES).flat().find(t => t.id === raw)?.label || raw;
            })()}
          
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}


function PanelGloss(){
  return (<>
    <div className="pointer-events-none absolute -top-24 -left-16 h-40 w-72 -rotate-12 bg-gradient-to-b from-white/10 to-transparent blur-2xl" />
    <div className="pointer-events-none absolute -bottom-28 -right-10 h-40 w-72 rotate-12 bg-gradient-to-b from-white/5 to-transparent blur-2xl" />
  </>);
}
function Tooltip({ text, children, placement = "top" }) {
  const pos =
    placement === "top"
      ? "bottom-full mb-1"
      : "top-full mt-1"; // you can pass "bottom" if you prefer

  return (
    <span className="relative inline-flex group z-20"> {/* z-20 so it’s above neighbors */}
      {children}
      <span
        className={[
          "pointer-events-none absolute left-1/2 -translate-x-1/2", pos,
          // box
          "rounded-md bg-black/80 px-2 py-1 text-xs text-white shadow-lg",
          // WRAP: set a width so it breaks to two lines
          "w-56 max-w-[min(80vw,16rem)] whitespace-normal break-words text-left leading-snug",
          // show on hover
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          // keep above stuff
          "z-50"
        ].join(" ")}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}


function SuggestionsPanel() {
  return (
    <div className={`${panel} mt-6`}>
       <div className="flex items-center gap-2 mb-2">
        <Send size={18} className="text-white/70 relative" />
        <h2 className="text-white/70 font-semibold tracking-tight">Suggestions</h2>
      </div>
      <form
        action="https://formspree.io/f/mzzjpegb" // ⬅️ replace with your Formspree endpoint
        method="POST"
        className="flex flex-col gap-2"
      >
        <textarea
          name="message"
          placeholder="Your suggestion..."
          required
          className="
    rounded-xl bg-white/5 border border-white/10 p-2 text-sm text-white/90 
    placeholder:text-white/40 min-h-[80px]
    focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30
  "/>
        <button type="submit" className={btnGhost}>
          Send
        </button>
      </form>
      <p className="text-xs text-white/40 mt-2">
        This is a relatively new concept... Any small improvements would be appreciated!
      </p>
    </div>
  );
}


function QuizView({ topicIds, topicMap, durationMin, flashSeconds, includesFlash, onExit, onFinish }){
  function TriangleDiagram({ type, lengths, labels, angleHint, isoRight, thetaAt }) {
    // Fixed canvas
    const W = 360, H = 220, MARGIN = 18;

    const BASE = Math.max(1e-6, lengths?.base ?? 1);
    const VERT = Math.max(1e-6, lengths?.vertical ?? 1);

    // Scale to fit with margins
    const scale = Math.min((W - 2*MARGIN)/BASE, (H - 2*MARGIN)/VERT);
    const basePx = BASE * scale, vertPx = VERT * scale;

    // Center the triangle: right angle at A
    const left = (W - basePx) / 2;
    const bottom = (H + vertPx) / 2;
    const A = { x: left, y: bottom };
    const B = { x: left + basePx, y: bottom };
    const C = { x: left, y: bottom - vertPx };

    // Helpers
    const mid = (P,Q)=>({x:(P.x+Q.x)/2, y:(P.y+Q.y)/2});
    const sub = (p,q)=>({x:p.x-q.x, y:p.y-q.y});
    const len = (v)=>Math.hypot(v.x,v.y) || 1;
    const norm = (v)=>{ const L=len(v); return {x:v.x/L, y:v.y/L}; };
    const perp = (v)=>({x:-v.y, y:v.x});

    const minSide = Math.min(basePx, vertPx);
    const r = Math.max(10, Math.min(16, 0.18 * minSide));          // right-angle box
    const fs = Math.max(11, Math.min(14, 0.045 * Math.min(W,H)));  // text size
    const tickLen = Math.max(8, Math.min(14, 0.14 * minSide));     // equality tick

    // Angle label inside on bisector
    function angleLabelInside(vertexKey, text, color="#a0aec0") {
      let V, U1, U2;
      if (vertexKey === "A") { V=A; U1=norm(sub(B,A)); U2=norm(sub(C,A)); }
      else if (vertexKey === "B") { V=B; U1=norm(sub(A,B)); U2=norm(sub(C,B)); }
      else { V=C; U1=norm(sub(A,C)); U2=norm(sub(B,C)); }
      let bis = { x: U1.x + U2.x, y: U1.y + U2.y };
      const L = Math.hypot(bis.x,bis.y);
      if (L < 1e-6) {
        const centroid = mid(A, mid(B,C));
        const v = sub(centroid, V);
        bis = norm(v);
      } else {
        bis.x /= L; bis.y /= L;
      }
      const d = Math.max(12, Math.min(22, 0.22 * minSide));
      const P = { x: V.x + bis.x * d, y: V.y + bis.y * d };
      return (
        <text x={P.x} y={P.y} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fill={color}>
          {text}
        </text>
      );
    }

    // Equality tick on an edge
    function edgeTick(P,Q){
      const v = sub(Q,P), u = norm(v), n = norm(perp(u));
      const m = mid(P,Q), t = tickLen/2;
      const a = { x:m.x - n.x*t, y:m.y - n.y*t };
      const b = { x:m.x + n.x*t, y:m.y + n.y*t };
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e5e7eb" strokeWidth="2" />;
    }

    const baseMid = mid(A,B), vertMid = mid(A,C), hypMid = mid(B,C);

    let angleNode = null;
    if (angleHint) {
      const txt = angleHint.startsWith("30") ? "30°"
                : angleHint.startsWith("60") ? "60°"
                : angleHint.startsWith("45") ? "45°"
                : null;
      const key = angleHint.slice(-1); // 'A'|'B'|'C'
      if (txt && /[ABC]/.test(key)) angleNode = angleLabelInside(key, txt, "#9ca3af");
    }

    // θ marker for angle-finding variant
    let thetaNode = null;
    if (thetaAt && /[ABC]/.test(thetaAt)) {
      thetaNode = angleLabelInside(thetaAt, "θ", "#f3f4f6");
    }

    return (
      <div className="mt-2 flex justify-center">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Triangle */}
          <polygon
            points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`}
            fill="rgba(16,185,129,0.08)"
            stroke="rgba(16,185,129,0.85)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Right angle at A */}
          <polyline
            points={`${A.x},${A.y - r} ${A.x + r},${A.y - r} ${A.x + r},${A.y}`}
            fill="none"
            stroke="#93c5fd"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Equal-leg ticks for 45-45-90 */}
          {isoRight && (
            <>
              {edgeTick(A,B)}
              {edgeTick(A,C)}
            </>
          )}

          {/* Side labels */}
          {labels?.base && (
            <text x={baseMid.x} y={A.y + 14} fontSize={fs} textAnchor="middle" fill="#e5e7eb">
              {labels.base}
            </text>
          )}
          {labels?.vertical && (
            <text x={A.x - 8} y={vertMid.y} fontSize={fs} textAnchor="end" dominantBaseline="middle" fill="#e5e7eb">
              {labels.vertical}
            </text>
          )}
          {labels?.hyp && (
            <text x={hypMid.x + 10} y={hypMid.y - 6} fontSize={fs} textAnchor="start" fill="#e5e7eb">
              {labels.hyp}
            </text>
          )}

          {/* Angle labels */}
          {angleNode}
          {thetaNode}
        </svg>
      </div>
    );
  }

// ===== CircleDiagram (replacement) ==========================================
  function CircleDiagram(diagram) {
    const {
      // geometry
      points = [],              // [{name:'A',deg:30} or {name:'X', x:.., y:..}, ...]
      chords = [],              // [["A","B"],["C","D"]]
      radii = [],               // [["O","A"],["O","B"]]
      tangent = null,           // { at:'T' }  OR  { at:'T', externalFromT:true, pDist?:1.4 } (for tangent–secant)
      secantLines = [],         // e.g. [["A","B"],["C","D"]] → two secants from one external P
      // annotation
      angleLabels = [],         // [{at:'B', from:'C', to:'T', text:'50°', reflex?:true}]
      rightAngles = [],         // reserved (we no longer use square in semicircle)
      equalTicks = [],          // [["PA","PB"]]  (unique keys added internally)
      sideLabels = [],          // [{of:'AX', text:'AX=4'}, {of:'PA', text:'PA=5'}]  (supports subsegments)
      // theta
      thetaAt = null,           // 'A'|'B'|'C'|'O'|'T'|'P' ...
      thetaUsesChord = null,    // 'TC' → show θ as angle between tangent at T and chord TC
    } = diagram;

    // --- canvas ---------------------------------------------------------------
    const W = 380, H = 280, M = 22;
    const cx = W / 2, cy = H / 2 + 6;
    const R = Math.min(W, H) / 2 - 2 * M;

    // --- points map -----------------------------------------------------------
    const byName = {};
    points.forEach(p => {
      if (p.name === "O") byName.O = { x: cx, y: cy };
      else if (typeof p.deg === "number") {
        const th = (p.deg - 90) * Math.PI / 180;
        byName[p.name] = { x: cx + R * Math.cos(th), y: cy + R * Math.sin(th) };
      } else if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        byName[p.name] = { x: p.x, y: p.y };
      }
    });

    // utilities
    const mid = (P, Q) => ({ x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 });
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
    const len = (v) => Math.hypot(v.x, v.y) || 1;
    const norm = (v) => { const L = len(v); return { x: v.x / L, y: v.y / L }; };
    const perp = (v) => ({ x: -v.y, y: v.x });
    const dot = (a, b) => a.x * b.x + a.y * b.y;

    // line intersection (infinite lines)
    function lineIntersect(P1, P2, Q1, Q2) {
      const x1 = P1.x, y1 = P1.y, x2 = P2.x, y2 = P2.y, x3 = Q1.x, y3 = Q1.y, x4 = Q2.x, y4 = Q2.y;
      const D = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(D) < 1e-8) return null;
      const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / D;
      const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / D;
      return { x: px, y: py };
    }

    // intersection of circle and line P + t*u (returns two points sorted by t)
    function circleLineHits(P, u) {
      const oc = sub(P, { x: cx, y: cy });
      const A = dot(u, u);
      const B = 2 * dot(oc, u);
      const C = dot(oc, oc) - R * R;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const t1 = (-B - s) / (2 * A);
      const t2 = (-B + s) / (2 * A);
      const p1 = { x: P.x + t1 * u.x, y: P.y + t1 * u.y };
      const p2 = { x: P.x + t2 * u.x, y: P.y + t2 * u.y };
      return t1 <= t2 ? [{ pt: p1, t: t1 }, { pt: p2, t: t2 }] : [{ pt: p2, t: t2 }, { pt: p1, t: t1 }];
    }

    // build tangent line(s) and external point P when required
    const tangentLines = [];
    if (tangent?.at) {
      const T = byName[tangent.at];
      if (T) {
        const vOT = sub(T, { x: cx, y: cy });
        const uTan = norm(perp(vOT));
        // infinite tangent guide (dashed)
        const L = 900;
        tangentLines.push({ x1: T.x - uTan.x * L, y1: T.y - uTan.y * L, x2: T.x + uTan.x * L, y2: T.y + uTan.y * L, dashed: true });
        // optional external point P placed along tangent at distance pDist*R
        if (tangent.externalFromT) {
          const dist = (tangent.pDist ?? 1.4) * R;
          const P = { x: T.x + uTan.x * dist, y: T.y + uTan.y * dist };
          byName.P = P;  // expose as named point
        }
      }
    }

    // ---- robust secants from an external point P ----
    // We compute P once, then for each secant we compute both circle hits and draw a long line.
    // Also expose the hits so labels like PA/PB can be placed at the right segments.
    const secants = [];   // [{P,u,hits:[{pt,t},{pt,t}]}]
    let Pext = byName.P || null;

    // If two secants are given, compute P as their line intersection
    if (!Pext && secantLines.length >= 2) {
      const [a1, b1] = secantLines[0], [a2, b2] = secantLines[1];
      const A = byName[a1], B = byName[b1], C = byName[a2], D = byName[b2];
      const P = (A && B && C && D) ? lineIntersect(A, B, C, D) : null;
      if (P) { Pext = P; byName.P = Pext; }
    }

    // If tangent.externalFromT created P at T, use that
    if (!Pext && byName.P) Pext = byName.P;

    // Build each secant ray from Pext toward its chord direction
    if (Pext) {
      secantLines.forEach(([m, n]) => {
        const M = byName[m], N = byName[n];
        if (!M || !N) return;
        const u = norm(sub(N, M)); // direction along chord
        const hits = circleLineHits(Pext, u); // two points, ordered by t
        secants.push({ P: Pext, u, hits });
      });
    }


    // angle arc with smart radius/label offset (bigger for circumference angles)
    function angleTextLabel(atName, fromName, toName, text) {
      const V = atName === "O" ? { x: cx, y: cy } : byName[atName];
      const P1 = byName[fromName], P2 = byName[toName];
      if (!V || !P1 || !P2) return null;
      const u1 = norm(sub(P1, V)), u2 = norm(sub(P2, V));
      let bis = { x: u1.x + u2.x, y: u1.y + u2.y };
      const L = Math.hypot(bis.x, bis.y);
      if (L < 1e-6) { bis = { x: 0, y: -1 }; } else { bis.x /= L; bis.y /= L; }
      const d = atName === "O" ? 26 : 20;
      return (
        <text key={`ang-${atName}-${fromName}-${toName}-${text}`}
          x={V.x + bis.x * d} y={V.y + bis.y * d}
          fontSize="12" textAnchor="middle" dominantBaseline="middle" fill="#e5e7eb">
          {text}
        </text>
      );
    }

    // θ as tangent–chord angle at T
    function thetaArcAtTUsingChord(pairLabel) {
      if (!pairLabel || pairLabel.length !== 2) return null;
      const at = pairLabel[0], other = pairLabel[1];
      const T = byName[at], C = byName[other];
      if (!T || !C || tangentLines.length === 0) return null;

      const tv = norm({ x: tangentLines[0].x2 - tangentLines[0].x1, y: tangentLines[0].y2 - tangentLines[0].y1 });
      const cv = norm(sub(C, T));
      const rr = 18;

      const a1 = Math.atan2(tv.y, tv.x), a2 = Math.atan2(cv.y, cv.x);
      let d = a2 - a1; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
      const xs = T.x + rr * Math.cos(a1), ys = T.y + rr * Math.sin(a1);
      const xe = T.x + rr * Math.cos(a1 + d), ye = T.y + rr * Math.sin(a1 + d);
      const path = `M ${xs} ${ys} A ${rr} ${rr} 0 ${Math.abs(d) > Math.PI ? 1 : 0} ${(d > 0) ? 1 : 0} ${xe} ${ye}`;
      const m = (a1 + a1 + d) / 2, lx = T.x + (rr + 10) * Math.cos(m), ly = T.y + (rr + 10) * Math.sin(m);

      return (
        <g key="theta-arc-T">
          <path d={path} fill="none" stroke="#9ca3af" strokeWidth="1.5" />
          <text x={lx} y={ly} fontSize="14" textAnchor="middle" dominantBaseline="middle" fill="#f3f4f6">θ</text>
        </g>
      );
    }

    // generic θ (bisector) – used when not tangent–chord
    function thetaLabel(atName) {
      const V = atName === "O" ? { x: cx, y: cy } : byName[atName];
      if (!V) return null;
      let dir = { x: 0, y: -1 };

      if (atName === "T" && tangentLines.length) {
        const vRad = norm(sub(V, { x: cx, y: cy }));
        const vTan = norm({ x: tangentLines[0].x2 - tangentLines[0].x1, y: tangentLines[0].y2 - tangentLines[0].y1 });
        const bis = norm({ x: vRad.x + vTan.x, y: vRad.y + vTan.y });
        if (isFinite(bis.x)) dir = bis;
      } else {
        const arms = [];
        chords.forEach(([a, b]) => { if (a === atName) arms.push(byName[b]); else if (b === atName) arms.push(byName[a]); });
        radii.forEach(([o, p]) => { if (p === atName) arms.push({ x: cx, y: cy }); });
        if (arms.length >= 2 && arms[0] && arms[1]) {
          const u1 = norm(sub(arms[0], V)), u2 = norm(sub(arms[1], V));
          const bis = norm({ x: u1.x + u2.x, y: u1.y + u2.y });
          if (isFinite(bis.x)) dir = bis;
        }
      }
      const d = 18;
      return <text key={`theta-${atName}`} x={V.x + dir.x * d} y={V.y + dir.y * d} fontSize="14" textAnchor="middle" dominantBaseline="middle" fill="#f3f4f6">θ</text>;
    }

    // parse segment id like 'AB' or 'AX' or 'PA'
    function segEnds(seg) {
      const a = seg[0], b = seg[1];
      return [byName[a], byName[b]];
    }

    // sub/whole segment label
    function segmentLabel(seg, text, idx, offset = 12) {
      const [P, Q] = segEnds(seg);
      if (!P || !Q) return null;
      const m = mid(P, Q), u = norm(sub(Q, P)), n = perp(u);
      return (
        <text key={`len-${seg}-${idx}`} x={m.x + n.x * offset} y={m.y + n.y * offset}
          fontSize="12" textAnchor="middle" dominantBaseline="middle" fill="#e5e7eb">
          {text}
        </text>
      );
    }

    // small tick on a segment (unique key)
    function segmentTick(seg, idx) {
      const [P, Q] = segEnds(seg);
      if (!P || !Q) return null;
      const m = mid(P, Q), u = norm(sub(Q, P)), n = perp(u), t = 8;
      const a = { x: m.x - n.x * t, y: m.y - n.y * t }, b = { x: m.x + n.x * t, y: m.y + n.y * t };
      return <line key={`tick-${seg}-${idx}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e5e7eb" strokeWidth="2" />;
    }

    // Label along a ray segment from P to Q (midpoint with small outward offset)
    function raySegmentLabel(P, Q, text, key, outward = 10) {
      const m = mid(P, Q);
      const u = norm(sub(Q, P));
      const n = perp(u);
      return (
        <text key={key} x={m.x + n.x * outward} y={m.y + n.y * outward}
          fontSize="12" textAnchor="middle" dominantBaseline="middle" fill="#e5e7eb">
          {text}
        </text>
      );
    }


    // --- build svg ------------------------------------------------------------
    return (
      <div className="mt-2 flex justify-center">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Circle */}
          <circle cx={cx} cy={cy} r={R} fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.85)" strokeWidth="2" />

          {/* Radii */}
          {radii.map(([o, p], i) => byName[p] && (
            <line key={`rad-${i}`} x1={cx} y1={cy} x2={byName[p].x} y2={byName[p].y} stroke="#a7f3d0" strokeWidth="2" />
          ))}

          {/* Chords */}
          {chords.map(([a, b], i) => (byName[a] && byName[b]) && (
            <line key={`ch-${i}`} x1={byName[a].x} y1={byName[a].y} x2={byName[b].x} y2={byName[b].y} stroke="#10b981" strokeWidth="2" />
          ))}

          {/* Secants (infinite lines through external P) */}
          {secants.map((s, i) => {
            const L = 1200;
            return (
              <line
                key={`sec-${i}`}
                x1={s.P.x - s.u.x * L} y1={s.P.y - s.u.y * L}
                x2={s.P.x + s.u.x * L} y2={s.P.y + s.u.y * L}
                stroke="#e5e7eb" strokeWidth="2"
              />
            );
          })}

          {/* Tangent (dashed guide) */}
          {tangentLines.map((t, i) => (
            <line key={`tan-${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="#22c55e" strokeWidth="2" strokeDasharray={t.dashed ? "6 6" : undefined} />
          ))}

          {/* Angle labels */}
          {angleLabels.map((al, i) => angleTextLabel(al.at, al.from ?? "A", al.to ?? "B", al.text))}

          {/* Ticks */}
          {equalTicks.map((pair, i) => (
            <g key={`ticks-${i}`}>
              {segmentTick(pair[0], i * 2)}
              {segmentTick(pair[1], i * 2 + 1)}
            </g>
          ))}

          {/* Length labels (supports 'AX', 'PA', etc.) */}
          {sideLabels.map((s, i) => {
            const id = s.of;

            // 1) PA / PB / PC / PD using secant hits (near/far from P)
            if (/^P[ABCD]$/.test(id) && secants.length > 0 && byName.P) {
              // pick the secant that contains the target letter in its chord definition
              const target = id[1]; // 'A'|'B'|'C'|'D'
              const sec = secants.find(sc =>
                (secantLines[secants.indexOf(sc)] || []).some(nm => nm.includes(target))
              ) || secants[0];

              if (sec && sec.hits && sec.hits.length === 2) {
                const near = sec.hits[0].pt, far = sec.hits[1].pt;
                const Q = (target === 'A' || target === 'C') ? near : far;
                return raySegmentLabel(sec.P, Q, s.text, `ray-${id}-${i}`);
              }
            }

            // 2) PT: if tangent created P and point T exists, label segment PT
            if (id === "PT" && byName.P && byName.T) {
              return raySegmentLabel(byName.P, byName.T, s.text, `ray-PT-${i}`);
            }

            // 3) AX/BX/CX/DX for intersecting chords inside: compute X, then label
            if (/^[ABCD]X$/.test(id)) {
              // find the two chords to intersect (assumes exactly two in diagram)
              if (chords.length >= 2) {
                const [u1, v1] = chords[0], [u2, v2] = chords[1];
                const U1 = byName[u1], V1 = byName[v1], U2 = byName[u2], V2 = byName[v2];
                const X = (U1 && V1 && U2 && V2) ? lineIntersect(U1, V1, U2, V2) : null;
                if (X) {
                  const letter = id[0];
                  const P0 = byName[letter];
                  if (P0) return segmentLabel(letter + "X", s.text, i);
                }
              }
            }

            // fallback: simple chord segment label
            return segmentLabel(id, s.text, i);
          })}
          {/* Points */}
          {Object.entries(byName).map(([name, P]) => {
            if (name === "O") return (
              <g key="O">
                <circle cx={P.x} cy={P.y} r="3.5" fill="#e5e7eb" />
                <text x={P.x + 10} y={P.y - 6} fontSize="12" fill="#e5e7eb">O</text>
              </g>
            );
            return (
              <g key={name}>
                <circle cx={P.x} cy={P.y} r="3.5" fill="#e5e7eb" />
                <text x={P.x + 8} y={P.y - 6} fontSize="12" fill="#e5e7eb">{name}</text>
              </g>
            );
          })}

          {/* θ */}
          {thetaAt === "T" && thetaUsesChord
            ? thetaArcAtTUsingChord(thetaUsesChord)
            : (thetaAt && thetaLabel(thetaAt))}
        </svg>
      </div>
    );
  }




  const poolRef = useRef([]);

  function refillPool() {
    poolRef.current = topicIds.filter(t => t !== "flash_timer");
    // Fisher–Yates shuffle
    for (let i = poolRef.current.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [poolRef.current[i], poolRef.current[j]] = [poolRef.current[j], poolRef.current[i]];
    }
  }
  useEffect(() => { refillPool(); }, []); // on session start

// run every time current question changes → re-typeset MathJax
  const [lastWasCorrect, setLastWasCorrect] = useState(null);

  // ADD: a pure one-shot checker we can call from Enter or the primary button
  const checkOnce = () => {
    if (!current) return false;

    // Prefer a custom checker if provided
    let ok = false;
    if (typeof current.checker === "function") {
      ok = !!current.checker(answer);
    } else {
      // Fallback: compare to acceptableAnswers/answer
      const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
      const cand = norm(answer);
      const accepts = new Set(
        (current.acceptableAnswers ?? [current.answer ?? ""])
          .map(norm)
      );
      // try numeric equality too (for numeric answers)
      if (accepts.has(cand)) ok = true;
      else {
        const aNum = Number(answer);
        if (Number.isFinite(aNum)) {
          const target = Number(current.answer);
          if (Number.isFinite(target) && aNum === target) ok = true;
        }
      }
    }

    setAttempts(a => a + 1);
    setState(ok ? "correct" : "wrong");
    setLastWasCorrect(ok);
    return ok;
  };

  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState("");
  const [topicQuery, setTopicQuery] = useState("");
  const [state, setState] = useState("idle"); // idle | wrong | correct | finished | revealed
  const [phase, setPhase] = useState("go");   // go | reveal | next
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(5, Math.round(durationMin * 60)));
  const [hidden, setHidden] = useState(false);
  const inputRef = useRef(null);
  const startedAt = useRef(Date.now());
  const times = useRef([]); // seconds per correct question
  const qStart = useRef(Date.now());
  const hideTimer = useRef(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  useEffect(() => {
    if (!showExitConfirm) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowExitConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showExitConfirm]);

    // Typeset ONLY the prompt node when it changes/ unhides


  function scheduleFlashHide(topicId){
    if (!(includesFlash && flashSeconds>0 && isCalc(topicId))) return;
    const ms = Math.max(0, Math.round(flashSeconds*1000) - 80); // account for fade-in
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(()=> setHidden(true), ms);
  }

  function next() {
    if (poolRef.current.length === 0) refillPool();
    const id = poolRef.current.length ? poolRef.current.shift() : null;
    const q = id ? genQuestion(id) : { prompt: "Add a topic to start", answer: "" };
    setHidden(false);
    setCurrent({ ...q, id });
    setAnswer("");
    setState("idle");
    setPhase("go"); // <-- add this
    qStart.current = Date.now();
    if (id) scheduleFlashHide(id);
    requestAnimationFrame(() => inputRef.current?.focus());
  }


  useEffect(()=>{ next(); }, []);
  useEffect(()=>{ inputRef.current?.focus(); }, [current]);
  useEffect(()=>()=>clearTimeout(hideTimer.current), []);

  // countdown
  useEffect(()=>{ const t = setInterval(()=> setTimeLeft(s=>s-1), 1000); return ()=>clearInterval(t); }, []);
  useEffect(()=>{ if (timeLeft<=0 && state!=="finished") endSession(); }, [timeLeft]);

  function endSession(){
    setState("finished");
    const elapsed = Math.max(1, (Date.now() - startedAt.current)/1000);
    const correct = times.current.length;
    const attemptsTotal = attempts; // or convert to a ref if you want 100% safety
    const avgSecPerQ = times.current.length ? (times.current.reduce((a,b)=>a+b,0)/times.current.length) : elapsed/Math.max(1,correctCount);
    const uniqTopicIds = [...new Set(topicIds.filter(t=>t!=="flash_timer"))];
    const isMixed = new Set(uniqTopicIds).size > 1;
    const { score, accuracy } = computeScore({ correct, attempts: attemptsTotal, durationSec: elapsed });
    const entry = { id: `${Date.now()}`, when: new Date().toISOString(), score, accuracy, avgSecPerQ: Math.round(avgSecPerQ*100)/100, attempts: attemptsTotal, correct, topics: uniqTopicIds, bucket: isMixed ? "MIXED" : (uniqTopicIds[0] || "MIXED"), label: isMixed ? "Mixed" : (topicMap.get(uniqTopicIds[0])?.label || ""), durationSec: Math.round(durationMin*60), };
    onFinish?.(entry);
  }

  function doCheck() {
    if (!current || state === "finished") return;

    const ok = typeof current?.checker === "function"
      ? current.checker(answer)
      : equalish(answer, current.answer);

    setAttempts(a => a + 1);

    if (ok) {
      const dt = (Date.now() - qStart.current) / 1000;
      times.current.push(dt);
      setState("correct");
      setTimeout(() => next(), 60); // same auto-advance
    } else {
      setState("wrong");
      // Ensure the primary stays "Reveal answer" after any wrong attempt(s)
      setPhase("reveal");
    }
  }

  function submit(e){
    e.preventDefault();
    if (state === "finished") return;

    if (phase === "go")       doCheck();
    else if (phase === "reveal") revealAnswer();
    else if (phase === "next")   next();
    else doCheck();
  }


  function revealAnswer() {
    if (!current || state === "finished") return;
    setAttempts(a => a + 1);
    setState("revealed");
    setPhase("next"); // next press (or Enter) should go to next question
  }

  // --- Symbols inserter --- will suggest based on prompt
  function insertAtCursor(text){
    const el = inputRef.current; if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newVal = before + text + after;
    setAnswer(newVal);
    requestAnimationFrame(()=>{ el.focus(); const pos = start + text.length; el.setSelectionRange(pos, pos); });
  }
  const suggestedSymbols = useMemo(()=>{
    const p = (current?.prompt || "").toLowerCase();
    const base = ["√", "π", "^", "²", "³", "(", ")", "×", "÷"];
    const need = new Set(base);
    if (p.includes("π") || p.includes("pi")) need.add("π");
    if (p.includes("^") || p.includes("power") || p.includes("²") || p.includes("³")) need.add("^");
    if (p.includes("×")) need.add("×");
    if (p.includes("÷")) need.add("÷");
    if (p.includes("sqrt") || p.includes("√")) { need.add("sqrt("); need.add(")"); }
    return Array.from(need);
  }, [current]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className={`${panel} relative overflow-visible`}>
        <PanelGloss />
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (state === "finished") {
                endSession();          // safe to save when finished
                onExit();
              } else {
                setShowExitConfirm(true); // ask before abandoning
              }
            }}
            className={btnGhost}
          >
            <ArrowLeft size={16} />Back
          </button>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <div className="flex items-center gap-1"><Clock size={16}/><span>{Math.max(0,timeLeft)}s</span></div>
            <div>Attempts: {attempts}</div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          {state!=="finished" ? (
            <>
              <div className="text-xs uppercase tracking-widest text-white/40">{current ? (topicMap.get(current.id)?.label || "") : ""}</div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={(hidden ? "hidden" : current?.id) || "idle"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.08 }}
                >
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2 min-h-[2.6em] flex items-center justify-center">
                    {hidden ? "" : (current?.prompt || "Preparing…")}
                  </div>

                  {!hidden && current?.diagram?.type === "triangle" && (
                    <TriangleDiagram {...current.diagram} />
                  )}
                  {!hidden && current?.diagram?.type === "circle" && (
                    <CircleDiagram {...current.diagram} />
                  )}
                </motion.div>
              </AnimatePresence>


              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!hidden && phase !== "next") {
                    const ok = checkOnce();
                    if (ok) {
                      // Correct → auto skip
                      next();                       // advance to the next question
                      setAnswer("");
                      setState("idle");
                      setPhase("go");
                      setLastWasCorrect(null);
                    } else {
                      // Wrong → go to reveal phase
                      setPhase("reveal");
                    }
                  }
  
                }}
                className="mt-4 flex items-center justify-center gap-2"
              >             <input
                  ref={inputRef}
                  value={answer}
                  onChange={(e) => setAnswer(beautifyInline(e.target.value))}
                  placeholder="Type answer and hit Enter"
                  className={`w-full max-w-md px-4 py-3 rounded-2xl bg-white/5 border outline-none text-lg ${state === "wrong"
                      ? "border-red-500/50 focus:border-red-400/60"
                      : "border-white/10 focus:border-emerald-400/50"
                    }`}
                />

                {/* Primary action cycles: Go → Reveal answer → Next */}
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    if (phase === "go") {
                      const ok = checkOnce();
                      if (ok) {
                        // correct → skip immediately
                        next();
                        setAnswer("");
                        setState("idle");
                        setPhase("go");
                        setLastWasCorrect(null);
                      } else {
                        // wrong → go to reveal stage
                        setPhase("reveal");
                      }
                    } else if (phase === "reveal") {
                      // first press of Reveal → show answer
                      if (state !== "revealed") {
                        setState("revealed");
                      } else {
                        // second press (after answer is revealed) → move on
                        next();
                        setAnswer("");
                        setState("idle");
                        setPhase("go");
                        setLastWasCorrect(null);
                      }
                    } else if (phase === "next") {
                      next();
                      setAnswer("");
                      setState("idle");
                      setPhase("go");
                      setLastWasCorrect(null);
                    }
                  }}
                >
                  {phase === "go" && (<><Play size={16} /> Go</>)}
                  {phase === "reveal" && state !== "revealed" && (<><Eye size={16} /> Reveal</>)}
                  {phase === "reveal" && state === "revealed" && (<><Check size={16} /> Next</>)}
                  {phase === "next" && (<><Check size={16} /> Next</>)}
                </button>

                {/* Secondary: keep a “Check again” button while user is in reveal phase (i.e., after a wrong try) */}
                {phase === "reveal" && (
                  <button type="button" onClick={checkOnce} className={btnGhost}>
                    <Check size={16} /> Again
                  </button>
                )}

                {/* If the prompt was hidden by Flash Timer, optionally allow revealing immediately before any check */}
                {hidden && phase === "go" && (
                  <button
                    type="button"
                    onClick={() => { setState("revealed"); setPhase("next"); }}
                    className={btnGhost}
                  >
                    <Eye size={16} /> Reveal now
                  </button>
                )}


              </form>


{/* Live MathJax preview under the input */}
              {/* Symbols toolbar */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {suggestedSymbols.map(sym => (
                  <button key={sym} type="button" onClick={()=>insertAtCursor(sym)} className="px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10">
                    {sym === '√' ? '√' : sym}
                  </button>
                ))}
              </div>

              <div className="mt-3 min-h-[2.5rem]">
                <AnimatePresence mode="sync">
                  {/* PHASE: user moved into reveal stage (but hasn't revealed the answer yet) */}
                  {phase === "reveal" && (
                    <motion.div
                      key="reveal-info"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className={lastWasCorrect ? "text-emerald-400" : "text-red-400"}
                    >
                      {lastWasCorrect ? "Your last attempt was correct." : "Your last attempt was incorrect."}{" "}
                      Press <span className="font-semibold">Reveal</span> to see the answer.
                    </motion.div>
                  )}

                  {/* STATE: immediate feedback when not in reveal phase */}
                  {state === "correct" && phase !== "reveal" && (
                    <motion.div
                      key="fb-correct"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="inline-flex items-center gap-2 text-emerald-400"
                    >
                      <Check size={18} /> Correct
                    </motion.div>
                  )}

                  {state === "wrong" && phase !== "reveal" && (
                    <motion.div
                      key="fb-wrong"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="text-red-400"
                    >
                      Incorrect, try again.
                    </motion.div>
                  )}

                  {/* STATE: revealed — show the actual answer and (optionally) an explanation */}
                  {state === "revealed" && (
                    <motion.div
                      key="fb-revealed"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="text-white/70"
                    >
                      Answer: <span className="text-white font-semibold">{current?.answer}</span>
                      {current?.explanation && (
                        <motion.pre
                          key="fb-revealed-expl"
                          className="mt-2 whitespace-pre-wrap text-xs text-white/60"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                        >
                          {current.explanation}
                        </motion.pre>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>


            </>
          ) : (
            <SessionSummary onExit={onExit} />
          )}
          <AnimatePresence>
            {showExitConfirm && (
              <>
                {/* Dim backdrop */}
                <motion.div
                  key="exit-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowExitConfirm(false)}
                />

                {/* Centered dialog */}
                <motion.div
                  key="exit-dialog"
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="fixed inset-0 z-50 flex items-center justify-center px-4"
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1d23] shadow-xl">
                    <div className="p-5">
                      {/* Header — centered icon + title on one row */}
                      <div className="flex flex-col items-center text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10">
                            <AlertTriangle className="text-amber-300" size={18} />
                          </span>
                          <h3 className="text-base font-semibold tracking-tight">
                            Leave session?
                          </h3>
                        </div>
                        <p className="mt-2 text-sm text-white/70">
                          This session won’t be saved to the leaderboard.
                        </p>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                          onClick={() => setShowExitConfirm(false)}
                          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white/90"
                        >
                          Keep practicing
                        </button>
                        <button
                          onClick={() => { setShowExitConfirm(false); onExit(); }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm bg-amber-500/90 hover:bg-amber-500 text-black font-medium"
                        >
                          <ArrowLeft size={16} /> Leave
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    
  );
}

function TutorialModal({ open, slides = [], onClose }) {
  const [i, setI] = React.useState(0);
  const total = slides.length || 0;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") setI((v) => Math.min(total - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
    };
  }, [open, total, onClose]);

  if (!open || total === 0) return null;

  const slide = slides[i];

  return (
    <AnimatePresence>
      <motion.div
        key="tutorial-backdrop"
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        key="tutorial-card"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial"
      >
        <div className={`${panel} w-full max-w-3xl p-0 overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2 text-white/90">
              <BookOpen size={18} className="text-white/70" />
              <div className="font-semibold">{slide.title}</div>
            </div>
            <button className={`${btnGhost} h-9`} onClick={onClose} aria-label="Close tutorial">
              <X size={16} /> Close
            </button>
          </div>

          {/* Media */}
          <div className="px-5 pt-4">
            <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10">
              {slide.video ? (
                <video
                  key={slide.video}              // reset playback when slide changes
                  src={slide.video}
                  className="w-full h-auto aspect-video object-cover"
                  controls
                  playsInline
                  preload="metadata"
                // optional:
                // autoPlay
                // muted
                // loop
                />
              ) : slide.img ? (
                <img
                  src={slide.img}
                  alt={slide.title}
                  className="w-full h-auto aspect-video object-cover"
                  draggable={false}
                />
              ) : null}

              {/* Left/Right controls … (unchanged) */}
            </div>
          </div>

          {/* Caption + dots */}
          <div className="px-5 pb-4 pt-3">
            <div className="text-white/70 text-sm">{slide.caption}</div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setI(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all ${
                      idx === i ? "w-6 bg-white/90" : "w-2.5 bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className={btnGhost}
                  onClick={() => setI((v) => Math.max(0, v - 1))}
                  disabled={i === 0}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <button
                  className={btnPrimary}
                  onClick={() => (i === total - 1 ? onClose?.() : setI((v) => Math.min(total - 1, v + 1)))}
                >
                  {i === total - 1 ? "Done" : <>Next <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function SessionSummary({ onExit }){
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="
      rounded-2xl border-2 border-dashed border-white/10 hover:border-white/20
      bg-white/[0.02] text-white/60
      p-6 flex flex-col items-center justify-center gap-2
      transition-colors">
              <div className="text-sm text-white/60 uppercase tracking-widest">Session Complete</div>

              <div className="text-white/70 text-sm">Saved to leaderboard.</div>
      </div>

      <button onClick={onExit} className={btnPrimary}>Back to Builder</button>
    </div>
  );
}
// ---- stats.js (or near your LeaderboardPanel) ----


function computeRelative(topic, entry, baseline, weights = { wAcc: 1, wSpeed: 0.7 }) {
  if (!baseline) return 0;

  const entryAcc = smoothAcc(entry.correct ?? 0, entry.attempts ?? 0);
  const accDelta = entryAcc - baseline.avgAcc;

  const secDelta = (entry.avgSecPerQ ?? 0) - (baseline.avgSec || 1e-9);
  let speedTerm = -secDelta / Math.max(baseline.avgSec || 1, 1e-9);
  // clamp speed effect
  speedTerm = Math.max(-1, Math.min(1, speedTerm));

  return weights.wAcc * accDelta + weights.wSpeed * speedTerm;
}

// --- Global baselines across all sessions (your overall "normal") ---
function computeGlobalBaselines(board){
  const accs = board.map(entryAccOf).filter(x => Number.isFinite(x) && x>=0 && x<=1);
  const secs = board.map(e => e?.avgSecPerQ).filter(x => Number.isFinite(x) && x > 0);

  // robust centres
  const globalAcc = median(accs) || 0;     // 0..1
  const globalSec = median(secs) || 1;     // sec/Q

  // robust spreads (scaled MAD ~ sigma; 1.4826 is normal-consistent factor)
  const accMAD = (1.4826 * mad(accs, globalAcc)) || 0.02;   // guard from 0
  const secMAD = (1.4826 * mad(secs, globalSec)) || 0.05;

  return { globalAcc, globalSec, accMAD, secMAD };
}

// Group entries by topic (same as before)
function groupByTopic(board){
  const byTopic = new Map();
  for (const e of board){
    for (const t of (e.topics || [])){
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(e);
    }
  }
  return byTopic;
}

// Main: per-topic summary + REL (relative strength index)
function summarizeTopics(
  board,
  weights = { wAcc: 1, wSpeed: 0.7 },
  prior = 1,
  opts = {
    winsorK: 3,            // clamp outliers to ±k*MAD
    shrinkKAttempts: 40,   // EB-like shrink by attempt count
  }
){
  const { globalAcc, globalSec, accMAD, secMAD } = computeGlobalBaselines(board);
  const byTopic = groupByTopic(board);

  const topics = [];
  for (const [topic, list] of byTopic){
    const n = list.length;

    // raw arrays
    const rawAccs = list.map(entryAccOf).filter(x => Number.isFinite(x) && x>=0 && x<=1);
    const rawSecs = list.map(e => e?.avgSecPerQ).filter(x => Number.isFinite(x) && x>0);

    // anomaly handling (winsorize around robust global centre)
    const accs = winsorizeAround(rawAccs, globalAcc, accMAD, opts.winsorK);
    const secs = winsorizeAround(rawSecs, globalSec, secMAD, opts.winsorK);

    // shrink small samples toward global (Laplace-style)
    const topicAccRaw = mean(accs);
    const topicSecRaw = mean(secs);
    const topicAcc = (topicAccRaw * accs.length + globalAcc * prior) / ((accs.length||0) + prior);
    const topicSec = (topicSecRaw * secs.length + globalSec * prior) / ((secs.length||0) + prior);

    // reliability / volume
    const attempts = list.reduce((s, e) => s + (e.attempts || 0), 0);
    const correct  = list.reduce((s, e) => s + (Number.isFinite(e.correct) ? e.correct
                                         : Math.round((entryAccOf(e)||0)*(e.attempts||0))), 0);
    const sessions = n;
    const relWL    = wilsonLowerBound(correct, attempts);        // 0..1
    const shrinkA  = attempts / (attempts + opts.shrinkKAttempts); // 0..1

    // z-scores relative to robust global centre & spread
    const zAcc = accMAD > 0 ? (topicAcc - globalAcc) / accMAD : 0;
    const zSpd = secMAD > 0 ? (globalSec - topicSec) / secMAD : 0; // faster-than-global => positive

    // blended performance signal
    const blendedZ = (weights.wAcc * zAcc + weights.wSpeed * zSpd)
                   * (0.5 + 0.5 * relWL)   // down-weight low-confidence accuracy
                   * (0.5 + 0.5 * shrinkA); // down-weight tiny attempt counts

    // map to 1..1000
    const normScore = zToScore01k(clamp(blendedZ, -6, 6)); // cap extreme tails for stability

    // weak/strong index retained (bounded -1..1) using a gentle tanh
    const weakIndex = clamp(blendedZ / 3, -1, 1);

    topics.push({
      topic,
      attempts,
      sessions,
      avgScore: mean(list.map(e => e.score || 0)), // keep original for compatibility
      normScore,                                   // NEW: 1..1000
      avgAcc: topicAcc,
      avgSec: topicSec,
      weakIndex,
      entries: list,
    });
  }

  return topics;
}


function LeaderboardPanel({ board, setBoard, topicMap, highlightId, maxShown = 5 }) {
  const TABS = ["overview", "topics", "sessions"];

  const [tab, setTab] = useState("overview");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [range, setRange] = useState("ALL");

  // keep previous tab to compute direction
  const prevTabRef = useRef(tab);
  const [dir, setDir] = useState(0); // -1 = left, 1 = right, 0 = none

  function changeTab(next) {
    const from = prevTabRef.current;
    const to = next;
    const d =
      TABS.indexOf(to) > TABS.indexOf(from) ? 1 :
      TABS.indexOf(to) < TABS.indexOf(from) ? -1 : 0;
    setDir(d);
    setTab(to);
    prevTabRef.current = to;
  }

  // (keep your current filtering logic)
  const filteredBoard = useMemo(() => {
    // apply time range here if desired
    return board;
  }, [board, range]);

  const topicSummaries = useMemo(() => summarizeTopics(filteredBoard), [filteredBoard]);

  // only change: cap sessions passed to SessionsTab
  const sessionsCapped = useMemo(
    () => filteredBoard.slice(0, maxShown),
    [filteredBoard, maxShown]
  );

  return (
    <motion.div layout className={`${panel} relative overflow-visible`}>
      <PanelGloss />
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Trophy size={18} className="text-white/80" /> Performance
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {["overview", "topics", "sessions"].map(k => (
          <button
            key={k}
            className={`${btnGhost} ${tab === k ? "ring-2 ring-emerald-400/60" : ""}`}
            onClick={() => changeTab(k)}
          >
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      <div className="relative overflow-visible h-auto min-h-0">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={tab}
            custom={dir}
            initial="enter"
            animate="center"
            exit="exit"
            variants={{
              enter: (d) => ({ x: d === 0 ? 0 : (d > 0 ? 40 : -40), opacity: 0 }),
              center: { x: 0, opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
              exit: (d) => ({ x: d > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.16, ease: "easeIn" } })
            }}
          >
            {tab === "overview" && (
              <OverviewTab
                board={filteredBoard}
                topicSummaries={topicSummaries}
                topicMap={topicMap}
              />
            )}
            {tab === "topics" && (
              <TopicsTab
                topicSummaries={topicSummaries}
                topicMap={topicMap}
              />
            )}
            {tab === "sessions" && (
              // ⬇️ UI unchanged — just capped data
              <SessionsTab
                board={sessionsCapped}
                topicMap={topicMap}
                highlightId={highlightId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SectionRailSwitch({ value, onChange }) {
  const options = [
    { key: "personal", label: "Personal", icon: User2 },
    { key: "global",   label: "Global",   icon: Globe2 },
    ];
  const idx = options.findIndex(o => o.key === value);
  const isGlobal = value === "global";

  return (
    <div
      role="tablist"
      aria-label="Select leaderboard scope"
      className="relative inline-flex items-center rounded-2xl bg-white/5 border border-white/10 p-1"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onChange(options[Math.min(idx+1, options.length-1)].key);
        if (e.key === "ArrowLeft")  onChange(options[Math.max(idx-1, 0)].key);
      }}
    >
      {/* Sliding handle (style changes by target) */}
      <motion.div
        aria-hidden
        className={`absolute top-1 bottom-1 rounded-xl border
          ${isGlobal
            ? "bg-[#0d1117]/85 border-white/10 ring-1 ring-emerald-400/35 shadow-[0_10px_28px_-10px_rgba(16,185,129,0.55)]"
            : "bg-white/5 border-white/10"}`
        }
        animate={{ left: idx === 0 ? 4 : "calc(50% + 4px)", right: idx === 0 ? "calc(50% + 4px)" : 4 }}
        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
      />

      {options.map((o) => {
        const ActiveIcon = o.icon;
        const active = value === o.key;
        const activeGlobal = active && o.key === "global";
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            className={`relative z-10 w-40 h-10 px-3 rounded-xl whitespace-nowrap
                        inline-flex items-center justify-center gap-2
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30
                        transition-colors
                        ${active
                          ? (activeGlobal ? "text-emerald-200" : "text-white")
                          : "text-white/75 hover:text-white"}`}
            onClick={() => onChange(o.key)}
          >
            <ActiveIcon size={16} className={`${activeGlobal ? "text-emerald-300" : "text-white/65"}`} />
            <span className="text-sm font-medium tracking-tight">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
function AnalyticsShell({ board, setBoard, topicMap, highlightId, maxShown = 5, currentUser }) {
  const [section, setSection] = React.useState("performance"); // "performance" | "global"

  // reuse your existing computations for Performance
  const filteredBoard = React.useMemo(() => board, [board]);
  const topicSummaries = React.useMemo(() => summarizeTopics(filteredBoard), [filteredBoard]);
  const sessionsCapped = React.useMemo(() => filteredBoard.slice(0, maxShown), [filteredBoard, maxShown]);

  return (
    <motion.div layout className={`${panel} relative overflow-visible`}>
      <PanelGloss />

      {/* Header with rail switch */}
  {/* Header with rail switch */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
  <Trophy size={18} className="text-white/80" />
          Analytics
        </h2>
        <SectionRailSwitch value={section} onChange={setSection} />
      </div>

      {/* Body — absolute crossfade to avoid height jumps */}
      {/* Body — natural height (shrinks/expands with content) */}
      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {section === "personal" ? (
            <motion.div
              key="personal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              layout
            >
              <PerformanceTabs
                board={filteredBoard}
                topicSummaries={topicSummaries}
                topicMap={topicMap}
                sessionsCapped={sessionsCapped}
                highlightId={highlightId}
              />
            </motion.div>
          ) : (
            <motion.div
              key="global"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              layout
            >
              <GlobalLeaderboard
                topicMap={topicMap}
                currentUserId={currentUser?.id}
                currentDisplayName={currentUser?.user_metadata?.display_name ?? currentUser?.email?.split("@")[0]}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {/* Body */}
<div className="relative overflow-visible h-auto min-h-0">
        <AnimatePresence initial={false} mode="popLayout">
          {section === "performance" ? (
            <motion.div
              key="perf"
              initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-2 flex items-center justify-end">
                <button className={btnGhost} onClick={() => { if (confirm("Clear leaderboard?")) setBoard([]); }}>Clear</button>
              </div>

              {/* Your existing performance tabs panel */}
              <PerformanceTabs
                board={filteredBoard}
                topicSummaries={topicSummaries}
                topicMap={topicMap}
                sessionsCapped={sessionsCapped}
                highlightId={highlightId}
                setBoard={setBoard}
              />
            </motion.div>
          ) : (
            <motion.div
              key="global"
              initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Render the GLOBAL card as a full panel section */}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
function PerformanceTabs({ board, topicSummaries, topicMap, sessionsCapped, highlightId, setBoard }) {
  const TABS = ["overview", "topics", "sessions"];
  const [tab, setTab] = React.useState("overview");
  const prevTabRef = React.useRef(tab);
  const [dir, setDir] = React.useState(0);

  function changeTab(next) {
    const from = prevTabRef.current;
    const to = next;
    const d = TABS.indexOf(to) > TABS.indexOf(from) ? 1 : TABS.indexOf(to) < TABS.indexOf(from) ? -1 : 0;
    setDir(d); setTab(to); prevTabRef.current = to;
  }

  return (
    <>
      {/* tabs row exactly as you had */}
  {/* Tabs row + Clear aligned on one line */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex gap-2">
          {TABS.map(k => (
            <button
              key={k}
              className={`${btnGhost} ${tab === k ? "ring-2 ring-emerald-400/60" : ""}`}
              onClick={() => changeTab(k)}
            >
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <button
          className={btnGhost}
          onClick={() => { if (confirm("Clear leaderboard?")) setBoard?.([]); }}
        >
          Clear
        </button>
      </div>


      <div className="relative overflow-x-visible overflow-y-visible min-h-[15em]">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={tab}
            custom={dir}
            initial="enter" animate="center" exit="exit"
            variants={{
              enter: (d) => ({ x: d === 0 ? 0 : (d > 0 ? 40 : -40), opacity: 0 }),
              center: { x: 0, opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
              exit: (d) => ({ x: d > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.16, ease: "easeIn" } })
            }}
          >
            {tab === "overview" && (
              <OverviewTab board={board} topicSummaries={topicSummaries} topicMap={topicMap} />
            )}
            {tab === "topics" && (
              <TopicsTab topicSummaries={topicSummaries} topicMap={topicMap} />
            )}
            {tab === "sessions" && (
              <SessionsTab board={sessionsCapped} topicMap={topicMap} highlightId={highlightId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

function OverviewTab({ board, topicSummaries, topicMap }) {
  const { user } = useAuth();
  const n = board.length;
  const avgScore = robustAverageScore(board);
  const avgAcc   = board.reduce((s,e)=>s+(e.accuracy||0),0)/(n||1);
  const avgSec   = Math.round(10*board.reduce((s,e)=>s+(e.avgSecPerQ||0),0)/(n||1))/10;

  // Let all finite RELs compete, then prefer well-sampled items as tie-breaker
  const finite = topicSummaries.filter(t => Number.isFinite(t.weakIndex));

  const weakest = [...finite]
    .sort((a, b) => (a.weakIndex - b.weakIndex) || ((b.attempts || 0) - (a.attempts || 0)))
    .slice(0, 3);

  const strongest = [...finite]
    .sort((a, b) => (b.weakIndex - a.weakIndex) || ((b.attempts || 0) - (a.attempts || 0)))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPI label="Sessions" value={n} />
        <KPI
          label={
            <div className="inline-flex items-center gap-1 leading-none">
              <span>Avg score</span>
              <PortalTooltip text={"Your score = 60% accuracy + 40% speed, compared to your usual pace.\n“Avg score” is the mean of all your sessions, scaled out of 1000."}>
                <HelpCircle size={12} className="text-white/40 hover:text-white/70 cursor-help relative top-[0.5px]" />
              </PortalTooltip>
            </div>
          }
          value={<>{avgScore}<span className="text-xs text-white/50"> /1000</span></>}
        />
        <KPI label="Accuracy" value={`${Math.round(avgAcc*100)}%`} />
        <KPI label="Avg sec / Q" value={avgSec} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TopicList title="Weakest topics"  items={weakest}   topicMap={topicMap} tone="weak" />
        <TopicList title="Strongest topics" items={strongest} topicMap={topicMap} tone="strong" />
      </div>
    </div>
  );
}




/* ===================== Topics Tab (bar leaderboard w/ medals) ===================== */
function MedalBadge({ rank }) {
  // Gold, Silver, Bronze with subtle conic shine
  const palettes = {
    1: {
      ring: "ring-yellow-300/70",
      style: {
        backgroundImage:
          "conic-gradient(from 210deg at 50% 50%, #FDE68A, #FCD34D, #FBBF24, #FDE68A)",
      },
      fg: "text-black/80",
    },
    2: {
      ring: "ring-slate-300/70",
      style: {
        backgroundImage:
          "conic-gradient(from 210deg at 50% 50%, #E5E7EB, #D1D5DB, #9CA3AF, #E5E7EB)",
      },
      fg: "text-black/80",
    },
    3: {
      ring: "ring-amber-300/70",
      style: {
        backgroundImage:
          "conic-gradient(from 210deg at 50% 50%, #FBBF24, #F59E0B, #D97706, #FBBF24)",
      },
      fg: "text-black/80",
    },
    default: {
      ring: "ring-grey-300/60",
      style: {
        backgroundImage:
          "conic-gradient(from 210deg at 50% 50%, #8b92aaff, #87a58bff, #897e91ff, #738e85ff)",
      },
      fg: "text-black/80",
    },
  };
  const p = palettes[rank] || palettes.default;

  return (
    <div
      className={`relative h-7 w-7 rounded-xl ring-2 ${p.ring} shadow-[0_4px_18px_-6px_rgba(0,0,0,0.6)] flex items-center justify-center ${p.fg}`}
      style={p.style}
      aria-label={`Rank ${rank}`}
      title={`Rank ${rank}`}
    >
      <div className="absolute inset-0 rounded-xl mix-blend-soft-light pointer-events-none"
           style={{ background: "radial-gradient(120% 120% at -10% -10%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.1) 55%, transparent 60%)" }} />
      <div className="text-xs font-bold">{rank}</div>
    </div>
  );
}
function TopicsTab({ topicSummaries, topicMap }) {
  // Default: strong first (by REL)
  const [sort, setSort] = useState("strong"); // strong | weak | practiced | recent

  // REL extent for scaling the single bar to 0..100
  const relExtent = useMemo(() => {
    if (!topicSummaries.length) return { min: 0, max: 0 };
    let min = Infinity, max = -Infinity;
    for (const t of topicSummaries) {
      const r = t.weakIndex ?? 0;
      if (r < min) min = r;
      if (r > max) max = r;
    }
    if (min === max) { min -= 0.5; max += 0.5; } // avoid zero span
    return { min, max };
  }, [topicSummaries]);

  // Sort: all based on REL, with requested variants
  const sorted = useMemo(() => {
    const arr = [...topicSummaries];
    if (sort === "weak")
      arr.sort((a, b) => (Number.isFinite(a.weakIndex) ? a.weakIndex : Infinity) - (Number.isFinite(b.weakIndex) ? b.weakIndex : Infinity));
    if (sort === "strong")
      arr.sort((a, b) => (Number.isFinite(b.weakIndex) ? b.weakIndex : -Infinity) - (Number.isFinite(a.weakIndex) ? a.weakIndex : -Infinity));
    if (sort === "practiced")
      arr.sort((a, b) =>
        ((Number.isFinite(b.weakIndex) ? b.weakIndex : -Infinity) - (Number.isFinite(a.weakIndex) ? a.weakIndex : -Infinity)) ||
        ((b.attempts || 0) - (a.attempts || 0))
      );
    if (sort === "recent")    arr.sort((a, b) =>
      (new Date(b.entries?.[0]?.when || 0)) - (new Date(a.entries?.[0]?.when || 0))
    );
    return arr;
  }, [topicSummaries, sort]);

  // REL → 0..100 width
  const scaleRel = (rel) => {
    const { min, max } = relExtent;
    return Math.round(100 * ((rel - min) / (max - min)));
  };

  return (
    <div className="space-y-3">
      {/* Controls — ordered: strong > weak > most practiced > most recent */}
      <div className="flex flex-wrap gap-2 pb-1">
        {[
          ["strong", "Strong first"],
          ["weak", "Weak first"],
          ["practiced", "Most Practiced"],
          ["recent", "Most recent"],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`${btnGhost} ${sort === k ? "ring-2 ring-emerald-400/60" : ""}`}
            onClick={() => setSort(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="text-[11px] text-white/45">
        REL bar - the higher the score, the stronger the topic against other topics.
      </div>

      <div className={`${cardBase} divide-y divide-white/5`}>
        {sorted.length === 0 && (
          <div className="p-4 text-sm text-white/50">No topic data yet. Run a session first.</div>
        )}
        {sorted.map((t, i) => (
          <TopicRowBar
            key={t.topic}
            index={i + 1}
            label={topicMap.get(t.topic)?.label || t.topic}
            rel={t.weakIndex ?? 0}
            relPct={scaleRel(t.weakIndex ?? 0)}
            sec={t.avgSec}
            attempts={t.attempts}
            sessions={t.sessions}
          />
        ))}
      </div>
    </div>
  );
}


function TopicRowBar({ index, label, rel, relPct, sec, attempts, sessions }) {
  // Nicer medals
  return (
    <div className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <MedalBadge rank={index} />

          <div className="min-w-0">
            {/* Full topic name — allow wrapping */}
            <div className="font-semibold leading-tight break-words">{label}</div>
            <div className="text-[11px] text-white/50">
              REL {rel >= 0 ? "+" : ""}{rel.toFixed(2)}
              {" · "}{sig3(sec)}s/q
              {" · "}{attempts} attempts
              {" · "}{sessions} sessions
              {attempts < 5 && <span className="ml-1 text-white/35">(low data)</span>}
            </div>

          </div>
        </div>
      </div>

      {/* Single REL bar — neutral, light→bright to match dark bg */}
      <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden" title={`REL ${rel >= 0 ? "+" : ""}${rel.toFixed(2)}`}>
        <div
          className="h-full"
          style={{
            width: `${relPct}%`,
            backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.85))",
            backgroundColor: "transparent",
            mixBlendMode: "screen",
            transition: "width 220ms ease",
          }}
        />
      </div>
    </div>
  );
}


/* ------------------ Helpers for visual scaling & color ------------------ */

// Map attempts count (0..max) to a % width (6..100) so even 1 attempt is visible
// ---- Visual helpers (drop-in) ----\
function explainDivisibility(N, d) {
  const digits = String(Math.abs(N)).split("").map(Number);
  const last   = digits[digits.length - 1];
  const last2  = digits.slice(-2).join("") || "0";
  const last3  = digits.slice(-3).join("") || "0";
  const sum    = digits.reduce((s, x) => s + x, 0);
  const altSum = digits.reduce((s, x, i) => (i % 2 === 0 ? s + x : s - x), 0); // 11-rule
  const mod    = ((N % d) + d) % d;

  const yesNo = (ok) => ok ? "Yes" : "No";

  if (d === 2) {
    const ok = last % 2 === 0;
    return `Rule for 2: number is even.\nLast digit = ${last} → ${last % 2 === 0 ? "even" : "odd"} → ${yesNo(ok)}.`;
  }

  if (d === 10) {
    const ok = last === 0;
    return `Rule for 10: ends in 0.\nLast digit = ${last} → ${yesNo(ok)}.`;
  }
  if (d === 3) {
    const ok = sum % 3 === 0;
    return `Rule for 3: sum of digits divisible by 3.\nSum = ${sum} → ${sum} ${ok ? "is" : "is not"} a multiple of 3 → ${yesNo(ok)}.`;
  }
  if (d === 9) {
    const ok = sum % 9 === 0;
    return `Rule for 9: sum of digits divisible by 9.\nSum = ${sum} → ${sum} ${ok ? "is" : "is not"} a multiple of 9 → ${yesNo(ok)}.`;
  }
  if (d === 4) {
    const n2 = Number(last2);
    const ok = n2 % 4 === 0;
    return `Rule for 4: last two digits divisible by 4.\nLast two digits = ${n2} → ${yesNo(n2 % 4 === 0)} → ${yesNo(ok)}.`;
  }
  if (d === 8) {
    const n3 = Number(last3);
    const ok = n3 % 8 === 0;
    return `Rule for 8: last three digits divisible by 8.\nLast three digits = ${n3} → ${yesNo(n3 % 8 === 0)} → ${yesNo(ok)}.`;
  }
  if (d === 6) {
    const even = last % 2 === 0;
    const sum3 = sum % 3 === 0;
    const ok = even && sum3;
    return `Rule for 6: divisible by 2 and 3.\nEven? ${even ? "Yes" : "No"}; Sum of digits = ${sum} → ${sum3 ? "multiple of 3" : "not a multiple of 3"} → ${yesNo(ok)}.`;
  }
  if (d === 11) {
    const ok = (Math.abs(altSum) % 11) === 0;
    return `Rule for 11: alternating sum of digits (odd positions − even positions) is a multiple of 11.\nAlt sum = ${altSum} → ${Math.abs(altSum)} ${ (Math.abs(altSum)%11)===0 ? "is" : "is not"} a multiple of 11 → ${yesNo(ok)}.`;
  }
  if (d === 7) {
    // Show the common classroom trick once or twice; also report true mod for certainty.
    const step = (n) => {
      const ld = n % 10;
      const rest = Math.trunc(n / 10);
      return rest - 2 * ld;
    };
    let s1 = step(Math.abs(N));
    let s2 = step(Math.abs(s1));
    const ok = mod === 0;
    return `One test for 7: take the last digit, double it, subtract from the rest, repeat.\n` +
           `${Math.abs(N)} → ${s1} → ${s2} … check small number.\n` +
           `${N} mod 7 = ${mod} → ${yesNo(ok)}.`;
  }
  // Fallback generic (shouldn't be hit with the chosen d set)
  return `Compute ${N} mod ${d} = ${mod} → ${yesNo(mod === 0)}.`;
}

// Laplace smoothing: accuracy = (correct + 1) / (attempts + 2)
// Laplace-smoothed accuracy for an entry
function entryAccOf(e) {
  const c = Number(e?.correct || 0);
  const a = Number(e?.attempts || 0);
  return (c + 1) / (a + 2);
}

function smoothAcc(correct, attempts) {
  return (Number(correct || 0) + 1) / (Number(attempts || 0) + 2);
}

function sig3(n) {
  if (!Number.isFinite(n)) return "--";
  // toPrecision → back to Number to avoid "1.23e+4"
  return String(Number(Number(n).toPrecision(3)));
}
function fmtSec(n) {            // "92.99999s/q" -> "93 s/q" or "9.86 s/q"
  const s = sig3(n);
  return s === "--" ? "--" : `${s}s/q`;
}

// Map attempts count to a visible width (6..100)
function scaleAttempts(n) {
  if (!n || n <= 0) return 6;
  const x = Math.log10(1 + n) / Math.log10(1 + 60); // 60 attempts ~ full bar
  return Math.round(6 + x * 94);
}

// Accuracy color (thresholded + smooth blend inside each band)
function barColor(pct) {
  const x = Math.max(0, Math.min(100, pct)) / 100;
  // bands: 0–0.4 red→orange, 0.4–0.7 orange→amber, 0.7–0.85 lime→emerald, 0.85–1 emerald→teal
  const lerp = (a,b,t)=>Math.round(a+(b-a)*t);
  const pick = (a,b,t)=>`rgb(${lerp(a[0],b[0],t)}, ${lerp(a[1],b[1],t)}, ${lerp(a[2],b[2],t)})`;

  if (x <= 0.4)   return pick([239,68,68],  [249,115,22],  x/0.4);           // red → orange
  if (x <= 0.7)   return pick([249,115,22],[245,158,11],  (x-0.4)/0.3);      // orange → amber
  if (x <= 0.85)  return pick([163,230,53],[16,185,129],  (x-0.7)/0.15);     // lime → emerald
  return                 pick([16,185,129],[20,184,166],  (x-0.85)/0.15);    // emerald → teal
}

function quartile(sorted, p) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function robustAverageScore(board) {
  const vals = board.map(e => e?.score).filter(v => Number.isFinite(v));
  if (vals.length === 0) return 0;
  if (vals.length < 5) return Math.round(vals.reduce((s,v)=>s+v,0)/vals.length);

  const sorted = [...vals].sort((a,b) => a - b);
  const q1 = quartile(sorted, 0.25);
  const q3 = quartile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;

  const filtered = vals.filter(v => v >= lo && v <= hi);
  const base = filtered.length ? filtered : vals;
  return Math.round(base.reduce((s,v)=>s+v,0)/base.length);
}

/* ===================== Sessions Tab (ranked list) ===================== */

function SessionsTab({ board, topicMap, highlightId }) {
  const [sortBy, setSortBy] = React.useState("attempts"); // "attempts" | "score" | "date"

  const ranked = React.useMemo(() => {
    const arr = board.slice();
    if (sortBy === "attempts") arr.sort((a,b) => (b.attempts||0) - (a.attempts||0));
    else if (sortBy === "score") arr.sort((a,b) => (b.score||0) - (a.score||0));
    else if (sortBy === "date")  arr.sort((a,b) => new Date(b.when) - new Date(a.when));
    return arr;
  }, [board, sortBy]);

  const [count, setCount] = useState(20);
  const show = ranked.slice(0, count);

  return (
    <div className="space-y-2">
      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-white/45">Sort:</span>
        <button
          className={`${btnGhost} ${sortBy==="attempts" ? "ring-2 ring-emerald-400/60" : ""}`}
          onClick={()=>setSortBy("attempts")}
          title="Most practiced (highest attempts first)"
        >
          Most practiced
        </button>
        <button
          className={`${btnGhost} ${sortBy==="score" ? "ring-2 ring-emerald-400/60" : ""}`}
          onClick={()=>setSortBy("score")}
          title="Highest score first"
        >
          Score
        </button>
        <button
          className={`${btnGhost} ${sortBy==="date" ? "ring-2 ring-emerald-400/60" : ""}`}
          onClick={()=>setSortBy("date")}
          title="Most recent first"
        >
          Recent
        </button>
      </div>

      {show.length===0 && <div className="text-white/50 text-sm">No entries yet.</div>}

      <div className="grid grid-cols-1 gap-2">
        {show.map((e, idx) => (
          <SessionRow
            key={e.id}
            rank={idx+1}
            entry={e}
            topicMap={topicMap}
            highlight={e.id===highlightId}
          />
        ))}
      </div>

      {count < ranked.length && (
        <div className="mt-2">
          <button className={btnGhost} onClick={()=>setCount(c=>c+20)}>Load more</button>
        </div>
      )}
    </div>
  );
}


function SessionRow({ rank, entry, topicMap, highlight=false }) {
  const date = new Date(entry.when);
  const topicsLabel = entry.bucket === "MIXED"
    ? entry.topics.map(t => topicMap.get(t)?.label || t).join(" · ")
    : (topicMap.get(entry.bucket)?.label || entry.bucket);

  const accPct = Math.round((entry.accuracy || 0) * 100);
  const barPct = accPct;

  return (
    <motion.div
      layout
      initial={false}
      animate={highlight ? { scale: 1.02 } : { scale: 1 }}
      className={`${cardBase} p-3 sm:p-4 relative overflow-hidden ${highlight ? "ring-2 ring-emerald-400/70 shadow-[0_0_0_6px_rgba(16,185,129,0.15)]" : ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* New shiny medal */}
          <MedalBadge rank={rank} />

          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold leading-tight">
              {entry.score}<span className="text-xs text-white/50"> /1000</span>
            </div>
            <div className="text-[11px] sm:text-xs text-white/60 break-words">
              {topicsLabel}
            </div>
          </div>
        </div>

        <div className="text-right text-[10px] sm:text-xs text-white/50">
          <div>{date.toLocaleDateString()} {date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</div>
          <div>{entry.correct}✔ / {entry.attempts} tries · {accPct}% · {fmtSec(entry.avgSecPerQ)}</div>
        </div>
      </div>

      {/* Neutral light→bright progress bar */}
      <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden" title={`Accuracy ${accPct}%`}>
        <div
          className="h-full"
          style={{
            width: `${barPct}%`,
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.85))',
            backgroundColor: 'transparent',
            mixBlendMode: 'screen',
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </motion.div>
  );
}





function KPI({label, value}) {
  return <div className={`${cardBase} p-3 text-center`}><div className="text-xs text-white/50">{label}</div><div className="text-xl font-semibold">{value}</div></div>;
}

function TopicList({ title, items, topicMap, tone }) {
  return (
    <div className={`${cardBase} p-3`}>
      <div className="text-sm text-white/60 mb-2">{title}</div>
      <div className="space-y-2">
        {items.length===0 && <div className="text-white/40 text-sm">Not enough data yet.</div>}
        {items.map(t => (
          <div key={t.topic} className="flex items-center justify-between">
            <div className="truncate">{topicMap.get(t.topic)?.label || t.topic}</div>
            <div className={`text-xs ${tone==="weak"?"text-red-300":"text-emerald-300"}`}>
              {tone==="weak" ? "" : ""} {(t.weakIndex>=0?"":"") + t.weakIndex.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function LeaderboardRow({ rank, entry, topicMap, highlight = false }) {
  const badge = rank===1
    ? "from-yellow-300 to-emerald-300"
    : rank===2
    ? "from-slate-200 to-slate-400"
    : rank===3
    ? "from-amber-500 to-orange-400"
    : "from-emerald-500 to-cyan-500";

  const barPct = Math.round((entry.accuracy||0)*100);
  const date = new Date(entry.when);
  const topicsLabel = entry.bucket === "MIXED"
    ? entry.topics.map(t=>topicMap.get(t)?.label || t).join(" · ")
    : (topicMap.get(entry.bucket)?.label || entry.bucket);

  return (
    <motion.div
      layout
      initial={false}
      animate={highlight ? { scale: 1.02 } : { scale: 1 }}
      className={`${cardBase} p-3 sm:p-4 relative overflow-hidden ${
        highlight ? "ring-2 ring-emerald-400/70 shadow-[0_0_0_6px_rgba(16,185,129,0.15)]" : ""
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-7 w-7 rounded-xl bg-gradient-to-br ${badge} flex items-center justify-center text-xs font-bold text-black/80`}>
            {rank}
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold leading-tight truncate">
              {entry.score}{highlight ? " •" : ""}
            </div>
            <div className="text-[10px] sm:text-xs text-white/50 truncate">
              {topicsLabel}
            </div>
          </div>
        </div>
        <div className="text-right text-[10px] sm:text-xs text-white/50">
          <div>{date.toLocaleDateString()} {date.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</div>
          <div>{entry.correct}✔ / {entry.attempts} tries · {Math.round((entry.accuracy||0)*100)}% · {entry.avgSecPerQ}s/q</div>
        </div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-white/40 to-white/80"
          style={{ width: `${barPct}%`, mixBlendMode: 'screen' }}
        />
      </div>

    </motion.div>
  );
}


// ---------- DEV tiny tests ----------
if (typeof window !== "undefined") {
  window.debugAnswersMatch = (user, correct) => {
    const u = tryNumeric(user);
    const c = tryNumeric(correct);
    console.groupCollapsed("%cdebugAnswersMatch", "color:#10b981;font-weight:bold", { user, correct });
    console.log("user raw:", user);
    console.log("correct raw:", correct);
    console.log("user numeric:", u, "correct numeric:", c, "diff:", (u!=null&&c!=null)?Math.abs(u-c):null);
    console.log("equal (numeric <1e-6):", (u!=null&&c!=null) && Math.abs(u-c)<1e-6);
    console.log("fallback string eq:", (String(user).trim().toLowerCase().replace(/\s+/g,"") === String(correct).trim().toLowerCase().replace(/\s+/g,"")));
    console.groupEnd();
    return (function answersMatchForDebug(user, correct) {
      const u2 = tryNumeric(user);
      const c2 = tryNumeric(correct);
      if (u2 != null && c2 != null && isFinite(u2) && isFinite(c2)) {
        return Math.abs(u2 - c2) < 1e-6;
      }
      const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, "");
      return norm(user) === norm(correct);
    })(user, correct);
  };
}

// Dev self-tests
(function __devSelfTests(){
  const ok = (cond, label) => {
    if (!cond) {
      // eslint-disable-next-line no-console
      console.error("❌ Test failed:", label);
    } else {
      // eslint-disable-next-line no-console
      console.log("✅", label);
    }
  };

  const approx = (a,b)=> Math.abs(a-b) < 1e-9;

  // Low-level numeric parsing checks
  ok(approx(tryNumeric("Math.sqrt(2)/2"), Math.SQRT2/2), "num: Math.sqrt(2)/2");
  ok(approx(tryNumeric("1/√2"),          Math.SQRT2/2), "num: 1/√2");
  ok(approx(tryNumeric("sqrt2"),         Math.SQRT2),   "num: sqrt2");
  ok(approx(tryNumeric("\\sqrt{3}"),     Math.sqrt(3)), "num: \\sqrt{3}");
  ok(approx(tryNumeric("\\√{3}"),        Math.sqrt(3)), "num: \\√{3}");
  ok(approx(tryNumeric("\\√3"),          Math.sqrt(3)), "num: \\√3");
  ok(approx(tryNumeric("√(3)"),          Math.sqrt(3)), "num: √(3)");
  ok(approx(tryNumeric("pi/3"),          Math.PI/3),    "num: pi/3");
  ok(approx(tryNumeric("π/3"),           Math.PI/3),    "num: π/3");
  ok(approx(tryNumeric("\\frac{1}{2}"),  0.5),          "num: \\frac{1}{2}");

  // High-level answer equivalence checks (the thing used by the app)
  const expect = (user, correct, label) => ok(window.debugAnswersMatch(user, correct), label);

  // tan(π/3) correct is "sqrt(3)"
  [
    "√3",
    "\\√3",
    "sqrt(3)",
    "\\sqrt{3}",
    "1.7320508075688772",
    "(√3)",
    " (  sqrt { 3 } ) "
  ].forEach(u => expect(u, "sqrt(3)", `answersMatch: ${JSON.stringify(u)} == sqrt(3)`));

  // cos(π/4) == sqrt(2)/2
  [
    "√2/2",
    "1/√2",
    "\\frac{\\sqrt{2}}{2}",
    "\\frac{1}{\\sqrt{2}}",
    "sqrt(2)/2",
  ].forEach(u => expect(u, "sqrt(2)/2", `answersMatch: ${JSON.stringify(u)} == sqrt(2)/2`));
})();