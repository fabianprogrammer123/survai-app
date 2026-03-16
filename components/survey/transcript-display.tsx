"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export interface TranscriptMessage {
  source: "user" | "agent"
  message: string
}

interface TranscriptDisplayProps {
  messages: TranscriptMessage[]
}

export function TranscriptDisplay({ messages }: TranscriptDisplayProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Conversation will appear here...
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={cn(
            "flex",
            msg.source === "user" ? "justify-end" : "justify-start",
          )}
        >
          <div
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
              msg.source === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted",
            )}
          >
            {msg.message}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
