import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const correct = process.env.SECRET_PASSWORD || "";
    if (password === correct) {
      return NextResponse.json({ valid: true }, { status: 200 });
    }
    return NextResponse.json({ valid: false }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true, method: "POST only" }, { status: 405 });
}

