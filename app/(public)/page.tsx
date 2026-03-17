"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"

/* ── Types ──────────────────────────────────────────────── */

interface Experience {
  company?: string; title?: string
  starts_at?: { year: number; month?: number }
  ends_at?: { year: number; month?: number } | null
  logo_url?: string
}

interface Education {
  school?: string; degree_name?: string; field_of_study?: string
  starts_at?: { year: number }; ends_at?: { year: number } | null
  logo_url?: string
}

interface Profile {
  id: string; name: string | null; first_name: string | null; last_name: string | null
  profile_pic_url: string | null; headline: string | null; summary: string | null
  company: string | null; job_title: string | null; occupation: string | null
  city: string | null; state: string | null; country: string | null
  country_full_name: string | null; linkedin_url: string | null; industry: string | null
  experiences: Experience[] | null; education: Education[] | null; skills: unknown[] | null
}

/* ── Helpers ─────────────────────────────────────────────── */

const dn = (p: Profile) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.name || "Guest"

const curRole = (exps: Experience[] | null) => {
  if (!exps?.length) return null
  const c = exps.find((e) => !e.ends_at) || exps[0]
  return c.title || c.company ? { title: c.title || "", company: c.company || "" } : null
}

const topSchool = (edu: Education[] | null) => edu?.[0]?.school || null

const fmtRange = (s?: { year: number; month?: number }, e?: { year: number; month?: number } | null) =>
  s ? `${s.year} \u2014 ${e ? e.year : "Present"}` : null

const sText = (p: Profile): string =>
  [p.name, p.first_name, p.last_name, p.headline, p.summary, p.industry, p.city, p.country_full_name, p.occupation, p.company, p.job_title,
    ...(p.experiences || []).map((e) => `${e.title || ""} ${e.company || ""}`),
    ...(p.education || []).map((e) => e.school || ""),
  ].filter(Boolean).join(" ").toLowerCase()

const isSimple = (q: string) => { const w = q.trim().toLowerCase().split(/\s+/); return w.length <= 2 && w.every((x) => /^[a-z\u00C0-\u024F'-]+$/i.test(x)) }

function inferTags(p: Profile): string[] {
  const tags: Set<string> = new Set()
  const t = [p.headline, p.occupation, p.industry, p.job_title, p.company, ...(p.experiences || []).flatMap((e) => [e.title, e.company])].filter(Boolean).join(" ").toLowerCase()
  if (/\b(co-?founder|founder|ceo|chief executive)\b/i.test(t)) { tags.add("founder"); tags.add("startup") }
  if (/\b(capital|ventures?|partners|sequoia|a16z|andreessen|accel|benchmark|greylock|lightspeed|tiger global|softbank|ycombinator|techstars|general catalyst|bessemer)\b/i.test(t)) { tags.add("investor"); tags.add("VC") }
  if (/\b(investor|venture|vc)\b/i.test(t) && /\b(fund|capital|ventures?|invest)\b/i.test(t)) tags.add("investor")
  if (/\b(angel investor|angel)\b/i.test(t)) tags.add("angel investor")
  if (/\b(goldman|morgan stanley|jp morgan|barclays|ubs|lazard|evercore)\b/i.test(t)) tags.add("finance")
  if (/\b(mckinsey|bain|bcg|deloitte|pwc|kpmg|accenture)\b/i.test(t)) tags.add("consultant")
  if (/\b(consult|advisor|advisory)\b/i.test(t)) tags.add("consultant")
  if (/\b(engineer|developer|software|cto|tech lead|architect|full.?stack)\b/i.test(t)) tags.add("technical")
  if (/\b(machine learning|deep learning|ai |artificial intelligence|data scien)\b/i.test(t)) tags.add("AI/ML")
  if (/\b(product manager|product lead|head of product)\b/i.test(t)) tags.add("product")
  if (/\b(ceo|cto|cfo|coo|chief|vp |vice president|director|head of|managing director)\b/i.test(t)) tags.add("executive")
  if (/\b(professor|phd|researcher|postdoc|academic)\b/i.test(t)) tags.add("academic")
  if (/\b(lawyer|attorney|counsel|legal)\b/i.test(t)) tags.add("legal")
  if (/\b(doctor|physician|medical|biotech|pharma|healthcare)\b/i.test(t)) tags.add("healthcare")
  return [...tags]
}

function buildSummaries(profiles: Profile[]) {
  return profiles.map((p) => ({
    id: p.id, name: dn(p), headline: p.headline, occupation: p.occupation || p.job_title,
    industry: p.industry, city: p.city, country: p.country_full_name,
    experiences: (p.experiences || []).slice(0, 3).map((e) => `${e.title || ""} at ${e.company || ""}`).filter((s) => s.trim() !== "at"),
    education: (p.education || []).slice(0, 3).map((e) => e.school || "").filter(Boolean),
    tags: inferTags(p).length > 0 ? inferTags(p) : undefined,
  }))
}

/* ── Cycling placeholder ─────────────────────────────────── */

function useCycling(items: string[], ms = 3500) {
  const [i, setI] = useState(0)
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % items.length), ms); return () => clearInterval(id) }, [items.length, ms])
  return items[i]
}

