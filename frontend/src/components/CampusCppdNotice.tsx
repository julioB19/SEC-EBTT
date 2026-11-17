"use client"

import { useEffect, useState } from "react"
import { clientFetch as fetch } from "@/lib/clientFetch"

/** Avisa o docente quando o campus do seu cadastro não tem CPPD local vigente. */
export default function CampusCppdNotice() {
  const [campusName, setCampusName] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [me, campuses] = await Promise.all([
          fetch("/api/me", { cache: "no-store" }).then(response => response.json()),
          fetch("/api/acesso/campuses", { cache: "no-store" }).then(response => response.json())
        ])
        const campusId = me?.data?.docenteProfile?.campusId
        const campus = Array.isArray(campuses?.data) ? campuses.data.find((item: { idCampus: number }) => item.idCampus === campusId) : null
        if (alive && campus && campus.hasActiveCppd === false) setCampusName(campus.name)
      } catch {
        // O aviso é informativo; sem dados, a abertura segue normalmente.
      }
    })()
    return () => { alive = false }
  }, [])

  if (!campusName) return null
  return (
    <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      O {campusName} ainda não tem CPPD local vigente. Depois de enviado, seu processo será analisado pela CPPD Central até que uma comissão seja cadastrada para o campus.
    </p>
  )
}
