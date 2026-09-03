import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mighty Verse",
  description: "Enter the creative universe.",
  openGraph: {
    title: "Mighty Verse",
    description: "Enter the creative universe.",
    siteName: "Mighty Verse",
  },
  twitter: {
    card: "summary",
    title: "Mighty Verse",
    description: "Enter the creative universe.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
