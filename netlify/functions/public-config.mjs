const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

function isPublicKey(key) {
  // Recognize the public-key format, not just the absence of a secret prefix.
  // The JWT signature is verified by Supabase, not by this configuration endpoint.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split(".");
  if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return header?.alg === "HS256" && claims?.role === "anon";
  } catch {
    return false;
  }
}

export const handler = async () => {
  const url = (process.env.SUPABASE_URL || "").trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey) return json(503, { error: "Storage is not configured" });
  // Only a hosted Supabase origin and a recognizable public key may be exposed.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !isPublicKey(anonKey)) {
    return json(500, {
      error: "Invalid public configuration; use the project URL and a public publishable/anon key",
    });
  }
  return json(200, { url, anonKey });
};
