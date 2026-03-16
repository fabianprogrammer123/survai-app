"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { QuestionDialog } from "./question-dialog"
import { PencilIcon, TrashIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import type { Question } from "@/lib/types"

export function QuestionTable() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/questions")
      if (res.ok) {
        setQuestions(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  async function handleDeactivate(id: string) {
    const res = await fetch(`/api/questions/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Question deactivated")
      fetchQuestions()
    }
  }

  const activeQuestions = questions.filter((q) => q.is_active)
  const inactiveQuestions = questions.filter((q) => !q.is_active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Questions</h1>
          <p className="text-sm text-muted-foreground">
            {activeQuestions.length} active question
            {activeQuestions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <QuestionDialog
            mode="add"
            trigger={
              <Button size="sm">
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                Add Question
              </Button>
            }
            onSuccess={() => {
              toast.success("Question added")
              fetchQuestions()
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeQuestions.map((q, i) => (
              <TableRow key={q.id}>
                <TableCell className="text-muted-foreground">
                  {i + 1}
                </TableCell>
                <TableCell>{q.text}</TableCell>
                <TableCell>
                  <Badge variant="default">Active</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <QuestionDialog
                      mode="edit"
                      initialText={q.text}
                      questionId={q.id}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                      }
                      onSuccess={() => {
                        toast.success("Question updated")
                        fetchQuestions()
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(q.id)}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {activeQuestions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No active questions. Add one to get started.
                </TableCell>
              </TableRow>
            )}
            {inactiveQuestions.length > 0 && (
              <>
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="bg-muted/30 text-xs font-medium text-muted-foreground"
                  >
                    Inactive ({inactiveQuestions.length})
                  </TableCell>
                </TableRow>
                {inactiveQuestions.map((q) => (
                  <TableRow key={q.id} className="opacity-50">
                    <TableCell />
                    <TableCell>{q.text}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Inactive</Badge>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
