"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PhoneOff,
  Type,
  Wifi,
  WifiOff,
  Clock,
  RotateCcw,
  ArrowRight,
} from "lucide-react"
import { useConversationLogger } from "@/hooks/use-conversation-logger"
import type { TranscriptEntry } from "@/hooks/use-conversation-logger"
import { useScribeLive } from "@/hooks/use-scribe-live"
import dynamic from "next/dynamic"
import type { AgentState } from "@/components/ui/orb"

// Lazy-load the Three.js Orb to avoid SSR issues
const Orb = dynamic(
  () => import("@/components/ui/orb").then((mod) => mod.Orb),
  { ssr: false },
)
import { TranscriptDisplay } from "./transcript-display"
import { LiveQuestionnaire } from "./live-questionnaire"

export function ConversationScreen({
  questions,
  participantName,
  onEnd,
  onSwitchToText,
  previousAnswers,
}: {
  questions: { id: string; text: string }[]
  participantName: string
  onEnd: (
    conversationId: string | null,
    transcript: TranscriptEntry[],
    answers: Record<string, string>,
  ) => void
  onSwitchToText?: () => void
  previousAnswers?: Record<string, string>
}) {
  const [isEnding, setIsEnding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [mobileTab, setMobileTab] = useState<"conversation" | "questions">(
    "conversation",
  )

  const {
    transcript,
    pendingAgentMessage,
    agentMode,
    connectionStatus,
    vadScore,
    error,
    startTime,
    isConversationOver,
    answers,
    tentativeUserText,
    revealedCharCount,
    upsertTentativeUserEntry,
    setVolume,
    getInputVolume,
    getOutputVolume,
    getTranscript,
    getConversationId,
    startSession,
    endSession,
  } = useConversationLogger({
    questions,
    participantName,
    previousAnswers,
  })

  // Smooth volume ramping for audio ducking
  const volumeRef = useRef(1.0)
  const volumeTargetRef = useRef(1.0)
  const volumeRafRef = useRef<number | null>(null)

  const smoothDuck = useCallback(
    (target: number, speed: number) => {
      volumeTargetRef.current = target
      if (volumeRafRef.current) return // already animating

      const step = () => {
        const diff = volumeTargetRef.current - volumeRef.current
        if (Math.abs(diff) < 0.01) {
          volumeRef.current = volumeTargetRef.current
          setVolume({ volume: volumeRef.current })
          volumeRafRef.current = null
          return
        }
        volumeRef.current += diff * speed
        setVolume({ volume: volumeRef.current })
        volumeRafRef.current = requestAnimationFrame(step)
      }
      volumeRafRef.current = requestAnimationFrame(step)
    },
    [setVolume],
  )

  // Parallel Scribe for live user transcription + audio ducking
  const {
    liveText: scribeLiveText,
    start: startScribe,
    stop: stopScribe,
  } = useScribeLive({
    onSpeakingStart: () => {
      // Fast duck-down (~50ms effective) to 25% volume
      smoothDuck(0.25, 0.25)
    },
    onSpeakingEnd: () => {
      // Slow duck-up (~500ms effective) back to 100%
      smoothDuck(1.0, 0.06)
    },
  })

  // Wire Scribe live text into the transcript as a tentative entry
  useEffect(() => {
    const text = scribeLiveText ?? tentativeUserText?.text ?? null
    upsertTentativeUserEntry(text)
  }, [scribeLiveText, tentativeUserText, upsertTentativeUserEntry])

  // Auto-connect on mount
  const connect = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      console.error("Microphone access denied")
      return
    }

    try {
      // Start both WebRTC conversation and Scribe transcription
      await Promise.all([startSession(), startScribe()])
    } catch (err) {
      console.error("Connection failed:", err)
    }
  }, [startSession, startScribe])

  // Connect immediately on mount + cleanup Scribe on unmount
  useEffect(() => {
    connect()
    return () => {
      stopScribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Elapsed timer
  useEffect(() => {
    if (connectionStatus !== "connected") return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [connectionStatus, startTime])

  // Clean up rAF on unmount
  useEffect(() => {
    return () => {
      if (volumeRafRef.current) cancelAnimationFrame(volumeRafRef.current)
    }
  }, [])

  const handleEnd = useCallback(async () => {
    setIsEnding(true)
    stopScribe()
    await endSession()
  }, [endSession, stopScribe])

  const handleFinish = useCallback(() => {
    const trans = getTranscript()
    const convId = getConversationId()
    onEnd(convId, trans, answers)
  }, [onEnd, getTranscript, getConversationId, answers])

  const handleRetry = useCallback(() => {
    connect()
  }, [connect])

  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const showDoneButton = isConversationOver && transcript.length > 0
  const showError =
    error ||
    (connectionStatus === "disconnected" &&
      !isConversationOver &&
      !isEnding &&
      elapsed > 0)

  return (
    <div className="relative flex flex-col h-full">
      {/* Ambient background */}
      <div className="ambient-bg" style={{ zIndex: 0 }}>
        <div className="ambient-orb-3" />
      </div>
      <div className="grain-overlay" />

      {/* Status bar */}
      <div
        className="relative z-10 flex items-center justify-between px-8 py-3"
        style={{
          background: "rgba(6, 6, 10, 0.5)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {connectionStatus === "connected" ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : connectionStatus === "connecting" ? (
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Wifi className="w-3.5 h-3.5" style={{ color: "var(--survey-accent)" }} />
              </motion.div>
            ) : (
              <WifiOff className="w-3.5 h-3.5" style={{ color: "var(--survey-muted-fg)", opacity: 0.5 }} />
            )}
            <span
              className="text-xs capitalize"
              style={{ color: "var(--survey-muted-fg)" }}
            >
              {connectionStatus}
            </span>
          </div>
          {connectionStatus === "connected" && (
            <div
              className="flex items-center gap-1.5 text-xs tabular-nums"
              style={{ color: "var(--survey-muted-fg)", opacity: 0.6 }}
            >
              <Clock className="w-3 h-3" />
              {formatElapsed(elapsed)}
            </div>
          )}
        </div>
        <span
          className="text-[10px] tracking-[0.15em] uppercase font-medium"
          style={{ color: "var(--survey-muted-fg)", opacity: 0.4 }}
        >
          Voice Questionnaire
        </span>
      </div>

      {/* Mobile tab switcher */}
      <div
        className="flex lg:hidden"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        {(["conversation", "questions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            style={{
              flex: 1,
              padding: "12px 0",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.03em",
              textAlign: "center",
              transition: "all 0.25s ease",
              color:
                mobileTab === tab
                  ? "var(--survey-accent)"
                  : "var(--survey-muted-fg)",
              borderBottom:
                mobileTab === tab
                  ? "2px solid var(--survey-accent)"
                  : "2px solid transparent",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main split layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative z-[2]">
        {/* LEFT PANEL */}
        <div
          className={`flex flex-col lg:w-[45%] ${mobileTab !== "conversation" ? "hidden lg:flex" : "flex"}`}
          style={{ position: "relative" }}
        >
          {/* Vertical separator */}
          <div
            className="hidden lg:block"
            style={{
              position: "absolute",
              right: 0,
              top: "8%",
              bottom: "8%",
              width: 1,
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(201,168,124,0.08) 30%, rgba(201,168,124,0.12) 50%, rgba(201,168,124,0.08) 70%, transparent 100%)",
              zIndex: 5,
            }}
          />

          {/* Panel label */}
          <div className="flex-shrink-0 px-8 pt-6 pb-2 hidden lg:block">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--survey-accent)",
                  whiteSpace: "nowrap",
                }}
              >
                Voice Interaction
              </h2>
              <div className="section-rule" style={{ flex: 1 }} />
            </div>
          </div>

          {/* Transcript area */}
          <div className="flex-1 overflow-hidden min-h-0">
            {connectionStatus === "connected" || transcript.length > 0 ? (
              <TranscriptDisplay
                entries={transcript}
                pendingAgentMessage={pendingAgentMessage}
                revealedCharCount={revealedCharCount}
                startTime={startTime}
                vadScore={vadScore}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    color: "var(--survey-muted-fg)",
                    opacity: 0.5,
                    fontSize: 14,
                  }}
                >
                  {connectionStatus === "connecting"
                    ? "Connecting to voice agent..."
                    : "Conversation transcript"}
                </motion.p>
              </div>
            )}
          </div>

          {/* Orb + controls */}
          <div
            className="flex-shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex flex-col items-center py-8 gap-6">
              <AnimatePresence mode="popLayout">
                {showDoneButton ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="text-center px-8 max-w-sm mx-auto"
                  >
                    <p
                      className="text-base mb-2"
                      style={{
                        fontFamily: "var(--font-survey-display), serif",
                        fontWeight: 500,
                        fontSize: 18,
                        color: "var(--survey-fg)",
                      }}
                    >
                      Thanks for taking the time!
                    </p>
                    <p
                      className="text-sm mb-6"
                      style={{ color: "var(--survey-muted-fg)", opacity: 0.6 }}
                    >
                      Your responses are being saved.
                    </p>
                    <button
                      onClick={handleFinish}
                      className="liquid-card"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 28px",
                        fontSize: 14,
                        fontWeight: 600,
                        background: "rgba(201,168,124,0.12)",
                        color: "var(--survey-accent)",
                        border: "1px solid rgba(201,168,124,0.2)",
                        borderRadius: 14,
                        cursor: "pointer",
                      }}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : showError ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="text-center px-8"
                  >
                    <div
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.15)",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-red-400 text-sm">
                        {error || "Connection lost"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 items-center">
                      <button
                        onClick={handleRetry}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 22px",
                          fontSize: 13,
                          fontWeight: 600,
                          background: "rgba(201,168,124,0.12)",
                          color: "var(--survey-accent)",
                          border: "1px solid rgba(201,168,124,0.2)",
                          borderRadius: 12,
                          cursor: "pointer",
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Try again
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="orb"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div style={{ width: 160, height: 160 }}>
                      <Orb
                        colors={["#e0cba8", "#c9a87c"]}
                        agentState={
                          connectionStatus === "connecting"
                            ? "thinking"
                            : agentMode === "speaking"
                              ? ("talking" as AgentState)
                              : ("listening" as AgentState)
                        }
                        getInputVolume={getInputVolume}
                        getOutputVolume={getOutputVolume}
                      />
                    </div>
                    <span
                      className="text-xs font-medium tracking-[0.2em] uppercase"
                      style={{
                        color: "var(--survey-muted-fg)",
                        opacity: 0.5,
                      }}
                    >
                      {connectionStatus === "connecting"
                        ? "Connecting"
                        : agentMode === "speaking"
                          ? "Speaking"
                          : "Listening"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              {connectionStatus === "connected" && !showDoneButton && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="flex items-center gap-3"
                >
                  {onSwitchToText && (
                    <button
                      onClick={() => {
                        endSession()
                        onSwitchToText()
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 16px",
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "var(--survey-muted-fg)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                      }}
                    >
                      <Type className="w-3.5 h-3.5" />
                      Switch to text
                    </button>
                  )}
                  <button
                    onClick={handleEnd}
                    disabled={isEnding}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: isEnding ? "not-allowed" : "pointer",
                      transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.15)",
                      color: "#f87171",
                      opacity: isEnding ? 0.4 : 1,
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                    }}
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    End conversation
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          className={`flex-1 flex flex-col overflow-hidden lg:w-[55%] ${mobileTab !== "questions" ? "hidden lg:flex" : "flex"}`}
          style={{ background: "rgba(255,255,255,0.01)" }}
        >
          <LiveQuestionnaire
            questions={questions}
            answers={answers}
            isConnected={connectionStatus === "connected"}
            isOver={isConversationOver}
          />
        </div>
      </div>
    </div>
  )
}
