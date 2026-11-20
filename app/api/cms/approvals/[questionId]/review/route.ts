import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // Only reviewers and admins can approve
    if (!["reviewer", "admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Only reviewers can approve" },
        { status: 403 }
      );
    }

    const { questionId } = await params;
    const body = await request.json();
    const { status, reviewNotes } = body;

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    // Get the approval record
    const { data: approval, error: fetchError } = await supabaseAdmin
      .from("approvals")
      .select("*")
      .eq("questionId", questionId)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { success: false, error: "Approval record not found" },
        { status: 404 }
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Approval has already been processed" },
        { status: 403 }
      );
    }

    let newStatus = approval.status;
    let newCurrentApprovals = approval.currentApprovals;
    let questionStatus = "in_review";

    if (status === "approved") {
      newCurrentApprovals += 1;
      if (newCurrentApprovals >= approval.requiredApprovals) {
        newStatus = "approved";
        questionStatus = "approved";
      }
    } else if (status === "rejected") {
      newStatus = "rejected";
      questionStatus = "draft";
    }

    // Update approval record
    const { data: updatedApproval, error: updateError } = await supabaseAdmin
      .from("approvals")
      .update({
        status: newStatus,
        currentApprovals: newCurrentApprovals,
        reviewedBy: user.userId,
        reviewNotes,
        reviewedAt: new Date(),
      })
      .eq("id", approval.id)
      .select();

    if (updateError) throw updateError;

    // Update question status if needed
    if (questionStatus !== "in_review") {
      await supabaseAdmin
        .from("questions")
        .update({ status: questionStatus })
        .eq("id", questionId);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          approval: updatedApproval?.[0],
          approvalProgress: `${newCurrentApprovals}/${approval.requiredApprovals}`,
        },
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/cms/approvals/[questionId]/review:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
