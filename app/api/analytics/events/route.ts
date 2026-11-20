import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import type { AnalyticsEvent } from "@/lib/analytics/events";

export async function POST(request: NextRequest) {
  try {
    const body: AnalyticsEvent = await request.json();
    const { eventName, questionId, source, userId, metadata } = body;

    if (!eventName || !source || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: eventName, source, userId" },
        { status: 400 }
      );
    }

    const validEvents = [
      "page_view",
      "social_outbound_click",
      "quiz_start",
      "quiz_submit",
      "explanation_view",
      "book_view",
      "amazon_outbound_click",
    ];
    if (!validEvents.includes(eventName)) {
      return NextResponse.json(
        { success: false, error: "Invalid eventName" },
        { status: 400 }
      );
    }

    const validSources = ["instagram", "x", "hp", "direct"];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { success: false, error: "Invalid source" },
        { status: 400 }
      );
    }

    // Insert event into database
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .insert([
        {
          id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          eventName,
          questionId: questionId || null,
          source,
          userId,
          timestamp: new Date(),
          metadata: metadata || null,
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data: data?.[0],
        timestamp: new Date(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/analytics/events:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
