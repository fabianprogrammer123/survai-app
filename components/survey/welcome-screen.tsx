"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { Mic, Type } from "lucide-react"
import { SURVEY_CONFIG } from "@/lib/survey-config"

const stagger = {
  animate: { transition: { staggerChildren: 0.14 } },
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export function WelcomeScreen({
  participantName,
  onStart,
  onTextMode,
}: {
  participantName: string
  onStart: () => void
  onTextMode: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") onStart()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onStart])
  return (
    <div className="relative flex h-full items-center justify-center px-6 overflow-hidden">
      {/* Venue image background — subtle, dark overlay */}
      <div className="absolute inset-0" aria-hidden>
        <img
          src="/venue.jpg"
          alt=""
          className="w-full h-full object-cover"
          style={{ opacity: 0.12, filter: "blur(1px) saturate(0.8)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(6,6,10,0.7) 0%, rgba(6,6,10,0.85) 50%, rgba(6,6,10,0.95) 100%)",
          }}
        />
      </div>

      {/* Warm accent glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <motion.div
          className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(201,168,124,0.06) 0%, rgba(201,168,124,0.02) 40%, transparent 70%)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>

      <motion.div
        className="relative max-w-lg w-full text-center z-10"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {/* Brand tag */}
        <motion.div variants={fadeUp} className="mb-4">
          <span
            className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase px-4 py-1.5 rounded-full"
            style={{
              color: "var(--survey-accent)",
              background: "rgba(201,168,124,0.08)",
              border: "1px solid rgba(201,168,124,0.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--survey-accent)" }}
            />
            {SURVEY_CONFIG.brandName}
          </span>
        </motion.div>

        {/* Greeting */}
        <motion.h1
          variants={fadeUp}
          className="text-4xl sm:text-5xl font-semibold mb-5 tracking-tight leading-[1.15]"
          style={{
            color: "var(--survey-fg)",
            fontFamily: "var(--font-survey-display), serif",
          }}
        >
          Hi, {participantName}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-lg sm:text-xl mb-2 leading-relaxed"
          style={{ color: "var(--survey-muted-fg)" }}
        >
          {SURVEY_CONFIG.welcome.subtitle}
        </motion.p>

        <motion.p
          variants={fadeUp}
          className="text-[15px] mb-12"
          style={{ color: "var(--survey-muted)", opacity: 0.6 }}
        >
          {SURVEY_CONFIG.welcome.description}
        </motion.p>

        {/* Privacy note */}
        <motion.div
          variants={fadeUp}
          className="mb-10 flex items-center justify-center"
        >
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl max-w-sm"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--survey-accent)", opacity: 0.6, flexShrink: 0 }}
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                color: "var(--survey-muted-fg)",
                opacity: 0.5,
              }}
            >
              {SURVEY_CONFIG.welcome.privacyNote}
            </span>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col gap-4 items-center"
        >
          {/* Voice CTA — primary */}
          <button
            onClick={onStart}
            className="btn-premium group relative flex items-center gap-3 px-9 py-4 rounded-full text-lg font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "var(--survey-accent)",
              color: "var(--survey-bg)",
              boxShadow: "0 0 40px rgba(201,168,124,0.15), 0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            <Mic className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            Start Voice Conversation
          </button>

          {/* Text CTA — secondary */}
          <button
            onClick={onTextMode}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.01]"
            style={{
              color: "var(--survey-muted-fg)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Type className="w-3.5 h-3.5" />
            Type your answers instead
          </button>
        </motion.div>

        {/* Keyboard hint */}
        <motion.p
          variants={fadeUp}
          className="text-xs mt-10 hidden sm:block tracking-wide"
          style={{ color: "var(--survey-muted)", opacity: 0.25 }}
        >
          Press Enter to start with voice
        </motion.p>
      </motion.div>
    </div>
  )
}