const SUGGESTIONS = ["Startup founders", "Investors & VCs", "AI / ML builders", "Studied at Stanford", "Technical backgrounds", "Worked in Quant Trading"]
const PLACEHOLDERS = [
  "Try \"startup founders\" or \"who works in AI?\"",
  "Try \"investors\" or \"Stanford alumni\"",
  "Try \"people to meet for fundraising\"",
  "Try \"engineers\" or \"from Germany\"",
]

const LUMA_URL = "https://lu.ma/yzyf3gka?tk=6HLNFH"

/* ══════════════════════════════════════════════════════════ */

export default function Page() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [aiResults, setAiResults] = useState<string[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)
  const [eventOpen, setEventOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ph = useCycling(PLACEHOLDERS)

  useEffect(() => { fetch("/api/attendees").then((r) => r.ok ? r.json() : []).then(setProfiles).finally(() => setLoading(false)) }, [])

  const idx = useMemo(() => profiles.map((p) => ({ p, t: sText(p) })), [profiles])
  const sums = useMemo(() => buildSummaries(profiles), [profiles])
  const localHits = useMemo(() => { if (!query.trim()) return profiles; const terms = query.toLowerCase().split(/\s+/).filter(Boolean); return idx.filter((e) => terms.every((t) => e.t.includes(t))).map((e) => e.p) }, [query, profiles, idx])

  const aiSearch = useCallback(async (q: string) => {
    abortRef.current?.abort(); const ctrl = new AbortController(); abortRef.current = ctrl; setIsSearching(true)
    try { const r = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, profiles: sums }), signal: ctrl.signal }); if (!r.ok) throw new Error(); const { ids } = await r.json(); if (!ctrl.signal.aborted) setAiResults(ids) }
    catch (e: unknown) { if (e instanceof Error && e.name !== "AbortError") setAiResults(null) }
    finally { if (!ctrl.signal.aborted) setIsSearching(false) }
  }, [sums])

  useEffect(() => { clearTimeout(debounceRef.current); setAiResults(null); if (!query.trim()) { setIsSearching(false); return }; if (isSimple(query) && localHits.length > 0) { setIsSearching(false); return }; setIsSearching(true); debounceRef.current = setTimeout(() => aiSearch(query), 400); return () => clearTimeout(debounceRef.current) }, [query, aiSearch, localHits.length])

  const results = useMemo(() => { if (!query.trim()) return profiles; if (aiResults) { const m = new Map(profiles.map((p) => [p.id, p])); return aiResults.filter((id) => m.has(id)).map((id) => m.get(id)!) }; return localHits }, [query, profiles, aiResults, localHits])
  const aiActive = aiResults !== null && query.trim().length > 0

  return (
    <div className="pub-scroll" style={{ height: "100dvh", overflow: "auto", overscrollBehavior: "contain" }}>

      {/* ── Venue bg (fixed behind everything) ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <img src="/venue.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%", filter: "brightness(0.85) saturate(0.8)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,10,0.4) 0%, rgba(6,6,10,0.72) 40%, rgba(6,6,10,0.93) 70%, #06060a 100%)" }} />
      </div>
      <div className="ambient-bg" style={{ opacity: 0.5 }}><div className="ambient-orb-3" /></div>
      <div className="grain-overlay" />

      {/* ── Hero: Title + Mission + Search ── */}
      <div style={{ position: "relative", zIndex: 2, paddingTop: 48 }}>
        <div className="pub-container">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: 28 }}
          >
            <h1 className="pub-hero-title" style={{
              fontFamily: "var(--font-survey-display), serif",
              fontWeight: 500, letterSpacing: "-0.025em",
              lineHeight: 1.05, color: "var(--survey-fg)", marginBottom: 10,
            }}>
              Compute &<br />Cocktails
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: "var(--survey-fg)", opacity: 0.65, letterSpacing: "0.01em" }}>
                GTC Reception &middot; March 17 &middot; Palo Alto
              </p>
              <button onClick={() => setEventOpen(true)} style={{
                fontSize: 12, fontWeight: 600, color: "var(--survey-accent)",
                background: "rgba(201,168,124,0.06)", border: "1px solid rgba(201,168,124,0.12)",
                borderRadius: 8, padding: "4px 12px", cursor: "pointer",
                whiteSpace: "nowrap" as const,
              }}>Event Info</button>
            </div>

            <p style={{
              fontSize: 15, fontWeight: 500,
              color: "var(--survey-fg)", opacity: 0.7,
              lineHeight: 1.6, maxWidth: 380,
            }}>
              Know who&apos;s coming. Connect before you arrive.
            </p>
            {!loading && profiles.length > 0 && (
              <p style={{ fontSize: 13, color: "var(--survey-accent)", opacity: 0.6, marginTop: 10 }}>
                {profiles.length} guests confirmed
              </p>
            )}
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pub-search" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", marginBottom: 14 }}>
              <span style={{ color: "var(--survey-accent)", opacity: 0.6, display: "flex", flexShrink: 0 }}>
                {isSearching ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="pub-spin"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                )}
              </span>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ph}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15, color: "var(--survey-fg)", fontFamily: "inherit" }}
              />
              {query ? (
                <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--survey-muted-fg)", display: "flex", padding: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
                  padding: "5px 11px", borderRadius: 8, flexShrink: 0,
                  background: "rgba(201,168,124,0.06)", color: "var(--survey-accent)",
                  border: "1px solid rgba(201,168,124,0.1)",
                }}>Smart Search</span>
              )}
            </div>

            {/* Chips */}
            <div className="pub-chip-row" style={{ display: "flex", flexWrap: "wrap" as const, gap: 7, marginBottom: 24 }}>
              {SUGGESTIONS.map((s) => {
                const on = query === s
                return (
                  <button key={s} onClick={() => setQuery(s)} className={`pub-chip${on ? " active" : ""}`}
                    style={{ padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" as const, color: on ? "var(--survey-accent-light)" : "var(--survey-muted-fg)" }}
                  >{s}</button>
                )
              })}
            </div>
          </motion.div>

          {/* Result info */}
          {query && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.5 }}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
              {aiActive && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 7, background: "rgba(201,168,124,0.07)", color: "var(--survey-accent)", border: "1px solid rgba(201,168,124,0.1)" }}>AI-powered</span>}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="pub-grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="profile-card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px" }}>
                  <div className="pub-shimmer" style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    <div className="pub-shimmer" style={{ height: 14, width: "60%", borderRadius: 6 }} />
                    <div className="pub-shimmer" style={{ height: 12, width: "80%", borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pub-stagger pub-grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {results.map((p) => {
                const role = curRole(p.experiences) || (p.headline ? { title: p.headline, company: "" } : p.job_title || p.company ? { title: p.job_title || "", company: p.company || "" } : null)
                const school = topSchool(p.education)
                return (
                  <button key={p.id} onClick={() => setSelected(p)} className="profile-card pub-fade-in-up"
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", textAlign: "left", width: "100%" }}>
                    <div style={{ flexShrink: 0 }}>
                      {p.profile_pic_url ? (
                        <img src={p.profile_pic_url} alt={dn(p)} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover" as const, border: "1px solid rgba(255,255,255,0.06)" }} />
                      ) : (
                        <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, background: "linear-gradient(135deg, rgba(201,168,124,0.1) 0%, rgba(201,168,124,0.02) 100%)", border: "1px solid rgba(201,168,124,0.12)", color: "var(--survey-accent)" }}>
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--survey-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{dn(p)}</p>
                      {role && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{role.title}{role.company && <span style={{ opacity: 0.4 }}> · {role.company}</span>}</p>}
                      {school && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{school}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {results.length === 0 && query && !isSearching && !loading && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <p style={{ fontSize: 15, color: "var(--survey-muted-fg)", marginBottom: 6 }}>No guests match that search</p>
              <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.35, marginBottom: 20 }}>Try a different description or one of these:</p>
              <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: 7 }}>
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button key={s} onClick={() => setQuery(s)} className="pub-chip"
                    style={{ padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--survey-muted-fg)" }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="pub-footer" style={{ marginTop: 64, padding: "24px 0" }}>
          <div className="pub-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.2 }}>Compute & Cocktails</span>
            <button onClick={() => setEventOpen(true)} style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.25, background: "none", border: "none", cursor: "pointer" }}>Event Info</button>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {selected && <Detail p={selected} onClose={() => setSelected(null)} />}
        {eventOpen && <EventPanel onClose={() => setEventOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   PROFILE DETAIL PANEL
   ══════════════════════════════════════════════════════════ */

function Detail({ p, onClose }: { p: Profile; onClose: () => void }) {
  const exps = p.experiences || []
  const edus = p.education || []
  const loc = [p.city, p.country_full_name].filter(Boolean).join(", ")

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h) }, [onClose])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />

      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="pub-scroll"
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: "min(500px, 100vw)", zIndex: 101, background: "#09090d", borderLeft: "1px solid rgba(255,255,255,0.05)", overflowY: "auto" }}>

        <div className="pub-detail-padding" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "flex-end", padding: "14px 32px 0" }}>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--survey-muted-fg)", cursor: "pointer", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="pub-detail-padding" style={{ padding: "0 32px 56px" }}>
          {/* Hero */}
          <div className="profile-hero-glass" style={{ padding: "36px 28px 28px", marginBottom: 28, textAlign: "center" as const }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 18 }}>
              {p.profile_pic_url ? (
                <>
                  <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,124,0.1) 0%, transparent 70%)", filter: "blur(14px)" }} />
                  <img src={p.profile_pic_url} alt={dn(p)} style={{ position: "relative", width: 88, height: 88, borderRadius: "50%", objectFit: "cover" as const, border: "2px solid rgba(201,168,124,0.1)" }} />
                </>
              ) : (
                <div style={{ width: 88, height: 88, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 500, fontFamily: "var(--font-survey-display), serif", background: "linear-gradient(135deg, rgba(201,168,124,0.1) 0%, rgba(201,168,124,0.02) 100%)", border: "2px solid rgba(201,168,124,0.12)", color: "var(--survey-accent)" }}>
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
              )}
            </div>

            <h2 style={{ fontFamily: "var(--font-survey-display), serif", fontSize: 22, fontWeight: 500, color: "var(--survey-fg)", marginBottom: 6 }}>{dn(p)}</h2>
            {p.headline && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", lineHeight: 1.5, maxWidth: 320, margin: "0 auto 12px" }}>{p.headline}</p>}

            {(loc || p.industry) && (
              <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: 6, marginBottom: 16 }}>
                {loc && <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "var(--survey-muted-fg)" }}>{loc}</span>}
                {p.industry && <span style={{ fontSize: 13, padding: "4px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "var(--survey-muted-fg)" }}>{p.industry}</span>}
              </div>
            )}

            {p.linkedin_url && (
              <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 12, background: "rgba(201,168,124,0.06)", color: "var(--survey-accent)", border: "1px solid rgba(201,168,124,0.12)", textDecoration: "none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                LinkedIn
              </a>
            )}
          </div>

          {p.summary && (
            <section style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--survey-accent)", marginBottom: 10 }}>About</p>
              <p style={{ fontSize: 13, color: "var(--survey-fg)", opacity: 0.6, lineHeight: 1.75, whiteSpace: "pre-line" as const }}>{p.summary}</p>
            </section>
          )}

          {exps.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--survey-accent)", marginBottom: 12 }}>Experience</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
                {exps.slice(0, 5).map((exp, i) => (
                  <div key={i} className="pub-detail-row" style={{ display: "flex", gap: 12, padding: "10px 12px" }}>
                    {exp.logo_url ? (
                      <img src={exp.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" as const, flexShrink: 0, marginTop: 1, background: "rgba(255,255,255,0.9)", padding: 2 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "rgba(201,168,124,0.04)", border: "1px solid rgba(201,168,124,0.07)", color: "var(--survey-accent)" }}>{exp.company?.[0] || "?"}</div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--survey-fg)" }}>{exp.title || "Role"}</p>
                      {exp.company && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", marginTop: 1 }}>{exp.company}</p>}
                      {exp.starts_at && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.3, marginTop: 2 }}>{fmtRange(exp.starts_at, exp.ends_at)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {edus.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--survey-accent)", marginBottom: 12 }}>Education</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
                {edus.slice(0, 3).map((edu, i) => (
                  <div key={i} className="pub-detail-row" style={{ display: "flex", gap: 12, padding: "10px 12px" }}>
                    {edu.logo_url ? (
                      <img src={edu.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" as const, flexShrink: 0, marginTop: 1, background: "rgba(255,255,255,0.9)", padding: 2 }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "rgba(201,168,124,0.04)", border: "1px solid rgba(201,168,124,0.07)", color: "var(--survey-accent)" }}>{edu.school?.[0] || "?"}</div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--survey-fg)" }}>{edu.school || "School"}</p>
                      {(edu.degree_name || edu.field_of_study) && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", marginTop: 1 }}>{[edu.degree_name, edu.field_of_study].filter(Boolean).join(", ")}</p>}
                      {edu.starts_at && <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.3, marginTop: 2 }}>{fmtRange(edu.starts_at, edu.ends_at)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════
   EVENT INFO PANEL
   ══════════════════════════════════════════════════════════ */

const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=4080+Amaranta+Ave+Palo+Alto+CA+94306"

function EventPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h) }, [onClose])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />

      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="pub-scroll"
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: "min(500px, 100vw)", zIndex: 101, background: "#09090d", borderLeft: "1px solid rgba(255,255,255,0.05)", overflowY: "auto" }}>

        <div className="pub-detail-padding" style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "flex-end", padding: "14px 32px 0" }}>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--survey-muted-fg)", cursor: "pointer", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="pub-detail-padding" style={{ padding: "0 32px 56px" }}>
          {/* Hero */}
          <div className="profile-hero-glass" style={{ padding: "36px 28px 32px", marginBottom: 28, textAlign: "center" as const }}>
            <h2 style={{ fontFamily: "var(--font-survey-display), serif", fontSize: 24, fontWeight: 500, color: "var(--survey-fg)", marginBottom: 6 }}>
              Compute & Cocktails
            </h2>
            <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", marginBottom: 20 }}>GTC Reception</p>

            <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: 6, marginBottom: 24 }}>
              <span style={{ fontSize: 13, padding: "5px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "var(--survey-muted-fg)" }}>Tue, March 17</span>
              <span style={{ fontSize: 13, padding: "5px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "var(--survey-muted-fg)" }}>5:00 &ndash; 8:00 PM</span>
              <span style={{ fontSize: 13, padding: "5px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", color: "var(--survey-muted-fg)" }}>Palo Alto, CA</span>
            </div>

            <a href={LUMA_URL} target="_blank" rel="noopener noreferrer" className="btn-premium" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "13px 26px", borderRadius: 50, fontSize: 15, fontWeight: 600,
              background: "var(--survey-accent)", color: "#06060a", textDecoration: "none",
              boxShadow: "0 0 40px rgba(201,168,124,0.12), 0 4px 16px rgba(0,0,0,0.3)",
            }}>
              RSVP on Luma
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
            </a>
          </div>

          {/* About */}
          <section style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--survey-accent)", marginBottom: 12 }}>About</p>
            <p style={{ fontSize: 13, color: "var(--survey-fg)", opacity: 0.6, lineHeight: 1.75, marginBottom: 12 }}>
              An exclusive GTC evening bringing together founders, hackers, investors, and operators building the future. Join us for cocktails and great conversation as you unwind after the conference.
            </p>
            <p style={{ fontSize: 13, color: "var(--survey-fg)", opacity: 0.6, lineHeight: 1.75 }}>
              Each guest completes a short voice survey about their interests before the event &mdash; this powers our smart guest search, helping everyone find the right people to connect with.
            </p>
          </section>

          {/* Venue */}
          <section style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--survey-accent)", marginBottom: 12 }}>Venue</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
              <img src="/venue.jpg" alt="Outdoor area" style={{ width: "100%", height: 140, objectFit: "cover", objectPosition: "center 40%", display: "block", borderRadius: 12 }} />
              <img src="/ball_room.png" alt="Interior" style={{ width: "100%", height: 140, objectFit: "cover", display: "block", borderRadius: 12 }} />
            </div>
            <p style={{ fontSize: 15, color: "var(--survey-fg)", marginBottom: 3 }}>4080 Amaranta Ave</p>
            <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", marginBottom: 12 }}>Palo Alto, CA 94306</p>
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 10,
              background: "rgba(201,168,124,0.06)", color: "var(--survey-accent)",
              border: "1px solid rgba(201,168,124,0.1)", textDecoration: "none",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              Open in Google Maps
            </a>
            <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.35, marginTop: 12, lineHeight: 1.5 }}>
              Street parking is limited &mdash; ride sharing encouraged.
            </p>
          </section>

          {/* Sponsors */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "var(--survey-accent)", marginBottom: 14 }}>Hosted by</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {[
                { name: "Palohouse", desc: "Hospitality & Events", logo: null },
                { name: "GreatPoint Ventures", desc: "Venture Capital", logo: "/logos/gpv.png" },
                { name: "Tensordyne", desc: "AI Infrastructure", logo: "/logos/tensordyne.png" },
                { name: "Silicon Valley Bank", desc: "Innovation Banking", logo: "/logos/svb.png" },
              ].map((s) => (
                <div key={s.name} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  {s.logo ? (
                    <img src={s.logo} alt={s.name} style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      objectFit: "contain", background: "rgba(255,255,255,0.9)", padding: 4,
                    }} />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                      background: "linear-gradient(135deg, rgba(201,168,124,0.1) 0%, rgba(201,168,124,0.03) 100%)",
                      border: "1px solid rgba(201,168,124,0.12)", color: "var(--survey-accent)",
                    }}>{s.name[0]}</div>
                  )}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--survey-fg)" }}>{s.name}</p>
                    <p style={{ fontSize: 13, color: "var(--survey-muted-fg)", opacity: 0.4, marginTop: 1 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    </>
  )
}
