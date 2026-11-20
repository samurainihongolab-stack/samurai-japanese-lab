import { NextRequest, NextResponse } from "next/server";
import { generateToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password required" },
        { status: 400 }
      );
    }

    // Demo auth: accept any email/password combination
    // In production, verify against database
    const token = generateToken({
      userId: `user_${Date.now()}`,
      email,
      role: "editor",
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          user: {
            email,
            role: "editor",
          },
        },
        timestamp: new Date(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/auth/login:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
