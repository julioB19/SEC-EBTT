import { Suspense } from "react"
import CppdProcessosClient from "./cppdProcessosClient"

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-[60vh]"><div className="px-4 md:px-6 lg:px-8 py-6">Carregando...</div></main>}>
      <CppdProcessosClient />
    </Suspense>
  )
}
