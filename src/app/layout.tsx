import type { Metadata } from 'next'
import { Inter, Montserrat, Open_Sans } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/molecules/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })
const montserrat = Montserrat({ 
  subsets: ['latin'],
  variable: '--font-montserrat'
})
const openSans = Open_Sans({ 
  subsets: ['latin'],
  variable: '--font-open-sans'
})

export const metadata: Metadata = {
  title: 'Lekd',
  description: 'Event management platform by Shiny Dog Productions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${montserrat.variable} ${openSans.variable}`}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <footer
          style={{
            textAlign: 'center',
            padding: '1.5rem 1rem',
            fontSize: '12px',
            color: '#9CA3AF',
            borderTop: '1px solid var(--sd-border)',
          }}
        >
          &copy; {new Date().getFullYear()} Shiny Dog Productions Inc. All rights reserved.
        </footer>
      </body>
    </html>
  )
}
