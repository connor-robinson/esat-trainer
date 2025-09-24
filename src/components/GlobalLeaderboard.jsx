import React from "react";
import { supabase } from "../lib/supabase";
import { Trophy, Target, Clock, ChevronDown } from "lucide-react";

/* ---------------- Visual bits ---------------- */
function MedalBadge({ rank }) {
  const palettes = {
    1: { ring: "ring-yellow-300/70", bg:"conic-gradient(from 210deg at 50% 50%, #FDE68A, #FCD34D, #FBBF24, #FDE68A)" },
    2: { ring: "ring-slate-300/70",  bg:"conic-gradient(from 210deg at 50% 50%, #E5E7EB, #D1D5DB, #9CA3AF, #E5E7EB)" },
    3: { ring: "ring-amber-300/70",  bg:"conic-gradient(from 210deg at 50% 50%, #FBBF24, #F59E0B, #D97706, #FBBF24)" },
    d: { ring: "ring-gray-300/60",   bg:"conic-gradient(from 210deg at 50% 50%, #8b92aa, #87a58b, #897e91, #738e85)" },
  };
  const p = palettes[rank] || palettes.d;
  return (
    <div
      className={`relative h-7 w-7 rounded-xl ring-2 ${p.ring} shadow-[0_4px_18px_-6px_rgba(0,0,0,0.6)] flex items-center justify-center text-black/80`}
      style={{ backgroundImage: p.bg }}
      title={`Rank ${rank}`} aria-label={`Rank ${rank}`}
    >
      <div className="absolute inset-0 rounded-xl mix-blend-soft-light pointer-events-none"
           style={{ background: "radial-gradient(120% 120% at -10% -10%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.1) 55%, transparent 60%)" }} />
      <div className="text-xs font-bold">{rank}</div>
    </div>
  );
}

function GlowBar({ value }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
      <div className="h-full rounded-full bg-emerald-400/80"
     style={{ width: `${w}%`, boxShadow: "0 0 18px rgba(16,185,129,0.35), 0 0 2px rgba(16,185,129,0.9)" }} />
    </div>
  );
}

/* -------------- Math helpers ----------------- */
function wilsonLowerBound(successes, trials, z = 1.96) {
  if (!trials || trials <= 0) return 0;
  const p = successes / trials;
  const denom = 1 + (z*z)/trials;
  const centre = p + (z*z)/(2*trials);
  const margin = z * Math.sqrt((p*(1-p) + (z*z)/(4*trials)) / trials);
  return Math.max(0, (centre - margin) / denom);
}
function overallBlend({ score=0, accuracy=0, attempts=0, minutes=0 }) {
  const adjAcc = wilsonLowerBound(Math.round(accuracy*attempts), attempts);
  const s = Math.max(0, Math.min(1, score/1000));
  const vol = Math.min(1, minutes/60); // saturate at 60 min
  return 0.5*s + 0.35*adjAcc + 0.15*vol;
}

