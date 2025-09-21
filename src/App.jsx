import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { Play, Save, Clock, FolderOpen, BookOpen, X, Check, Trash2, Trophy, Eye, GripVertical, Wrench, Plus, ChevronLeft, ChevronRight, ArrowLeft, AlertTriangle} from "lucide-react";
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
    { id: "indices_simplify", label: "Simplifying Indices" },
  ],
  FRACTIONS: [
    { id: "common_frac_to_dec_2dp", label: "Fractions and Decimals" },
    { id: "simplify_fraction", label: "Simplifying fractions" },
  ],
  ALGEBRA: [
    { id: "complete_square", label: "Complete the Square" },
    { id: "inequalities", label: "Inequalities" },
    { id: "binomial_expand", label: "Binomial Expansion" },
  ],
  EQUATIONS: [
    { id: "suvat_solve", label: "SUVAT" },
    { id: "units_con vert", label: "Units (SI)" },
    { id: "sphere_volume", label: "Sphere Volume" },
    { id: "sphere_area", label: "Sphere Surface Area" },
    { id: "cylinder_sa", label: "Cylinder Surface Area" },
    { id: "cone_sa", label: "Cone Surface Area" },
    { id: "square_pyramid_sa", label: "Square Pyramid SA" },
  ],
  TRIGONOMETRY: [
    { id: "trig_recall", label: "Trig Ratios " },
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
    video: "/tutorial/dragging.mp4", // replace with your poster or thumbnail
    caption: "Drag topics from the left into the Session Folder. Click “+” to add quickly without dragging."
  },
  {
    title: "Flash timer",
    video: "/tutorial/flashtimer.mp4",
    caption: "Add the Flash Timer and set seconds inside the folder to hide questions for fast recall."
  },
  {
    title: "Save a preset", 
    video: "/tutorial/savedsessions.mp4",
    caption: "Save a certain combination of topics so you can start a session in the future quickly."
  },
  {
    title: "Start a session", 
    video: "/tutorial/startsession.mp4",
    caption: "Set the timer, and do as many questions as you can within that time."
  },
  {
    title: "During practice",
    video: "/tutorial/symbolbar.mp4",
    caption: "Type answers, use the mini symbols, press Enter to check. Wrong → Check again → Reveal → Next."
  },
  {
    title: "Performance",
    video: "/tutorial/performance.mp4",
    caption: "Track progress by topic. REL bar shows stronger/weaker vs your own baseline."
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
  "undef", "undefined", "dne", "doesnotexist", "noanswer", "novalue",
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
function normalizeToJS(expr) {
  if (expr == null) return "";
  let s = String(expr);

  // basic cleanups
  s = s.replace(/[−—]/g, "-").replace(/\s+/g, "");
  s = s.replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/\^/g, "**");

  // sqrt forms: √(x), √x, sqrt(x), sqrt2
  s = s.replace(/√\s*\(([^)]+)\)/g, (_, inner) => `Math.sqrt(${inner})`);
  s = s.replace(/√\s*([A-Za-z_]\w*|\d+(?:\.\d+)?)/g, (_, inner) => `Math.sqrt(${inner})`);
  s = s.replace(/\bsqrt\s*\(([^)]+)\)/gi, (_, inner) => `Math.sqrt(${inner})`);
  s = s.replace(/\bsqrt(\d+(?:\.\d+)?)/gi, (_, num) => `Math.sqrt(${num})`);

  // constants
  s = s.replace(/\bpi\b/gi, "Math.PI").replace(/π/gi, "Math.PI");

  // user typed "math." (lowercase) → "Math."
  s = s.replace(/(^|[^A-Za-z])math\./g, "$1Math.");

  // superscripts
  s = s.replace(/([A-Za-z0-9_.\)])²/g, "($1)**2");
  s = s.replace(/([A-Za-z0-9_.\)])³/g, "($1)**3");

  // guard against accidental double prefixes: Math.Math. → Math.
  s = s.replace(/(?:Math\.){2,}/g, "Math.");

  return s;
}

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
const CALC_IDS = new Set(CATEGORIES.CALCULATION.map(t=>t.id));
const isCalc = (id)=> CALC_IDS.has(id);
// ---------- MathJax helpers ----------

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
      // Helper: parse "a/b" with optional spaces & signs
      const parseFraction = (s) => {
        if (!s) return null;
        const t = s.trim();
        // plain integer? (we'll disallow for this task unless the true answer is an integer)
        if (/^[+-]?\d+$/.test(t)) return [Number(t), 1];
        const m = t.match(/^\s*([+-]?\d+)\s*\/\s*([+-]?\d+)\s*$/);
        if (!m) return null;
        const p = Number(m[1]), q = Number(m[2]);
        if (!Number.isFinite(p) || !Number.isFinite(q) || q === 0) return null;
        return [p, q];
      };

      // Build a guaranteed-unsimplified fraction:
      // 1) choose coprime base (n0/d0)
      // 2) multiply both by k >= 2
      function randomCoprimePair() {
        while (true) {
          const a = randInt(2, 40);
          const b = randInt(2, 40);
          if (gcd(a, b) === 1) return [a, b];
        }
      }

      // A composite-ish factor set so gcd>1 and not trivial
      const factors = [2,3,4,5,6,7,8,9,10,12,14,15,16,18,20];
      const [n0, d0] = randomCoprimePair();
      const k = pick(factors);
      let P = n0 * k;
      let Q = d0 * k;

      // Random sign (on numerator for canonical form)
      if (Math.random() < 0.25) P = -P;

      // Target reduced (canonical) form
      const [ANS_P, ANS_Q] = reduceFraction(P, Q); // denominator made positive here
      const answer = formatFraction(ANS_P, ANS_Q); // e.g. "-3/5" or "2/3"

      // Strict checker:
      // - Must be a fraction (not just a decimal), unless true answer is an integer (ANS_Q===1)
      // - Must be in lowest terms: gcd(|a|,|b|)===1
      // - After normalizing sign and reducing, must equal (ANS_P/ANS_Q)
      const checker = (user) => {
        const parsed = parseFraction(user);
        if (!parsed) return false;

        let [a, b] = parsed;
        // If user gave a plain integer while the correct answer is NOT an integer → reject
        if (ANS_Q !== 1 && b === 1) return false;

        // Lowest-terms check first
        const g0 = gcd(Math.abs(a), Math.abs(b));
        if (g0 !== 1) return false;

        // Normalize sign to denominator-positive & compare
        const [A, B] = reduceFraction(a, b);
        return A === ANS_P && B === ANS_Q;
      };

      return {
        prompt: `Simplify: ${P}/${Q}`,
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
    case "binomial_expand": { const a = randInt(-5,5); const pow = pick([2,3]); const sign = a>=0? "+" : "-"; const A = Math.abs(a); let expansion = ""; if (pow===2) expansion = `x² ${a>=0?"+":"-"} ${2*A}x + ${A*A}`; else expansion = `x³ ${a>=0?"+":"-"} ${3*A}x² + ${3*A*A}x ${a>=0?"+":"-"} ${A*A*A}`; return { prompt: `Expand: (x ${sign} ${A})^${pow}` , answer: expansion }; }

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
      // Choose which variable is unknown
      const target = pick(["speed", "distance", "time"]);
      let prompt, acceptable;

      if (target === "speed") {
        prompt = "(speed = ?)";
        acceptable = ["s/t"];                        // only s over t
      } else if (target === "distance") {
        prompt = "(distance = ?)";
        acceptable = ["vt", "v*t", "t*v"];          // allow implicit or explicit mult
      } else { // time
        prompt = "(time = ?)";
        acceptable = ["s/v"];                        // only s over v
      }

      // Custom checker for this question
      const checker = (user) => {
        const norm = (user || "")
          .replace(/\s+/g, "")
          .replace(/×/g, "*")
          .replace(/·/g, "*")
          .replace(/÷/g, "/");

        // Only allow s, v, t, parentheses and * or /
        if (!/^[svt()*/]+$/i.test(norm)) return false;

        // Normalize trivial parentheses like (s)/t -> s/t
        const cleaned = norm.replace(/[()]/g, "").toLowerCase();

        // Accept either implicit or explicit multiplication for distance
        const alts = new Set(
          acceptable
            .map(s => s.replace(/\s+/g,""))
            .flatMap(s => s === "vt" ? ["vt","v*t","t*v","t*v"] : [s])
        );

        return alts.has(cleaned);
      };

      return { prompt, answer: acceptable[0], acceptableAnswers: acceptable, checker };
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
  const [view, setView] = useState("builder");
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
      // store the value only if flash_timer is in the session
      ...(compact.includes("flash_timer") ? { flashSeconds: Number(flashSeconds) || 0 } : {})
    };
    setSessions(prev => [entry, ...prev].slice(0, 24));
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
            onFinish={(entry)=>{
              setBoard(prev => [entry, ...prev].slice(0,200));
              setLastEntryId(entry.id); }} 
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

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (state === "finished") return;
        if (phase === "go") doCheck();
        else if (phase === "reveal") revealAnswer();
        else if (phase === "next") next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <LeaderboardPanel
            board={board}
            setBoard={setBoard}
            topicMap={topicMap}
            highlightId={lastEntryId}
          />        
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
                  key={(hidden ? "hidden" : current?.prompt) || "idle"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.08 }}
                  className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2 min-h-[2.6em] flex items-center justify-center"
                >
                  {hidden ? "" : (current?.prompt || "Preparing…")}
                </motion.div>

                {current?.id === "tri_special" && current?.diagram && !hidden && (
                  <TriangleDiagram
                    type={current.diagram.type}
                    lengths={current.diagram.lengths}
                    labels={current.diagram.labels}
                    angleHint={current.diagram.angleHint}
                    isoRight={!!current.diagram.isoRight}
                    thetaAt={current.diagram.thetaAt} 
                  />
                )}
              </AnimatePresence>

              <form onSubmit={submit} className="mt-4 flex items-center justify-center gap-2">
                <input
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
                <button className={btnPrimary} type="submit">
                  {phase === "go" && (<><Play size={16} /> Go</>)}
                  {phase === "reveal" && (<><Eye size={16} /> Reveal</>)}
                  {phase === "next" && (<><Check size={16} /> Next</>)}
                </button>

                {/* Secondary: keep a “Check again” button while user is in reveal phase (i.e., after a wrong try) */}
                {phase === "reveal" && (
                  <button type="button" onClick={doCheck} className={btnGhost}>
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

              <div className="h-10 mt-3">
                <AnimatePresence>
                  {state==="correct" && (<motion.div initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} transition={{duration:0.08}} className="inline-flex items-center gap-2 text-emerald-400"><Check size={18}/> Correct</motion.div>)}
                  {state==="wrong" && (<motion.div initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} transition={{duration:0.08}} className="text-red-400">Incorrect, try again.</motion.div>)}
                  {state==="revealed" && (<motion.div initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} transition={{duration:0.08}} className="text-white/70">Answer: <span className="text-white font-semibold">{current?.answer}</span></motion.div>)}
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
  const accs = board.map(entryAccOf).filter(Number.isFinite);
  const secs = board.map(e => e?.avgSecPerQ).filter(x => Number.isFinite(x) && x > 0);

  const globalAcc = mean(accs) || 0;  // 0..1
  const globalSec = mean(secs) || 1;  // seconds per Q
  return { globalAcc, globalSec };
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
function summarizeTopics(board, weights = { wAcc: 1, wSpeed: 0.7 }, prior = 1){
  const { globalAcc, globalSec } = computeGlobalBaselines(board);
  const byTopic = groupByTopic(board);

  const topics = [];
  for (const [topic, list] of byTopic){
    const n = list.length;

    // Topic means
    const accs = list.map(entryAccOf);
    const secs = list.map(e => e?.avgSecPerQ).filter(x => Number.isFinite(x) && x > 0);

    // Shrink small samples toward global baseline (Laplace-style)
    // prior=1 adds one "pseudo" observation at the global mean
    const topicAcc = (mean(accs) * n + globalAcc * prior) / (n + prior);
    const topicSec = (mean(secs) * secs.length + globalSec * prior) / ((secs.length || 0) + prior);

    // REL: higher is “stronger”
    //   accuracy term: topicAcc - globalAcc
    //   speed term:    faster-than-global => positive
    let rel = weights.wAcc * (topicAcc - globalAcc)
            + weights.wSpeed * ((globalSec - topicSec) / globalSec);
    if (!Number.isFinite(rel)) rel = 0; // safety

    // Keep it bounded for display sanity
    rel = Math.max(-1, Math.min(1, rel));

    const attempts = list.reduce((s, e) => s + (e.attempts || 0), 0);

    topics.push({
      topic,
      attempts,
      sessions: n,
      avgScore: mean(list.map(e => e.score || 0)),
      avgAcc: topicAcc,          // already shrunk
      avgSec: topicSec,          // already shrunk
      weakIndex: rel,            // <0 weaker than your overall, >0 stronger
      entries: list,
    });
  }

  return topics;
}


