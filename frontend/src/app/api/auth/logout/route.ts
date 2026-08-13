import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const backend = process.env.BACKEND_URL || ""
const PATH = "/logout"

export async function POST(req: NextRequest) {
  if (!backend) {
    return NextResponse.json({ message: "BACKEND_URL não configurada" }, { status: 500 })
  }

  const jar = await cookies()
  const accessToken = jar.get("accessToken")?.value
  const refreshToken = jar.get("refreshToken")?.value

  try {
    if (refreshToken || accessToken) {
      await fetch(`${backend}${PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ refreshToken })
      }).catch(() => null)
    }

    const res = NextResponse.json({ status: "success", message: "Logged out", data: null })

    res.cookies.set("accessToken", "", { path: "/", maxAge: 0 })
    res.cookies.set("refreshToken", "", { path: "/", maxAge: 0 })

    return res
  } catch (e: any) {
    const res = NextResponse.json(
      { message: "Erro ao sair", error: e?.message ?? "unknown" },
      { status: 500 }
    )
    res.cookies.set("accessToken", "", { path: "/", maxAge: 0 })
    res.cookies.set("refreshToken", "", { path: "/", maxAge: 0 })
    return res
  }
}
