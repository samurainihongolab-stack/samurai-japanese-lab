"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
    window.location.href = "/admin/login";
  }
  return (
    <button onClick={logout} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-bold transition">
      ログアウト
    </button>
  );
}
