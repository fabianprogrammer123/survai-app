"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { WelcomeScreen } from "./welcome-screen"
import { ConversationScreen } from "./conversation-screen"
import { TextModeScreen } from "./text-mode-screen"
import { ThankYouScreen } from "./thank-you-screen"
import type { TranscriptEntry } from "@/hooks/use-conversation-logger"

type Screen = "welcome" | "conversation" | "text" | "thanks"

const slideVariants = {
  enter: { y: "100%", opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: "-100%", opacity: 0 },
}

interface SurveyFlowProps {
  participant: { id: string; first_name: string; last_name: string }
  questions: { id: string; text: string }[]
  slug: string
}

export function SurveyFlow({
  participant,
  questions,
  slug,
}: SurveyFlowProps) {
  const [screen, setScreen] = useState<Screen>("welcome")
  // No token pre-loading — tokens are short-lived (10-15 min) and fetched
  // fresh at connection time to avoid expiry issues

  // Accumulate answers across sessions (for "add more ideas")
  const accumulatedAnswers = useRef<Record<string, string>>({})
  // Session counter forces ConversationScreen remount for fresh sessions
  const [sessionKey, setSessionKey] = useState(0)

  const saveToBackend = useCallback(
    async (
      transcriptText: string,
      answers: Record<string, string>,
      conversationId: string | null,
    ) => {
      try {
        const res = await fetch(`/api/survey/${slug}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: transcriptText,
            answers,
            conversation_id: conversationId,
          }),
        })
        if (!res.ok) {
          console.error("Failed to save survey:", await res.text())
        }
      } catch (err) {
        console.error("Failed to save survey:", err)
      }
    },
    [slug],
  )

  const handleConversationEnd = useCallback(
    async (
      conversationId: string | null,
      transcriptEntries: TranscriptEntry[],
      answers: Record<string, string>,
    ) => {
      // Merge new answers with accumulated ones
      accumulatedAnswers.current = {
        ...accumulatedAnswers.current,
        ...answers,
      }

      // Filter out any tentative (unconfirmed) entries before saving
      const confirmedEntries = transcriptEntries.filter((e) => !e.tentative)
      const transcriptText = confirmedEntries
        .map(
          (entry) =>
            `${entry.role === "user" ? "Participant" : "Interviewer"}: ${entry.text}`,
        )
        .join("\n")

      await saveToBackend(
        transcriptText,
        accumulatedAnswers.current,
        conversationId,
      )
      setScreen("thanks")
    },
    [saveToBackend],
  )

  const handleTextSubmit = useCallback(
    async (answers: Record<string, string>) => {
      accumulatedAnswers.current = {
        ...accumulatedAnswers.current,
        ...answers,
      }
      await saveToBackend("", accumulatedAnswers.current, null)
      setScreen("thanks")
    },
    [saveToBackend],
  )

  const handleAddMore = useCallback(() => {
    setSessionKey((k) => k + 1)
    setScreen("conversation")
  }, [])

  const firstName = participant.first_name || "there"

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          {screen === "welcome" && (
            <WelcomeScreen
              participantName={firstName}
              onStart={() => setScreen("conversation")}
              onTextMode={() => setScreen("text")}
            />
          )}
          {screen === "conversation" && (
            <ConversationScreen
              key={sessionKey}
              questions={questions}
              participantName={firstName}
              onEnd={handleConversationEnd}
              onSwitchToText={() => setScreen("text")}
              previousAnswers={accumulatedAnswers.current}
            />
          )}
          {screen === "text" && (
            <TextModeScreen
              questions={questions}
              participantName={firstName}
              onSubmit={handleTextSubmit}
              onSwitchToVoice={() => setScreen("conversation")}
            />
          )}
          {screen === "thanks" && (
            <ThankYouScreen
              participantName={firstName}
              onRedo={() => {
                accumulatedAnswers.current = {}
                setSessionKey((k) => k + 1)
                setScreen("welcome")
              }}
              onAddMore={handleAddMore}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
