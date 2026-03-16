import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface AttendeeCardProps {
  firstName: string
  lastName: string
}

export function AttendeeCard({ firstName, lastName }: AttendeeCardProps) {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase()

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col items-center gap-3 py-6">
        <Avatar size="lg">
          <AvatarFallback className="text-base font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <p className="text-sm font-medium">
          {firstName} {lastName}
        </p>
      </CardContent>
    </Card>
  )
}
