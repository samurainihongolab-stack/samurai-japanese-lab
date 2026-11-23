export type EventName =
  | "page_view"
  | "social_outbound_click"
  | "quiz_start"
  | "quiz_submit"
  | "explanation_view"
  | "book_view"
  | "amazon_outbound_click";

export type EventSource = "instagram" | "x" | "hp" | "direct";

export interface AnalyticsEvent {
  eventName: EventName;
  questionId?: string;
  source: EventSource;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export function generateAnonymousUserId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("anonymous_user_id");
    if (stored) return stored;
  }
  const id = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  if (typeof window !== "undefined") {
    localStorage.setItem("anonymous_user_id", id);
  }
  return id;
}

export async function recordEvent(event: AnalyticsEvent): Promise<boolean> {
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to record event:", err);
    return false;
  }
}
