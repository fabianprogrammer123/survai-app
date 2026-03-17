"use client"

import { useRef, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type {
  TranscriptEntry,
  PendingAgentMessage,
} from "@/hooks/use-conversation-logger"

function formatTimestamp(ts: number, startTime: number): string {
  const elapsed = Math.floor((ts - startTime) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Reveals text character-by-character based on audio alignment data.
 */
function AudioAlignedText({
  text,
  revealedChars,
}: {
  text: string
  revealedChars: number
}) {
  if (revealedChars >= text.length) return <span>{text}</span>
  let splitAt = revealedChars
  while (splitAt > 0 && text[splitAt] !== " ") splitAt--
  if (splitAt === 0) splitAt = revealedChars
  return (
    <>
      <span>{text.slice(0, splitAt)}</span>
      <span style={{ opacity: 0.3 }}>{text.slice(splitAt)}</span>
    </>
  )
}

/**
 * Shows text with a left-to-right color sweep when transitioning
 * from tentative (blue) to confirmed (white).
 */
function UserBubbleText({
  text,
  isTentative,
}: {
  text: string
  isTentative: boolean
}) {
  const [sweeping, setSweeping] = useState(false)
  const prevTentativeRef = useRef(isTentative)

  useEffect(() => {
    if (prevTentativeRef.current && !isTentative) {
      setSweeping(true)
      const timer = setTimeout(() => setSweeping(false), 500)
      prevTentativeRef.current = isTentative
      return () => clearTimeout(timer)
    }
    prevTentativeRef.current = isTentative
  }, [isTentative])

  if (sweeping) {
    return (
      <motion.span
        initial={{ backgroundPosition: "100% 50%" }}
        animate={{ backgroundPosition: "0% 50%" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--survey-fg) 50%, #93c5fd 50%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {text}
      </motion.span>
    )
  }

  return (
    <span
      style={{
        color: isTentative ? "#93c5fd" : "var(--survey-fg)",
        transition: "color 0.3s ease",
      }}
    >
      {text}
    </span>
  )
}

export function TranscriptDisplay({
  entries,
  pendingAgentMessage,
  revealedCharCount = 0,
  startTime,
  vadScore = 0,
}: {
  entries: TranscriptEntry[]
  pendingAgentMessage?: PendingAgentMessage | null
  revealedCharCount?: number
  startTime: number
  vadScore?: number
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const lastEntryText = entries[entries.length - 1]?.text
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries.length, lastEntryText, pendingAgentMessage?.text])

  if (entries.length === 0 && !pendingAgentMessage) {
    return (
      <div className="flex items-center justify-center h-full px-10">
        <p
          style={{
            color: "var(--survey-muted-fg)",
            opacity: 0.4,
            fontSize: 14,
          }}
        >
          Your conversation will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto h-full px-8 py-8 scroll-smooth">
      <AnimatePresence mode="popLayout">
        {entries.map((entry, index) => {
          const isUser = entry.role === "user"
          const isTentative = entry.tentative === true
          const isLatestAgent =
            !isUser &&
            index === entries.length - 1 &&
            !pendingAgentMessage

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              layout
              className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
            >
              {/* Role label + timestamp */}
              <div
                className={`flex items-center gap-2 px-1 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    color: isUser ? "#93c5fd" : "var(--survey-accent)",
                    opacity: isTentative ? 0.5 : 0.7,
                    transition: "opacity 0.3s ease",
                  }}
                >
                  {isUser ? "You" : "Agent"}
                </span>
                {!isTentative && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--survey-muted-fg)",
                      opacity: 0.3,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatTimestamp(entry.timestamp, startTime)}
                  </span>
                )}
              </div>

              {/* Message bubble */}
              <div
                style={{
                  borderRadius: 18,
                  maxWidth: "85%",
                  fontSize: 14,
                  lineHeight: 1.7,
                  padding: "12px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  // Smooth transition from tentative to confirmed styling
                  background: isUser
                    ? isTentative
                      ? "rgba(59, 130, 246, 0.04)"
                      : "rgba(59, 130, 246, 0.08)"
                    : "rgba(201, 168, 124, 0.06)",
                  border: isUser
                    ? isTentative
                      ? "1px solid rgba(59, 130, 246, 0.08)"
                      : "1px solid rgba(59, 130, 246, 0.12)"
                    : "1px solid rgba(201, 168, 124, 0.1)",
                  color: "var(--survey-fg)",
                  opacity: 0.9,
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  boxShadow: isUser
                    ? "inset 0 1px 1px rgba(59,130,246,0.06)"
                    : "inset 0 1px 1px rgba(201,168,124,0.05)",
                  transition:
                    "background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease",
                }}
              >
                {/* Audio bars for tentative user messages */}
                {isUser && isTentative && (
                  <div className="flex gap-[3px] items-center flex-shrink-0">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="rounded-full"
                        style={{ width: 2, background: "#93c5fd" }}
                        animate={{
                          height: [
                            3,
                            3 + Math.max(vadScore, 0.3) * 10,
                            3,
                          ],
                          opacity: [0.4, 0.8, 0.4],
                        }}
                        transition={{
                          duration: 0.35,
                          repeat: Infinity,
                          delay: i * 0.08,
                        }}
                      />
                    ))}
                  </div>
                )}

                <span style={{ flex: 1 }}>
                  {isUser ? (
                    <UserBubbleText
                      text={entry.text}
                      isTentative={isTentative}
                    />
                  ) : isLatestAgent &&
                    revealedCharCount > 0 &&
                    revealedCharCount < entry.text.length ? (
                    <AudioAlignedText
                      text={entry.text}
                      revealedChars={revealedCharCount}
                    />
                  ) : (
                    entry.text
                  )}
                </span>
              </div>
            </motion.div>
          )
        })}

        {/* Tentative agent response — faded preview before audio */}
        {pendingAgentMessage && pendingAgentMessage.text.length > 0 && (
          <motion.div
            key={`pending-${pendingAgentMessage.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-1.5 items-start"
          >
            <div className="flex items-center gap-2 px-1">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "var(--survey-accent)",
                  opacity: 0.4,
                }}
              >
                Agent
              </span>
            </div>
            <div
              style={{
                borderRadius: 18,
                maxWidth: "85%",
                padding: "12px 18px",
                background: "rgba(201, 168, 124, 0.03)",
                border: "1px solid rgba(201, 168, 124, 0.06)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "var(--survey-fg)",
                }}
              >
                <AudioAlignedText
                  text={pendingAgentMessage.text}
                  revealedChars={revealedCharCount}
                />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bottomRef} className="h-px shrink-0" />
    </div>
  )
}
