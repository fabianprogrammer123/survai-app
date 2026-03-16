import { cookies } from "next/headers"

const COOKIE_NAME = "admin_session"
const SESSION_VALUE = "authenticated"

export async function setAdminSession() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  })
}

export async function clearAdminSession() {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(COOKIE_NAME)?.value === SESSION_VALUE
}
