"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircleIcon, CircleIcon } from "lucide-react"

interface QuestionItem {
  id: string
  text: string
}

interface QuestionnairePanelProps {
  questions: QuestionItem[]
  answers: Record<string, string>
}

export function QuestionnairePanel({
  questions,
  answers,
}: QuestionnairePanelProps) {
  const answeredCount = Object.keys(answers).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Questionnaire</h2>
        <Badge variant="secondary">
          {answeredCount}/{questions.length} answered
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {questions.map((q, i) => {
            const answer = answers[q.id]
            const isAnswered = !!answer

            return (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  {isAnswered ? (
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <CircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {i + 1}. {q.text}
                    </p>
                    {isAnswered && (
                      <p className="mt-1 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground">
                        {answer}
                      </p>
                    )}
                  </div>
                </div>
                {i < questions.length - 1 && <Separator />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
