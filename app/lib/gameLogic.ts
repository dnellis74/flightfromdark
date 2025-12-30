export type ActionSheet = {
  endurance: number;
  combatSkill: number;
  gold: number;
  items: string[];
  flags: Record<string, boolean>;
  removedChoices: number[];
};

export type Action = {
  type: "update_stat" | "set_stat" | "add_item" | "remove_item" | "set_flag" | "start_combat" | "remove_choice";
  reason: string;
  stat: "endurance" | "combatSkill" | "gold";
  delta: number;
  value: number;
  item: string;
  flag: string;
  flagValue: boolean;
  enemyName: string;
};

export function applyActions(prev: ActionSheet, actions: Action[]): ActionSheet {
  const next: ActionSheet = {
    ...prev,
    items: [...prev.items],
    flags: { ...prev.flags },
    removedChoices: [...prev.removedChoices],
  };

  for (const a of actions) {
    if (a.type === "update_stat") {
      if (a.stat === "endurance") {
        next.endurance = (next.endurance ?? 0) + a.delta;
      } else if (a.stat === "combatSkill") {
        next.combatSkill = (next.combatSkill ?? 0) + a.delta;
      } else if (a.stat === "gold") {
        next.gold = (next.gold ?? 0) + a.delta;
      }
    } else if (a.type === "set_stat") {
      if (a.stat === "endurance") {
        next.endurance = a.value;
      } else if (a.stat === "combatSkill") {
        next.combatSkill = a.value;
      } else if (a.stat === "gold") {
        next.gold = a.value;
      }
    } else if (a.type === "add_item") {
      if (!next.items.includes(a.item)) next.items.push(a.item);
    } else if (a.type === "remove_item") {
      next.items = next.items.filter((x) => x !== a.item);
    } else if (a.type === "set_flag") {
      next.flags[a.flag] = a.flagValue;
    } else if (a.type === "remove_choice") {
      // Track the section ID of the choice to remove
      // value should contain the section ID (the 'to' field from the choice)
      const choiceSectionId = a.value;
      if (choiceSectionId > 0 && !next.removedChoices.includes(choiceSectionId)) {
        next.removedChoices.push(choiceSectionId);
      }
    } else if (a.type === "start_combat") {
      // POC: surface only. Next step is deterministic combat engine.
    }
  }

  // Clamp endurance at >= 0
  next.endurance = Math.max(0, next.endurance);

  return next;
}

