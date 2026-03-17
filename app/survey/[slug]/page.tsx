"use client"

import { useEffect, useState, use } from "react"
import { SurveyFlow } from "@/components/survey/survey-flow"

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch(`/api/survey/${slug}/session`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || "Survey not found")
          return
        }
        const data = await res.json()
        setParticipant(data.participant)
        setQuestions(data.questions)
      } catch {
        setError("Failed to load survey")
      } finally {
        setLoading(false)
      }
    }
    loadSession()
  }, [slug])

  if (loading) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm"
        style={{ color: "var(--survey-muted-fg)", opacity: 0.5 }}
      >
        Loading survey...
      </div>
    )
  }

  if (error || !participant) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm"
        style={{ color: "var(--survey-muted-fg)", opacity: 0.5 }}
      >
        {error || "Survey not found"}
      </div>
    )
  }

  return (
    <SurveyFlow
      participant={participant}
      questions={questions}
      slug={slug}
    />
  )
}
