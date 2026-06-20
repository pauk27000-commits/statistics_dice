// scripts/achievements.js
import { StatisticsStorage } from './storage.js';

export const ACHIEVEMENTS = {
    // --- Утешительные призы ---
    SNAKE_BIT: { name: "Змеиный укус", description: "Выбросить 'Змеиные глаза'.", lp: 15, rarity: 'common', maxRank: 0 },
    PREMATURE_DETONATION: { name: "Фальстарт", description: "Кубик взорвался, но следующий бросок — '1'.", lp: 5, rarity: 'common', maxRank: 0 },
    SAVED_BY_THE_WILD: { name: "Спасенный Диким", description: "Кубик навыка '1', но Дикий кубик дал Успех.", lp: 5, rarity: 'common', maxRank: 0 },
    AGAINST_ALL_ODDS: { name: "Вопреки всему", description: "Пройти проверку со штрафом -4 или больше.", lp: 40, rarity: 'epic', maxRank: 0 },

    // --- Дубли (Бинго) ---
    DOUBLE_2: { name: "Гуси-лебеди", description: "Выбросить 2-2.", lp: 5, rarity: 'common', maxRank: 0 },
    DOUBLE_3: { name: "Усы Якубовича", description: "Выбросить 3-3.", lp: 5, rarity: 'common', maxRank: 0 },
    DOUBLE_4: { name: "Стульчики", description: "Выбросить 4-4.", lp: 5, rarity: 'common', maxRank: 0 },
    DOUBLE_5: { name: "Отличник", description: "Выбросить 5-5.", lp: 5, rarity: 'common', maxRank: 0 },

    // --- Героические моменты ---
    CHAIN_REACTION: { name: "Цепная реакция", description: "Один кубик взорвался 2 раза подряд.", lp: 15, rarity: 'rare', maxRank: 0 },
    GRINDER: { name: "Марафонец", description: "Совершить 50 бросков за сессию.", lp: 20, rarity: 'rare', maxRank: 1 },
    DEAD_EYE: { name: "Снайпер", description: "Получить 2 Подъема (≥ TN + 8).", lp: 20, rarity: 'rare', maxRank: 0 },
    MINIMALIST: { name: "Минималист", description: "Пройти проверку ровно по сложности.", lp: 10, rarity: 'common', maxRank: 0 },
    RAW_POWER: { name: "Чистая Сила", description: "Получить Подъем без взрывов кубиков.", lp: 15, rarity: 'rare', maxRank: 0 },
    SYNCHRONICITY: { name: "Синхронность", description: "На 3+ кубиках выпало одно и то же значение.", lp: 50, rarity: 'epic', maxRank: 0 },
    THE_SPECIALIST: { name: "Специалист", description: "Успешно использовать один навык 8 раз за сессию.", lp: 30, rarity: 'epic', maxRank: 1 },
    ON_A_ROLL: { name: "На волне удачи", description: "Получить Подъем на 5 бросках подряд.", lp: 25, rarity: 'epic', maxRank: 0 },

    // --- Идеальный шторм (Градации) ---
    PERFECT_STORM_D4: { name: "Идеальный шторм (d4)", description: "И основной, и Дикий куб (d4) взорвались одновременно.", lp: 30, rarity: 'rare', maxRank: 0 },
    PERFECT_STORM_D6: { name: "Идеальный шторм (d6)", description: "И основной, и Дикий куб (d6) взорвались одновременно.", lp: 50, rarity: 'epic', maxRank: 0 },
    PERFECT_STORM_D8: { name: "Идеальный шторм (d8)", description: "И основной, и Дикий куб (d8) взорвались одновременно.", lp: 70, rarity: 'epic', maxRank: 0 },
    PERFECT_STORM_D10: { name: "Идеальный шторм (d10)", description: "И основной, и Дикий куб (d10) взорвались одновременно.", lp: 90, rarity: 'legendary', maxRank: 0 },
    PERFECT_STORM_D12: { name: "Идеальный шторм (d12)", description: "И основной, и Дикий куб (d12) взорвались одновременно.", lp: 120, rarity: 'legendary', maxRank: 0 },

    // --- Эпические достижения ---
    CURSED: { name: "Проклятый", description: "2 крит. провала за сессию.", lp: 50, rarity: 'epic', maxRank: 1 },
    NICE: { name: "Ну вы поняли", description: "6 на Диком, 9 на основном.", lp: 50, rarity: 'epic', maxRank: 0 },
    JACK_OF_ALL_TRADES: { name: "Мастер на все руки", description: "5 успешных разных навыков за сессию.", lp: 40, rarity: 'epic', maxRank: 1 },

    // --- Легендарные ---
    TO_THE_MOON: { name: "Илон Маск", description: "Один кубик взорвался 4 раза подряд.", lp: 100, rarity: 'legendary', maxRank: 0 },
    ABSOLUTE_ZERO: { name: "Абсолютный ноль", description: "Итог броска ≤ 0.", lp: 20, rarity: 'rare', maxRank: 0 },
    DIVINE_INTERVENTION: { name: "Божественное вмешательство", description: "Итог броска ≥ 40.", lp: 100, rarity: 'legendary', maxRank: 0 },

    // --- Новые ачивки ---
    BEGINNERS_LUCK: { name: "Удача новичка", description: "Успех на проверке навыка, которого у персонажа нет (Неумелая попытка).", lp: 25, rarity: 'rare', maxRank: 0 },
    EXTREME_VARIANCE: { name: "Максимальный разброс", description: "На основном кубике 1, а дикий взорвался (или наоборот).", lp: 20, rarity: 'rare', maxRank: 0 },
    DEVILS_LUCK: { name: "Число Зверя", description: "Итоговый результат ровно 13 (или три шестерки на кубах).", lp: 40, rarity: 'epic', maxRank: 0 },
};

