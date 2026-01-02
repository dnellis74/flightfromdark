"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { applyActions, type ActionSheet, type Action } from "../lib/gameLogic";
import { SKIP_LLM_SECTIONS } from "../api/interpret/route";

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

type Choice = { label: string; to: number; isDroppedItem?: boolean; itemName?: string };

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
    droppedItems: {},
  });

  const [assistantMsg, setAssistantMsg] = useState<string>("");
  const [lastActions, setLastActions] = useState<Action[]>([]);
  const [interpretErr, setInterpretErr] = useState<string>("");
  const [interpreting, setInterpreting] = useState<boolean>(false);
  const [combatLog, setCombatLog] = useState<string[]>([]);

  // Handler for dropping items
  const handleDropItem = (item: string, currentSectionId: number) => {
    const dropItemAction: Action = {
      type: "drop_item",
      reason: `Dropped ${item} at section ${currentSectionId}`,
      stat: "endurance",
      delta: 0,
      value: 0,
      item: item,
      flag: "",
      flagValue: false,
      combat: { combatModifier: 0, enemy: [] },
      sectionId: currentSectionId,
    };
    
    const removeItemAction: Action = {
      type: "remove_item",
      reason: `Removed ${item} from inventory`,
      stat: "endurance",
      delta: 0,
      value: 0,
      item: item,
      flag: "",
      flagValue: false,
      combat: { combatModifier: 0, enemy: [] },
    };
    
    const result = applyActions(sheet, [dropItemAction, removeItemAction], currentSectionId);
    setSheet(result.updatedSheet);
    if (result.combatLog.length > 0) {
      setCombatLog(result.combatLog);
    }
  };

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
    
    // Add choices for dropped items at this section
    const droppedItemsForSection = sheet.droppedItems[id] || [];
    
    // Debug logging
    if (droppedItemsForSection.length > 0) {
      console.log(`[Section ${id}] Dropped items found:`, droppedItemsForSection);
    }
    
    const droppedItemChoices: Choice[] = droppedItemsForSection.map((item) => ({
      label: `Pick up ${item}`,
      to: id, // Stay on same section
      isDroppedItem: true,
      itemName: item,
    }));
    
    const sectionWithDroppedItems = {
      ...baseSection,
      choices: [...baseSection.choices, ...droppedItemChoices],
    };
    
    // Append combat log to section paragraphs if present
    if (combatLog.length > 0) {
      return {
        ...sectionWithDroppedItems,
        paragraphs: [...sectionWithDroppedItems.paragraphs, "", "=== COMBAT LOG ===", ...combatLog],
      };
    }
    return sectionWithDroppedItems;
  }, [rawHtml, id, combatLog, sheet.droppedItems]);

  // 2) Interpret section with LLM (once per section entry)
  useEffect(() => {
    let cancelled = false;

    async function interpret() {
      if (!section) return;
      
      // Skip LLM processing if section ID is in the skip list
      if (SKIP_LLM_SECTIONS.includes(section.id)) {
        setAssistantMsg(`This section (${section.id}) is configured to skip LLM processing. You can proceed with the available choices.`);
        setLastActions([]);
        setInterpreting(false);
        return;
      }

      setInterpretErr("");
      setInterpreting(true);

      try {
        const sectionText = section.paragraphs.join("\n\n");
        // Filter out already-removed choices and dropped item choices before sending to API
        const availableChoices = section.choices
          .filter((c) => !c.isDroppedItem && !sheet.removedChoices.includes(c.to))
          .map(({ isDroppedItem: _, itemName: __, ...choice }) => choice); // Remove dropped item fields

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
          // Debug: log drop_item actions
          const dropItemActions = out.actions.filter((a: Action) => a.type === "drop_item");
          if (dropItemActions.length > 0) {
            console.log("Drop item actions received:", dropItemActions);
          }
          
          const result = applyActions(sheet, out.actions, section.id);
          
          // Debug: log updated droppedItems
          if (Object.keys(result.updatedSheet.droppedItems).length > 0) {
            console.log("Updated droppedItems:", result.updatedSheet.droppedItems);
          }
          
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
            <div style={{ fontSize: isMobile ? 13 : 14, marginTop: 4 }}>
              <div style={{ marginBottom: 4 }}>Weapons:</div>
              {sheet.inventory.weapons.map((weapon, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, marginTop: 2 }}>
                  <span>{weapon}</span>
                  <button
                    onClick={() => handleDropItem(weapon, section?.id || id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#d32f2f",
                      cursor: "pointer",
                      fontSize: isMobile ? 16 : 14,
                      fontWeight: 700,
                      padding: "0 4px",
                      lineHeight: 1,
                      minWidth: 20,
                      minHeight: 20,
                    }}
                    title={`Drop ${weapon}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {sheet.inventory.backpack.length > 0 && (
            <div style={{ fontSize: isMobile ? 13 : 14, marginTop: 4 }}>
              <div style={{ marginBottom: 4 }}>Backpack:</div>
              {sheet.inventory.backpack.map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, marginTop: 2 }}>
                  <span>{item}</span>
                  <button
                    onClick={() => handleDropItem(item, section?.id || id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#d32f2f",
                      cursor: "pointer",
                      fontSize: isMobile ? 16 : 14,
                      fontWeight: 700,
                      padding: "0 4px",
                      lineHeight: 1,
                      minWidth: 20,
                      minHeight: 20,
                    }}
                    title={`Drop ${item}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {sheet.inventory.special.length > 0 && (
            <div style={{ fontSize: isMobile ? 13 : 14, marginTop: 4 }}>
              <div style={{ marginBottom: 4 }}>Special:</div>
              {sheet.inventory.special.map(([loc, item], idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, marginTop: 2 }}>
                  <span>{loc}: {item}</span>
                  <button
                    onClick={() => handleDropItem(item, section?.id || id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#d32f2f",
                      cursor: "pointer",
                      fontSize: isMobile ? 16 : 14,
                      fontWeight: 700,
                      padding: "0 4px",
                      lineHeight: 1,
                      minWidth: 20,
                      minHeight: 20,
                    }}
                    title={`Drop ${item}`}
                  >
                    ×
                  </button>
                </div>
              ))}
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
              const availableChoices = section.choices.filter((c) => 
                c.isDroppedItem || !sheet.removedChoices.includes(c.to)
              );
              return availableChoices.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 8 }}>
                  {availableChoices.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (c.isDroppedItem && c.itemName) {
                          // Emit add_item action for dropped item
                          const itemName = c.itemName;
                          const addItemAction: Action = {
                            type: "add_item",
                            reason: `Picked up ${itemName} from section ${section.id}`,
                            stat: "endurance",
                            delta: 0,
                            value: 0,
                            item: itemName,
                            flag: "",
                            flagValue: false,
                            combat: { combatModifier: 0, enemy: [] },
                          };
                          
                          const result = applyActions(sheet, [addItemAction]);
                          setSheet(result.updatedSheet);
                          
                          // Remove from dropped items
                          setSheet((prev) => {
                            const newDroppedItems = { ...prev.droppedItems };
                            const sectionId = section?.id;
                            if (sectionId && newDroppedItems[sectionId]) {
                              const filtered = newDroppedItems[sectionId].filter((item) => item !== itemName);
                              if (filtered.length === 0) {
                                delete newDroppedItems[sectionId];
                              } else {
                                newDroppedItems[sectionId] = filtered;
                              }
                            }
                            return {
                              ...prev,
                              droppedItems: newDroppedItems,
                            };
                          });
                        } else {
                          // Regular choice - navigate to section
                          setId(c.to);
                        }
                      }}
                      disabled={interpreting && !c.isDroppedItem}
                      style={{
                        textAlign: "left",
                        padding: isMobile ? "14px 12px" : 10,
                        minHeight: isMobile ? 50 : "auto",
                        fontSize: isMobile ? 15 : 16,
                        opacity: (interpreting && !c.isDroppedItem) ? 0.5 : 1,
                        cursor: (interpreting && !c.isDroppedItem) ? "not-allowed" : "pointer",
                        borderRadius: 6,
                        border: "1px solid #ddd",
                        background: (interpreting && !c.isDroppedItem) ? "#f5f5f5" : c.isDroppedItem ? "#e8f5e9" : "#fff",
                        color: "#000",
                      }}
                    >
                      {c.isDroppedItem ? c.label : `${c.label} (→ ${c.to})`}
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
