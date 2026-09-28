import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "";

async function proxy(
  method: "POST" | "DELETE",
  request: NextRequest,
  context: { params: Promise<{ id: string; key: string }> },
) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { status: "error", message: "BACKEND_URL não configurada", data: null },
      { status: 500 },
    );
  }

  const accessToken = (await cookies()).get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { status: "error", message: "Não autenticado", data: null },
      { status: 401 },
    );
  }

  const { id, key } = await context.params;
  const url = `${BACKEND_URL.replace(/\/+$/, "")}/processos/${encodeURIComponent(id)}/documentos-configurados/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      body: method === "POST" ? await request.formData() : undefined,
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({
      status: "error",
      message: "Resposta inesperada do backend",
      data: null,
    }));
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    console.error("Erro ao encaminhar documento configurado:", error);
    return NextResponse.json(
      { status: "error", message: "Erro interno", data: null },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; key: string }> },
) {
  return proxy("POST", request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; key: string }> },
) {
  return proxy("DELETE", request, context);
}
