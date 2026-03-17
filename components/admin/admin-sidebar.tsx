"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { FileQuestionIcon, UsersIcon } from "lucide-react"

const navItems = [
  { href: "/admin/questions", label: "Questions", icon: FileQuestionIcon },
  { href: "/admin/participants", label: "Participants", icon: UsersIcon },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-svh w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/admin/questions" className="text-sm font-semibold">
          Voice Questionnaire
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
