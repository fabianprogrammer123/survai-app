"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useConversation } from "@elevenlabs/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TranscriptDisplay,
  type TranscriptMessage,
} from "./transcript-display"
import { MicIcon, MicOffIcon, PhoneOffIcon } from "lucide-react"

interface VoicePanelProps {
  questions: { id: string; text: string }[]
  onAnswerUpdate: (questionId: string, answer: string) => void
  onConversationEnd: (
    transcript: TranscriptMessage[],
    conversationId: string | null,
  ) => void
}

export function VoicePanel({
  questions,
  onAnswerUpdate,
  onConversationEnd,
}: VoicePanelProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [hasEnded, setHasEnded] = useState(false)
  const messagesRef = useRef<TranscriptMessage[]>([])

  const conversation = useConversation({
    clientTools: {
      write_answer: ({
        question_id,
        answer,
      }: {
        question_id: string
        answer: string
      }) => {
        onAnswerUpdate(question_id, answer)
        return "Answer recorded successfully"
      },
    },
    onMessage: (msg) => {
      if (msg.message) {
        const newMsg: TranscriptMessage = {
          source: msg.source === "user" ? "user" : "agent",
          message: msg.message,
        }
        messagesRef.current = [...messagesRef.current, newMsg]
        setMessages([...messagesRef.current])
      }
    },
    onDisconnect: () => {
      setHasEnded(true)
    },
  })

  useEffect(() => {
    if (hasEnded) {
      onConversationEnd(messagesRef.current, conversationId)
    }
  }, [hasEnded, conversationId, onConversationEnd])

  const startConversation = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert("Microphone access is required for this survey.")
      return
    }

    try {
      const res = await fetch("/api/elevenlabs/signed-url")
      const { signedUrl } = await res.json()

      const questionList = questions
        .map((q, i) => `Question ${i + 1} (ID: ${q.id}): ${q.text}`)
        .join("\n")

      const id = await conversation.startSession({
        signedUrl,
        dynamicVariables: {
          questions: questionList,
        },
      })
      setConversationId(id ?? null)
    } catch (err) {
      console.error("Failed to start conversation:", err)
    }
  }, [conversation, questions])

  const endConversation = useCallback(async () => {
    await conversation.endSession()
  }, [conversation])

  const isConnected = conversation.status === "connected"
  const isConnecting = conversation.status === "connecting"

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Voice Conversation</h2>
          {isConnected && (
            <Badge variant={conversation.isSpeaking ? "default" : "secondary"}>
              {conversation.isSpeaking ? "Agent speaking" : "Listening"}
            </Badge>
          )}
        </div>
        {isConnected ? (
          <Button variant="destructive" size="sm" onClick={endConversation}>
            <PhoneOffIcon className="mr-1.5 h-3.5 w-3.5" />
            End
          </Button>
        ) : hasEnded ? (
          <Badge variant="secondary">Conversation ended</Badge>
        ) : null}
      </div>

      <TranscriptDisplay messages={messages} />

      {!isConnected && !hasEnded && (
        <div className="border-t p-4">
          <Button
            className="w-full"
            size="lg"
            onClick={startConversation}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>Connecting...</>
            ) : (
              <>
                <MicIcon className="mr-2 h-4 w-4" />
                Start Conversation
              </>
            )}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Microphone access will be requested
          </p>
        </div>
      )}

      {hasEnded && (
        <div className="border-t bg-muted/30 p-4 text-center">
          <MicOffIcon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            The conversation has ended. Your responses have been recorded.
          </p>
        </div>
      )}
    </div>
  )
}
