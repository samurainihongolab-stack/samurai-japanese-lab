import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/client";
import { legacyUser } from "@/lib/auth/legacy";

export async function GET(request: NextRequest) {
  try {
    const user = await legacyUser(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");

    let query = supabaseAdmin.from("templates").select("*");

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query.order("isDefault", { ascending: false });

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/cms/templates:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await legacyUser(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, description, platform, template } = body;

    if (!name || !platform || !template) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const templateId = `tpl_${platform}_${Date.now()}`;

    const { data, error } = await supabaseAdmin
      .from("templates")
      .insert([
        {
          id: templateId,
          name,
          description,
          platform,
          template,
          isDefault: false,
          createdBy: user.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
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
    console.error("POST /api/cms/templates:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
