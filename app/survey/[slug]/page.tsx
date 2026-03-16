"use client"

import { useState, useCallback, useRef, use } from "react"
import { PasswordGate } from "@/components/survey/password-gate"
import { VoicePanel } from "@/components/survey/voice-panel"
import { QuestionnairePanel } from "@/components/survey/questionnaire-panel"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import type { TranscriptMessage } from "@/components/survey/transcript-display"

interface ParticipantInfo {
  id: string
  first_name: string
  last_name: string
}

interface QuestionItem {
  id: string
  text: string
}

export default function SurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const [authenticated, setAuthenticated] = useState(false)
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const answersRef = useRef<Record<string, string>>({})
  const [completed, setCompleted] = useState(false)

  const handleAuthenticated = useCallback(
    async (p: ParticipantInfo) => {
      setParticipant(p)

      const res = await fetch(`/api/survey/${slug}/session`)
      if (res.ok) {
        const data = await res.json()
        setQuestions(data.questions)
        setAuthenticated(true)
      } else {
        toast.error("Failed to load survey")
      }
    },
    [slug],
  )

  const handleAnswerUpdate = useCallback(
    (questionId: string, answer: string) => {
      answersRef.current = { ...answersRef.current, [questionId]: answer }
      setAnswers({ ...answersRef.current })
    },
    [],
  )

  const handleConversationEnd = useCallback(
    async (transcript: TranscriptMessage[], conversationId: string | null) => {
      if (completed) return

      // Small delay to let any final tool calls settle
      await new Promise((r) => setTimeout(r, 500))

      try {
        const transcriptText = transcript
          .map(
            (m) =>
              `${m.source === "user" ? "Participant" : "Interviewer"}: ${m.message}`,
          )
          .join("\n")

        const res = await fetch(`/api/survey/${slug}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: transcriptText,
            answers: answersRef.current,
            conversation_id: conversationId,
          }),
        })

        if (res.ok) {
          setCompleted(true)
          toast.success("Survey completed! Thank you for participating.")
        } else {
          toast.error("Failed to save results")
        }
      } catch {
        toast.error("Failed to save results")
      }
    },
    [slug, completed],
  )

  if (!authenticated) {
    return (
      <>
        <PasswordGate slug={slug} onAuthenticated={handleAuthenticated} />
        <Toaster />
      </>
    )
  }

  return (
    <div className="h-svh">
      {participant && (
        <div className="flex h-10 items-center border-b bg-muted/30 px-4 text-sm">
          <span className="text-muted-foreground">
            Welcome,{" "}
            <span className="font-medium text-foreground">
              {participant.first_name} {participant.last_name}
            </span>
          </span>
          {completed && (
            <span className="ml-auto text-xs text-muted-foreground">
              Survey completed
            </span>
          )}
        </div>
      )}
      <ResizablePanelGroup
        className="flex-1"
        style={{ height: "calc(100svh - 2.5rem)" }}
      >
        <ResizablePanel defaultSize={55} minSize={30}>
          <VoicePanel
            questions={questions}
            onAnswerUpdate={handleAnswerUpdate}
            onConversationEnd={handleConversationEnd}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={45} minSize={25}>
          <QuestionnairePanel questions={questions} answers={answers} />
        </ResizablePanel>
      </ResizablePanelGroup>
      <Toaster />
    </div>
  )
}
