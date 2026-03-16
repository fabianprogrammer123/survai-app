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
import { ParticipantDialog } from "./participant-dialog"
import { ResponseDetail } from "./response-detail"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  PlusIcon,
  CopyIcon,
  ChevronDownIcon,
  LinkIcon,
  KeyIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { Participant } from "@/lib/types"

type ParticipantWithResponse = Participant & {
  responses: { id: string; created_at: string }[] | null
}

export function ParticipantTable() {
  const [participants, setParticipants] = useState<ParticipantWithResponse[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/participants")
      if (res.ok) {
        setParticipants(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  function getSurveyUrl(slug: string) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/survey/${slug}`
    }
    return `/survey/${slug}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Participants</h1>
          <p className="text-sm text-muted-foreground">
            {participants.length} participant
            {participants.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <ParticipantDialog
          trigger={
            <Button size="sm">
              <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
              Add Participant
            </Button>
          }
          onSuccess={() => {
            toast.success("Participant added")
            fetchParticipants()
          }}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : participants.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No participants yet. Add one to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Survey Link</TableHead>
              <TableHead>Password</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p) => (
              <Collapsible
                key={p.id}
                asChild
                open={expandedId === p.id}
                onOpenChange={(open) =>
                  setExpandedId(open ? p.id : null)
                }
              >
                <>
                  <TableRow>
                    <TableCell className="font-medium">
                      {p.first_name} {p.last_name}
                    </TableCell>
                    <TableCell>
                      {p.slug ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-muted-foreground">
                            /survey/{p.slug}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              copyToClipboard(getSurveyUrl(p.slug!), "Link")
                            }
                          >
                            <LinkIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.password ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs">{p.password}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              copyToClipboard(p.password!, "Password")
                            }
                          >
                            <KeyIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.survey_completed ? (
                        <Badge variant="default">Completed</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.survey_completed && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ChevronDownIcon className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </TableCell>
                  </TableRow>
                  {p.survey_completed && (
                    <CollapsibleContent asChild>
                      <tr>
                        <TableCell colSpan={5} className="bg-muted/20 p-4">
                          <ResponseDetail participantId={p.id} />
                        </TableCell>
                      </tr>
                    </CollapsibleContent>
                  )}
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
