"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

export type OrbMode = "listening" | "speaking" | "connecting"

/**
 * Voice orb that reacts to real-time audio levels from the ElevenLabs SDK.
 * Uses getInputVolume (user mic) and getOutputVolume (agent audio) polled
 * at 60fps for smooth, truly reactive animation — following ElevenLabs'
 * recommended square-root volume boost for visual responsiveness.
 */
export function VoiceOrb({
  mode,
  getInputVolume,
  getOutputVolume,
  size = "lg",
}: {
  mode: OrbMode
  getInputVolume?: () => number
  getOutputVolume?: () => number
  size?: "sm" | "lg"
}) {
  const base = size === "lg" ? 120 : 64
  const isSpeaking = mode === "speaking"
  const isListening = mode === "listening"
  const isConnecting = mode === "connecting"

  // Poll real-time volume at 60fps
  const [inputVol, setInputVol] = useState(0)
  const [outputVol, setOutputVol] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      // Apply ElevenLabs recommended square-root boost for visual responsiveness
      const rawIn = getInputVolume?.() ?? 0
      const rawOut = getOutputVolume?.() ?? 0
      setInputVol(Math.min(1.0, Math.pow(rawIn, 0.5) * 2.5))
      setOutputVol(Math.min(1.0, Math.pow(rawOut, 0.5) * 2.0))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [getInputVolume, getOutputVolume])

  // Use the relevant volume based on mode
  const activeVol = isSpeaking ? outputVol : isListening ? inputVol : 0
  const intensity = isConnecting ? 0.15 : Math.max(0.05, activeVol)

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: base + 80, height: base + 80 }}
    >
      {/* Layer 0: Rotating aurora — slow atmospheric glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: -30,
          background: `conic-gradient(
            from 0deg,
            rgba(201,168,124,${0.02 + intensity * 0.05}),
            rgba(180,140,90,${0.015 + intensity * 0.03}),
            rgba(220,190,150,${0.025 + intensity * 0.06}),
            rgba(201,168,124,${0.02 + intensity * 0.05})
          )`,
          filter: "blur(30px)",
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Layer 1: Ambient glow — follows volume directly */}
      <div
        className="absolute rounded-full"
        style={{
          inset: -14,
          background: `radial-gradient(circle, rgba(201,168,124,${0.06 + intensity * 0.14}) 0%, transparent 60%)`,
          filter: "blur(16px)",
          opacity: 0.15 + intensity * 0.5,
          transform: `scale(${1 + intensity * 0.06})`,
          transition: "opacity 0.08s ease-out, transform 0.08s ease-out",
        }}
      />

      {/* Layer 2: Glass ring — subtle presence */}
      <div
        className="absolute rounded-full"
        style={{
          width: base + 20,
          height: base + 20,
          border: `1px solid rgba(201,168,124,${0.05 + intensity * 0.1})`,
          boxShadow: `inset 0 0 20px rgba(201,168,124,${0.01 + intensity * 0.03})`,
          opacity: 0.3 + intensity * 0.35,
          transform: `scale(${1 + intensity * 0.02})`,
          transition: "opacity 0.1s ease-out, transform 0.1s ease-out, border-color 0.1s ease-out",
        }}
      />

      {/* Layer 3: Main orb — scales and glows with volume */}
      <div
        className="absolute rounded-full"
        style={{
          width: base,
          height: base,
          background: "radial-gradient(circle at 38% 38%, #f0dcc0, #d4b68a, #c9a87c, #a88650)",
          transform: `scale(${1 + intensity * 0.1})`,
          boxShadow: `
            0 0 ${20 + intensity * 45}px rgba(201,168,124,${0.15 + intensity * 0.35}),
            inset 0 -8px 20px rgba(120,80,40,0.3),
            inset 0 4px 12px rgba(255,230,190,0.15)
          `,
          transition: "transform 0.08s ease-out, box-shadow 0.08s ease-out",
        }}
      />

      {/* Layer 4: Organic blob — gentle volume-reactive drift */}
      <div
        className="absolute rounded-full"
        style={{
          width: base * 0.82,
          height: base * 0.82,
          background: "radial-gradient(circle at 55% 35%, rgba(240,220,190,0.5), rgba(210,180,140,0.2), transparent)",
          mixBlendMode: "screen" as const,
          transform: `scale(${0.92 + intensity * 0.08}) translate(${isSpeaking ? Math.sin(Date.now() / 800) * 2 : 0}px, ${isSpeaking ? Math.cos(Date.now() / 1000) * 1.5 : 0}px)`,
          transition: "transform 0.1s ease-out",
        }}
      />

      {/* Layer 5: Specular highlight */}
      <div
        className="absolute rounded-full"
        style={{
          width: base * 0.4,
          height: base * 0.4,
          top: "26%",
          left: "30%",
          background: "radial-gradient(circle, rgba(255,255,255,0.45), rgba(255,240,220,0.1), transparent)",
          opacity: 0.2 + intensity * 0.35,
          transition: "opacity 0.1s ease-out",
        }}
      />

      {/* Connecting pulse overlay */}
      {isConnecting && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: base,
            height: base,
            background: "radial-gradient(circle, rgba(201,168,124,0.1), transparent)",
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  )
}
