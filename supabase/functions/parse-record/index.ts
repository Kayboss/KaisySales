import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// parse-record: turn one plain-language sentence into a structured record.
//
//   "paid 8k for fuel"            -> expense { title: fuel, amount: 8000 }
//   "sold Ade 12 bags for 96000"  -> sale { item: bags, quantity: 12, ... }
//
// It is also asked twice for the same record. When the request carries
// `merge: { recordType, fields }` this is the answer to a question the panel
// asked about a card already on screen ("you can still add the vendor..."), so
// the prompt becomes a follow-up that echoes the held fields back and adds what
// the reply says. The client merges the two.
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
// under ~40 items so the prompt stays cheap. Follow-up examples live inline in
// the prompt below instead, so the training corpus stays real sentences only.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Must match SUBCATEGORIES in src/features/services/ServiceExpenses.jsx and
// EXPENSE_SUBCATEGORIES in src/utils/assistant/recordPayload.js. The client
// rejects anything else, so offering a value the screen does not have would
// only fail the card after the round trip.
const SUBCATEGORIES = ["general", "saas", "subcontractor", "hardware", "platform_fee"];

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
  // From a real feedback='down' row (2026-10-17): the user typed this meaning a
  // cost and the model answered service_income, because in "services" mode a bare
  // amount reads as money in. It is money out unless a verb says otherwise.
  [
    "39.00 for sticker printing",
    `{"kind":"record","recordType":"expense","confidence":"medium","fields":{"title":"Sticker printing","amount":39,"quantity":1,"unitPrice":39,"category":"Printing","date":null},"clarify":null}`,
  ],
  // A services business has no stock, so its expense carries the columns its own
  // screen shows instead of quantity and unit price. This is the shape the
  // ServiceExpenses table stores.
  [
    "paid Adobe 39 for the design software",
    `{"kind":"record","recordType":"expense","confidence":"high","fields":{"title":"Adobe","amount":39,"quantity":1,"unitPrice":39,"category":"","date":null,"vendor":"Adobe","client_name":"","renewal_date":null,"subcategory":"saas","is_asset":false,"asset_lifetime_years":null,"transaction_fee":0},"clarify":null}`,
  ],
  // A recurring services cost: the cadence sets a renewal date, and a charge on
  // top of the payment is a fee rather than a larger amount.
  [
    "renewed the accounting tool, 200 plus a 5 cedis charge",
    `{"kind":"record","recordType":"expense","confidence":"medium","fields":{"title":"Accounting tool","amount":200,"quantity":1,"unitPrice":200,"category":"","date":null,"vendor":"","client_name":"","renewal_date":null,"subcategory":"saas","is_asset":false,"asset_lifetime_years":null,"transaction_fee":5},"clarify":null}`,
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
- A sentence that is only an amount and a thing ("39 for sticker printing", "120 on fuel") is money PAID OUT -> "expense". Only a verb saying the money came IN (sold, received, earned, "paid me") makes it money in.
- Amounts: plain numbers, no currency symbols, no commas. "8k" -> 8000. Total amount goes in "amount"; per-unit in "unitPrice"; compute whichever is missing.
- quantity defaults to 1. unitPrice defaults to amount/quantity when not stated.
- category: pick the closest from the provided category list, else "" (never invent a category when a list is given).
- date: only set when the sentence says it (YYYY-MM-DD). Use null otherwise. "yesterday"/"last friday" may be resolved against the today date in CONTEXT, else null.
- confidence="low" + a "clarify" question when a needed value is genuinely missing (e.g. no amount at all).
- Questions about money ("how much did I spend", "who owes me") -> kind="question", recordType=null, fields={}.
- Never invent people, items or amounts not in the sentence.

SERVICES EXPENSE FIELDS (mode="services" only)
A services business keeps no stock, so its expense screen has no quantity or unit price; it has these columns instead. Include them on a services expense, "" or null when the sentence gives none:
- vendor: who was paid ("paid Grace 1,200 for supplies" -> vendor "Grace").
- client_name: which customer the cost belongs to, only when the sentence says so.
- renewal_date: for a recurring cost. "renews every month" -> today plus one month, "every quarter" -> plus three months, "every year"/"annual" -> plus one year, "due in 6 months" -> plus six months. YYYY-MM-DD, or null when no cadence is given.
- subcategory: one of the provided subcategory list, else "general". "monthly subscription"/"software"/"SaaS" -> "saas"; "freelancer"/"subcontractor" -> "subcontractor"; "laptop"/"device"/"printer" -> "hardware"; "platform"/"commission" -> "platform_fee".
- is_asset: true for a durable purchase (laptop, machine, furniture, vehicle, equipment), false for a consumable or a service. asset_lifetime_years only when a lifespan is stated ("over 3 years"), otherwise null.
- transaction_fee: an explicit charge or commission on top of a payment ("100 plus a 5 cedis charge" -> amount 100, transaction_fee 5). 0 when none.`;

interface MergeRequest {
  recordType: string;
  fields: Record<string, unknown>;
}

interface ParseRequest {
  text: string;
  mode?: string;
  currency?: string;
  categories?: string[];
  items?: string[];
  merge?: MergeRequest | null;
}

// Asked when a card is already on screen and the reply is the answer to a
// question the panel asked about a blank column ("you can still add the
// vendor..."). The held fields come back echoed by the model and are merged on
// the client, so the one thing this prompt must not do is lose a value: the
// amount is repeated whether or not the reply mentions it.
function buildFollowUpPrompt(req: ParseRequest, today: string): string {
  const recordType = req.merge?.recordType || "expense";
  const held = JSON.stringify(req.merge?.fields ?? {}).slice(0, 2000);
  return `You are finishing a record that is already on the user's screen. The user is answering a question about a blank field, or adding detail.

STRICT RULES
- Output ONLY JSON matching this schema, no prose, no markdown fences:
  {"kind":"record","recordType":"${recordType}","confidence":"high"|"medium"|"low","fields":{...},"clarify":null}
- Echo EVERY held field back unchanged, including the amount. A field this reply says nothing about keeps the value it already has.
- Add or correct only what this reply actually says.
- The reply may answer several things in one line ("Kwame, Software, renews every year") - map each part onto the field it belongs to.
- The reply may be a bare value ("Adobe", "Software", "every year") - it belongs to whichever held field is blank.
- recordType never changes here, and kind is always "record".
- confidence="high" when the reply answers what was asked, else "medium".
- today is ${today}; use it to resolve a cadence into a renewal date.
- Never invent a value the reply does not give.

FIELDS ALREADY HELD
${held}

Sentence: ${JSON.stringify(req.text)}
JSON:`;
}

function buildPrompt(req: ParseRequest, today: string): string {
  if (req.merge?.recordType) return buildFollowUpPrompt(req, today);

  const context = [
    `mode: ${req.mode === "services" ? "services" : "retail"}`,
    `currency: ${req.currency || "GHS"}`,
    `today: ${today}`,
    req.categories?.length
      ? `categories: ${req.categories.slice(0, 60).join(", ")}`
      : null,
    req.items?.length
      ? `known items: ${req.items.slice(0, 60).join(", ")}`
      : null,
    `subcategories: ${SUBCATEGORIES.join(", ")}`,
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

  // A follow-up carries the record type and fields already on the card. The
  // type is whitelisted here so a model that invents one cannot turn the card
  // into a different record; the fields are used as prompt context only and are
  // never written anywhere by this function.
  const mergeType = ["expense", "sale", "service_income"].includes(String(body?.merge?.recordType))
    ? String(body?.merge?.recordType)
    : null;
  const merge: MergeRequest | null = mergeType
    ? {
        recordType: mergeType,
        fields:
          body?.merge?.fields && typeof body.merge.fields === "object" ? body.merge.fields : {},
      }
    : null;

  // The only "today" the model can see. It resolves "yesterday" and a renewal
  // cadence against this, so it is deliberately UTC rather than a guess at the
  // owner's timezone.
  const today = new Date().toISOString().slice(0, 10);

  // Model choice here is about latency, not intelligence: this is a one-sentence
  // extraction. gemini-2.5-flash is retired for keys issued after it (404
  // NOT_FOUND), and gemini-3.8-flash thinks at "medium" by default, which blew
  // past a 15 s and then a 20 s cap even at "low". The Flash-Lite tier answers at
  // "minimal" by default. Override with GEMINI_MODEL.
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  const prompt = buildPrompt({ ...body, text, merge }, today);

  // Declared outside the try so the catch below can still report how long the
  // call ran before it died - a bare AbortError says "too slow", never "how slow".
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    // Gemini gets 20 s and the client waits 30 s, so a slow model still answers
    // the panel with this function's own JSON error instead of an aborted fetch.
    const timer = setTimeout(() => controller.abort(), 20000);
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
              // Flash-Lite answers at "minimal" (its default) - "minimal" is a
              // 400 for 3.8 Flash, so if GEMINI_MODEL pins 3.8 this must go back
              // to "low". temperature, top_p and top_k are ignored from 3.6 on,
              // so none is sent. The output cap bounds a runaway JSON body, which
              // is the other way this call could outlive the timeout. It is 500
              // rather than 400 because a follow-up echoes a full services
              // expense (eleven fields) back; a truncated JSON body would come
              // back as a 502 and leave the card stuck.
              thinkingConfig: { thinkingLevel: "minimal" },
              responseMimeType: "application/json",
              maxOutputTokens: 500,
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
      console.error("gemini error", geminiRes.status, `after ${Date.now() - startedAt}ms`, detail.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "model_error", status: geminiRes.status }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const data = await geminiRes.json();
    // Latency, finish reason and token counts are logged on every success: if the
    // call ever creeps back over the timeout, this line says whether the model was
    // slow, whether it hit maxOutputTokens, or whether thinking tokens ballooned.
    const usage = data?.usageMetadata ?? {};
    console.log(
      "gemini ok",
      merge ? "follow-up" : "first",
      merge?.recordType ?? "-",
      `${Date.now() - startedAt}ms`,
      "finish",
      data?.candidates?.[0]?.finishReason ?? "?",
      "out",
      usage.candidatesTokenCount ?? "?",
      "thoughts",
      usage.thoughtsTokenCount ?? "?",
    );
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
        // On a follow-up the card already has a type, so the model's echo cannot
        // change it into a different record. On a first parse, only a known type
        // gets through.
        recordType:
          merge?.recordType ??
          (["expense", "sale", "service_income"].includes(String(result.recordType))
            ? result.recordType
            : null),
        confidence: result.confidence || "medium",
        fields: result.fields && typeof result.fields === "object" ? result.fields : {},
        clarify: typeof result.clarify === "string" ? result.clarify : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("parse-record failure", `after ${Date.now() - startedAt}ms`, err);
    return new Response(JSON.stringify({ error: "parse_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
