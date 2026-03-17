import { DM_Sans, Playfair_Display } from "next/font/google"
import "./survey-theme.css"

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

export default function SurveyLayout({
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
        height: "100dvh",
        overflow: "hidden",
        fontFamily: "var(--font-survey-sans), sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </div>
  )
}
