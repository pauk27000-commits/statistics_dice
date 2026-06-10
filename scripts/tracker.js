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

        if (message.flags?.swade) return false;
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
        if (!message.isRoll || !message.rolls?.length) return;
        if (!StatisticsStorage.isTrackingEnabled()) return;
        if (this._isRollDiceMessage(message)) return;
        if (this._isRollTableMessage(message)) return;

        const userId = message.author.id;
        const diceDataForStorage = [];
        const dieTermSummariesForAchievements = [];
        let isCritFail = false;

        const tn = message.flags?.swade?.targetNumber ?? 4;

        // --- 1. Flavor / Skill Name Extraction & Cleaning ---
        const rawFlavor = message.flavor || "";
        const isSupport = rawFlavor.includes("Support") || rawFlavor.includes("РџРѕРґРґРµСЂР¶РєР°");
        let flavor = "";

        // Try to get clean name from flags
        if (message.flags?.swade?.item?.name) {
            flavor = message.flags.swade.item.name;
        } else {
            // Fallback: Clean raw flavor text
            let clean = rawFlavor.replace(/<\/(div|p|h\d|li|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
            clean = clean.replace(/<[^>]+>/g, "");
            const lines = clean.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
            flavor = lines.length > 0 ? lines[0] : "";
        }

        // --- 2. Determine if it is a Damage Roll ---
        let isDamage = message.flags?.swade?.type === 'damage';
        if (!isDamage && (rawFlavor.includes("Damage") || rawFlavor.includes("РЈСЂРѕРЅ"))) {
            isDamage = true;
        }

        // --- 3. Process Rolls ---
        let penalty = 0;
        const roll = message.rolls[0];

        if (roll.terms) {
            for (const term of roll.terms) {
                if (term instanceof foundry.dice.terms.OperatorTerm && term.operator === "-") {
                    const nextTerm = roll.terms[roll.terms.indexOf(term) + 1];
                    if (nextTerm instanceof foundry.dice.terms.NumericTerm) {
                        penalty += nextTerm.number;
                    }
                }
            }
        }

        for (const currentRoll of message.rolls) {
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

        // --- 4. Finalize Data ---
        if (isDamage) {
            flavor = "";
        }

        let raises = 0;
        if (!isDamage && roll.total >= tn) {
            raises = Math.floor((roll.total - tn) / 4);
        }

        if (diceDataForStorage.length > 0) {
            const wasTracked = await StatisticsStorage.updatePlayerStats(
                userId,
                diceDataForStorage,
                isCritFail,
                flavor,
                raises,
                roll.total,
                {
                    isDamage,
                    dieTermSummaries: dieTermSummariesForAchievements
                }
            );

            if (!wasTracked) return;

            await AchievementManager.check({
                userId,
                roll,
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
