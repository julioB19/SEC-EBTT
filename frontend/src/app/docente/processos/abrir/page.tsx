import Form from "./Form"
import CampusCppdNotice from "@/components/CampusCppdNotice"

export default function AbrirProcessoPage() {
  return (
    <main className="min-h-[60vh]">
      <div className="max-w-3xl mx-auto">
        <CampusCppdNotice />
        <Form />
      </div>
    </main>
  )
}
