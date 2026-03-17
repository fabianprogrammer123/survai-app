import { NextResponse } from "next/server"
import { getConversationToken } from "@/lib/elevenlabs"

export async function GET() {
  try {
    const token = await getConversationToken()
    return NextResponse.json({ token })
  } catch (error) {
    console.error("Failed to get conversation token:", error)
    return NextResponse.json(
      { error: "Failed to get conversation token" },
      { status: 500 },
    )
  }
}
