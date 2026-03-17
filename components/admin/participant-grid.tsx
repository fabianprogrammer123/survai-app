"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { ParticipantDialog } from "./participant-dialog"
import { ResponseDetail } from "./response-detail"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"
import type { Participant } from "@/lib/types"

/* ── Types ──────────────────────────────────────────────── */

type ParticipantWithResponse = Participant & {
  responses: { id: string; created_at: string }[] | null
}

interface Experience {
  company?: string
  title?: string
  description?: string
  starts_at?: { year: number; month?: number }
  ends_at?: { year: number; month?: number } | null
  logo_url?: string
}

interface Education {
  school?: string
  degree_name?: string
  field_of_study?: string
  starts_at?: { year: number }
  ends_at?: { year: number } | null
  logo_url?: string
}

/* ── Hooks ──────────────────────────────────────────────── */

function useCyclingPlaceholder(examples: string[], intervalMs = 4000) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % examples.length),
      intervalMs,
    )
    return () => clearInterval(id)
  }, [examples.length, intervalMs])
  return examples[index]
}

/* ── Helpers ─────────────────────────────────────────────── */

function getCurrentRole(exps: unknown) {
  const arr = exps as Experience[] | null
  if (!arr?.length) return null
  const current = arr.find((e) => !e.ends_at) || arr[0]
  if (!current.title && !current.company) return null
  return { title: current.title || "", company: current.company || "" }
}

function getTopSchool(edu: unknown) {
  const arr = edu as Education[] | null
  return arr?.[0]?.school || null
}

function formatRange(
  starts_at?: { year: number; month?: number },
  ends_at?: { year: number; month?: number } | null,
) {
  if (!starts_at) return null
  return `${starts_at.year} \u2014 ${ends_at ? ends_at.year : "Present"}`
}

