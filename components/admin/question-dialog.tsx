"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface QuestionDialogProps {
  mode: "add" | "edit"
  initialText?: string
  questionId?: string
  trigger: React.ReactNode
  onSuccess: () => void
}

export function QuestionDialog({
  mode,
  initialText = "",
  questionId,
  trigger,
  onSuccess,
}: QuestionDialogProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(initialText)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)

    try {
      const url =
        mode === "add" ? "/api/questions" : `/api/questions/${questionId}`
      const method = mode === "add" ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })

      if (res.ok) {
        setOpen(false)
        setText(mode === "add" ? "" : text)
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v && mode === "edit") setText(initialText)
        if (v && mode === "add") setText("")
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Question" : "Edit Question"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "This will create a new version of the question. Existing responses will keep referencing the original."
              : "Add a new question to the active questionnaire."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question-text">Question</Label>
            <Textarea
              id="question-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your question..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !text.trim()}>
              {loading
                ? "Saving..."
                : mode === "add"
                  ? "Add Question"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
