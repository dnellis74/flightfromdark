import OpenAI from "openai";
import { z } from "zod";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Shared constants ----
const ACTION_TYPES = ["update_stat", "set_stat", "drop_item", "add_item", "remove_item", "set_flag", "start_combat", "remove_choice"] as const;

// ---- Request schema (client -> server) ----
const RequestBody = z.object({
  sectionId: z.number().int(),
  sectionText: z.string(),
  choices: z.array(z.object({ to: z.number().int(), label: z.string() })),
  sheet: z.object({
    endurance: z.number().int(),
    combatSkill: z.number().int(),
    inventory: z.object({
      weapons: z.array(z.string()),
      pouch: z.number().int(),
      backpack: z.array(z.string()),
      special: z.array(z.tuple([z.string(), z.string()])),
    }),
    flags: z.record(z.string(), z.boolean()),
    removedChoices: z.array(z.number().int()),
    droppedItems: z.record(z.number().int(), z.array(z.string())),
  }),
  userMessage: z.string().optional().default(""),
});

// ---- Response schema (server -> client) ----
// IMPORTANT: OpenAI Structured Outputs enforces that for any object schema,
// `required` must include EVERY key in `properties`. That effectively forbids optional fields.
// Workaround: use a "wide" action object with neutral defaults for unused fields.
const EnemySchema = z.object({
  enemyType: z.string(),
  enemyName: z.string(),
  combatSkill: z.number().int(),
  endurance: z.number().int(),
  enemyModifier: z.number().int().optional().default(0),
});

const CombatSchema = z.object({
  combatModifier: z.number().int().optional().default(0),
  enemy: z.array(EnemySchema),
});

const ActionWide = z
  .object({
    type: z.enum(ACTION_TYPES),
    reason: z.string(),

    // Always present (neutral defaults when unused)
    stat: z.enum(["endurance", "combatSkill", "gold"]),
    delta: z.number().int(),
    value: z.number().int(),

    item: z.string(),

    flag: z.string(),
    flagValue: z.boolean(),

    combat: CombatSchema,
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
- ONLY emita ctions explicitly supported by the section text or the user's explicit message.
- Never invent stat changes, items, or flags.
- DO NOT simulate combat. If combat is required, emit a start_combat action.
- If uncertain, emit no actions and explain briefly in gmMessage.
- If a game rule prohibits a choice, remove that choice from the choices array.
- If a section ends with a single instruction like "Turn to 19." and no alternatives are presented, treat it as a mandatory continuation, not a choice. Do not remove it and do not label it as a choice.
- If the section text or choices state you must turn to a specific section due to condition, emit a remove_choice action with value set to the section to be removed.
- If a choice requires a discipline
-- Check the flags in the action sheet for the discipline.
-- If a flag for the discipline is not present emit a remove_choice action with value set to the choice's 'to' field (the section ID the choice leads to).

Random Number Table:
- If asked to pick a number from the Random Number Table.
- Generate a random number between 0 and 9.
- Add the number to the section text.
- The number should indicate which choice the player must make.  Keep that choice and emit a remove_choice action not rolled.
- Emit stat changes as required by outcome of the random number.
Item handling:
- When an item is available to pick up in the section text, emit a drop_item action with item set to the item name.
- DO NOT emit add_item actions. The player will pick up items themselves by clicking the choice that appears.
- DO NOT automatically add items to inventory. Only emit drop_item events to make items available as choices.
- The drop_item action does not need sectionId - it will automatically use the current section.

Structured output hard constraints:
- You MUST return JSON matching the schema exactly.
- Because all fields are required, for fields that do not apply to an action type, use neutral defaults:
  stat: "endurance"
  delta: 0
  value: 0
  item: ""
  flag: ""
  flagValue: false
  combat: { combatModifier: 0, enemy: [] }
- Only the fields relevant to the action type should be non-default.
- For remove_choice: set value to the section ID (the 'to' field from the choice object, e.g., if choice is {to: 150, label: "Go north"}, set value: 150)
- For start_combat: set combat to an object with:
  - combatModifier: integer (optional, defaults to 0, combat skill bonus/penalty applied to Lone Wolf for this combat)
  - enemy: array of enemy objects. Each enemy object must have:
    - enemyType: string (e.g., "Giant Vulture", "Giak", "Doomwolf")
    - enemyName: string (e.g., "Vicious Vulture", "Giak Warrior", "Pack Leader")
    - combatSkill: integer (the enemy's combat skill)
    - endurance: integer (the enemy's endurance points)
    - enemyModifier: integer (required, any combat skill bonus/penalty specific to this enemy)
  If combat involves multiple enemies, include all of them in the enemy array. For single enemy combat, use an array with one enemy object.

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
                enum: ACTION_TYPES,
              },
              reason: { type: "string" },

              stat: { type: "string", enum: ["endurance", "combatSkill", "gold"] },
              delta: { type: "integer" },
              value: { type: "integer" },

              item: { type: "string" },

              flag: { type: "string" },
              flagValue: { type: "boolean" },

              combat: {
                type: "object",
                additionalProperties: false,
                properties: {
                  combatModifier: { type: "integer" },
                  enemy: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        enemyType: { type: "string" },
                        enemyName: { type: "string" },
                        combatSkill: { type: "integer" },
                        endurance: { type: "integer" },
                        enemyModifier: { type: "integer" },
                      },
                      required: ["enemyType", "enemyName", "combatSkill", "endurance", "enemyModifier"],
                    },
                  },
                },
                required: ["combatModifier", "enemy"],
              },
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
              "combat",
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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Interpret error";
    return NextResponse.json(
      { error: errorMessage, detail: String(err) },
      { status: 400 }
    );
  }
}
