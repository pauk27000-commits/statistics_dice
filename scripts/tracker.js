import { StatisticsStorage } from './storage.js';
import { AchievementManager } from './achievements.js';

export class DiceTracker {
    static HOOK_KEY = '__statisticsDiceTrackerHook';

    static init() {
        if (globalThis[DiceTracker.HOOK_KEY]) {
            Hooks.off('createChatMessage', globalThis[DiceTracker.HOOK_KEY]);
        }

        const handler = this._onChatMessage.bind(this);
        globalThis[DiceTracker.HOOK_KEY] = handler;
        Hooks.on('createChatMessage', handler);
    }

    static _stripHtml(text) {
        return String(text || '')
            .replace(/<\/(div|p|h\d|li|tr)>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static _getMessageSearchTexts(message) {
        return {
            alias: this._stripHtml(message.speaker?.alias || '').toLowerCase(),
            flavorText: this._stripHtml(message.flavor || '').toLowerCase(),
            contentText: this._stripHtml(message.content || '').toLowerCase()
        };
    }

    static _matchesServiceLabels(text, labels) {
        return Boolean(text) && labels.some((label) => text.includes(label));
    }

    static _isRollDiceMessage(message) {
        const { alias, flavorText, contentText } = this._getMessageSearchTexts(message);
        const directLabels = [
            'roll dice',
            'dice roll',
            'Р±СЂРѕСЃРѕРє РєСѓР±РѕРІ'
        ];

        if (message.flags?.swade || message.flags?.['betterrolls-swade2'] || message.flags?.brsw) return false;
        if (directLabels.includes(alias)) return true;
        if (directLabels.includes(flavorText)) return true;
        if (this._matchesServiceLabels(contentText, directLabels) && !flavorText) return true;

        return false;
    }

    static _isRollTableMessage(message) {
        const coreFlags = message.flags?.core || {};
        const rollTableFlagKeys = [
            'RollTable',
            'rollTable',
            'tableResult',
            'tableResults',
            'rollTableResult',
            'rollTableResults',
            'RollTableResult',
            'RollTableResults'
        ];
        if (rollTableFlagKeys.some((key) => key in coreFlags)) return true;

        const { alias, flavorText, contentText } = this._getMessageSearchTexts(message);
        const labels = [
            'roll table',
            'rolltable',
            'rolling on',
            'rolled on',
            'table result',
            'бросок по таблице',
            'бросок на таблице',
            'результат по таблице',
            'таблица бросков'
        ];

        if (this._matchesServiceLabels(alias, labels)) return true;
        if (this._matchesServiceLabels(flavorText, labels)) return true;
        if (this._matchesServiceLabels(contentText, labels) && !message.flags?.swade) return true;

        return false;
    }

    static async _onChatMessage(message) {
        if (game.user.id !== game.users.activeGM?.id) return;
        if (!StatisticsStorage.isTrackingEnabled()) return;

        const brswFlags = message.flags?.['betterrolls-swade2'] || message.flags?.brsw;
        const brData = brswFlags?.br_data || brswFlags;
        const isBrsw = !!brswFlags;

        if (!isBrsw && (!message.isRoll || !message.rolls?.length)) return;
        if (this._isRollDiceMessage(message)) return;
        if (this._isRollTableMessage(message)) return;

        const userId = message.author.id;
        const diceDataForStorage = [];
        const dieTermSummariesForAchievements = [];
        let isCritFail = false;

        const tn = message.flags?.swade?.targetNumber ?? brData?.trait_roll?.tn ?? brswFlags?.render_data?.trait_roll?.tn ?? 4;

        // --- 1. Flavor / Skill Name Extraction & Cleaning ---
        const rawFlavor = message.flavor || "";
        const isSupport = rawFlavor.includes("Support") || rawFlavor.includes("РџРѕРґРґРµСЂР¶РєР°");
        let flavor = "";

        // Try to get clean name from flags
        if (message.flags?.swade?.item?.name) {
            flavor = message.flags.swade.item.name;
        } else if (brData) {
            if (brData.item_id || brData.skill_id) {
                const actor = game.actors.get(brData.actor_id);
                const item = actor?.items?.get(brData.item_id || brData.skill_id);
                flavor = item?.name || brswFlags?.render_data?.header?.title || "";
            } else if (brData.attribute_name) {
                flavor = brData.attribute_name;
            } else if (brswFlags?.render_data?.header?.title) {
                flavor = brswFlags.render_data.header.title;
            }
        } else {
            // Fallback: Clean raw flavor text
            let clean = rawFlavor.replace(/<\/(div|p|h\d|li|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
            clean = clean.replace(/<[^>]+>/g, "");
            const lines = clean.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
            flavor = lines.length > 0 ? lines[0] : "";
        }

        // --- 2. Determine if it is a Damage Roll ---
        let isDamage = message.flags?.swade?.type === 'damage';
        if (brData && (brData.type === 10 || (brData.type === 3 && brswFlags?.render_data?.damage_rolls?.length > 0) || brData.damage?.damage_rolls?.length > 0 || brData.damage_rolls?.length > 0)) {
            isDamage = true;
        }
        if (!isDamage && (rawFlavor.includes("Damage") || rawFlavor.includes("РЈСЂРѕРЅ"))) {
            isDamage = true;
        }

        // --- 3. Process Rolls ---
        let penalty = 0;
        const roll = message.rolls?.[0];

        if (roll?.terms) {
            for (const term of roll.terms) {
                if (term instanceof foundry.dice.terms.OperatorTerm && term.operator === "-") {
                    const nextTerm = roll.terms[roll.terms.indexOf(term) + 1];
                    if (nextTerm instanceof foundry.dice.terms.NumericTerm) {
                        penalty += nextTerm.number;
                    }
                }
            }
        }

        if (brswFlags) {
            const traitRollData = brData?.trait_roll || brswFlags?.render_data?.trait_roll;
            const traitRolls = traitRollData?.rolls || [];
            
            const traitCurrentRoll = traitRolls[traitRollData?.selected_roll_index || 0];
            if (traitCurrentRoll?.is_fumble) {
                isCritFail = true;
            }

            for (const r of traitRolls) {
                if (!r.dice) continue;
                for (const die of r.dice) {
                    const sides = die.sides;
                    let current_total = die.raw_total;
                    if (current_total === null || !sides) continue;
                    
                    let acesForThisTerm = 0;
                    let results = [];
                    let out = false;
                    while (!out) {
                        if (current_total > sides) {
                            diceDataForStorage.push({ faces: sides, result: sides, exploded: true });
                            results.push({ result: sides, exploded: true });
                            acesForThisTerm++;
                            current_total -= sides;
                        } else {
                            diceDataForStorage.push({ faces: sides, result: current_total, exploded: false });
                            results.push({ result: current_total, exploded: false });
                            out = true;
                        }
                    }
                    dieTermSummariesForAchievements.push({
                        faces: sides,
                        allResults: results,
                        aces: acesForThisTerm,
                        finalResult: results[results.length - 1]?.result
                    });
                }
            }

            const damageRolls = brData?.damage?.damage_rolls || brData?.damage_rolls || brswFlags?.render_data?.damage_rolls || [];
            for (const dmg of damageRolls) {
                if (!dmg.brswroll?.dice) continue;
                for (const die of dmg.brswroll.dice) {
                    const sides = die.faces;
                    if (!sides || !die.results || !Array.isArray(die.results)) continue;
                    
                    let acesForThisTerm = 0;
                    let results = [];
                    for (let i = 0; i < die.results.length; i++) {
                        const val = die.results[i];
                        const isExploded = val >= sides;
                        diceDataForStorage.push({ faces: sides, result: val, exploded: isExploded });
                        results.push({ result: val, exploded: isExploded });
                        if (isExploded) acesForThisTerm++;
                    }
                    dieTermSummariesForAchievements.push({
                        faces: sides,
                        allResults: results,
                        aces: acesForThisTerm,
                        finalResult: results[results.length - 1]?.result
                    });
                }
            }
        } else {
            for (const currentRoll of (message.rolls || [])) {
                if (!isDamage) {
                    const dieTerms = this._findDiceTerms(currentRoll);
                    if (dieTerms.length >= 2) {
                        const d1 = dieTerms[0]?.results[0]?.result;
                        const d2 = dieTerms[1]?.results[0]?.result;
                        if (d1 === 1 && d2 === 1) {
                            isCritFail = true;
                        }
                    }
                }
                this._processRollTerms(currentRoll, diceDataForStorage, dieTermSummariesForAchievements);
            }
        }

        // --- 4. Finalize Data ---
        if (isDamage) {
            flavor = "";
        }

        let total = roll?.total ?? 0;
        let raises = 0;

        if (brswFlags && !isDamage) {
            const traitRollData = brData?.trait_roll || brswFlags?.render_data?.trait_roll;
            const traitCurrentRoll = traitRollData?.rolls?.[traitRollData?.selected_roll_index || 0];
            if (traitCurrentRoll?.dice) {
                let maxTotal = -9999;
                for (const die of traitCurrentRoll.dice) {
                    if (die.result !== null && die.final_total !== undefined) {
                        if (die.final_total > maxTotal) maxTotal = die.final_total;
                    }
                }
                if (maxTotal !== -9999) total = maxTotal;
            }
            if (total >= tn) {
                raises = Math.floor((total - tn) / 4);
            }
        } else if (brswFlags && isDamage) {
            const damageRolls = brData?.damage?.damage_rolls || brData?.damage_rolls || brswFlags?.render_data?.damage_rolls || [];
            let maxDmgTotal = -9999;
            for (const dmg of damageRolls) {
                const possibleTotals = [
                    dmg.total,
                    dmg.brswroll?.total,
                    dmg.final_total,
                    dmg.damage_total,
                    dmg.result
                ].map(t => Number(t)).filter(t => !isNaN(t));

                if (possibleTotals.length > 0) {
                    const dmgTotal = Math.max(...possibleTotals);
                    if (dmgTotal > maxDmgTotal) {
                        maxDmgTotal = dmgTotal;
                    }
                }
            }
            if (maxDmgTotal !== -9999) total = maxDmgTotal;
        } else if (!isDamage && message.rolls?.length > 0) {
            const extractActiveTotals = (rollObj) => {
                let activeTotals = [];
                if (!rollObj.terms) return activeTotals;
                for (const term of rollObj.terms) {
                    if (term.constructor.name === "PoolTerm" && Array.isArray(term.rolls)) {
                        if (term.results && term.results.length === term.rolls.length) {
                            for (let i = 0; i < term.results.length; i++) {
                                const res = term.results[i];
                                if (res.active !== false && !res.discarded && !res.dropped) {
                                    activeTotals.push(res.result);
                                }
                            }
                        } else {
                            for (const innerRoll of term.rolls) {
                                activeTotals.push(...extractActiveTotals(innerRoll));
                            }
                        }
                    } else if (term.faces && term.results) {
                        let dTotal = 0;
                        let isDropped = term.options?.discarded || term.options?.dropped;
                        if (term.results.length > 0) {
                            if (term.results[0].discarded || term.results[0].dropped || term.results[0].active === false) {
                                isDropped = true;
                            }
                        }
                        if (!isDropped) {
                            for (const res of term.results) {
                                dTotal += res.result;
                            }
                            activeTotals.push(dTotal);
                        }
                    }
                }
                return activeTotals;
            };

            let maxTotal = -9999;
            raises = 0;

            for (const r of message.rolls) {
                let rTotal = r.total ?? 0;
                let activeDiceTotals = extractActiveTotals(r);
                let sumActiveDice = activeDiceTotals.reduce((a, b) => a + b, 0);

                if (activeDiceTotals.length === 0) {
                    if (rTotal > maxTotal) maxTotal = rTotal;
                    if (rTotal >= tn) raises += Math.floor((rTotal - tn) / 4);
                } else {
                    const modifier = rTotal - sumActiveDice;
                    for (const dTotal of activeDiceTotals) {
                        const finalDieTotal = dTotal + modifier;
                        if (finalDieTotal > maxTotal) maxTotal = finalDieTotal;
                        if (finalDieTotal >= tn) {
                            raises += Math.floor((finalDieTotal - tn) / 4);
                        }
                    }
                }
            }
            if (maxTotal !== -9999) total = maxTotal;
        } else if (isDamage && message.rolls?.length > 0) {
            let maxDmgTotal = -9999;
            for (const r of message.rolls) {
                const rTotal = Number(r.total);
                if (!isNaN(rTotal) && rTotal > maxDmgTotal) {
                    maxDmgTotal = rTotal;
                }
            }
            if (maxDmgTotal !== -9999) total = maxDmgTotal;
        }

        if (diceDataForStorage.length > 0) {
            const wasTracked = await StatisticsStorage.updatePlayerStats(
                userId,
                diceDataForStorage,
                isCritFail,
                flavor,
                raises,
                total,
                {
                    isDamage,
                    dieTermSummaries: dieTermSummariesForAchievements
                }
            );

            if (!wasTracked) return;

            await AchievementManager.check({
                userId,
                roll,
                totalResult: total,
                isCritFail,
                dieTermSummaries: dieTermSummariesForAchievements,
                tn,
                flavor,
                isDamage,
                isSupport,
                penalty
            });
        }
    }

    static _processRollTerms(roll, diceDataForStorage, dieTermSummariesForAchievements) {
        if (!roll.terms) return;
        for (const term of roll.terms) {
            if (term.faces && term.results) {
                let acesForThisTerm = 0;
                for (const result of term.results) {
                    diceDataForStorage.push({ faces: term.faces, result: result.result, exploded: result.exploded || false });
                    if (result.exploded) acesForThisTerm++;
                }
                dieTermSummariesForAchievements.push({
                    faces: term.faces,
                    allResults: term.results,
                    aces: acesForThisTerm,
                    finalResult: term.results[term.results.length - 1]?.result
                });
            } else if (term.constructor.name === "PoolTerm" && Array.isArray(term.rolls)) {
                for (const innerRoll of term.rolls) {
                    this._processRollTerms(innerRoll, diceDataForStorage, dieTermSummariesForAchievements);
                }
            }
        }
    }

    static _findDiceTerms(roll) {
        let dice = [];
        if (!roll.terms) return dice;
        for (const term of roll.terms) {
            if (term.faces && term.results) {
                dice.push(term);
            } else if (term.constructor.name === "PoolTerm" && Array.isArray(term.rolls)) {
                for (const innerRoll of term.rolls) {
                    dice.push(...this._findDiceTerms(innerRoll));
                }
            }
        }
        return dice;
    }
}
