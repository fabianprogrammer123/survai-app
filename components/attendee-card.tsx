"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  BuildingIcon,
  MapPinIcon,
  LinkedinIcon,
} from "lucide-react"

export interface AttendeeCardProps {
  firstName: string | null
  lastName: string | null
  profilePicUrl: string | null
  headline: string | null
  company: string | null
  jobTitle: string | null
  city: string | null
  country: string | null
  linkedinUrl: string | null
  industry: string | null
}

export function AttendeeCard({
  firstName,
  lastName,
  profilePicUrl,
  headline,
  company,
  jobTitle,
  city,
  country,
  linkedinUrl,
  industry,
}: AttendeeCardProps) {
  const first = firstName ?? ""
  const last = lastName ?? ""
  const initials = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
  const displayName = [first, last].filter(Boolean).join(" ") || "Unknown"
  const location = [city, country].filter(Boolean).join(", ")

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <Avatar className="!h-16 !w-16">
          {profilePicUrl && (
            <AvatarImage src={profilePicUrl} alt={displayName} />
          )}
          <AvatarFallback className="text-lg font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="w-full space-y-1">
          <p className="text-sm font-semibold leading-tight">{displayName}</p>
          {(headline || jobTitle) && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {headline || jobTitle}
            </p>
          )}
        </div>

        {(company || location) && (
          <div className="flex w-full flex-col items-center gap-1 text-xs text-muted-foreground">
            {company && (
              <span className="inline-flex items-center gap-1">
                <BuildingIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{company}</span>
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>
        )}

        {industry && (
          <Badge variant="secondary" className="text-[10px]">
            {industry}
          </Badge>
        )}

        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            <LinkedinIcon className="h-3 w-3" />
            LinkedIn
          </a>
        )}
      </CardContent>
    </Card>
  )
}
