"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Sparkles } from "lucide-react"

type QuestionStatus = "upcoming" | "active" | "complete"

interface QuestionState {
  id: string
  question: string
  answer: string
  status: QuestionStatus
}

export function LiveQuestionnaire({
  questions,
  answers,
  isConnected,
  isOver,
}: {
  questions: { id: string; text: string }[]
  answers: Record<string, string>
  isConnected: boolean
  isOver: boolean
}) {
  const [questionStates, setQuestionStates] = useState<QuestionState[]>(
    questions.map((q) => ({
      id: q.id,
      question: q.text,
      answer: "",
      status: "upcoming",
    })),
  )

  useEffect(() => {
    setQuestionStates((prev) => {
      const next = prev.map((qs, i) => {
        const answer = answers[qs.id]
        if (answer) {
          return { ...qs, answer, status: "complete" as const }
        }
        // First unanswered question becomes active when connected
        if (isConnected && qs.status !== "complete") {
          const allPreviousComplete = prev
            .slice(0, i)
            .every((p) => answers[p.id])
          if (allPreviousComplete) {
            return { ...qs, status: "active" as const }
          }
        }
        return { ...qs, status: qs.answer ? "complete" as const : "upcoming" as const }
      })
      if (isOver) {
        return next.map((qs) =>
          qs.answer ? { ...qs, status: "complete" as const } : qs,
        )
      }
      return next
    })
  }, [answers, isConnected, isOver])

  const answeredCount = questionStates.filter((q) => q.status === "complete").length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--survey-accent)",
            }}
          >
            Agent-managed Questionnaire
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--survey-muted-fg)",
              opacity: 0.5,
            }}
          >
            {answeredCount} / {questions.length}
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            height: 2,
            borderRadius: 1,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <motion.div
            style={{
              height: "100%",
              borderRadius: 1,
              background: "var(--survey-accent)",
            }}
            animate={{
              width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
            }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Question list */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="flex flex-col gap-1">
          {questionStates.map((qs, i) => (
            <QuestionRow key={qs.id} index={i} state={qs} />
          ))}
        </div>
      </div>
    </div>
  )
}

function QuestionRow({
  index,
  state,
}: {
  index: number
  state: QuestionState
}) {
  const isComplete = state.status === "complete"
  const isActive = state.status === "active"

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        borderRadius: 14,
        padding: "16px 18px",
        position: "relative",
        transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        background: isActive
          ? "rgba(201, 168, 124, 0.05)"
          : "transparent",
        borderLeft: isActive
          ? "2px solid var(--survey-accent)"
          : isComplete
            ? "2px solid rgba(34, 197, 94, 0.4)"
            : "2px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* Question number + text */}
      <div className="flex items-start gap-3">
        {/* Number / check circle */}
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            marginTop: 1,
            fontSize: 12,
            fontWeight: 700,
            background: isComplete
              ? "rgba(34, 197, 94, 0.12)"
              : isActive
                ? "rgba(201, 168, 124, 0.12)"
                : "rgba(255, 255, 255, 0.04)",
            color: isComplete
              ? "rgba(34, 197, 94, 0.8)"
              : isActive
                ? "var(--survey-accent)"
                : "var(--survey-muted-fg)",
            border: isComplete
              ? "1px solid rgba(34, 197, 94, 0.2)"
              : isActive
                ? "1px solid rgba(201, 168, 124, 0.2)"
                : "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {isComplete ? (
            <Check className="w-3 h-3" strokeWidth={3} />
          ) : (
            index + 1
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Question text */}
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--survey-fg)",
              opacity: isActive ? 1 : isComplete ? 0.75 : 0.45,
              transition: "opacity 0.3s ease",
            }}
          >
            {state.question}
          </p>

          {/* Answer */}
          <AnimatePresence>
            {state.answer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--survey-fg)",
                    opacity: 0.7,
                    marginTop: 10,
                    paddingLeft: 0,
                  }}
                >
                  {state.answer}
                </p>
                {isComplete && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 8,
                    }}
                  >
                    <Sparkles
                      className="w-3 h-3"
                      style={{ color: "rgba(34,197,94,0.6)" }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "rgba(34,197,94,0.6)",
                      }}
                    >
                      Summarized by AI
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
