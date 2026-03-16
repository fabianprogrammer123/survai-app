"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ResponseData {
  id: string
  transcript: string
  conversation_id: string | null
  created_at: string
  response_answers: {
    id: string
    answer_text: string
    questions: { id: string; text: string } | null
  }[]
}

export function ResponseDetail({ participantId }: { participantId: string }) {
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/participants/${participantId}/response`)
        if (res.ok) {
          setData(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [participantId])

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading response...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No response found.
      </div>
    )
  }

  return (
    <Tabs defaultValue="answers" className="w-full">
      <TabsList>
        <TabsTrigger value="answers">Answers</TabsTrigger>
        <TabsTrigger value="transcript">Transcript</TabsTrigger>
      </TabsList>

      <TabsContent value="answers">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Answer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.response_answers.map((ra) => (
              <TableRow key={ra.id}>
                <TableCell className="font-medium">
                  {ra.questions?.text ?? "Unknown question"}
                </TableCell>
                <TableCell>{ra.answer_text || "—"}</TableCell>
              </TableRow>
            ))}
            {data.response_answers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-center text-muted-foreground"
                >
                  No answers recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="transcript">
        <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {data.transcript || "No transcript available."}
          </pre>
        </div>
      </TabsContent>
    </Tabs>
  )
}
