import { NextResponse } from "next/server"
import { getSignedUrl } from "@/lib/elevenlabs"

export async function GET() {
  try {
    const signedUrl = await getSignedUrl()
    return NextResponse.json({ signedUrl })
  } catch (error) {
    console.error("Failed to get signed URL:", error)
    return NextResponse.json(
      { error: "Failed to get signed URL" },
      { status: 500 },
    )
  }
}
