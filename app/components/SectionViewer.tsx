"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { applyActions, type ActionSheet, type Action } from "../lib/gameLogic";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

type Choice = { label: string; to: number };

type Section = {
  id: number;
  paragraphs: string[];
  choices: Choice[];
  sourceUrl: string;
};

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
  const isMobile = useIsMobile();
  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [rawHtml, setRawHtml] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const [sheet, setSheet] = useState<ActionSheet>({
    endurance: 25,
    combatSkill: 15,
    inventory: {
      weapons: ["Axe"],
      pouch: 0,
      backpack: [],
      special: [],
    },
    flags: {"Sixth Sense": true},
    removedChoices: [],
  });

  const [assistantMsg, setAssistantMsg] = useState<string>("");
  const [lastActions, setLastActions] = useState<Action[]>([]);
  const [interpretErr, setInterpretErr] = useState<string>("");
  const [interpreting, setInterpreting] = useState<boolean>(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);

  // 1) Fetch section HTML
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr("");
      setCombatLog([]); // Clear combat log when changing sections
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
    const baseSection = extractLiveSection(rawHtml, id);
    // Append combat log to section paragraphs if present
    if (combatLog.length > 0) {
      return {
        ...baseSection,
        paragraphs: [...baseSection.paragraphs, "", "=== COMBAT LOG ===", ...combatLog],
      };
    }
    return baseSection;
  }, [rawHtml, id, combatLog]);

  // 2) Interpret section with LLM (once per section entry)
  useEffect(() => {
    let cancelled = false;

    async function interpret() {
      if (!section) return;

      setInterpretErr("");
      setInterpreting(true);

      try {
        const sectionText = section.paragraphs.join("\n\n");
        // Filter out already-removed choices before sending to API
        const availableChoices = section.choices.filter((c) => !sheet.removedChoices.includes(c.to));

        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: section.id,
            sectionText,
            choices: availableChoices,
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
          const result = applyActions(sheet, out.actions);
          setSheet(result.updatedSheet);
          if (result.combatLog.length > 0) {
            setCombatLog(result.combatLog);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setInterpretErr(e instanceof Error ? e.message : "Interpret error");
      } finally {
        if (!cancelled) setInterpreting(false);
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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? 12 : 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 12, marginBottom: 12 }}>
        <div style={{ flex: isMobile ? "none" : 1, border: "1px solid #ddd", borderRadius: 8, padding: isMobile ? 10 : 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: isMobile ? 14 : 16 }}>Action Sheet</div>
          <div style={{ fontSize: isMobile ? 13 : 14 }}>Combat Skill: {sheet.combatSkill}</div>
          <div style={{ fontSize: isMobile ? 13 : 14 }}>Endurance: {sheet.endurance}</div>
          <div style={{ fontSize: isMobile ? 13 : 14 }}>Gold: {sheet.inventory.pouch}</div>
          {sheet.inventory.weapons.length > 0 && (
            <div style={{ fontSize: isMobile ? 13 : 14, marginTop: 4 }}>Weapons: {sheet.inventory.weapons.join(", ") || "(none)"}</div>
          )}
          {sheet.inventory.backpack.length > 0 && (
            <div style={{ fontSize: isMobile ? 13 : 14, marginTop: 4 }}>Backpack: {sheet.inventory.backpack.join(", ")}</div>
          )}
          {sheet.inventory.special.length > 0 && (
            <div style={{ fontSize: isMobile ? 13 : 14, marginTop: 4 }}>
              Special: {sheet.inventory.special.map(([loc, item]) => `${loc}: ${item}`).join(", ")}
            </div>
          )}
        </div>

        <div style={{ flex: isMobile ? "none" : 2, border: "1px solid #ddd", borderRadius: 8, padding: isMobile ? 10 : 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: isMobile ? 14 : 16 }}>Assistant</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: isMobile ? 13 : 14 }}>{assistantMsg || "(no message yet)"}</div>
          {interpretErr ? <div style={{ color: "crimson", marginTop: 8, fontSize: isMobile ? 12 : 14 }}>{interpretErr}</div> : null}

          {lastActions.length ? (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: isMobile ? 12 : 14 }}>Actions</summary>
              <pre style={{ fontSize: 11, overflowX: "auto" }}>{JSON.stringify(lastActions, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 6 : 8, alignItems: "center", marginBottom: 12 }}>
        <label style={{ fontSize: isMobile ? 14 : 16 }}>
          Section:&nbsp;
          <input
            value={id}
            onChange={(e) => setId(Math.max(1, Number(e.target.value || "1")))}
            type="number"
            min={1}
            style={{ width: isMobile ? 80 : 120, padding: "6px 8px", fontSize: isMobile ? 14 : 16 }}
          />
        </label>
        <button
          onClick={() => setId((x) => Math.max(1, x - 1))}
          style={{
            minHeight: isMobile ? 44 : "auto",
            minWidth: isMobile ? 60 : "auto",
            padding: isMobile ? "10px 16px" : "6px 12px",
            fontSize: isMobile ? 14 : 16,
          }}
        >
          Prev
        </button>
        <button
          onClick={() => setId((x) => x + 1)}
          style={{
            minHeight: isMobile ? 44 : "auto",
            minWidth: isMobile ? 60 : "auto",
            padding: isMobile ? "10px 16px" : "6px 12px",
            fontSize: isMobile ? 14 : 16,
          }}
        >
          Next
        </button>
        {loading ? <span style={{ fontSize: isMobile ? 14 : 16 }}>Loading…</span> : null}
        {err ? <span style={{ color: "crimson", fontSize: isMobile ? 13 : 14 }}>{err}</span> : null}
      </div>

      {section ? (
        <>
          <div style={{ fontSize: isMobile ? 11 : 12, marginBottom: 8, color: "#333" }}>
            Source:{" "}
            <a href={section.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#0066cc" }}>
              Project Aon sect{section.id}
            </a>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: isMobile ? 12 : 16,
              lineHeight: 1.5,
              background: "#fff",
              color: "#000",
            }}
          >
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, marginBottom: 10, color: "#000" }}>Section {section.id}</div>

            {section.paragraphs.length ? (
              section.paragraphs.map((t, idx) => (
                <p key={idx} style={{ margin: "10px 0", fontSize: isMobile ? 14 : 16, color: "#000" }}>
                  {t}
                </p>
              ))
            ) : (
              <p style={{ opacity: 0.7, fontSize: isMobile ? 14 : 16, color: "#333" }}>No narrative text detected.</p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "8px 0", fontSize: isMobile ? 16 : 18 }}>Choices</h3>

            {(() => {
              const availableChoices = section.choices.filter((c) => !sheet.removedChoices.includes(c.to));
              return availableChoices.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 8 }}>
                  {availableChoices.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => setId(c.to)}
                      disabled={interpreting}
                      style={{
                        textAlign: "left",
                        padding: isMobile ? "14px 12px" : 10,
                        minHeight: isMobile ? 50 : "auto",
                        fontSize: isMobile ? 15 : 16,
                        opacity: interpreting ? 0.5 : 1,
                        cursor: interpreting ? "not-allowed" : "pointer",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        background: interpreting ? "#f5f5f5" : "#fff",
                        color: "#000",
                      }}
                    >
                      {c.label} (→ {c.to})
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.7, fontSize: isMobile ? 14 : 16, color: "#333" }}>No choices available on this section.</div>
              );
            })()}
          </div>
        </>
      ) : null}
            <details
        style={{
          marginBottom: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: isMobile ? 10 : 12,
          background: "#fff",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 700,
            fontSize: isMobile ? 14 : 16,
            padding: "4px 0",
            userSelect: "none",
          }}
        >
          Map of Sommerlund
        </summary>
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            borderRadius: 6,
            overflow: "hidden",
            background: "#f5f5f5",
            padding: isMobile ? 8 : 12,
          }}
        >
          <Image
            src="https://www.projectaon.org/en/xhtml/lw/01fftd/map.png"
            alt="Map of Sommerlund"
            width={1024}
            height={768}
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            unoptimized
          />
        </div>
      </details>
    </div>
  
  );
}
