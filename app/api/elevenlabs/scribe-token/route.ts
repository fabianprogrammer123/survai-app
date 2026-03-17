import { NextResponse } from "next/server"
import { getScribeToken } from "@/lib/elevenlabs"

export async function GET() {
  try {
    const token = await getScribeToken()
    return NextResponse.json({ token })
  } catch (error) {
    console.error("Failed to get Scribe token:", error)
    return NextResponse.json(
      { error: "Failed to get Scribe token" },
      { status: 500 },
    )
  }
}
