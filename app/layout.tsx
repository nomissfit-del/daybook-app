import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Daybook',
  description: 'Personal productivity tracker — targets, projects, and recurring tasks.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  )
}
