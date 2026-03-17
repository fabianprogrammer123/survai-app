import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

interface ProfileSummary {
  id: string
  name: string
  headline: string | null
  occupation: string | null
  industry: string | null
  city: string | null
  country: string | null
  experiences: string[]
  education: string[]
  tags?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { query, profiles } = (await req.json()) as {
      query: string
      profiles: ProfileSummary[]
    }

    if (!query?.trim() || !profiles?.length) {
      return NextResponse.json({ ids: [] })
    }

    const directory = profiles
      .map((p, i) => {
        const parts = [`[${i}] ${p.name}`]
        if (p.headline) parts.push(`  "${p.headline}"`)
        if (p.occupation) parts.push(`  Role: ${p.occupation}`)
        if (p.industry) parts.push(`  Industry: ${p.industry}`)
        if (p.city || p.country)
          parts.push(
            `  Location: ${[p.city, p.country].filter(Boolean).join(", ")}`,
          )
        if (p.experiences.length)
          parts.push(`  Experience: ${p.experiences.join(" | ")}`)
        if (p.education.length)
          parts.push(`  Education: ${p.education.join(" | ")}`)
        if (p.tags?.length) parts.push(`  Tags: ${p.tags.join(", ")}`)
        return parts.join("\n")
      })
      .join("\n\n")

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are an intelligent search engine for an event guest directory. Given a query and numbered attendee profiles, return ALL matching profile indices ranked by relevance.

MATCHING RULES:
1. **Name search**: fuzzy/partial match on names
2. **Explicit roles**: match titles, headlines, industries directly
3. **Implicit roles** (IMPORTANT): Infer what someone likely does based on context clues:
   - Someone at a VC/PE firm → investor, even if title says "Associate"
   - Someone who is CEO/CTO of a small company → likely a startup founder
   - Someone at McKinsey/BCG/Bain → management consultant
   - Someone at Goldman Sachs → finance/banking professional
   - Someone with "Partner" at a law firm → lawyer, not investor
   - A PhD student or professor → researcher/academic
   - Use the Tags field as strong signals — these are pre-computed role inferences
4. **Intent-based queries**: Think about what the user actually needs:
   - "People to meet for fundraising" → VCs, angels, startup advisors
   - "Potential customers" → business leaders, ops/growth heads
   - "Interesting people to talk to" → diverse, influential profiles
5. **Education**: match institution names, even abbreviated (e.g. "MIT")
6. **Location**: match city, country, or region (e.g. "European" matches Germany, France, etc.)
7. **Be generous**: when in doubt, include the person.

Return ONLY a JSON array of indices, e.g. [0, 5, 12]. No explanation. If no matches, return [].`,
        },
        {
          role: "user",
          content: `Query: "${query}"\n\nAttendee directory:\n${directory}`,
        },
      ],
    })

    const text = response.choices[0]?.message?.content?.trim() || "[]"
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const indices: number[] = JSON.parse(jsonMatch ? jsonMatch[0] : "[]")
    const ids = indices
      .filter((i) => i >= 0 && i < profiles.length)
      .map((i) => profiles[i].id)

    return NextResponse.json({ ids })
  } catch (err) {
    console.error("AI search error:", err)
    return NextResponse.json(
      { ids: [], error: "Search failed" },
      { status: 500 },
    )
  }
}