function getSearchableText(p: ParticipantWithResponse): string {
  const exps = (p.experiences as Experience[] | null) || []
  const edus = (p.education as Education[] | null) || []
  return [
    p.name,
    p.first_name,
    p.last_name,
    p.headline,
    p.summary,
    p.industry,
    p.city,
    p.country_full_name,
    p.occupation,
    p.company,
    p.job_title,
    ...exps.map((e) => `${e.title || ""} ${e.company || ""}`),
    ...edus.map((e) => e.school || ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function isSimpleQuery(q: string): boolean {
  const words = q.trim().toLowerCase().split(/\s+/)
  return (
    words.length <= 2 && words.every((w) => /^[a-z\u00C0-\u024F'-]+$/i.test(w))
  )
}

function inferTags(p: ParticipantWithResponse): string[] {
  const tags: Set<string> = new Set()
  const exps = (p.experiences as Experience[] | null) || []
  const allText = [
    p.headline,
    p.occupation,
    p.industry,
    p.job_title,
    p.company,
    ...exps.flatMap((e) => [e.title, e.company]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (/\b(co-?founder|founder|ceo|chief executive)\b/i.test(allText)) {
    tags.add("founder")
    tags.add("entrepreneur")
    tags.add("startup")
  }
  if (/\b(serial entrepreneur|built|started|launched)\b/i.test(allText)) {
    tags.add("serial entrepreneur")
    tags.add("founder")
  }

  const vcFirms =
    /\b(capital|ventures?|partners|sequoia|a16z|andreessen|accel|benchmark|greylock|index|lightspeed|tiger global|softbank|ycombinator|y combinator|500 startups|techstars|kleiner|khosla|general catalyst|insight partners|bessemer|ivp|gv |nea |lux capital)\b/i
  const investorTitles =
    /\b(investor|venture|vc|partner|principal|associate|analyst)\b/i
  if (
    vcFirms.test(allText) ||
    (investorTitles.test(allText) &&
      /\b(fund|capital|ventures?|invest)\b/i.test(allText))
  ) {
    tags.add("investor")
    tags.add("VC")
    tags.add("venture capital")
  }
  if (/\b(angel investor|angel|lp|limited partner)\b/i.test(allText)) {
    tags.add("investor")
    tags.add("angel investor")
  }

  if (
    /\b(goldman|morgan stanley|jp morgan|jpmorgan|barclays|citi|ubs|credit suisse|deutsche bank|lazard|evercore|rothschild|investment bank)\b/i.test(
      allText,
    )
  ) {
    tags.add("finance")
    tags.add("banking")
  }
  if (/\b(private equity|pe |buyout|hedge fund)\b/i.test(allText)) {
    tags.add("finance")
    tags.add("private equity")
  }

  if (
    /\b(mckinsey|bain|bcg|boston consulting|deloitte|pwc|kpmg|ey |ernst|accenture|oliver wyman|roland berger)\b/i.test(
      allText,
    )
  ) {
    tags.add("consultant")
    tags.add("management consulting")
  }
  if (/\b(consult|advisor|advisory)\b/i.test(allText)) {
    tags.add("consultant")
    tags.add("advisor")
  }

  if (
    /\b(engineer|developer|software|swe|sde|cto|tech lead|architect|devops|full.?stack|back.?end|front.?end)\b/i.test(
      allText,
    )
  ) {
    tags.add("technical")
    tags.add("engineer")
  }
  if (
    /\b(machine learning|deep learning|ai |artificial intelligence|nlp|computer vision|data scien|ml engineer)\b/i.test(
      allText,
    )
  ) {
    tags.add("AI/ML")
    tags.add("technical")
  }

  if (
    /\b(product manager|pm |product lead|product director|head of product|cpo)\b/i.test(
      allText,
    )
  ) {
    tags.add("product")
  }
  if (/\b(design|ux|ui|creative director|art director)\b/i.test(allText)) {
    tags.add("design")
  }

  if (
    /\b(ceo|cto|cfo|coo|cmo|cpo|chief|vp |vice president|svp|evp|director|head of|managing director)\b/i.test(
      allText,
    )
  ) {
    tags.add("executive")
    tags.add("leadership")
  }

  if (
    /\b(professor|phd|ph\.d|researcher|postdoc|academic|fellow|lecturer)\b/i.test(
      allText,
    )
  ) {
    tags.add("academic")
    tags.add("researcher")
  }

  if (
    /\b(lawyer|attorney|counsel|legal|law firm|juris|j\.d)\b/i.test(allText)
  ) {
    tags.add("legal")
  }

  if (
    /\b(doctor|md|physician|medical|health|biotech|pharma|therapeutic|clinical|hospital|healthcare)\b/i.test(
      allText,
    )
  ) {
    tags.add("healthcare")
    tags.add("biotech")
  }

  if (
    /\b(head of|director|vp|manager).*(operations|growth|marketing|sales|revenue|business dev)\b/i.test(
      allText,
    )
  ) {
    tags.add("potential customer")
    tags.add("business leader")
  }

  if (p.survey_completed) tags.add("completed survey")
  else tags.add("pending survey")

  return [...tags]
}

interface ProfileSummary {
  id: string
  name: string
  headline: string | null
  occupation: string | null
  industry: string | null
  city: string | null
  country: string | null
  experiences: string[]
  education: string[]
  tags?: string[]
}

function buildProfileSummaries(
  participants: ParticipantWithResponse[],
): ProfileSummary[] {
  return participants.map((p) => {
    const exps = (p.experiences as Experience[] | null) || []
    const edus = (p.education as Education[] | null) || []
    const tags = inferTags(p)
    return {
      id: p.id,
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.name || "Unknown",
      headline: p.headline,
      occupation: p.occupation || p.job_title,
      industry: p.industry,
      city: p.city,
      country: p.country_full_name,
      experiences: exps
        .slice(0, 3)
        .map((e) => `${e.title || ""} at ${e.company || ""}`)
        .filter((s) => s.trim() !== "at"),
      education: edus
        .slice(0, 3)
        .map((e) => e.school || "")
        .filter(Boolean),
      tags: tags.length > 0 ? tags : undefined,
    }
  })
}

/* ── Suggestion data ─────────────────────────────────────── */

const AI_SUGGESTIONS = [
  { label: "Completed surveys", icon: "\u2705" },
  { label: "Startup founders", icon: "\uD83D\uDE80" },
  { label: "Technical backgrounds", icon: "\uD83D\uDCBB" },
  { label: "Investors & VCs", icon: "\uD83D\uDCB0" },
  { label: "Consultants & advisors", icon: "\uD83D\uDCCA" },
  { label: "Healthcare & biotech", icon: "\uD83E\uDDEC" },
]

const PLACEHOLDER_EXAMPLES = [
  "Who are the startup founders?",
  "Find investors or VCs",
  "People with technical backgrounds",
  "Who completed their survey?",
  "Consultants and advisors",
  "People from California",
]

/* ══════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════ */

export function ParticipantGrid() {
  const [participants, setParticipants] = useState<ParticipantWithResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [aiResults, setAiResults] = useState<string[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedParticipant, setSelectedParticipant] =
    useState<ParticipantWithResponse | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const placeholder = useCyclingPlaceholder(PLACEHOLDER_EXAMPLES)

  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/participants")
      if (res.ok) setParticipants(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  const searchIndex = useMemo(
    () =>
      participants.map((p) => ({ profile: p, text: getSearchableText(p) })),
    [participants],
  )
  const profileSummaries = useMemo(
    () => buildProfileSummaries(participants),
    [participants],
  )

  const clientFiltered = useMemo(() => {
    if (!query.trim()) return participants
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0)
    return searchIndex
      .filter((e) => terms.every((t) => e.text.includes(t)))
      .map((e) => e.profile)
  }, [query, participants, searchIndex])

  const runAiSearch = useCallback(
    async (q: string) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setIsSearching(true)
      try {
        const res = await fetch("/api/admin/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, profiles: profileSummaries }),
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error("Search failed")
        const { ids } = await res.json()
        if (!ctrl.signal.aborted) setAiResults(ids)
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("AI search error:", err)
          setAiResults(null)
        }
      } finally {
        if (!ctrl.signal.aborted) setIsSearching(false)
      }
    },
    [profileSummaries],
  )

  useEffect(() => {
    clearTimeout(debounceRef.current)
    setAiResults(null)
    if (!query.trim()) {
      setIsSearching(false)
      return
    }
    if (isSimpleQuery(query) && clientFiltered.length > 0) {
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(() => runAiSearch(query), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query, runAiSearch, clientFiltered.length])

  const filtered = useMemo(() => {
    if (!query.trim()) return participants
    if (aiResults) {
      const map = new Map(participants.map((p) => [p.id, p]))
      return aiResults.filter((id) => map.has(id)).map((id) => map.get(id)!)
    }
    return clientFiltered
  }, [query, participants, aiResults, clientFiltered])

  const isAiPowered = aiResults !== null && query.trim().length > 0

  function openDetail(p: ParticipantWithResponse) {
    setSelectedParticipant(p)
    setSheetOpen(true)
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  function getSurveyUrl(slug: string) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/survey/${slug}`
    }
    return `/survey/${slug}`
  }

  const displayName = (p: ParticipantWithResponse) =>
    `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.name || "Unknown"

  return (
    <div className="liquid-glass-theme min-h-full" style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
      {/* Ambient background */}
      <div className="lg-ambient-bg">
        <div className="lg-ambient-orb-3" />
      </div>
      <div className="lg-grain-overlay" />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh" }}>
        {/* ── Header ── */}
        <header style={{ maxWidth: 1160, margin: "0 auto", padding: "48px 40px 0" }}>
          {/* Title row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 32,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 36,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  color: "#eeebe5",
                  marginBottom: 6,
                }}
              >
                Participants
              </h1>
              <p style={{ fontSize: 14, color: "#9c9ca4", lineHeight: 1.6 }}>
                {participants.length} participant
                {participants.length !== 1 ? "s" : ""} registered
              </p>
            </div>
            <ParticipantDialog
              trigger={
                <button
                  className="lg-chip"
                  style={{
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#eeebe5",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <PlusIcon style={{ width: 15, height: 15 }} />
                  Add Participant
                </button>
              }
              onSuccess={() => {
                toast.success("Participant added")
                fetchParticipants()
              }}
            />
          </div>

          {/* Search bar */}
          <div
            className="lg-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 20px",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                color: "rgb(74, 180, 80)",
                opacity: 0.7,
                display: "flex",
                flexShrink: 0,
              }}
            >
              {isSearching ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="lg-spin"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="32"
                    strokeDashoffset="12"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              )}
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "#eeebe5",
                fontFamily: "inherit",
              }}
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9c9ca4",
                  display: "flex",
                  padding: 4,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  padding: "4px 10px",
                  borderRadius: 8,
                  flexShrink: 0,
                  background: "rgba(74, 180, 80, 0.08)",
                  color: "rgb(74, 180, 80)",
                  border: "1px solid rgba(74, 180, 80, 0.15)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 16.7l-6.2 4.5 2.4-7.3L2 9.4h7.6z" />
                </svg>
                AI
              </span>
            )}
          </div>

          {/* Hint text */}
          <p
            style={{
              fontSize: 12,
              color: "#9c9ca4",
              opacity: 0.5,
              marginBottom: 20,
              paddingLeft: 4,
            }}
          >
            Ask in natural language — search understands roles, schools, and
            intent
          </p>

          {/* Suggestion chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap" as const,
              gap: 8,
              marginBottom: 36,
            }}
          >
            {AI_SUGGESTIONS.map((s) => {
              const active = query === s.label
              return (
                <button
                  key={s.label}
                  onClick={() => setQuery(s.label)}
                  className={`lg-chip${active ? " active" : ""}`}
                  style={{
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    cursor: "pointer",
                    color: active ? "rgb(120, 220, 120)" : "#9c9ca4",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{s.icon}</span>
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Result count */}
          {query && (
            <div
              className="lg-animate-fade-in"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <span
                style={{ fontSize: 13, color: "#9c9ca4", opacity: 0.55 }}
              >
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
              {isAiPowered && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    padding: "3px 10px",
                    borderRadius: 7,
                    background: "rgba(74, 180, 80, 0.1)",
                    color: "rgb(74, 180, 80)",
                    border: "1px solid rgba(74, 180, 80, 0.15)",
                  }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 16.7l-6.2 4.5 2.4-7.3L2 9.4h7.6z" />
                  </svg>
                  AI
                </span>
              )}
            </div>
          )}

          <div className="lg-section-rule" style={{ marginBottom: 32 }} />
        </header>

        {/* ── Grid ── */}
        <main
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "0 40px 80px",
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "80px 0",
                color: "#9c9ca4",
                fontSize: 14,
              }}
            >
              Loading participants...
            </div>
          ) : participants.length === 0 && !query ? (
            <div
              style={{
                textAlign: "center",
                padding: "80px 0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(74, 180, 80, 0.06)",
                  border: "1px solid rgba(74, 180, 80, 0.12)",
                  color: "rgb(74, 180, 80)",
                }}
              >
                <PlusIcon style={{ width: 24, height: 24 }} />
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: "#9c9ca4",
                  marginBottom: 4,
                }}
              >
                No participants yet
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "#9c9ca4",
                  opacity: 0.35,
                }}
              >
                Add your first participant to get started
              </p>
            </div>
          ) : (
            <div
              className="lg-stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 14,
              }}
            >
              {filtered.map((p) => {
                const role = getCurrentRole(p.experiences) ||
                  (p.headline
                    ? { title: p.headline, company: "" }
                    : p.job_title || p.company
                      ? { title: p.job_title || "", company: p.company || "" }
                      : null)
                const school = getTopSchool(p.education)
                const name = displayName(p)

                return (
                  <button
                    key={p.id}
                    onClick={() => openDetail(p)}
                    className="lg-card lg-animate-fade-in-up"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 18,
                      padding: "20px 22px",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {/* Photo */}
                    <div style={{ flexShrink: 0 }}>
                      {p.profile_pic_url ? (
                        <img
                          src={p.profile_pic_url}
                          alt={name}
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 16,
                            objectFit: "cover" as const,
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 500,
                            background:
                              "linear-gradient(135deg, rgba(74,180,80,0.14) 0%, rgba(74,180,80,0.04) 100%)",
                            border: "1px solid rgba(74,180,80,0.18)",
                            color: "rgb(74, 180, 80)",
                          }}
                        >
                          {p.first_name?.[0]}
                          {p.last_name?.[0]}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                        position: "relative",
                        zIndex: 3,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 2,
                        }}
                      >
                        <h2
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#eeebe5",
                            lineHeight: 1.3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {name}
                        </h2>
                        {p.survey_completed ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: "0.03em",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(74, 180, 80, 0.12)",
                              color: "rgb(74, 180, 80)",
                              border: "1px solid rgba(74, 180, 80, 0.2)",
                              flexShrink: 0,
                            }}
                          >
                            Completed
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: "0.03em",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.04)",
                              color: "#9c9ca4",
                              border: "1px solid rgba(255,255,255,0.08)",
                              flexShrink: 0,
                            }}
                          >
                            Pending
                          </span>
                        )}
                      </div>
                      {role && (
                        <p
                          style={{
                            fontSize: 13,
                            color: "#9c9ca4",
                            marginTop: 3,
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {role.title}
                          {role.company && (
                            <span style={{ opacity: 0.5 }}>
                              {" "}
                              · {role.company}
                            </span>
                          )}
                        </p>
                      )}
                      {school && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "#9c9ca4",
                            opacity: 0.35,
                            marginTop: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {school}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Empty search state */}
          {filtered.length === 0 && query && !isSearching && !loading && (
            <div
              className="lg-animate-fade-in"
              style={{ textAlign: "center" as const, padding: "80px 0" }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(74, 180, 80, 0.06)",
                  border: "1px solid rgba(74, 180, 80, 0.12)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgb(74, 180, 80)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: "#9c9ca4",
                  marginBottom: 4,
                }}
              >
                No participants match that search
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "#9c9ca4",
                  opacity: 0.35,
                  marginBottom: 20,
                }}
              >
                Try a different name or question
              </p>
              <button
                onClick={() => setQuery("")}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgb(74, 180, 80)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear search
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Detail Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="!bg-[#0e0e11] !border-[rgba(255,255,255,0.07)] !text-[#eeebe5] sm:!max-w-[480px] overflow-y-auto"
        >
          {selectedParticipant && (() => {
            const sp = selectedParticipant
            const exps = (sp.experiences as Experience[] | null) || []
            const edus = (sp.education as Education[] | null) || []
            return (
              <>
                <SheetHeader className="pb-2">
                  {/* Profile photo + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                    {sp.profile_pic_url ? (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{
                          position: "absolute", inset: -6, borderRadius: "50%",
                          background: "radial-gradient(circle, rgba(74,180,80,0.12) 0%, transparent 70%)",
                          filter: "blur(12px)",
                        }} />
                        <img
                          src={sp.profile_pic_url}
                          alt={displayName(sp)}
                          style={{
                            position: "relative", width: 72, height: 72, borderRadius: 20,
                            objectFit: "cover" as const, border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 72, height: 72, borderRadius: 20, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, fontWeight: 500,
                        background: "linear-gradient(135deg, rgba(74,180,80,0.14) 0%, rgba(74,180,80,0.04) 100%)",
                        border: "1px solid rgba(74,180,80,0.18)", color: "rgb(74, 180, 80)",
                      }}>
                        {sp.first_name?.[0]}{sp.last_name?.[0]}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <SheetTitle className="!text-[#eeebe5] text-lg">
                        {displayName(sp)}
                      </SheetTitle>
                      {sp.headline && (
                        <SheetDescription className="!text-[#9c9ca4] mt-1" style={{ lineHeight: 1.45 }}>
                          {sp.headline}
                        </SheetDescription>
                      )}
                    </div>
                  </div>

                  {/* Meta pills */}
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 4 }}>
                    {sp.company && (
                      <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#9c9ca4" }}>
                        {sp.company}
                      </span>
                    )}
                    {(sp.city || sp.country_full_name) && (
                      <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#9c9ca4", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        {[sp.city, sp.country_full_name].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {sp.industry && (
                      <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#9c9ca4" }}>
                        {sp.industry}
                      </span>
                    )}
                    <span style={{
                      fontSize: 12, padding: "4px 12px", borderRadius: 10,
                      background: sp.survey_completed ? "rgba(74, 180, 80, 0.12)" : "rgba(255,255,255,0.04)",
                      border: sp.survey_completed ? "1px solid rgba(74, 180, 80, 0.2)" : "1px solid rgba(255,255,255,0.07)",
                      color: sp.survey_completed ? "rgb(74, 180, 80)" : "#9c9ca4",
                    }}>
                      {sp.survey_completed ? "Survey Completed" : "Survey Pending"}
                    </span>
                  </div>

                  {/* Action buttons row: LinkedIn + Survey link */}
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    {sp.linkedin_url && (
                      <a
                        href={sp.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 12,
                          background: "rgba(74,180,80,0.08)", color: "rgb(74, 180, 80)",
                          border: "1px solid rgba(74,180,80,0.18)", textDecoration: "none",
                          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {sp.slug && (
                      <button
                        onClick={() => copyToClipboard(getSurveyUrl(sp.slug!), "Survey link")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 12,
                          background: "rgba(255,255,255,0.03)", color: "#9c9ca4",
                          border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
                          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      >
                        <LinkIcon style={{ width: 14, height: 14 }} />
                        Copy Survey Link
                      </button>
                    )}
                  </div>
                </SheetHeader>

                <div className="px-4 pb-6" style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
                  {/* ── About ── */}
                  {sp.summary && (
                    <section style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "rgb(74, 180, 80)", whiteSpace: "nowrap" as const }}>
                          About
                        </h3>
                        <div className="lg-section-rule" style={{ flex: 1 }} />
                      </div>
                      <p style={{ fontSize: 14, color: "#eeebe5", opacity: 0.7, lineHeight: 1.75, whiteSpace: "pre-line" as const }}>
                        {sp.summary}
                      </p>
                    </section>
                  )}

                  {/* ── Experience ── */}
                  {exps.length > 0 && (
                    <section style={{ marginTop: 28 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "rgb(74, 180, 80)", whiteSpace: "nowrap" as const }}>
                          Experience
                        </h3>
                        <div className="lg-section-rule" style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                        {exps.slice(0, 5).map((exp, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex", gap: 14, padding: "12px 14px",
                              borderRadius: 14, transition: "background 0.25s ease",
                            }}
                          >
                            {exp.logo_url ? (
                              <img
                                src={exp.logo_url}
                                alt={exp.company || ""}
                                style={{
                                  width: 36, height: 36, borderRadius: 10,
                                  objectFit: "contain" as const, flexShrink: 0, marginTop: 2,
                                  background: "rgba(255,255,255,0.9)", padding: 2,
                                }}
                              />
                            ) : (
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                                background: "rgba(74,180,80,0.06)", border: "1px solid rgba(74,180,80,0.1)",
                                color: "rgb(74, 180, 80)",
                              }}>
                                {exp.company?.[0] || "?"}
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#eeebe5", lineHeight: 1.35 }}>
                                {exp.title || "Unknown Role"}
                              </p>
                              {exp.company && (
                                <p style={{ fontSize: 12, color: "#9c9ca4", marginTop: 2 }}>
                                  {exp.company}
                                </p>
                              )}
                              {exp.starts_at && (
                                <p style={{ fontSize: 11, color: "#9c9ca4", opacity: 0.45, marginTop: 3 }}>
                                  {formatRange(exp.starts_at, exp.ends_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Education ── */}
                  {edus.length > 0 && (
                    <section style={{ marginTop: 28 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "rgb(74, 180, 80)", whiteSpace: "nowrap" as const }}>
                          Education
                        </h3>
                        <div className="lg-section-rule" style={{ flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                        {edus.slice(0, 3).map((edu, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex", gap: 14, padding: "12px 14px",
                              borderRadius: 14, transition: "background 0.25s ease",
                            }}
                          >
                            {edu.logo_url ? (
                              <img
                                src={edu.logo_url}
                                alt={edu.school || ""}
                                style={{
                                  width: 36, height: 36, borderRadius: 10,
                                  objectFit: "contain" as const, flexShrink: 0, marginTop: 2,
                                  background: "rgba(255,255,255,0.9)", padding: 2,
                                }}
                              />
                            ) : (
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 2,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
                                background: "rgba(74,180,80,0.06)", border: "1px solid rgba(74,180,80,0.1)",
                                color: "rgb(74, 180, 80)",
                              }}>
                                {edu.school?.[0] || "?"}
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#eeebe5", lineHeight: 1.35 }}>
                                {edu.school || "Unknown School"}
                              </p>
                              {(edu.degree_name || edu.field_of_study) && (
                                <p style={{ fontSize: 12, color: "#9c9ca4", marginTop: 2 }}>
                                  {[edu.degree_name, edu.field_of_study].filter(Boolean).join(", ")}
                                </p>
                              )}
                              {edu.starts_at && (
                                <p style={{ fontSize: 11, color: "#9c9ca4", opacity: 0.45, marginTop: 3 }}>
                                  {formatRange(edu.starts_at, edu.ends_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Survey Response ── */}
                  {sp.survey_completed && (
                    <section style={{ marginTop: 28 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "rgb(74, 180, 80)", whiteSpace: "nowrap" as const }}>
                          Survey Response
                        </h3>
                        <div className="lg-section-rule" style={{ flex: 1 }} />
                      </div>
                      <ResponseDetail participantId={sp.id} />
                    </section>
                  )}
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
