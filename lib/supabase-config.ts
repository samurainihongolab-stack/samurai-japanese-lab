/** Supabase が「実在しうる設定」になっているか。プレースホルダ/demo 値は未設定扱い（有効な接続先とは断定しない）。 */
const PLACEHOLDER = /(^|\/\/)(demo|your-project|example|placeholder)[.\-]|your_.*_here/i;

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url, anon, service };
}

export function isSupabaseConfigured(): boolean {
  const { url, anon, service } = supabaseEnv();
  if (!url || !anon || !service) return false;
  return ![url, anon, service].some((v) => PLACEHOLDER.test(v));
}
