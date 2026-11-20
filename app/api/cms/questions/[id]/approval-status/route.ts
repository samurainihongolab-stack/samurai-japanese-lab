import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get question
    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("status")
      .eq("id", id)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    // Get approval record
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("approvals")
      .select("*")
      .eq("questionId", id)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (approvalError || !approval) {
      return NextResponse.json(
        {
          success: true,
          data: {
            status: "none",
            message: "No approval process started",
          },
          timestamp: new Date(),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          questionStatus: question.status,
          status: approval.status,
          requiredApprovals: approval.requiredApprovals,
          currentApprovals: approval.currentApprovals,
          progress: `${approval.currentApprovals}/${approval.requiredApprovals}`,
          reviewedBy: approval.reviewedBy,
          reviewedAt: approval.reviewedAt,
          reviewNotes: approval.reviewNotes,
        },
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/cms/questions/[id]/approval-status:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
