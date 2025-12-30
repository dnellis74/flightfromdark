"use client";

import React, { useEffect, useMemo, useState } from "react";

type Choice = { label: string; to: number };

type Section = {
  id: number;
  paragraphs: string[];
  choices: Choice[];
  sourceUrl: string;
};

type Sheet = {
  endurance: number;
  combatSkill: number;
  gold: number;
  items: string[];
  flags: Record<string, boolean>;
};

type AnyAction = any;

function applyActions(prev: Sheet, actions: AnyAction[]): Sheet {
  let next: Sheet = {
    ...prev,
    items: [...prev.items],
    flags: { ...prev.flags },
  };

  for (const a of actions) {
    if (a.type === "update_stat") {
      (next as any)[a.stat] = ((next as any)[a.stat] ?? 0) + a.delta;
    } else if (a.type === "set_stat") {
      (next as any)[a.stat] = a.value;
    } else if (a.type === "add_item") {
      if (!next.items.includes(a.item)) next.items.push(a.item);
    } else if (a.type === "remove_item") {
      next.items = next.items.filter((x) => x !== a.item);
    } else if (a.type === "set_flag") {
      next.flags[a.flag] = a.value;
    } else if (a.type === "start_combat") {
      // POC: surface only. Next step is deterministic combat engine.
    }
  }

  // Clamp endurance at >= 0
  next.endurance = Math.max(0, next.endurance);

  return next;
}

function extractLiveSection(html: string, currentId: number): Section {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const main = doc.querySelector("div.maintext") || doc.querySelector("article") || doc.body;

  main.querySelectorAll("script, style").forEach((n) => n.remove());

  const h3Text = main.querySelector("h3")?.textContent?.trim() ?? "";
  const id = /^\d+$/.test(h3Text) ? Number(h3Text) : currentId;

  const paragraphs = Array.from(main.querySelectorAll("p"))
    .filter((p) => !p.classList.contains("choice"))
    .map((p) => (p.textContent ?? "").trim())
    .filter(Boolean);

  const choices: Choice[] = [];
  main.querySelectorAll("p.choice").forEach((p) => {
    const a = p.querySelector("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const m = href.match(/sect(\d+)\.htm/i);
    if (!m) return;
    const to = Number(m[1]);
    const label = (p.textContent || "").trim() || `Turn to ${to}`;
    choices.push({ label, to });
  });

  return {
    id,
    paragraphs,
    choices,
    sourceUrl: `https://www.projectaon.org/en/xhtml/lw/01fftd/sect${id}.htm`,
  };
}

export default function SectionViewer() {
  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [rawHtml, setRawHtml] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const [sheet, setSheet] = useState<Sheet>({
    endurance: 25,
    combatSkill: 15,
    gold: 0,
    items: [],
    flags: {},
  });

  const [assistantMsg, setAssistantMsg] = useState<string>("");
  const [lastActions, setLastActions] = useState<AnyAction[]>([]);
  const [interpretErr, setInterpretErr] = useState<string>("");

  // 1) Fetch section HTML
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`/api/sect/${id}`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const html = await res.text();
        if (!cancelled) setRawHtml(html);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const section = useMemo(() => {
    if (!rawHtml) return null;
    return extractLiveSection(rawHtml, id);
  }, [rawHtml, id]);

  // 2) Interpret section with LLM (once per section entry)
  useEffect(() => {
    let cancelled = false;

    async function interpret() {
      if (!section) return;

      setInterpretErr("");

      try {
        const sectionText = section.paragraphs.join("\n\n");

        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: section.id,
            sectionText,
            choices: section.choices,
            sheet,
            userMessage: "", // later: wire a text input into this
          }),
        });

        if (!res.ok) throw new Error(`Interpret failed: ${res.status}`);
        const out = await res.json();

        if (cancelled) return;

        setAssistantMsg(out.gmMessage || "");
        setLastActions(Array.isArray(out.actions) ? out.actions : []);

        if (Array.isArray(out.actions) && out.actions.length) {
          setSheet((prev) => applyActions(prev, out.actions));
        }
      } catch (e: unknown) {
        if (!cancelled) setInterpretErr(e instanceof Error ? e.message : "Interpret error");
      }
    }

    interpret();

    return () => {
      cancelled = true;
    };

    // IMPORTANT:
    // Depend ONLY on section.id so we don't loop when sheet updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Action Sheet</div>
          <div>Combat Skill: {sheet.combatSkill}</div>
          <div>Endurance: {sheet.endurance}</div>
          <div>Gold: {sheet.gold}</div>
          {sheet.items.length ? <div>Items: {sheet.items.join(", ")}</div> : <div>Items: (none)</div>}
        </div>

        <div style={{ flex: 2, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Assistant</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{assistantMsg || "(no message yet)"}</div>
          {interpretErr ? <div style={{ color: "crimson", marginTop: 8 }}>{interpretErr}</div> : null}

          {lastActions.length ? (
            <details style={{ marginTop: 8 }}>
              <summary>Actions</summary>
              <pre style={{ fontSize: 12, overflowX: "auto" }}>{JSON.stringify(lastActions, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label>
          Section:&nbsp;
          <input
            value={id}
            onChange={(e) => setId(Math.max(1, Number(e.target.value || "1")))}
            type="number"
            min={1}
            style={{ width: 120 }}
          />
        </label>
        <button onClick={() => setId((x) => Math.max(1, x - 1))}>Prev</button>
        <button onClick={() => setId((x) => x + 1)}>Next</button>
        {loading ? <span>Loading…</span> : null}
        {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
      </div>

      {section ? (
        <>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            Source:{" "}
            <a href={section.sourceUrl} target="_blank" rel="noreferrer">
              Project Aon sect{section.id}
            </a>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              lineHeight: 1.5,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Section {section.id}</div>

            {section.paragraphs.length ? (
              section.paragraphs.map((t, idx) => (
                <p key={idx} style={{ margin: "10px 0" }}>
                  {t}
                </p>
              ))
            ) : (
              <p style={{ opacity: 0.7 }}>No narrative text detected.</p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "8px 0" }}>Choices</h3>

            {section.choices.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {section.choices.map((c, idx) => (
                  <button key={idx} onClick={() => setId(c.to)} style={{ textAlign: "left", padding: 10 }}>
                    {c.label} (→ {c.to})
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.7 }}>No choices detected on this section.</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
