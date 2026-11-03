"use client"
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react"
import { classifyFeedback, FeedbackKind, notifyFeedback } from "@/lib/feedback"

export function useFeedbackState<T extends string | null>(initial: T | (() => T), kind: FeedbackKind | "auto" = "auto"): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  const current = useRef(value)
  const publish = useCallback((message: T) => {
    if (message) notifyFeedback(message, kind === "auto" ? classifyFeedback(message) : kind)
  }, [kind])
  const initialValue = useRef(value)
  useEffect(() => { publish(initialValue.current) }, [publish])
  const setFeedback = useCallback<Dispatch<SetStateAction<T>>>(next => {
    const result = typeof next === "function" ? next(current.current) : next
    current.current = result
    setValue(result)
    publish(result)
  }, [publish])
  return [value, setFeedback]
}
