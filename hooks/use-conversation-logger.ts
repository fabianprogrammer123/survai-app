"use client"

import { useState, useCallback, useRef } from "react"
import { useConversation } from "@elevenlabs/react"
import type { Mode, Status } from "@elevenlabs/react"
import { nanoid } from "nanoid"
import { SURVEY_CONFIG } from "@/lib/survey-config"

export type AgentMode = Mode
export type ConnectionStatus = Status

export interface TranscriptEntry {
  id: string
  role: "agent" | "user"
  text: string
  timestamp: number
  tentative?: boolean
}

export interface PendingAgentMessage {
  id: string
  text: string
  timestamp: number
}

export interface TentativeUserTranscript {
  text: string
  timestamp: number
}

interface UseConversationLoggerOptions {
  questions: { id: string; text: string }[]
  participantName?: string
  onAnswerUpdate?: (questionId: string, answer: string) => void
  previousAnswers?: Record<string, string>
}

export function useConversationLogger(options: UseConversationLoggerOptions) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [agentMode, setAgentMode] = useState<AgentMode>("listening")
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected")
  const [vadScore, setVadScore] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [isConversationOver, setIsConversationOver] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [tentativeUserText, setTentativeUserText] =
    useState<TentativeUserTranscript | null>(null)

  // Tentative agent response preview (shown faded before audio plays)
  const [pendingAgentMessage, setPendingAgentMessage] =
    useState<PendingAgentMessage | null>(null)
  const pendingTextRef = useRef("")
  const pendingIdRef = useRef<string | null>(null)

  // Audio-aligned character reveal tracking
  const [revealedCharCount, setRevealedCharCount] = useState(0)
  const revealedCharCountRef = useRef(0)

  const transcriptRef = useRef<TranscriptEntry[]>([])
  const conversationIdRef = useRef<string | null>(null)
  const hadMessagesRef = useRef(false)
  const tentativeUserIdRef = useRef<string | null>(null)
  const onAnswerUpdateRef = useRef(options.onAnswerUpdate)
  onAnswerUpdateRef.current = options.onAnswerUpdate

  const cleanAgentText = (text: string) =>
    text
      .replace(/\[.*?\]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()

  const addTranscriptEntry = useCallback(
    (role: "agent" | "user", text: string) => {
      const entry: TranscriptEntry = {
        id: nanoid(8),
        role,
        text: role === "agent" ? cleanAgentText(text) : text,
        timestamp: Date.now(),
      }
      setTranscript((prev) => {
        const next = [...prev, entry]
        transcriptRef.current = next
        return next
      })
      hadMessagesRef.current = true
    },
    [],
  )

  // Upsert a tentative user entry in the transcript array.
  // When text is null, removes the tentative entry (only if still tentative).
  const upsertTentativeUserEntry = useCallback((text: string | null) => {
    setTranscript((prev) => {
      if (!text) {
        // Only remove if still tentative
        if (tentativeUserIdRef.current) {
          const entry = prev.find((e) => e.id === tentativeUserIdRef.current)
          if (entry?.tentative) {
            tentativeUserIdRef.current = null
            const next = prev.filter((e) => e.id !== entry.id)
            transcriptRef.current = next
            return next
          }
        }
        return prev
      }

      // Create new tentative ID if needed
      if (
        !tentativeUserIdRef.current ||
        !prev.find(
          (e) => e.id === tentativeUserIdRef.current && e.tentative,
        )
      ) {
        tentativeUserIdRef.current = `tentative-${nanoid(4)}`
      }

      const existingIdx = prev.findIndex(
        (e) => e.id === tentativeUserIdRef.current,
      )
      if (existingIdx !== -1) {
        const updated = [...prev]
        updated[existingIdx] = { ...updated[existingIdx], text }
        transcriptRef.current = updated
        return updated
      }

      const next = [
        ...prev,
        {
          id: tentativeUserIdRef.current,
          role: "user" as const,
          text,
          timestamp: Date.now(),
          tentative: true,
        },
      ]
      transcriptRef.current = next
      return next
    })
  }, [])

  const conversation = useConversation({
    clientTools: {
      write_answer: ({
        question_id,
        answer,
      }: {
        question_id: string
        answer: string
      }) => {
        const cleanAnswer = cleanAgentText(answer)
        console.log("[write_answer] called:", { question_id, answer: cleanAnswer })
        setAnswers((prev) => ({ ...prev, [question_id]: cleanAnswer }))
        onAnswerUpdateRef.current?.(question_id, cleanAnswer)
        return "Answer recorded successfully"
      },
    },

    onConnect: ({ conversationId: convId }) => {
      console.log("[ElevenLabs] Connected via WebRTC, conversationId:", convId)
      conversationIdRef.current = convId
      setConnectionStatus("connected")
      setError(null)
    },

    onDisconnect: (details) => {
      console.log("[ElevenLabs] Disconnected:", details?.reason)
      setConnectionStatus("disconnected")
      setAgentMode("listening")
      setPendingAgentMessage(null)
      pendingTextRef.current = ""
      pendingIdRef.current = null
      if (hadMessagesRef.current) {
        setIsConversationOver(true)
      } else if (details?.reason === "error" && "message" in details) {
        setError(details.message)
      }
    },

    onMessage: (payload) => {
      const role = payload.role === "user" ? ("user" as const) : ("agent" as const)
      if (!payload.message) return
      console.log("[ElevenLabs] Message:", role, payload.message.slice(0, 60))

      if (role === "user") {
        // Try to update tentative entry in-place (smooth transition, no remount)
        setTranscript((prev) => {
          const tentativeIdx = prev.findIndex(
            (e) =>
              e.id === tentativeUserIdRef.current && e.tentative,
          )
          if (tentativeIdx !== -1) {
            const updated = [...prev]
            updated[tentativeIdx] = {
              ...updated[tentativeIdx],
              text: payload.message,
              tentative: false,
            }
            tentativeUserIdRef.current = null
            transcriptRef.current = updated
            hadMessagesRef.current = true
            return updated
          }
          // No tentative entry — append normally
          const entry: TranscriptEntry = {
            id: nanoid(8),
            role: "user",
            text: payload.message,
            timestamp: Date.now(),
          }
          const next = [...prev, entry]
          transcriptRef.current = next
          hadMessagesRef.current = true
          return next
        })
        setTentativeUserText(null)
      } else {
        addTranscriptEntry("agent", payload.message)
        // Final agent message arrived — clear preview, reset alignment counter
        setPendingAgentMessage(null)
        pendingTextRef.current = ""
        pendingIdRef.current = null
        revealedCharCountRef.current = 0
        setRevealedCharCount(0)
      }
    },

    // Tentative agent response — show as faded preview before audio
    onAgentChatResponsePart: (part) => {
      if (part.type === "start") {
        const id = nanoid(8)
        pendingIdRef.current = id
        pendingTextRef.current = part.text || ""
        revealedCharCountRef.current = 0
        setRevealedCharCount(0)
        setPendingAgentMessage({
          id,
          text: cleanAgentText(part.text),
          timestamp: Date.now(),
        })
      } else if (part.type === "delta") {
        pendingTextRef.current += part.text || ""
        const currentId = pendingIdRef.current || nanoid(8)
        if (!pendingIdRef.current) pendingIdRef.current = currentId
        setPendingAgentMessage({
          id: currentId,
          text: cleanAgentText(pendingTextRef.current),
          timestamp: Date.now(),
        })
      }
    },

    // Audio alignment — tracks how many characters have been spoken
    onAudioAlignment: (alignment) => {
      if (alignment.chars && alignment.chars.length > 0) {
        revealedCharCountRef.current += alignment.chars.length
        setRevealedCharCount(revealedCharCountRef.current)
      }
    },

    onModeChange: ({ mode }) => {
      setAgentMode(mode)
    },

    onStatusChange: ({ status }) => {
      setConnectionStatus(status)
    },

    onError: (message: string) => {
      console.error("[ElevenLabs] Error:", message)
      setError(message)
    },

    onVadScore: ({ vadScore: score }) => {
      setVadScore(score)
    },

    onInterruption: () => {
      setPendingAgentMessage(null)
      pendingTextRef.current = ""
      pendingIdRef.current = null
      revealedCharCountRef.current = 0
      setRevealedCharCount(0)
    },

    onDebug: (info: unknown) => {
      const event = info as Record<string, unknown> | undefined
      if (!event) return
      const type = event.type as string | undefined
      if (
        type === "tentative_user_transcript" ||
        event?.tentative_user_transcription_event
      ) {
        const transcriptEvent =
          (event as Record<string, Record<string, string>>)
            ?.tentative_user_transcription_event
        const text =
          transcriptEvent?.user_transcript ??
          (event as Record<string, string>)?.user_transcript
        if (text && text.trim()) {
          setTentativeUserText({ text: text.trim(), timestamp: Date.now() })
        }
      }
    },
  })

  // startSession now fetches a conversation token for WebRTC
  const startSession = useCallback(
    async () => {
      setConnectionStatus("connecting")
      setError(null)
      setIsConversationOver(false)
      hadMessagesRef.current = false
      setPendingAgentMessage(null)
      pendingTextRef.current = ""
      pendingIdRef.current = null
      revealedCharCountRef.current = 0
      setRevealedCharCount(0)

      const questionList = options.questions
        .map((q, i) => `Question ${i + 1} (ID: ${q.id}): ${q.text}`)
        .join("\n")

      try {
        // Fetch fresh conversation token for WebRTC
        const res = await fetch("/api/elevenlabs/conversation-token")
        if (!res.ok) {
          throw new Error(`Token API error: ${res.status}`)
        }
        const { token } = await res.json()
        if (!token) {
          throw new Error("No token in response")
        }

        const name = options.participantName || "there"
        const sessionOptions: Record<string, unknown> = {
          conversationToken: token,
          // connectionType: "webrtc" is implied by conversationToken
          overrides: {
            conversation: {
              client_events: [
                "audio",
                "agent_response",
                "agent_response_correction",
                "user_transcript",
                "tentative_user_transcript",
                "internal_tentative_agent_response",
                "interruption",
                "vad_score",
                "client_tool_call",
                "agent_tool_response",
              ],
            },
          },
          dynamicVariables: {
            questions: questionList,
            participant_name: name,
            greeting:
              Object.keys(options.previousAnswers || {}).length > 0
                ? `Welcome back, ${name}! You mentioned some great ideas earlier. Feel free to add anything else or expand on your previous thoughts.`
                : SURVEY_CONFIG.greeting(name),
            previous_context:
              Object.keys(options.previousAnswers || {}).length > 0
                ? `The participant has already shared these answers in a previous conversation:\n${Object.entries(options.previousAnswers || {}).map(([, v]) => `- ${v}`).join("\n")}\n\nAsk if they want to add more details or share additional thoughts.`
                : "",
          },
        }

        const id = await conversation.startSession(
          sessionOptions as Parameters<typeof conversation.startSession>[0],
        )
        console.log("[ConversationLogger] WebRTC session started, id:", id)
        return id
      } catch (err) {
        console.error("[ConversationLogger] startSession failed:", err)
        const message =
          err instanceof Error ? err.message : "Failed to connect"
        setError(message)
        setConnectionStatus("disconnected")
      }
    },
    [conversation, options.questions, options.participantName, options.previousAnswers],
  )

  const endSession = useCallback(async () => {
    try {
      await conversation.endSession()
    } catch {
      // Session may already be ended
    }
    setPendingAgentMessage(null)
    pendingTextRef.current = ""
    pendingIdRef.current = null
    setIsConversationOver(true)
  }, [conversation])

  return {
    transcript,
    pendingAgentMessage,
    revealedCharCount,
    agentMode,
    connectionStatus,
    vadScore,
    error,
    startTime,
    isConversationOver,
    answers,
    tentativeUserText,
    upsertTentativeUserEntry,
    setVolume: conversation.setVolume,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
    getTranscript: () => transcriptRef.current,
    getConversationId: () => conversationIdRef.current,
    startSession,
    endSession,
  }
}
