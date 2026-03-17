"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Check, RotateCcw, Plus, Users } from "lucide-react"
import { SURVEY_CONFIG } from "@/lib/survey-config"

const stagger = {
  animate: { transition: { staggerChildren: 0.15 } },
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
}

export function ThankYouScreen({
  participantName,
  onRedo,
  onAddMore,
}: {
  participantName: string
  onRedo?: () => void
  onAddMore?: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <motion.div
        className="max-w-lg w-full text-center"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {/* Success icon */}
        <motion.div
          variants={fadeUp}
          className="flex items-center justify-center mb-6"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(34, 197, 94, 0.15)" }}
          >
            <Check
              className="w-8 h-8"
              style={{ color: "var(--survey-success)" }}
              strokeWidth={2.5}
            />
          </div>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-3xl sm:text-4xl font-semibold mb-4"
          style={{
            color: "var(--survey-fg)",
            fontFamily: "var(--font-survey-display), serif",
          }}
        >
          Thanks, {participantName}!
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="text-lg mb-2"
          style={{ color: "var(--survey-muted-fg)" }}
        >
          {SURVEY_CONFIG.thankYou.message}
        </motion.p>

        <motion.p
          variants={fadeUp}
          className="text-base mb-10"
          style={{ color: "var(--survey-muted)" }}
        >
          {SURVEY_CONFIG.thankYou.subtitle}
        </motion.p>

        {/* Action buttons */}
        {(onRedo || onAddMore) && (
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center gap-3 mb-10"
          >
            {onRedo && (
              <button
                onClick={onRedo}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--survey-muted-fg)",
                  cursor: "pointer",
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Redo survey
              </button>
            )}
            {onAddMore && (
              <button
                onClick={onAddMore}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: "rgba(201, 168, 124, 0.1)",
                  border: "1px solid rgba(201, 168, 124, 0.2)",
                  color: "var(--survey-accent)",
                  cursor: "pointer",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add more ideas
              </button>
            )}
          </motion.div>
        )}

        {/* View participants link */}
        <motion.div variants={fadeUp} className="mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm transition-colors duration-200 justify-center"
            style={{ color: "var(--survey-muted-fg)", opacity: 0.6 }}
          >
            <Users className="w-3.5 h-3.5" />
            View all participants
          </Link>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full"
            style={{
              color: "var(--survey-accent)",
              background: "rgba(201, 168, 124, 0.1)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: "var(--survey-accent)" }}
            />
            {SURVEY_CONFIG.brandName}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
