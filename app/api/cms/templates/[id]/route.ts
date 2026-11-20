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

    const { data, error } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/cms/templates/[id]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifyRequest(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from("templates")
      .update({
        ...body,
        updatedAt: new Date(),
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data: data[0],
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("PUT /api/cms/templates/[id]:", err);
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

    // Check if template is default
    const { data: template, error: fetchError } = await supabaseAdmin
      .from("templates")
      .select("isDefault")
      .eq("id", id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    if (template.isDefault) {
      return NextResponse.json(
        { success: false, error: "Cannot delete default template" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabaseAdmin.from("templates").delete().eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE /api/cms/templates/[id]:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
