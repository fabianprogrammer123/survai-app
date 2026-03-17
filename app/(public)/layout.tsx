import { DM_Sans, Playfair_Display } from "next/font/google"
import "../survey/survey-theme.css"
import "./public.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-survey-sans",
  weight: ["300", "400", "500", "600", "700"],
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-survey-display",
  weight: ["400", "500", "600", "700"],
})

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`survey-theme ${dmSans.variable} ${playfair.variable}`}
      style={{
        background: "#06060a",
        color: "#eeebe5",
        minHeight: "100dvh",
        fontFamily: "var(--font-survey-sans), sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </div>
  )
}
