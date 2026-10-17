import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// parse-record: turn one plain-language sentence into a structured record.
//
//   "paid 8k for fuel"            -> expense { title: fuel, amount: 8000 }
//   "sold Ade 12 bags for 96000"  -> sale { item: bags, quantity: 12, ... }
//
// The model (Gemini) is only a parser. It never touches the database: this
// function returns JSON and the client shows a confirmation card, and the
// record is written through the normal authenticated API after the user taps
// Save. GEMINI_API_KEY lives in the function secrets, never in the bundle.
//
// TRAINING (weekly review): the FEW_SHOT list below is the "model" we train.
// Query public.assistant_parses for feedback='down', take the misparsed
// sentences, fix the expected JSON by hand, append them here, redeploy. No
// fine-tuning - curated examples. Keep each example short and keep the list
// under ~40 items so the prompt stays cheap.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Weekly-review curated examples. Format: [sentence, expected JSON].
// NOTE: keep this array and the schema in sync. Add new entries at the end.
const FEW_SHOT: Array<[string, string]> = [
  [
    "paid 8k for fuel",
    `{"kind":"record","recordType":"expense","confidence":"high","fields":{"title":"Fuel","amount":8000,"quantity":1,"unitPrice":8000,"category":"Transport","date":null},"clarify":null}`,
  ],
  [
    "sold 12 bags of cement to Ade for 96,000",
    `{"kind":"record","recordType":"sale","confidence":"high","fields":{"item":"Bags of cement","quantity":12,"unitPrice":8000,"amount":96000,"category":"","date":null,"paymentMethod":"cash"},"clarify":null}`,
  ],
  [
    "received 500 cedis from Kwame for the design job",
    `{"kind":"record","recordType":"service_income","confidence":"high","fields":{"client_name":"Kwame","amount":500,"category":"","notes":"Design job","date":null},"clarify":null}`,
  ],
  [
    "bought 3 boxes of noodles for 450",
    `{"kind":"record","recordType":"expense","confidence":"high","fields":{"title":"Noodles","amount":450,"quantity":3,"unitPrice":150,"category":"Stock","date":null},"clarify":null}`,
  ],
  [
    "how much did I make this month?",
    `{"kind":"question","recordType":null,"confidence":"high","fields":{},"clarify":null}`,
  ],
  [
    "still waiting on Ade to pay me",
    `{"kind":"question","recordType":null,"confidence":"high","fields":{},"clarify":null}`,
  ],
  [
    "paid Grace 1,200 for supplies last friday",
    `{"kind":"record","recordType":"expense","confidence":"high","fields":{"title":"Supplies","amount":1200,"quantity":1,"unitPrice":1200,"category":"Supplies","date":null,"notes":"Paid Grace"},"clarify":null}`,
  ],
  [
    "sold 2 gallons of oil to Mama Ada for 180",
    `{"kind":"record","recordType":"sale","confidence":"high","fields":{"item":"Oil","quantity":2,"unitPrice":90,"amount":180,"category":"","date":null,"paymentMethod":"cash"},"clarify":null}`,
  ],
];

const SYSTEM_PROMPT = `You turn one sentence a small African business owner typed into structured JSON. You are a parser, not an adviser.

STRICT RULES
- Output ONLY JSON matching this schema, no prose, no markdown fences:
  {"kind":"record"|"question"|"unknown","recordType":"expense"|"sale"|"service_income"|null,"confidence":"high"|"medium"|"low","fields":{...},"clarify":null|string}
- kind="record" only when the sentence reports a concrete completed money event (a payment made, a sale, money received). Otherwise kind="question" (it asks something) or "unknown" (neither).
- recordType rules:
  * money LEAVING the business -> "expense" (fields: title, amount, quantity, unitPrice, category, date, notes)
  * goods SOLD to someone -> "sale" (fields: item, quantity, unitPrice, amount, category, date, paymentMethod)
  * money the business EARNED from a client -> "service_income" (fields: client_name, amount, category, date, notes)
- In mode="retail" never produce service_income. In mode="services" prefer service_income for money in and never produce sale.
- Amounts: plain numbers, no currency symbols, no commas. "8k" -> 8000. Total amount goes in "amount"; per-unit in "unitPrice"; compute whichever is missing.
- quantity defaults to 1. unitPrice defaults to amount/quantity when not stated.
- category: pick the closest from the provided category list, else "" (never invent a category when a list is given).
- date: only set when the sentence says it (YYYY-MM-DD). Use null otherwise. "yesterday"/"last friday" may be resolved if unambiguous, else null.
- confidence="low" + a "clarify" question when a needed value is genuinely missing (e.g. no amount at all).
- Questions about money ("how much did I spend", "who owes me") -> kind="question", recordType=null, fields={}.
- Never invent people, items or amounts not in the sentence.`;

interface ParseRequest {
  text: string;
  mode?: string;
  currency?: string;
  categories?: string[];
  items?: string[];
}

function buildPrompt(req: ParseRequest): string {
  const context = [
    `mode: ${req.mode === "services" ? "services" : "retail"}`,
    `currency: ${req.currency || "GHS"}`,
    req.categories?.length
      ? `categories: ${req.categories.slice(0, 60).join(", ")}`
      : null,
    req.items?.length
      ? `known items: ${req.items.slice(0, 60).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const examples = FEW_SHOT.map(
    ([sentence, expected]) => `Sentence: ${sentence}\nJSON: ${expected}`,
  ).join("\n\n");

  return `${SYSTEM_PROMPT}

CONTEXT
${context}

EXAMPLES
${examples}

Sentence: ${JSON.stringify(req.text)}
JSON:`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Every caller must be a signed-in user. The client sends its JWT; we never
  // trust the anon key alone here (the sentence is the user's own data).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "record_parsing_not_configured",
        detail: "GEMINI_API_KEY is not set for this function",
      }),
      { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }

  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const text = String(body?.text ?? "").trim().slice(0, 500);
  if (!text) {
    return new Response(JSON.stringify({ error: "Empty sentence" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // gemini-2.5-flash answers 404 NOT_FOUND for keys created after its retirement
  // ("no longer available to new users"), which surfaces to the user as a dead
  // panel, so the default tracks the current Flash. Override with GEMINI_MODEL.
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
  const prompt = buildPrompt({ ...body, text });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let geminiRes: Response;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => "");
      console.error("gemini error", geminiRes.status, detail.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "model_error", status: geminiRes.status }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const data = await geminiRes.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    // Strip markdown fences if the model ignored instructions.
    const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("unparseable model output", cleaned.slice(0, 500));
      return new Response(JSON.stringify({ error: "model_output_invalid" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const result = parsed as {
      kind?: string;
      recordType?: string | null;
      confidence?: string;
      fields?: Record<string, unknown>;
      clarify?: string | null;
    };

    return new Response(
      JSON.stringify({
        kind: ["record", "question", "unknown"].includes(String(result.kind))
          ? result.kind
          : "unknown",
        recordType: ["expense", "sale", "service_income"].includes(String(result.recordType))
          ? result.recordType
          : null,
        confidence: result.confidence || "medium",
        fields: result.fields && typeof result.fields === "object" ? result.fields : {},
        clarify: typeof result.clarify === "string" ? result.clarify : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("parse-record failure", err);
    return new Response(JSON.stringify({ error: "parse_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
