import { NextResponse } from "next/server";
import { getDatabaseConfigStatus, queryOne } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const config = getDatabaseConfigStatus();

  if (!config.hasUrl || !config.hasToken) {
    return NextResponse.json(
      {
        ok: false,
        database: "missing-env",
        config
      },
      { status: 503 }
    );
  }

  try {
    const result = await queryOne("SELECT 1 AS ok");
    return NextResponse.json({
      ok: true,
      database: result?.ok === 1 ? "connected" : "unexpected-result",
      config
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "connection-error",
        error: error?.message || "Unknown database error",
        config
      },
      { status: 500 }
    );
  }
}
