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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("mv-theme-preset");if(t==="soft-pop"||t==="neo-brutalism"||t==="tangerine"||t==="default")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
