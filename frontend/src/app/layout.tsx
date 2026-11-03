import AppFeedbackProvider from "@/components/AppFeedbackProvider"
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEC-EBTT",
  description: "Sistema de processos da carreira docente EBTT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased"><AppFeedbackProvider>{children}</AppFeedbackProvider></body>
    </html>
  );
}