export class AchievementManager {
    static _getPairDice(dieTermSummaries) {
        if (!Array.isArray(dieTermSummaries) || dieTermSummaries.length < 2) return null;

        const [firstDie, secondDie] = dieTermSummaries;
        const firstResult = firstDie?.allResults?.[0]?.result;
        const secondResult = secondDie?.allResults?.[0]?.result;

        if (firstResult == null || secondResult == null) return null;

        // In SWADE the wild die is usually a d6. If it comes first, swap the pair
        // so trait/wild specific achievements still work reliably.
        if (firstDie.faces === 6 && secondDie.faces !== 6) {
            return {
                traitDie: secondDie,
                wildDie: firstDie,
                traitResult: secondResult,
                wildResult: firstResult
            };
        }

        return {
            traitDie: firstDie,
            wildDie: secondDie,
            traitResult: firstResult,
            wildResult: secondResult
        };
    }

    static async check(rollData) {
        if (!StatisticsStorage.isTrackingEnabled()) return false;

        const { userId, roll, totalResult, isCritFail, dieTermSummaries, tn, flavor, penalty, isDamage } = rollData;
        const playerData = StatisticsStorage.getPlayerData(userId);
        const rollTotal = totalResult ?? roll?.total ?? 0;
        let dataChanged = false;

        // --- Update Session Stats ---
        playerData.session.actions++;
        if (isCritFail) playerData.session.critFails++;
        dataChanged = true;

        // --- Check logic ---
        if (isCritFail) {
            if (await this.unlock(userId, 'SNAKE_BIT', playerData)) dataChanged = true;
        }

        if (rollTotal <= 0) {
            if (await this.unlock(userId, 'ABSOLUTE_ZERO', playerData)) dataChanged = true;
        }
        if (rollTotal >= 40) {
            if (await this.unlock(userId, 'DIVINE_INTERVENTION', playerData)) dataChanged = true;
        }
        if (rollTotal === 13) {
            if (await this.unlock(userId, 'DEVILS_LUCK', playerData)) dataChanged = true;
        }

        if (playerData.session.actions >= 50) {
            if (await this.unlock(userId, 'GRINDER', playerData)) dataChanged = true;
        }
        if (playerData.session.critFails >= 2) {
            if (await this.unlock(userId, 'CURSED', playerData)) dataChanged = true;
        }

        if (dieTermSummaries) {
            let sixesCount = 0;
            for (const term of dieTermSummaries) {
                if (term.allResults) {
                    for (const r of term.allResults) {
                        if (r.result === 6) sixesCount++;
                    }
                }
                if (term.aces >= 2) { if (await this.unlock(userId, 'CHAIN_REACTION', playerData)) dataChanged = true; }
                if (term.aces >= 4) { if (await this.unlock(userId, 'TO_THE_MOON', playerData)) dataChanged = true; }
                if (term.aces > 0 && term.finalResult === 1) { if (await this.unlock(userId, 'PREMATURE_DETONATION', playerData)) dataChanged = true; }
            }
            if (sixesCount >= 3) {
                if (await this.unlock(userId, 'DEVILS_LUCK', playerData)) dataChanged = true;
            }
            if (dieTermSummaries.length >= 3) {
                const firstResult = dieTermSummaries[0].allResults[0]?.result;
                if (firstResult > 1 && dieTermSummaries.every(t => t.allResults[0]?.result === firstResult)) {
                    if (await this.unlock(userId, 'SYNCHRONICITY', playerData)) dataChanged = true;
                }
            }
        }

        if (!isDamage) {
            const pairDice = this._getPairDice(dieTermSummaries);
            if (pairDice) {
                const { traitDie, wildDie, traitResult, wildResult } = pairDice;

                if (traitDie.aces > 0 && wildDie.aces > 0) {
                    const faces = traitDie.faces;
                    let achId = null;
                    if (faces === 4) achId = 'PERFECT_STORM_D4';
                    else if (faces === 6) achId = 'PERFECT_STORM_D6';
                    else if (faces === 8) achId = 'PERFECT_STORM_D8';
                    else if (faces === 10) achId = 'PERFECT_STORM_D10';
                    else if (faces === 12) achId = 'PERFECT_STORM_D12';
                    if (achId) { if (await this.unlock(userId, achId, playerData)) dataChanged = true; }
                }

                if (traitResult === 2 && wildResult === 2) { if (await this.unlock(userId, 'DOUBLE_2', playerData)) dataChanged = true; }
                if (traitResult === 3 && wildResult === 3) { if (await this.unlock(userId, 'DOUBLE_3', playerData)) dataChanged = true; }
                if (traitResult === 4 && wildResult === 4) { if (await this.unlock(userId, 'DOUBLE_4', playerData)) dataChanged = true; }
                if (traitResult === 5 && wildResult === 5) { if (await this.unlock(userId, 'DOUBLE_5', playerData)) dataChanged = true; }
                if ((traitResult === 6 && wildResult === 9) || (traitResult === 9 && wildResult === 6)) { if (await this.unlock(userId, 'NICE', playerData)) dataChanged = true; }
                if (traitResult === 1 && wildResult >= tn) { if (await this.unlock(userId, 'SAVED_BY_THE_WILD', playerData)) dataChanged = true; }
                if ((traitResult === 1 && wildDie.aces > 0) || (wildResult === 1 && traitDie.aces > 0)) { if (await this.unlock(userId, 'EXTREME_VARIANCE', playerData)) dataChanged = true; }
            }
        }

        if (!isDamage && rollTotal >= tn) { // Success
            if (penalty >= 4) { if (await this.unlock(userId, 'AGAINST_ALL_ODDS', playerData)) dataChanged = true; }
            if (rollTotal >= tn + 8) { if (await this.unlock(userId, 'DEAD_EYE', playerData)) dataChanged = true; }
            if (rollTotal === tn) { if (await this.unlock(userId, 'MINIMALIST', playerData)) dataChanged = true; }

            const isUnskilled = flavor && (flavor.toLowerCase().includes('unskilled') || flavor.toLowerCase().includes('неумел'));
            if (isUnskilled) {
                if (await this.unlock(userId, 'BEGINNERS_LUCK', playerData)) dataChanged = true;
            }

            const totalAces = dieTermSummaries.reduce((acc, term) => acc + term.aces, 0);
            if (rollTotal >= tn + 4 && totalAces === 0) {
                if (await this.unlock(userId, 'RAW_POWER', playerData)) dataChanged = true;
            }

            if (flavor) {
                if (!playerData.session.uniqueSkills) playerData.session.uniqueSkills = [];
                if (!playerData.session.uniqueSkills.includes(flavor)) {
                    playerData.session.uniqueSkills.push(flavor);
                    if (playerData.session.uniqueSkills.length >= 5) {
                        if (await this.unlock(userId, 'JACK_OF_ALL_TRADES', playerData)) dataChanged = true;
                    }
                }

                if (playerData.session.skillStreak?.skill === flavor) {
                    playerData.session.skillStreak.count++;
                } else {
                    playerData.session.skillStreak = { skill: flavor, count: 1 };
                }
                if (playerData.session.skillStreak.count >= 8) {
                    if (await this.unlock(userId, 'THE_SPECIALIST', playerData)) dataChanged = true;
                }
            }

            // Check for Raise Streak
            if (rollTotal >= tn + 4) { // At least one raise
                playerData.session.raiseStreak = (playerData.session.raiseStreak || 0) + 1;
                if (playerData.session.raiseStreak >= 5) {
                    if (await this.unlock(userId, 'ON_A_ROLL', playerData)) dataChanged = true;
                }
            } else { // Success without a raise
                playerData.session.raiseStreak = 0;
            }

        } else if (!isDamage) { // Failure
            playerData.session.raiseStreak = 0;
            playerData.session.skillStreak = { skill: null, count: 0 };
        }

        if (dataChanged) {
            await StatisticsStorage.savePlayerData(userId, playerData);
        }
    }

