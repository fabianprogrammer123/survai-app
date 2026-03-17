import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("guest_profiles")
    .select(
      "id, first_name, last_name, name, profile_pic_url, headline, summary, company, job_title, occupation, city, state, country, country_full_name, linkedin_url, industry, experiences, education, skills"
    )
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
