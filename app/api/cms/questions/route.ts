import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";
import type { Question } from "@/lib/db/schema";

// GET /api/cms/questions
export async function GET(request: NextRequest) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "draft";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabaseAdmin
      .from("questions")
      .select("*", { count: "exact" })
      .eq("status", status)
      .range(offset, offset + limit - 1)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      total: count,
      page,
      limit,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("GET /api/cms/questions:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/cms/questions
export async function POST(request: NextRequest) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { stem, choices, correctChoice, explanation, tags, difficulty, source } = body;

    if (!stem || !choices || !correctChoice || !explanation) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const questionId = `q_${new Date().toISOString().split("T")[0].replace(/-/g, "")}_${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await supabaseAdmin.from("questions").insert([
      {
        id: questionId,
        stem,
        choices,
        correctChoice,
        explanation,
        tags: tags || [],
        difficulty: difficulty || "中級",
        source: source || null,
        status: "draft",
        createdBy: user.userId,
        createdAt: new Date(),
        timezone: "Asia/Tokyo",
      },
    ]).select();

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
    console.error("POST /api/cms/questions:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
