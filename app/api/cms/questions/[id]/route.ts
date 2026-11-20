import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { verifyRequest } from "@/lib/auth/jwt";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("questions")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft questions can be edited" },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("questions")
      .update(body)
      .eq("id", id)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data?.[0],
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("PUT /api/cms/questions/[id]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("questions")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft questions can be deleted" },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin.from("questions").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("DELETE /api/cms/questions/[id]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
