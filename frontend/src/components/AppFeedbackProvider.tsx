"use client"

import { ReactNode, useSyncExternalStore } from "react"
import Modal from "@/components/Modal"
import { dismissFeedback, feedbackSnapshot, serverFeedbackSnapshot, subscribeFeedback } from "@/lib/feedback"

export default function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const feedback = useSyncExternalStore(subscribeFeedback, feedbackSnapshot, serverFeedbackSnapshot)
  return <>{children}<Modal managed open={!!feedback} variant={feedback?.kind} title={feedback?.title ?? (feedback?.kind === "error" ? "Não foi possível concluir" : feedback?.kind === "success" ? "Ação confirmada" : "Aviso")} message={feedback?.message ?? ""} onClose={dismissFeedback} /></>
}
