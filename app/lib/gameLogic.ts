import { CRT, type CRTCell } from "./crt";

export interface Inventory {
  weapons: string[]; // Two weapon slots
  pouch: number; // Gold stored as int
  backpack: string[]; // Holds 8 items
  special: Array<[string, string]>; // Tuple of [location, item], e.g., ["head", "helmet"]
}

export type ActionSheet = {
  endurance: number;
  combatSkill: number;
  inventory: Inventory;
  flags: Record<string, boolean>;
  removedChoices: number[];
};

export type Enemy = {
  enemyType: string;
  enemyName: string;
  combatSkill: number;
  endurance: number;
  enemyModifier?: number;
};

export type Combat = {
  combatModifier?: number;
  enemy: Enemy[];
};

export type CombatRound = {
  round: number;
  combatRatio: number;
  randomNumber: number;
  enemyDamage: number | "K";
  loneWolfDamage: number | "K";
  enemyEnduranceBefore: number;
  enemyEnduranceAfter: number;
  loneWolfEnduranceBefore: number;
  loneWolfEnduranceAfter: number;
  message: string;
};

export type CombatResult = {
  updatedSheet: ActionSheet;
  enemyEndurance: number;
  combatLog: string[];
  rounds: CombatRound[];
  winner: "Lone Wolf" | "Enemy" | null;
};

export type MultiCombatResult = {
  updatedSheet: ActionSheet;
  combatLog: string[];
  allRounds: CombatRound[];
  winners: Array<{ enemy: Enemy; winner: "Lone Wolf" | "Enemy" | null }>;
  overallWinner: "Lone Wolf" | "Enemy" | null;
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
  combat: Combat;
};

export type CombatModifiers = {
  combatSkillBonus?: number;
};

// Get a random number from 0-9 (Random Number Table)
function getRandomNumber(): number {
  return Math.floor(Math.random() * 10);
}

// Clamp ratio to valid CRT range (-11 to 11)
function clampRatio(ratio: number): number {
  if (ratio < -11) return -11;
  if (ratio > 11) return 11;
  return ratio;
}

