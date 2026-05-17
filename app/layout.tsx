import { Geist_Mono, Inter } from "next/font/google"
import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Nav } from "@/components/nav"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Hitster Song Collector",
  description: "Zbieraj piosenki na wspólną listę Hitster",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pl"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <Nav />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
