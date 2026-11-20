import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { version = 1 } = body;

    // Check if question exists and is in draft status
    const { data: question, error: fetchError } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    if (question.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft questions can be submitted for review" },
        { status: 403 }
      );
    }

    // Update question status to in_review
    const { data: updatedQuestion, error: updateError } = await supabaseAdmin
      .from("questions")
      .update({
        status: "in_review",
        reviewedAt: new Date(),
        reviewedBy: user.userId,
      })
      .eq("id", id)
      .select();

    if (updateError) throw updateError;

    // Create approval record
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("approvals")
      .insert([
        {
          id: `apr_${Date.now()}`,
          questionId: id,
          version,
          status: "pending",
          requiredApprovals: 2,
          currentApprovals: 0,
        },
      ])
      .select();

    if (approvalError) throw approvalError;

    return NextResponse.json(
      {
        success: true,
        data: {
          question: updatedQuestion?.[0],
          approval: approval?.[0],
        },
        timestamp: new Date(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/cms/questions/[id]/submit-review:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
