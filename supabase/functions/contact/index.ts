import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public contact form endpoint.
//
// The landing site is static and `anon` holds no access to any user-data table,
// so the form cannot insert directly. It posts here instead: this function
// validates and length-caps every field, throttles repeats, and inserts with
// the service role. Nothing is emailed — the project has no SMTP host and its
// built-in mailer can send two messages an hour for the whole project — so a
// submission lands in `contact_messages` and is read in Admin → Inbox.
//
// Deploy with `--no-verify-jwt` so a visitor who has never signed in can post.
// Every privileged action still happens on a service-role client created here,
// never with the caller's token.

const ALLOWED_ORIGINS = new Set([
  "https://www.kaisysales.com",
  "https://kaisysales.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
]);

const SUBJECTS = new Set([
  "general",
  "account",
  "billing",
  "technical",
  "privacy",
  "data",
]);

const LIMITS = {
  name: 120,
  email: 254,
  message: 5000,
  sourcePage: 200,
  userAgent: 300,
  bodyBytes: 32 * 1024,
};

// Three messages per address per hour, twenty per network per hour. A person
// writing twice about one problem is normal; thirty is a flood.
const EMAIL_LIMIT = 3;
const IP_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
};

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });

/** Client IP as the proxy saw it. Supabase terminates TLS in front of this
 *  function, so `x-forwarded-for` is the only reliable source; the first entry
 *  is the caller, the rest are proxies. */
const clientIp = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
};

/** A stable pseudonym for an address, keyed with a secret this function already
 *  holds. It is used only for the per-network throttle: the table stores no IP,
 *  and the hash cannot be reversed without the key. */
const hashIp = async (ip: string, key: string): Promise<string | null> => {
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(ip));
    return [...new Uint8Array(signature).slice(0, 16)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    // Without a hash we still have the per-address throttle; refusing every
    // submission because hashing failed would turn a detail into an outage.
    console.error("contact: could not hash ip", error);
    return null;
  }
};

const withinWindow = () => new Date(Date.now() - WINDOW_MS).toISOString();

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, origin);
    }
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // A browser sends Origin on a cross-origin POST. A request with an origin we
  // do not serve is not our form, so it is refused before any work is done.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > LIMITS.bodyBytes) {
    return json({ error: "That message is too long." }, 413, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("contact: SUPABASE_URL or SERVICE_ROLE_KEY is missing");
    return json({ error: "This form is not configured." }, 500, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400, origin);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid request body." }, 400, origin);
  }

  const text = (value: unknown, max: number) =>
    String(value ?? "").trim().slice(0, max);

  const name = text(body.name, LIMITS.name);
  const email = text(body.email, LIMITS.email).toLowerCase();
  const message = text(body.message, LIMITS.message);
  const subject = SUBJECTS.has(String(body.subject)) ? String(body.subject) : "general";
  const sourcePage = text(body.sourcePage, LIMITS.sourcePage);
  const userAgent = text(req.headers.get("user-agent"), LIMITS.userAgent);
  const honeypot = text(body.website, 200);

  // A filled honeypot is a bot. Answer exactly as a success so it learns
  // nothing, and store nothing.
  if (honeypot) {
    return json({ ok: true }, 200, origin);
  }

  if (name.length < 2) {
    return json({ error: "Please enter your name." }, 400, origin);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ error: "Please enter a valid email address." }, 400, origin);
  }
  if (message.length < 10) {
    return json({ error: "Please tell us a little more — at least 10 characters." }, 400, origin);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Throttle before inserting, so a rejected flood never writes a row.
  const { count: recentFromAddress, error: emailCountError } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", withinWindow());

  if (emailCountError) {
    console.error("contact: email throttle lookup failed", emailCountError);
    return json({ error: "We couldn't send that just now. Please try again." }, 500, origin);
  }
  if ((recentFromAddress ?? 0) >= EMAIL_LIMIT) {
    return new Response(
      JSON.stringify({
        error: "You've already sent us a few messages in the last hour. Please wait a little before sending another.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "3600",
          ...corsHeaders(origin),
        },
      },
    );
  }

  const ipHash = await hashIp(clientIp(req), serviceKey);
  if (ipHash) {
    const { count: recentFromNetwork, error: ipCountError } = await admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", withinWindow());

    if (ipCountError) {
      console.error("contact: network throttle lookup failed", ipCountError);
      return json({ error: "We couldn't send that just now. Please try again." }, 500, origin);
    }
    if ((recentFromNetwork ?? 0) >= IP_LIMIT) {
      return json(
        { error: "Too many messages from this connection in the last hour. Please try again later." },
        429,
        origin,
      );
    }
  }

  const { error: insertError } = await admin.from("contact_messages").insert({
    name,
    email,
    subject,
    message,
    source_page: sourcePage || null,
    ip_hash: ipHash,
    user_agent: userAgent || null,
  });

  if (insertError) {
    console.error("contact: insert failed", insertError);
    return json({ error: "We couldn't send that just now. Please try again." }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