    static async unlock(userId, achievementId, playerData) {
        const achievement = ACHIEVEMENTS[achievementId];
        if (!achievement) return false;

        if (!playerData.achievements) playerData.achievements = {};
        const playerAchievement = playerData.achievements[achievementId];

        if (playerAchievement && achievement.maxRank > 0 && playerAchievement.count >= achievement.maxRank) {
            return false;
        }

        let isNew = false;
        if (playerAchievement) {
            playerAchievement.count++;
        } else {
            playerData.achievements[achievementId] = { unlocked: Date.now(), count: 1 };
            isNew = true;
        }

        playerData.luckPoints = (playerData.luckPoints || 0) + achievement.lp;

        const user = game.users.get(userId);

        if (isNew) {
            const msg = await ChatMessage.create({
                speaker: { alias: "Система Ачивок" },
                sound: "sounds/notify.wav",
                content: `
                    <div style="border: 2px solid #ffd700; background: rgba(0,0,0,0.8); padding: 10px; border-radius: 5px; color: white;">
                        <h3 style="color: #ffd700; border-bottom: 1px solid #555; margin-bottom: 5px;">🏆 Новая Ачивка!</h3>
                        <div style="font-size: 1.1em; font-weight: bold;">${achievement.name}</div>
                        <div style="font-style: italic; font-size: 0.9em; color: #ccc;">${achievement.description || ''}</div>
                        <div style="margin-top: 5px; color: #4caf50; font-weight: bold;">Награда: +${achievement.lp} LP</div>
                        <div style="font-size: 0.8em; color: #888; margin-top: 5px;">Игрок: ${user.name} открыл это достижение впервые!</div>
                    </div>
                `
            });
            setTimeout(() => {
                if (msg) msg.delete().catch(err => console.log("Statistics Dice | Message already deleted"));
            }, 15000);
        } else {
            const count = playerData.achievements[achievementId].count;
            const msg = await ChatMessage.create({
                speaker: { alias: "Система Ачивок" },
                content: `
                    <div style="background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 3px; border-left: 3px solid #ffd700; color: #ddd; font-size: 0.9em;">
                        <strong>${user.name}</strong> снова получает <strong>${achievement.name}</strong> (x${count})!<br>
                        <span style="color: #4caf50;">+${achievement.lp} LP</span>
                    </div>
                `
            });
            setTimeout(() => {
                if (msg) msg.delete().catch(err => console.log("Statistics Dice | Message already deleted"));
            }, 8000);
        }

        return true;
    }
}
