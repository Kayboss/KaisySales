import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Creates a staff login on behalf of a business owner.
//
// The invite code flow asks the teammate to sign themselves up and then join,
// which is two steps, needs a mailbox that works, and leaves the password in
// their hands before anyone has explained the app. Owners asked to create the
// login instead: they pick the branch and the access, and hand over a temporary
// password that must be changed on first sign-in.
//
// Only a service-role key can create an auth user, so this cannot be an RPC.
// The function therefore does the authorisation itself: the caller's JWT is
// verified, and the caller must be the *owner* of an active business.
//
// The mailer on this project can send two messages an hour for the whole
// project, so nothing here depends on email: `email_confirm: true` marks the
// address confirmed without sending anything.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the server-side password policy: min 8, lower + upper + digit. */
const passwordProblem = (password: string): string | null => {
  if (typeof password !== "string" || password.length < 8) {
    return "The password must be at least 8 characters.";
  }
  if (!/[a-z]/.test(password)) return "The password must contain a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "The password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "The password must contain a digit.";
  return null;
};

// Only these two modules exist (see utils/tenancy.js); anything else is dropped
// rather than trusted, and `sales` is always present.
const normaliseModules = (value: unknown): string[] => {
  const allowed = new Set(["sales", "reporting"]);
  const requested = Array.isArray(value) ? value.filter((m) => typeof m === "string") : [];
  const kept = requested.filter((m) => allowed.has(m));
  return kept.includes("sales") ? [...new Set(kept)] : ["sales", ...new Set(kept)];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: "This function is not configured." }, 500);
  }

  const token = authHeader.replace("Bearer ", "");

  // Read the caller identity from the token they sent, then do every privileged
  // write with the service key on a separate client.
  const callerClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid token" }, 401);
  }

  // A staff login must not be able to mint more staff: only an owner may.
  const { data: membership, error: membershipError } = await admin
    .from("business_members")
    .select("business_id, role, status")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    console.error("create-staff: membership lookup failed", membershipError);
    return json({ error: "Could not verify your business." }, 500);
  }
  if (!membership) {
    return json({ error: "Only the business owner can create a login." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();
  const branchId = Number(body.branchId);

  if (!EMAIL_RE.test(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) {
    return json({ error: pwProblem }, 400);
  }
  if (!fullName) {
    return json({ error: "Enter the teammate's name." }, 400);
  }
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return json({ error: "Choose the branch this teammate works in." }, 400);
  }

  // The branch must belong to this business and must still be open; otherwise
  // `staff_needs_branch` or RLS would strand the new login.
  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id, name, business_id, archived_at")
    .eq("id", branchId)
    .eq("business_id", membership.business_id)
    .maybeSingle();

  if (branchError) {
    console.error("create-staff: branch lookup failed", branchError);
    return json({ error: "Could not check that branch." }, 500);
  }
  if (!branch || branch.archived_at) {
    return json({ error: "That branch is not available. Choose another one." }, 400);
  }

  const modules = normaliseModules(body.modules);

  // 1. Create the login. `email_confirm: true` avoids sending anything: the
  //    built-in mailer is limited to two messages an hour for the whole project
  //    and the owner is handing the password over in person.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      must_change_password: true,
      full_name: fullName,
    },
  });

  if (createError || !created?.user) {
    const message = String(createError?.message ?? "");
    if (/already|exists|registered|duplicate/i.test(message)) {
      return json({ error: "An account already exists for that email address." }, 409);
    }
    console.error("create-staff: createUser failed", createError);
    return json({ error: message || "Could not create the login." }, 400);
  }

  const newUserId = created.user.id;

  // Anything below this line failing must not leave an orphaned auth user who
  // can sign in but has no membership (which would show them the "create a
  // business" onboarding screen instead of their job).
  const rollback = async (reason: string) => {
    const { error } = await admin.auth.admin.deleteUser(newUserId);
    if (error) {
      console.error("create-staff: rollback failed for", newUserId, error);
    }
    return json({ error: reason }, 500);
  };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      owner_name: fullName,
      is_onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", newUserId);

  if (profileError) {
    console.error("create-staff: profile update failed", profileError);
    return await rollback("Could not finish setting up the account.");
  }

  const { data: member, error: memberError } = await admin
    .from("business_members")
    .insert({
      business_id: membership.business_id,
      user_id: newUserId,
      role: "staff",
      branch_id: branchId,
      modules,
      status: "active",
    })
    .select("user_id, branch_id, modules")
    .single();

  if (memberError || !member) {
    console.error("create-staff: membership insert failed", memberError);
    return await rollback("Could not attach the new login to your business.");
  }

  return json({
    userId: newUserId,
    email,
    fullName,
    branchId: member.branch_id,
    branchName: branch.name,
    modules: member.modules,
  });
});
