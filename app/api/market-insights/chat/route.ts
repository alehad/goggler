import { NextRequest, NextResponse } from "next/server.js";
import { validateSameOriginRequest } from "../../../../src/auth/csrf.ts";
import { getOrCreateCurrentUser } from "../../../../src/auth/current-user.ts";
import { parseMatchingPreferences } from "../../../../src/ebay/matching-preferences.ts";
import { answerAnalyticsQuestion } from "../../../../src/market-insights/chat.ts";

const MAX_QUESTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  const csrf = validateSameOriginRequest(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const currentUser = getOrCreateCurrentUser(request);

  const body = (await request.json().catch(() => ({}))) as Partial<{
    question: unknown;
    exactTitleMatch: boolean;
    criteriaText: string;
  }>;

  const question = boundedQuestion(body.question);
  if (!question) {
    return withInternalSessionCookie(
      NextResponse.json({ error: "question_required" }, { status: 400 }),
      currentUser.setCookie
    );
  }

  const matchingPreferences = parseMatchingPreferences({
    exactTitleMatch: body.exactTitleMatch,
    criteriaText: body.criteriaText
  });

  try {
    const result = await answerAnalyticsQuestion(currentUser.context.user.id, question, matchingPreferences);
    return withInternalSessionCookie(NextResponse.json(result), currentUser.setCookie);
  } catch {
    console.warn("Market insights chat failed", { type: "unexpected_error" });
    return withInternalSessionCookie(
      NextResponse.json({ error: "chat_unavailable" }, { status: 502 }),
      currentUser.setCookie
    );
  }
}

function boundedQuestion(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().slice(0, MAX_QUESTION_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function withInternalSessionCookie(response: NextResponse, setCookie: string | undefined): NextResponse {
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }
  return response;
}
