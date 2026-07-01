export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("EDGE_ALLOWED_ORIGIN") || "http://localhost:5173",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function requireEdgeSecret(req: Request) {
  const expected = requireEnv("EDGE_SYNC_SECRET");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || token !== expected) throw new Error("Unauthorized");
}
