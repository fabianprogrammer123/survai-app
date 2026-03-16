"use client"

import { useEffect, useState } from "react"
import { AttendeeCard } from "@/components/attendee-card"
import { UsersIcon } from "lucide-react"

interface Attendee {
  id: string
  first_name: string | null
  last_name: string | null
  profile_pic_url: string | null
  headline: string | null
  company: string | null
  job_title: string | null
  city: string | null
  country: string | null
  linkedin_url: string | null
  industry: string | null
}

export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/attendees")
        if (res.ok) setAttendees(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UsersIcon className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-semibold">Participants</h1>
        <p className="mt-1 text-muted-foreground">
          Meet the people taking part in this questionnaire
        </p>
        {!loading && attendees.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {attendees.length} participant{attendees.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : attendees.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No participants registered yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {attendees.map((a) => (
            <AttendeeCard
              key={a.id}
              firstName={a.first_name}
              lastName={a.last_name}
              profilePicUrl={a.profile_pic_url}
              headline={a.headline}
              company={a.company}
              jobTitle={a.job_title}
              city={a.city}
              country={a.country}
              linkedinUrl={a.linkedin_url}
              industry={a.industry}
            />
          ))}
        </div>
      )}
    </div>
  )
}