function LeaderboardPanel({ board, setBoard, topicMap, highlightId }) {
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

  const filteredBoard = useMemo(() => {
    // apply time range here if desired
    return board;
  }, [board, range]);

  const topicSummaries = useMemo(() => summarizeTopics(filteredBoard), [filteredBoard]);

  return (
    <motion.div layout className={`${panel} relative overflow-visible`}>
      <PanelGloss />
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Trophy size={18} font-semibold/> Performance
        </h2>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={() => { if (confirm("Clear leaderboard?")) setBoard([]); }}>Clear</button>
        </div>
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

      <div className="relative overflow-x-visible overflow-y-visible min-h-[15em]">
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
              <OverviewTab board={filteredBoard} topicSummaries={topicSummaries} topicMap={topicMap} />
            )}
            {tab === "topics" && (
              <TopicsTab topicSummaries={topicSummaries} topicMap={topicMap} />
            )}
            {tab === "sessions" && (
              <SessionsTab board={filteredBoard} topicMap={topicMap} highlightId={highlightId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </motion.div>
  );
}
function OverviewTab({ board, topicSummaries, topicMap }) {
  const n = board.length;
  const avgScore = Math.round(board.reduce((s,e)=>s+(e.score||0),0)/(n||1));
  const avgAcc   = board.reduce((s,e)=>s+(e.accuracy||0),0)/(n||1);
  const avgSec   = Math.round(10*board.reduce((s,e)=>s+(e.avgSecPerQ||0),0)/(n||1))/10;

  // REL can be negative, so we just sort naturally
// Let *all* finite RELs compete, then prefer well-sampled items as a tiebreaker.
// This ensures negative REL topics show up even with low attempts.
  const finite = topicSummaries.filter(t => Number.isFinite(t.weakIndex));

  // Weakest: lowest REL first
  const weakest = [...finite]
    .sort((a, b) =>
      (a.weakIndex - b.weakIndex) || ((b.attempts || 0) - (a.attempts || 0))
    )
    .slice(0, 3);

  // Strongest: highest REL first
  const strongest = [...finite]
    .sort((a, b) =>
      (b.weakIndex - a.weakIndex) || ((b.attempts || 0) - (a.attempts || 0))
    )
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPI label="Sessions" value={n} />
        <KPI
          label="Avg score"
          value={
            <>
              {avgScore}
              <span className="text-xs text-white/50"> /1000</span>
            </>
          }
        />        <KPI label="Accuracy" value={`${Math.round(avgAcc*100)}%`} />
        <KPI label="Avg sec / Q" value={avgSec} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TopicList title="Weakest topics" items={weakest} topicMap={topicMap} tone="weak" />
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