/* ----------- Data fetch (client) ------------- */
async function fetchRecentRows({ days = 7, limit = 1000 }) {
  const sinceISO = new Date(Date.now() - days*24*3600*1000).toISOString();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* -------------- Dark Select ------------------ */
/* Custom on-brand select (no white native popup) */
/* -------------- Dark Select ------------------ */
/* Compact, pill-style, dark, with optional search + scroll */
function DarkSelect({
  value,
  onChange,
  options,
  className = "",
  searchable = false,
  placeholder = "Search…",
  maxMenuHeight = 280,
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hover, setHover] = React.useState(-1);
  const wrapRef = React.useRef(null);

  const selected = options.find(o => o.value === value) || options[0];

  // outside click
  React.useEffect(() => {
    const onDoc = (e) => { if (open && wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => String(o.label).toLowerCase().includes(q));
  }, [options, searchable, query]);

  // keyboard nav
  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHover(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHover(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); if (filtered[hover]) { onChange(filtered[hover].value); setOpen(false); } }
    if (e.key === "Escape")    { e.preventDefault(); setOpen(false); }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="h-9 rounded-2xl bg-white/5 border border-white/10
                   text-sm px-3 pr-8 text-white/85 inline-flex items-center gap-2
                   w-auto min-w-32 whitespace-nowrap shrink-0
                   hover:bg-white/7 hover:border-white/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        onClick={() => { setOpen(v => !v); setQuery(""); setHover(-1); }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.label}
        <ChevronDown size={16} className="ml-1 text-white/50" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 min-w-full rounded-xl bg-[#111318]/80
                     border border-white/10 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)] overflow-hidden"
          style={{ maxHeight: maxMenuHeight }}
        >
          {searchable && (
            <div className="p-2 border-b border-white/10">
              <input
                autoFocus
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full h-8 px-2 rounded-lg bg-white/5 text-sm text-white/90
                           placeholder-white/40 outline-none border border-white/10 focus:border-white/20"
              />
            </div>
          )}

          <div className="max-h-[280px] overflow-y-auto">
            {filtered.map((o, i) => {
              const active = o.value === value;
              const hovering = i === hover;
              return (
                <button
                  key={o.value}
                  role="option"
                  className={`w-full text-left px-3 py-2 text-sm ${
                    active ? "bg-white/10 text-white"
                    : hovering ? "bg-white/6 text-white"
                    : "text-white/80 hover:bg-white/8"
                  }`}
                  onMouseEnter={()=>setHover(i)}
                  onMouseLeave={()=>setHover(-1)}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                >
                  {o.label}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-white/50">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const lbHueStyle = {
  backgroundImage:
    `radial-gradient(120% 120% at -10% -10%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 55%, transparent 60%),
     linear-gradient(to bottom right, rgba(16,185,129,0.06), rgba(16,185,129,0.02))`
};
/* ------------- Generic table ----------------- */
/* ------------- Generic table ----------------- */
function LBTable({ titleIcon, title, rows, columns, progress, meRowId, isAggregate=false }) {
  return (
    <div
      className="rounded-3xl bg-[#0d1117]/80 backdrop-blur-md
               border border-white/10 ring-1 ring-emerald-400/10
               shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]
               p-3"
      style={lbHueStyle}
    >      <div className="flex items-center gap-2 text-white/80 mb-2">
        {titleIcon} <span className="font-semibold">{title}</span>
      </div>

      {rows.length === 0 ? (
        <div className="h-2" />
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const isEllipsis = r.__ellipsis;
            const isMe = !isEllipsis && (r.__id === meRowId);
            const rank = r.__rank;
            const name = isAggregate ? r.name : (r.display_name || "Anon");

            if (isEllipsis) {
              return (
                <div key={`ellipsis-${i}`} className="flex items-center justify-center text-white/40 text-sm py-1">
                  …
                </div>
              );
            }

            return (
              <div
                key={(r.id ?? name) + i}
                className={`rounded-2xl bg-[#0b0f14]/80 border border-white/10 p-3
                            hover:border-emerald-400/30 hover:shadow-[0_10px_34px_-10px_rgba(16,185,129,0.28)]
                            transition ${isMe ? "ring-2 ring-emerald-400/60" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <MedalBadge rank={rank <= 3 ? rank : undefined} />
                  <div className="text-white/50 w-8 text-right">{rank}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className={`truncate ${isMe ? "text-emerald-200" : "text-white/90"}`}>
                        {name}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-white/80">
                        {columns.map(col => (
                          <div key={col.key} className={col.align==="right" ? "text-right min-w-[64px]" : ""}>
                            <span className="text-white/50 mr-2">{col.label}</span>
                            <span className="font-semibold">{col.render(r)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {typeof progress === "function" && <GlowBar value={progress(r)} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ------------- Utility: top6 + me ------------- */
function withTop6AndMe(fullSortedRows, getId, meId) {
  // fullSortedRows are already sorted DESC by the metric of interest
  const N = 6;
  const top = fullSortedRows.slice(0, N);
  // annotate ranks + ids
  top.forEach((r, i) => { r.__rank = i + 1; r.__id = getId(r); });

  // If me is inside top6 → done
  if (top.some(r => r.__id === meId)) return top;

  // Find me in the full list
  const idx = fullSortedRows.findIndex(r => getId(r) === meId);
  if (idx === -1) return top; // no me row available

  const meRow = { ...fullSortedRows[idx], __rank: idx + 1, __id: meId };
  return [...top, { __ellipsis: true }, meRow];
}

/* ---------------- Main component --------------- */
/** Props:
 *  - topicMap: Map(id -> {id,label})
 *  - currentUserId?: string
 *  - currentDisplayName?: string
 */
export default function GlobalLeaderboard({ topicMap, currentUserId, currentDisplayName }) {
  const [tab, setTab] = React.useState("top"); // "top" | "accurate" | "practice"
  const [days, setDays] = React.useState(7);

  const topics = React.useMemo(() => {
    const items = Array.from(topicMap?.values?.() || []);
    return items.map(t => ({ id: t.id, label: t.label }));
  }, [topicMap]);
  const [topicId, setTopicId] = React.useState(() => topics?.[0]?.id || null);

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try { setRows(await fetchRecentRows({ days })); }
      catch (e) { console.error("Global leaderboard fetch failed:", e); }
      finally { setLoading(false); }
    })();
  }, [days]);

  // identify "me"
  const meId = React.useMemo(() => currentUserId || currentDisplayName || null, [currentUserId, currentDisplayName]);

  // Aggregate by user for “accurate” and “practice”
  const byUser = React.useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.user_id || r.display_name; if (!key) continue;
      const attempts = Number.isFinite(r.attempts) ? r.attempts : 0;
      const correct  = Number.isFinite(r.correct) ? r.correct : Math.round((r.accuracy||0) * attempts);
      const prev = map.get(key) || {
        __id: key, name: r.display_name || "Anon",
        attempts: 0, correct: 0, minutes: 0, bestScore: 0, bestAcc: 0, sessions: 0,
      };
      prev.sessions += 1;
      prev.attempts += attempts;
      prev.correct  += correct;
      prev.minutes  += (r.duration_sec || 0);
      prev.bestScore = Math.max(prev.bestScore, r.score || 0);
      prev.bestAcc   = Math.max(prev.bestAcc, r.accuracy || 0);
      map.set(key, prev);
    }
    return Array.from(map.values());
  }, [rows]);

  // Overall banner
  const overallTop = React.useMemo(() => {
    const list = byUser.map(u => ({
      ...u,
      blend: overallBlend({
        score: u.bestScore,
        accuracy: u.bestAcc,
        attempts: u.attempts,
        minutes: u.minutes/60
      })
    })).sort((a,b) => b.blend - a.blend);
    return list[0] || null;
  }, [byUser]);

  // 1) Top Scores by topic
  const topByTopic = React.useMemo(() => {
    if (!topicId) return [];
    const filtered = rows.filter(r => Array.isArray(r.topics) && r.topics.includes(topicId));
    const sorted = [...filtered].sort((a,b) => (b.score||0)-(a.score||0) || (b.accuracy||0)-(a.accuracy||0));
    return withTop6AndMe(sorted, r => r.user_id || r.display_name, meId);
  }, [rows, topicId, meId]);

  // 2) Most Accurate (adjusted)
  const mostAcc = React.useMemo(() => {
    const enriched = byUser.map(u => ({
      ...u,
      adjusted: wilsonLowerBound(u.correct, u.attempts, 1.96),
      rawAcc: u.attempts ? u.correct/u.attempts : 0
    })).sort((a,b)=> (b.adjusted - a.adjusted) || (b.attempts - a.attempts) || (b.rawAcc - a.rawAcc));
    return withTop6AndMe(enriched, u => u.__id, meId);
  }, [byUser, meId]);

  // 3) Most Practice (minutes)
  const mostPractice = React.useMemo(() => {
    const sorted = [...byUser].sort((a,b)=> (b.minutes - a.minutes));
    return withTop6AndMe(sorted, u => u.__id, meId);
  }, [byUser, meId]);

  const TopicLabel = topics.find(t => t.id === topicId)?.label || "Topic";

  // shared tab styles (outline pills)
  const tabBase = "px-4 py-1.5 rounded-2xl text-sm border transition " +
                  "border-emerald-400/20 text-emerald-200/70 " +
                  "hover:border-emerald-400/40 hover:text-emerald-200 bg-transparent";
  const tabActive = "bg-emerald-500/10 text-emerald-200 border-emerald-400/50 ring-1 ring-emerald-400/40";

  return (
    <div className="mt-6">
      {/* Card */}
      <div className="rounded-3xl bg-[#0d1117]/80 backdrop-blur-md
                      border border-white/10 ring-1 ring-emerald-400/10
                      shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]
                      p-4 relative overflow-hidden">

        {/* Subtle emerald hue behind header */}
        <div className="pointer-events-none absolute -inset-x-4 -top-6 h-20
                        bg-[radial-gradient(60%_60%_at_0%_50%,rgba(16,185,129,0.10),transparent_60%)]
                        opacity-100" />

        {/* Header row: single line */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <Trophy size={18} className="text-emerald-300/85" />
            <div className="text-white/90 font-semibold tracking-wide">Global Leaderboard</div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DarkSelect
              value={days}
              onChange={(v)=>setDays(Number(v))}
              options={[
                { value: 7, label: "Last 7 days" },
                { value: 30, label: "Last 30 days" },
                { value: 365, label: "All time" },
              ]}
            />
            <DarkSelect
              value={topicId || ""}
              onChange={setTopicId}
              options={topics.map(t => ({ value: t.id, label: t.label }))}
              searchable
              placeholder="Search topics…"
            />
          </div>
        </div>

        {/* Overall top banner */}
        <div className="mt-2" />


        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4 mb-3">
          <button onClick={()=>setTab("top")} className={`${tabBase} ${tab==="top" ? tabActive : ""}`}>Top Scores</button>
          <button onClick={()=>setTab("accurate")} className={`${tabBase} ${tab==="accurate" ? tabActive : ""}`}>Most Accurate</button>
          <button onClick={()=>setTab("practice")} className={`${tabBase} ${tab==="practice" ? tabActive : ""}`}>Most Practiced</button>
        </div>

        {/* Single table area (view swapped) */}
        <div>
          {loading ? (
            <div className="text-sm text-white/60">Loading…</div>
          ) : tab === "top" ? (
            <LBTable
              titleIcon={<Trophy size={16} className="text-white/70" />}
              title={`Top Scores — ${TopicLabel}`}
              rows={topByTopic}
              columns={[
                { key: "score", label: "Score", align: "right", render: r => r.score },
                { key: "acc",   label: "Acc",   align: "right", render: r => `${Math.round((r.accuracy||0)*100)}%` },
              ]}
              progress={r => (r.score||0)/1000}
              meRowId={meId}
              isAggregate={false}
            />
          ) : tab === "accurate" ? (
            <LBTable
              titleIcon={<Target size={16} className="text-white/70" />}
              title="Most Accurate (Adjusted)"
              rows={mostAcc}
              columns={[
                { key: "adj",      label: "Adj Acc",  align: "right", render: r => `${Math.round((r.adjusted||0)*100)}%` },
                { key: "attempts", label: "Attempts", align: "right", render: r => r.attempts },
              ]}
              progress={r => r.adjusted}
              meRowId={meId}
              isAggregate
            />
          ) : (
            <LBTable
              titleIcon={<Clock size={16} className="text-white/70" />}
              title="Most Practice"
              rows={mostPractice}
              columns={[
                { key: "min", label: "Minutes", align: "right", render: r => Math.round((r.minutes||0)/60) },
                { key: "sessions", label: "Sessions", align: "right", render: r => r.sessions ?? undefined },
              ]}
              progress={r => Math.min(1, (r.minutes||0)/(60*60))}
              meRowId={meId}
              isAggregate
            />
          )}
        </div>
      </div>
    </div>
  );
}

