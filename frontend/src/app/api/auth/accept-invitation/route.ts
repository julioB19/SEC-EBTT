import { NextResponse } from "next/server"

const backend = process.env.BACKEND_URL!

export async function POST(req: Request) {
  const body = await req.json()
  const response = await fetch(`${backend}/accept-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json"
    }
  })
}