// Resolve a single round of combat
export function resolveCombat(
  sheet: ActionSheet,
  enemy: Enemy,
  modifiers: CombatModifiers = {},
  evade: boolean = false
): CombatResult {
  const combatLog: string[] = [];
  const rounds: CombatRound[] = [];
  let loneWolfEndurance = sheet.endurance;
  let enemyEndurance = enemy.endurance;
  let roundNumber = 1;

  const combatSkillBonus = modifiers.combatSkillBonus ?? 0;
  const totalLoneWolfCS = sheet.combatSkill + combatSkillBonus;

  const enemyDisplayName = enemy.enemyName || enemy.enemyType || "Enemy";
  const enemyModifier = enemy.enemyModifier ?? 0;
  const enemyCSDisplay = enemy.combatSkill + (enemyModifier !== 0 ? enemyModifier : 0);
  const enemyCSStr = enemyModifier !== 0 ? `${enemy.combatSkill} + ${enemyModifier} = ${enemyCSDisplay}` : `${enemy.combatSkill}`;
  combatLog.push(`Combat begins: ${enemyDisplayName} (CS: ${enemyCSStr}, EP: ${enemy.endurance}) vs Lone Wolf (CS: ${sheet.combatSkill}${combatSkillBonus !== 0 ? ` + ${combatSkillBonus}` : ""}, EP: ${loneWolfEndurance})`);

  // Combat loop continues until one character's endurance reaches 0 or below
  while (loneWolfEndurance > 0 && enemyEndurance > 0) {
    // Calculate Combat Ratio: (Lone Wolf CS + modifiers) - (Enemy CS + enemy modifiers)
    const enemyCombatSkill = enemy.combatSkill + (enemy.enemyModifier ?? 0);
    const combatRatio = totalLoneWolfCS - enemyCombatSkill;
    const clampedRatio = clampRatio(combatRatio);

    // Pick a number from the Random Number Table (0-9)
    const randomNumber = getRandomNumber();

    // Look up result in CRT
    const roundResult = getCRTResult(clampedRatio, randomNumber);

    // Store endurance before damage
    const enemyEnduranceBefore = enemyEndurance;
    const loneWolfEnduranceBefore = loneWolfEndurance;

    // Determine damage values (for logging)
    const enemyDamage: number | "K" = evade ? 0 : roundResult.enemy;
    const loneWolfDamage: number | "K" = roundResult.loneWolf;

    // Apply damage
    if (evade) {
      // Evasion: ignore enemy damage, only Lone Wolf takes damage
      if (roundResult.loneWolf === "K") {
        loneWolfEndurance = 0;
      } else {
        loneWolfEndurance -= roundResult.loneWolf;
      }
    } else {
      // Normal combat: both take damage
      if (roundResult.enemy === "K") {
        enemyEndurance = 0;
        combatLog.push(`${enemyDisplayName} is killed!`);
      } else {
        enemyEndurance -= roundResult.enemy;
      }

      if (roundResult.loneWolf === "K") {
        loneWolfEndurance = 0;
      } else {
        loneWolfEndurance -= roundResult.loneWolf;
      }
    }

    // Clamp endurance at >= 0
    loneWolfEndurance = Math.max(0, loneWolfEndurance);
    enemyEndurance = Math.max(0, enemyEndurance);

    // Create round log entry
    const isCritical = randomNumber === 0 || randomNumber === 1;
    const criticalTag = isCritical ? " CRITICAL" : "";
    let message = `Round ${roundNumber}: Ratio=${combatRatio}, Random=${randomNumber}${criticalTag} -> Enemy loses ${enemyDamage}, Lone Wolf loses ${loneWolfDamage}`;
    if (evade) {
      message += ` (Evading)`;
    }
    // Add running endurance totals
    message += ` | Enemy EP: ${enemyEndurance}, Lone Wolf EP: ${loneWolfEndurance}`;

    rounds.push({
      round: roundNumber,
      combatRatio,
      randomNumber,
      enemyDamage,
      loneWolfDamage,
      enemyEnduranceBefore,
      enemyEnduranceAfter: enemyEndurance,
      loneWolfEnduranceBefore,
      loneWolfEnduranceAfter: loneWolfEndurance,
      message,
    });

    combatLog.push(message);

    roundNumber++;

    if (loneWolfEndurance <= 0 || enemyEndurance <= 0) {
      break;
    }
  }

  // Determine winner
  let winner: "Lone Wolf" | "Enemy" | null = null;
  if (loneWolfEndurance <= 0 && enemyEndurance <= 0) {
    combatLog.push("Combat ends in mutual destruction!");
      } else if (loneWolfEndurance <= 0) {
        winner = "Enemy";
        combatLog.push(`${enemyDisplayName} wins! Lone Wolf is defeated.`);
      } else if (enemyEndurance <= 0) {
        winner = "Lone Wolf";
        combatLog.push(`Lone Wolf wins! ${enemyDisplayName} is defeated.`);
      }

  // Update the action sheet with new endurance
  const updatedSheet: ActionSheet = {
    ...sheet,
    endurance: loneWolfEndurance,
  };

  return {
    updatedSheet,
    enemyEndurance,
    combatLog,
    rounds,
    winner,
  };
}

// Helper to get CRT result from the CRT table
function getCRTResult(ratio: number, dieRoll: number): CRTCell {
  const ratioKey = ratio.toString();
  const ratioTable = CRT[ratioKey];
  if (!ratioTable) {
    // Fallback if ratio is out of range (shouldn't happen due to clamping)
    return { enemy: 0, loneWolf: 12 };
  }
  const result = ratioTable[dieRoll];
  if (!result) {
    // Fallback if dieRoll is invalid
    return { enemy: 0, loneWolf: 12 };
  }
  return result;
}

