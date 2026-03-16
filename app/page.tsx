"use client"

import { useEffect, useState } from "react"
import { AttendeeCard } from "@/components/attendee-card"
import { UsersIcon } from "lucide-react"

interface Attendee {
  id: string
  first_name: string
  last_name: string
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
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <UsersIcon className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-semibold">Participants</h1>
        <p className="mt-1 text-muted-foreground">
          Meet the people taking part in this questionnaire
        </p>
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
