"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Mic } from "lucide-react"

export function TextModeScreen({
  questions,
  participantName,
  onSubmit,
  onSwitchToVoice,
}: {
  questions: { id: string; text: string }[]
  participantName: string
  onSubmit: (answers: Record<string, string>) => void
  onSwitchToVoice: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const current = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1
  const progress = ((currentIndex) / questions.length) * 100

  useEffect(() => {
    inputRef.current?.focus()
  }, [currentIndex])

  function handleNext() {
    if (!inputValue.trim() || !current) return
    const updated = { ...answers, [current.id]: inputValue.trim() }
    setAnswers(updated)
    setInputValue("")

    if (isLast) {
      onSubmit(updated)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleNext()
    }
  }

  if (!current) return null

  return (
    <div className="relative flex h-full flex-col">
      <div className="ambient-bg" style={{ zIndex: 0 }}>
        <div className="ambient-orb-3" />
      </div>
      <div className="grain-overlay" />

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-8 py-3"
        style={{
          background: "rgba(6, 6, 10, 0.5)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--survey-muted-fg)" }}>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <button
          onClick={onSwitchToVoice}
          className="flex items-center gap-1.5 text-xs transition-colors duration-200"
          style={{ color: "var(--survey-accent)", opacity: 0.7, background: "none", border: "none", cursor: "pointer" }}
        >
          <Mic className="w-3 h-3" />
          Switch to voice
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.04)" }}>
        <motion.div
          style={{
            height: "100%",
            background: "var(--survey-accent)",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Question + input */}
      <div className="relative z-[2] flex-1 flex flex-col items-center justify-center px-8 max-w-2xl mx-auto w-full">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--survey-accent)",
              opacity: 0.7,
              marginBottom: 16,
            }}
          >
            Question {currentIndex + 1}
          </p>

          <p
            className="mb-10"
            style={{
              fontSize: 22,
              lineHeight: 1.5,
              color: "var(--survey-fg)",
              fontFamily: "var(--font-survey-display), serif",
            }}
          >
            {current.text}
          </p>

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Hi ${participantName}, type your answer here...`}
            rows={3}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "2px solid var(--survey-border)",
              color: "var(--survey-fg)",
              fontSize: 18,
              lineHeight: 1.6,
              padding: "12px 0",
              resize: "none",
              outline: "none",
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) =>
              (e.target.style.borderBottomColor = "var(--survey-accent)")
            }
            onBlur={(e) =>
              (e.target.style.borderBottomColor = "var(--survey-border)")
            }
          />

          <div className="flex items-center justify-between mt-8">
            <span
              style={{
                fontSize: 12,
                color: "var(--survey-muted-fg)",
                opacity: 0.4,
              }}
            >
              {"\u2318"} + Enter to submit
            </span>

            <button
              onClick={handleNext}
              disabled={!inputValue.trim()}
              className="btn-premium flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200"
              style={{
                background: inputValue.trim()
                  ? "var(--survey-accent)"
                  : "rgba(255,255,255,0.06)",
                color: inputValue.trim()
                  ? "var(--survey-bg)"
                  : "var(--survey-muted-fg)",
                cursor: inputValue.trim() ? "pointer" : "not-allowed",
                opacity: inputValue.trim() ? 1 : 0.5,
              }}
            >
              {isLast ? "Submit" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
