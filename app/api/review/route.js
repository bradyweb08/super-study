import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordReview } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await request.json();
    const result = await recordReview({
      cardId: body.cardId,
      mode: body.mode,
      answer: body.answer,
      expected: body.expected,
      correct: Boolean(body.correct),
      userId: user.id
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
