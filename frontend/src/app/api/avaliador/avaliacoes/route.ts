import { proxyBackend } from "@/lib/backendProxy"

export async function GET() {
  return proxyBackend("/external-evaluator/assignments")
}
