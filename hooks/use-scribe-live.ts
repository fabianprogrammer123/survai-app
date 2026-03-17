"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useScribe } from "@elevenlabs/react"

interface UseScribeLiveOptions {
  onSpeakingStart?: () => void
  onSpeakingEnd?: () => void
}

export function useScribeLive(options: UseScribeLiveOptions = {}) {
  const [liveText, setLiveText] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSpeakingStartRef = useRef(options.onSpeakingStart)
  const onSpeakingEndRef = useRef(options.onSpeakingEnd)
  const preloadedTokenRef = useRef<string | null>(null)
  onSpeakingStartRef.current = options.onSpeakingStart
  onSpeakingEndRef.current = options.onSpeakingEnd
  // Token always fetched fresh — no preloading (tokens expire quickly)

  const scribe = useScribe({
    onPartialTranscript: ({ text }) => {
      if (text && text.trim()) {
        setLiveText(text.trim())

        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current)
        } else {
          onSpeakingStartRef.current?.()
        }

        speakingTimeoutRef.current = setTimeout(() => {
          speakingTimeoutRef.current = null
          onSpeakingEndRef.current?.()
        }, 800)
      }
    },
    onCommittedTranscript: () => {
      // Clear live text after a short delay — let onMessage handle the
      // smooth transition. If onMessage doesn't arrive within 1.5s,
      // clear anyway to prevent stale text.
      setTimeout(() => {
        setLiveText(null)
      }, 1500)
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current)
        speakingTimeoutRef.current = null
      }
    }
  }, [])

  const start = useCallback(async () => {
    try {
      const res = await fetch("/api/elevenlabs/scribe-token")
      if (!res.ok) {
        console.error("Scribe token error:", res.status)
        return
      }
      const { token } = await res.json()
      if (!token) {
        console.error("No Scribe token available")
        return
      }

      await scribe.connect({
        token,
        modelId: "scribe_v2_realtime",
        // @ts-expect-error — SDK accepts string but types may be strict
        commitStrategy: "vad",
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      setIsActive(true)
      console.log("[Scribe] Connected for live transcription")
    } catch (err) {
      console.error("[Scribe] Failed to connect:", err)
    }
  }, [scribe])

  const stop = useCallback(() => {
    try {
      scribe.disconnect()
    } catch {
      // May already be disconnected
    }
    setIsActive(false)
    setLiveText(null)
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current)
      speakingTimeoutRef.current = null
    }
  }, [scribe])

  return {
    liveText,
    isActive,
    start,
    stop,
  }
}
