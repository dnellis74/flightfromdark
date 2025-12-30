import OpenAI from "openai";
import { z } from "zod";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Request schema (client -> server) ----
const RequestBody = z.object({
  sectionId: z.number().int(),
  sectionText: z.string(),
  choices: z.array(z.object({ to: z.number().int(), label: z.string() })),
  sheet: z.object({
    endurance: z.number().int(),
    combatSkill: z.number().int(),
    gold: z.number().int(),
    items: z.array(z.string()),
    flags: z.record(z.string(), z.boolean()),
  }),
  userMessage: z.string().optional().default(""),
});

// ---- Response schema (server -> client) ----
// IMPORTANT: OpenAI Structured Outputs enforces that for any object schema,
// `required` must include EVERY key in `properties`. That effectively forbids optional fields.
// Workaround: use a "wide" action object with neutral defaults for unused fields.
const ActionWide = z
  .object({
    type: z.enum([
      "update_stat",
      "set_stat",
      "add_item",
      "remove_item",
      "set_flag",
      "start_combat",
    ]),
    reason: z.string(),

    // Always present (neutral defaults when unused)
    stat: z.enum(["endurance", "combatSkill", "gold"]),
    delta: z.number().int(),
    value: z.number().int(),

    item: z.string(),

    flag: z.string(),
    flagValue: z.boolean(),

    enemyName: z.string(),
  })
  .strict();

const InterpretResult = z
  .object({
    gmMessage: z.string(),
    actions: z.array(ActionWide),
  })
  .strict();

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const json = await req.json();
    const body = RequestBody.parse(json);

    const system = `
You are a Lone Wolf rules assistant embedded in a game engine.

Rules:
- Produce ONLY actions explicitly supported by the section text or the user's explicit message.
- Never invent stat changes, items, or flags.
- If combat is required, emit a start_combat action. DO NOT simulate combat.
- If uncertain, emit no actions and explain briefly in gmMessage.

Structured output constraints:
- You MUST return JSON matching the schema exactly.
- Because all fields are required, for fields that do not apply to an action type, use neutral defaults:
  stat: "endurance"
  delta: 0
  value: 0
  item: ""
  flag: ""
  flagValue: false
  enemyName: ""
- Only the fields relevant to the action type should be non-default.

Output MUST be valid JSON. Do not include markdown.
`.trim();

    const user = `
SECTION ${body.sectionId} TEXT:
${body.sectionText}

CHOICES:
${body.choices.map((c) => `- (${c.to}) ${c.label}`).join("\n")}

CURRENT ACTION SHEET:
${JSON.stringify(body.sheet, null, 2)}

USER MESSAGE:
${body.userMessage || "(none)"}
`.trim();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        gmMessage: { type: "string" },
        actions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: [
                  "update_stat",
                  "set_stat",
                  "add_item",
                  "remove_item",
                  "set_flag",
                  "start_combat",
                ],
              },
              reason: { type: "string" },

              stat: { type: "string", enum: ["endurance", "combatSkill", "gold"] },
              delta: { type: "integer" },
              value: { type: "integer" },

              item: { type: "string" },

              flag: { type: "string" },
              flagValue: { type: "boolean" },

              enemyName: { type: "string" },
            },
            // REQUIRED MUST INCLUDE ALL PROPERTIES
            required: [
              "type",
              "reason",
              "stat",
              "delta",
              "value",
              "item",
              "flag",
              "flagValue",
              "enemyName",
            ],
          },
        },
      },
      required: ["gmMessage", "actions"],
    } as const;

    const resp = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "interpret_result",
          strict: true,
          schema,
        },
      },
    });

    const text = resp.output_text?.trim() ?? "";
    const parsedJson = JSON.parse(text);

    const validated = InterpretResult.parse(parsedJson);
    return NextResponse.json(validated, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Interpret error", detail: String(err) },
      { status: 400 }
    );
  }
}
