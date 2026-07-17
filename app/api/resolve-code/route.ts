import { createClient } from "@supabase/supabase-js";

// Résout un code privé côté serveur pour pouvoir rate-limiter par IP réelle
// (indisponible depuis le client Supabase). On ne stocke jamais l'IP brute :
// seul un hash SHA-256 salé sert d'identifiant dans code_attempts.
export const runtime = "nodejs";

const SALT = "zoomhide-code-rl-v1";

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  let code = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "");
  } catch {
    return Response.json({ error: "not_found" });
  }

  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const identifier = await hashIp(ip);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase.rpc("get_hide_by_code", {
    p_code: code,
    p_identifier: identifier,
  });
  if (error) {
    return Response.json({ error: "not_found" });
  }
  return Response.json(data);
}
