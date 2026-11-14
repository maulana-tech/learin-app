import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "LEARIS", template: "%s · LEARIS" },
  description:
    "LEARIS: an agentic workspace for students and teams. Ask once; an Orchestrator splits the "
    + "work across agents that read your files, write sourced pages, plan tasks and check every claim.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col dot-grid">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
