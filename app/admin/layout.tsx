import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "侍日本語ラボ | CMS 管理画面",
  description: "問題・承認・配信管理システム",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <aside className="w-64 bg-samurai-navy text-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold">🥋 CMS管理</h1>
          <p className="text-sm text-blue-200 mt-1">侍日本語ラボ</p>
        </div>

        <nav className="mt-8 space-y-2 px-4">
          <NavItem href="/admin" label="ダッシュボード" icon="📊" />
          <NavItem href="/admin/questions" label="問題管理" icon="📝" />
          <NavItem href="/admin/approval" label="承認フロー" icon="✅" />
          <NavItem href="/admin/schedule" label="配信スケジュール" icon="📅" />
          <NavItem href="/admin/preview" label="プレビュー" icon="👁️" />
          <NavItem href="/admin/analytics" label="分析" icon="📈" />
          <NavItem href="/admin/settings" label="設定" icon="⚙️" />
        </nav>

        <div className="absolute bottom-6 left-4 right-4 border-t border-blue-700 pt-4">
          <div className="text-sm">
            <p className="text-gray-300">ログイン中:</p>
            <p className="font-bold">編集者 A</p>
          </div>
          <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-bold transition">
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="block px-4 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
    >
      <span className="mr-3">{icon}</span>
      {label}
    </a>
  );
}