// Resolve combat against multiple enemies sequentially
export function resolveMultiCombat(
  sheet: ActionSheet,
  combat: Combat,
  modifiers: CombatModifiers = {},
  evade: boolean = false
): MultiCombatResult {
  const enemies = combat.enemy;
  // Combine combat-level modifier with Lone Wolf modifiers
  const totalCombatModifier = (combat.combatModifier ?? 0) + (modifiers.combatSkillBonus ?? 0);
  const adjustedModifiers: CombatModifiers = {
    combatSkillBonus: totalCombatModifier,
  };
  const allCombatLogs: string[] = [];
  const allRounds: CombatRound[] = [];
  const winners: Array<{ enemy: Enemy; winner: "Lone Wolf" | "Enemy" | null }> = [];
  
  let currentSheet = sheet;
  let overallWinner: "Lone Wolf" | "Enemy" | null = null;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) continue; // Skip if undefined
    
    // If Lone Wolf is already dead, skip remaining enemies
    if (currentSheet.endurance <= 0) {
      allCombatLogs.push(`\n${enemy.enemyName || enemy.enemyType} is not fought - Lone Wolf is already defeated.`);
      winners.push({ enemy, winner: "Enemy" });
      overallWinner = "Enemy";
      continue;
    }

    // Add separator between combats if multiple enemies
    if (i > 0) {
      allCombatLogs.push(`\n=== Next Combat ===`);
    }

    // Fight this enemy
    const combatResult = resolveCombat(currentSheet, enemy, adjustedModifiers, evade);
    
    // Append this combat's logs
    allCombatLogs.push(...combatResult.combatLog);
    allRounds.push(...combatResult.rounds);
    winners.push({ enemy, winner: combatResult.winner });
    
    // Update sheet for next combat
    currentSheet = combatResult.updatedSheet;

    // If Lone Wolf lost, stop fighting remaining enemies
    if (combatResult.winner === "Enemy") {
      overallWinner = "Enemy";
      if (i < enemies.length - 1) {
        allCombatLogs.push(`\nLone Wolf is defeated. Remaining enemies are not fought.`);
      }
      break;
    }
  }

  // If we fought all enemies and Lone Wolf survived, Lone Wolf wins overall
  if (overallWinner === null && currentSheet.endurance > 0) {
    overallWinner = "Lone Wolf";
  }

  return {
    updatedSheet: currentSheet,
    combatLog: allCombatLogs,
    allRounds,
    winners,
    overallWinner,
  };
}

export type ApplyActionsResult = {
  updatedSheet: ActionSheet;
  combatLog: string[];
};

export function applyActions(prev: ActionSheet, actions: Action[]): ApplyActionsResult {
  const next: ActionSheet = {
    ...prev,
    inventory: {
      weapons: [...prev.inventory.weapons],
      pouch: prev.inventory.pouch,
      backpack: [...prev.inventory.backpack],
      special: [...prev.inventory.special],
    },
    flags: { ...prev.flags },
    removedChoices: [...prev.removedChoices],
  };
  
  const combatLogs: string[] = [];

  for (const a of actions) {
    if (a.type === "update_stat") {
      if (a.stat === "endurance") {
        next.endurance = (next.endurance ?? 0) + a.delta;
      } else if (a.stat === "combatSkill") {
        next.combatSkill = (next.combatSkill ?? 0) + a.delta;
      } else if (a.stat === "gold") {
        next.inventory.pouch = (next.inventory.pouch ?? 0) + a.delta;
      }
    } else if (a.type === "set_stat") {
      if (a.stat === "endurance") {
        next.endurance = a.value;
      } else if (a.stat === "combatSkill") {
        next.combatSkill = a.value;
      } else if (a.stat === "gold") {
        next.inventory.pouch = a.value;
      }
    } else if (a.type === "add_item") {
      // For now, add items to backpack. This can be refined later to handle weapons and special items.
      if (!next.inventory.backpack.includes(a.item)) {
        next.inventory.backpack.push(a.item);
      }
    } else if (a.type === "remove_item") {
      // Remove from backpack, weapons, or special items
      next.inventory.backpack = next.inventory.backpack.filter((x) => x !== a.item);
      next.inventory.weapons = next.inventory.weapons.filter((x) => x !== a.item);
      next.inventory.special = next.inventory.special.filter((tuple) => tuple[1] !== a.item);
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
      // Fight all enemies in the combat struct sequentially
      if (a.combat && a.combat.enemy && a.combat.enemy.length > 0) {
        // Calculate combat modifiers from flags/disciplines
        const modifiers: CombatModifiers = {
          combatSkillBonus: 0, // TODO: Calculate from disciplines/flags
        };
        const multiCombatResult = resolveMultiCombat(next, a.combat, modifiers, false);
        next.endurance = multiCombatResult.updatedSheet.endurance;
        next.inventory = multiCombatResult.updatedSheet.inventory;
        next.flags = multiCombatResult.updatedSheet.flags;
        next.removedChoices = multiCombatResult.updatedSheet.removedChoices;
        combatLogs.push(...multiCombatResult.combatLog);
      }
    }
  }

  // Clamp endurance at >= 0
  next.endurance = Math.max(0, next.endurance);

  return {
    updatedSheet: next,
    combatLog: combatLogs,
  };
}

