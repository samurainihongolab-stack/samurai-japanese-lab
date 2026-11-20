import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!questionId || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: questionId, startDate, endDate",
        },
        { status: 400 }
      );
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch events for this question in date range
    let query = supabaseAdmin
      .from("analytics_events")
      .select("*")
      .eq("questionId", questionId)
      .gte("timestamp", start.toISOString())
      .lte("timestamp", end.toISOString());

    const { data: events, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const stats = {
      views: events.filter((e) => e.eventName === "page_view").length,
      clicks: events.filter((e) => e.eventName === "social_outbound_click").length,
      quizStarts: events.filter((e) => e.eventName === "quiz_start").length,
      quizCompletions: events.filter((e) => e.eventName === "quiz_submit").length,
      explanationViews: events.filter((e) => e.eventName === "explanation_view").length,
      bookViews: events.filter((e) => e.eventName === "book_view").length,
      amazonClicks: events.filter((e) => e.eventName === "amazon_outbound_click").length,
    };

    // Calculate derived metrics
    const ctr = stats.views > 0 ? (stats.clicks / stats.views).toFixed(2) : "0.00";
    const completionRate =
      stats.quizStarts > 0 ? (stats.quizCompletions / stats.quizStarts).toFixed(2) : "0.00";

    // Source breakdown
    const sourceBreakdown = events.reduce(
      (acc, event) => {
        acc[event.source] = (acc[event.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Event breakdown
    const eventBreakdown = events.reduce(
      (acc, event) => {
        acc[event.eventName] = (acc[event.eventName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Hourly data for trending
    const hourlyData = events.reduce(
      (acc, event) => {
        const hour = new Date(event.timestamp).toISOString().substring(0, 13);
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...stats,
          ctr: parseFloat(ctr),
          completionRate: parseFloat(completionRate),
          sourceBreakdown,
          eventBreakdown,
          hourlyData,
          totalEvents: events.length,
          dateRange: { start, end },
        },
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/analytics/stats:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
