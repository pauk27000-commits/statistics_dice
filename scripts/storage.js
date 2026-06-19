export const RECORD_DEFINITIONS = {
    highestTotal: { title: 'Лучший итоговый бросок', icon: 'fas fa-bolt' },
    highestDamage: { title: 'Самый сильный урон', icon: 'fas fa-burst' },
    highestSkill: { title: 'Лучший бросок навыка', icon: 'fas fa-crosshairs' },
    biggestSingleDie: { title: 'Самый высокий результат на одном кубе', icon: 'fas fa-dice-d20' },
    longestAceChain: { title: 'Самая длинная цепочка взрывов', icon: 'fas fa-fire' },
    mostRaises: { title: 'Максимум подъемов за бросок', icon: 'fas fa-angle-double-up' }
};

export class StatisticsStorage {
    static ID = 'statistics_dice';
    static SETTING_KEY = 'dice-stats-v3';
    static CONFIG_KEY = 'module-config-v1';
    static META_KEY = '__meta';
    static RECORD_FEED_LIMIT = 40;

    static rerenderOpenWindows() {
        Object.values(ui.windows).forEach((window) => {
            if (window.id === 'statistics-dice-session-summary') {
                window.close();
                return;
            }

            if (window.id === 'statistics-dice-window' || window.id === 'statistics-dice-settings') {
                window.render(true);
            }
        });
    }

    static registerSettings() {
        game.settings.register(this.ID, this.SETTING_KEY, {
            name: 'Dice Statistics Data v3',
            scope: 'world',
            config: false,
            type: Object,
            default: {},
            onChange: () => this.rerenderOpenWindows()
        });

        game.settings.register(this.ID, this.CONFIG_KEY, {
            name: 'Statistics Dice UI Config',
            scope: 'world',
            config: false,
            type: Object,
            default: this.getDefaultConfig(),
            onChange: () => this.rerenderOpenWindows()
        });
    }

    static getDefaultConfig() {
        return {
            hiddenUserIds: [],
            trackingEnabled: true,
            enableEconomy: true,
            enableAltar: true
        };
    }

    static _normalizeConfig(config = {}) {
        const normalized = foundry.utils.mergeObject(this.getDefaultConfig(), config || {});
        normalized.hiddenUserIds = Array.from(new Set((normalized.hiddenUserIds || [])
            .filter((userId) => typeof userId === 'string' && userId.trim())));
        normalized.trackingEnabled = normalized.trackingEnabled !== false;
        return normalized;
    }

    static getDefaultRecordEntry() {
        return {
            value: 0,
            label: '',
            timestamp: 0
        };
    }

    static getDefaultRecordsBlock() {
        return {
            highestTotal: this.getDefaultRecordEntry(),
            highestDamage: this.getDefaultRecordEntry(),
            highestSkill: this.getDefaultRecordEntry(),
            biggestSingleDie: this.getDefaultRecordEntry(),
            longestAceChain: this.getDefaultRecordEntry(),
            mostRaises: this.getDefaultRecordEntry()
        };
    }

    static getDefaultWorldRecordsBlock() {
        return Object.fromEntries(Object.keys(RECORD_DEFINITIONS).map((key) => [key, {
            value: 0,
            userId: null,
            label: '',
            timestamp: 0
        }]));
    }

    static getDefaultStatsBlock() {
        return {
            totalActions: 0,
            totalDiceRolled: 0,
            criticalFailures: 0,
            raises: 0,
            dice: {},
            skillUsage: {},
            records: this.getDefaultRecordsBlock()
        };
    }

    static getDefaultSessionBlock() {
        return {
            actions: 0,
            critFails: 0,
            raises: 0,
            uniqueSkills: [],
            skillStreak: { skill: null, count: 0 },
            raiseStreak: 0,
            totalActions: 0,
            totalDiceRolled: 0,
            criticalFailures: 0,
            dice: {},
            skillUsage: {},
            records: this.getDefaultRecordsBlock()
        };
    }

    static getDefaultBennyStatsBlock() {
        return {
            selfPurchased: 0,
            giftsSent: 0,
            giftsReceived: 0,
            benniesGranted: 0,
            lpSpent: 0
        };
    }

    static getDefaultPlayerData() {
        return {
            luckPoints: 0,
            achievements: {},
            allTime: this.getDefaultStatsBlock(),
            session: this.getDefaultSessionBlock(),
            bennyStats: {
                allTime: this.getDefaultBennyStatsBlock(),
                session: this.getDefaultBennyStatsBlock()
            }
        };
    }

    static getDefaultMeta() {
        return {
            schemaVersion: 4,
            recordFeed: [],
            worldRecords: this.getDefaultWorldRecordsBlock(),
            importedAt: 0,
            exportedAt: 0
        };
    }

    static getStats() {
        return game.settings.get(this.ID, this.SETTING_KEY);
    }

    static getConfig() {
        return this._normalizeConfig(game.settings.get(this.ID, this.CONFIG_KEY));
    }

    static async saveConfig(config) {
        await game.settings.set(this.ID, this.CONFIG_KEY, this._normalizeConfig(config));
    }

    static getHiddenUserIds() {
        return this.getConfig().hiddenUserIds || [];
    }

    static isUserHidden(userId) {
        return this.getHiddenUserIds().includes(userId);
    }

    static isTrackingEnabled() {
        return this.getConfig().trackingEnabled !== false;
    }

    static getMeta() {
        const allStats = this.getStats();
        return foundry.utils.mergeObject(this.getDefaultMeta(), allStats[this.META_KEY] || {});
    }

    static _normalizePlayerData(playerData = {}) {
        const normalized = foundry.utils.mergeObject(this.getDefaultPlayerData(), playerData);

        normalized.allTime = foundry.utils.mergeObject(this.getDefaultStatsBlock(), normalized.allTime || {});
        normalized.session = foundry.utils.mergeObject(this.getDefaultSessionBlock(), normalized.session || {});
        normalized.bennyStats = foundry.utils.mergeObject({
            allTime: this.getDefaultBennyStatsBlock(),
            session: this.getDefaultBennyStatsBlock()
        }, normalized.bennyStats || {});

        normalized.allTime.records = foundry.utils.mergeObject(this.getDefaultRecordsBlock(), normalized.allTime.records || {});
        normalized.session.records = foundry.utils.mergeObject(this.getDefaultRecordsBlock(), normalized.session.records || {});
        normalized.bennyStats.allTime = foundry.utils.mergeObject(this.getDefaultBennyStatsBlock(), normalized.bennyStats.allTime || {});
        normalized.bennyStats.session = foundry.utils.mergeObject(this.getDefaultBennyStatsBlock(), normalized.bennyStats.session || {});

        normalized.session.totalActions = normalized.session.totalActions || 0;
        normalized.session.totalDiceRolled = normalized.session.totalDiceRolled || 0;
        normalized.session.criticalFailures = normalized.session.criticalFailures || 0;
        normalized.session.raises = normalized.session.raises || 0;

        return normalized;
    }

    static getPlayerData(userId) {
        const allStats = this.getStats();
        return this._normalizePlayerData(allStats[userId] || {});
    }

    static async saveAllStats(allStats) {
        const payload = foundry.utils.deepClone(allStats);
        payload[this.META_KEY] = foundry.utils.mergeObject(this.getDefaultMeta(), payload[this.META_KEY] || {});
        await game.settings.set(this.ID, this.SETTING_KEY, payload);
    }

    static async savePlayerData(userId, data) {
        const allStats = this.getStats();
        allStats[userId] = this._normalizePlayerData(data);
        await this.saveAllStats(allStats);
    }

    static async saveMeta(meta) {
        const allStats = this.getStats();
        allStats[this.META_KEY] = foundry.utils.mergeObject(this.getDefaultMeta(), meta || {});
        await this.saveAllStats(allStats);
    }

    static async reassignStats(orphanKey, targetUserId) {
        const allStats = this.getStats();
        if (!allStats[orphanKey]) return false;

        let targetData = allStats[targetUserId];

        if (targetData) {
            targetData = this._mergePlayerData(targetData, allStats[orphanKey]);
        } else {
            targetData = allStats[orphanKey];
        }

        // Remove orphan specific fields if any
        delete targetData.originalName;

        allStats[targetUserId] = targetData;
        delete allStats[orphanKey];

        // Update world records to point to new user ID
        if (allStats[this.META_KEY] && allStats[this.META_KEY].worldRecords) {
            for (const category of Object.keys(allStats[this.META_KEY].worldRecords)) {
                if (allStats[this.META_KEY].worldRecords[category].userId === orphanKey) {
                    allStats[this.META_KEY].worldRecords[category].userId = targetUserId;
                }
            }
        }

        // Update record feed to point to new user ID
        if (allStats[this.META_KEY] && allStats[this.META_KEY].recordFeed) {
            for (const entry of allStats[this.META_KEY].recordFeed) {
                if (entry.userId === orphanKey) {
                    entry.userId = targetUserId;
                }
            }
        }

        await this.saveAllStats(allStats);
        return true;
    }

    static getOrphanStats() {
        const allStats = this.getStats();
        return Object.keys(allStats)
            .filter(key => key.startsWith('orphan_'))
            .map(key => ({
                id: key,
                originalName: allStats[key].originalName || key,
                data: allStats[key]
            }));
    }

    static _pushRecordFeed(meta, event) {
        meta.recordFeed = Array.isArray(meta.recordFeed) ? meta.recordFeed : [];
        meta.recordFeed.unshift(event);
        if (meta.recordFeed.length > this.RECORD_FEED_LIMIT) {
            meta.recordFeed.length = this.RECORD_FEED_LIMIT;
        }
    }

    static _getRecordLabel({ flavor = '', isDamage = false, totalResult = 0, raises = 0, topDieInfo = null, aceDieInfo = null, aceCount = 0 }) {
        return {
            highestTotal: flavor || (isDamage ? `Урон ${totalResult}` : `Бросок ${totalResult}`),
            highestDamage: flavor || `Урон ${totalResult}`,
            highestSkill: flavor || 'Проверка',
            biggestSingleDie: topDieInfo ? `${topDieInfo.result} на d${topDieInfo.faces}` : '',
            longestAceChain: aceDieInfo ? `${aceCount} взрывов на d${aceDieInfo.faces}` : '',
            mostRaises: flavor || `${raises} подъемов`
        };
    }

    static _tryUpdateRecord(block, category, value, label, timestamp) {
        if (!value || value <= 0) return false;

        const record = block.records[category];
        if (!record || value <= (record.value || 0)) return false;

        block.records[category] = {
            value,
            label,
            timestamp
        };

        return true;
    }

    static _registerRecordEvent(meta, userId, category, value, label, timestamp) {
        const definition = RECORD_DEFINITIONS[category];
        if (!definition) return;

        const worldRecord = meta.worldRecords[category] || { value: 0 };
        const isWorldRecord = value > (worldRecord.value || 0);

        if (isWorldRecord) {
            meta.worldRecords[category] = {
                value,
                userId,
                label,
                timestamp
            };
        }

        this._pushRecordFeed(meta, {
            userId,
            category,
            title: definition.title,
            icon: definition.icon,
            value,
            label,
            timestamp,
            level: isWorldRecord ? 'world' : 'personal'
        });
    }

    static _updateRollRecords(userId, playerData, meta, context = {}) {
        const timestamp = Date.now();
        const {
            diceData = [],
            dieTermSummaries = [],
            flavor = '',
            totalResult = 0,
            raises = 0,
            isDamage = false
        } = context;

        const topDie = diceData.reduce((best, die) => {
            if (!best || die.result > best.result) return die;
            return best;
        }, null);

        const longestAceTerm = dieTermSummaries.reduce((best, term) => {
            if (!best || (term.aces || 0) > (best.aces || 0)) return term;
            return best;
        }, null);

        const aceCount = longestAceTerm?.aces || 0;
        const labels = this._getRecordLabel({
            flavor,
            isDamage,
            totalResult,
            raises,
            topDieInfo: topDie,
            aceDieInfo: longestAceTerm ? { faces: longestAceTerm.faces, result: longestAceTerm.finalResult } : null,
            aceCount
        });

        const recordCandidates = [
            { category: 'highestTotal', value: totalResult, label: labels.highestTotal },
            { category: 'biggestSingleDie', value: topDie?.result || 0, label: labels.biggestSingleDie },
            { category: 'longestAceChain', value: aceCount, label: labels.longestAceChain },
            { category: 'mostRaises', value: raises, label: labels.mostRaises }
        ];

        if (isDamage) {
            recordCandidates.push({
                category: 'highestDamage',
                value: totalResult,
                label: labels.highestDamage
            });
        } else if (flavor) {
            recordCandidates.push({
                category: 'highestSkill',
                value: totalResult,
                label: labels.highestSkill
            });
        }

        for (const candidate of recordCandidates) {
            const allTimeUpdated = this._tryUpdateRecord(playerData.allTime, candidate.category, candidate.value, candidate.label, timestamp);
            this._tryUpdateRecord(playerData.session, candidate.category, candidate.value, candidate.label, timestamp);

            if (allTimeUpdated) {
                this._registerRecordEvent(meta, userId, candidate.category, candidate.value, candidate.label, timestamp);
            }
        }
    }

    static _incrementBennyStats(playerData, updater) {
        for (const scope of ['allTime', 'session']) {
            updater(playerData.bennyStats[scope]);
        }
    }

    static _trackSelfPurchase(playerData, cost) {
        this._incrementBennyStats(playerData, (stats) => {
            stats.selfPurchased++;
            stats.benniesGranted++;
            stats.lpSpent += cost;
        });
    }

    static _trackGiftSender(playerData, cost) {
        this._incrementBennyStats(playerData, (stats) => {
            stats.giftsSent++;
            stats.lpSpent += cost;
        });
    }

    static _trackGiftReceiver(playerData) {
        this._incrementBennyStats(playerData, (stats) => {
            stats.giftsReceived++;
            stats.benniesGranted++;
        });
    }

    static getAltarData() {
        const meta = this.getStats()[this.META_KEY] || {};
        return {
            lp: meta.altarLP || 0,
            goal: 1000,
            contributors: meta.altarContributors || {}
        };
    }

    static async donateAltarLP(userId, amount) {
        const allStats = this.getStats();
        const playerData = this.getPlayerData(userId);
        const user = game.users.get(userId);

        if (!user) return;

        if ((playerData.luckPoints || 0) < amount) {
            if (game.user.isGM) {
                ui.notifications.warn(`У игрока ${user.name} недостаточно LP для пожертвования!`);
            }
            return;
        }

        playerData.luckPoints -= amount;
        this._incrementBennyStats(playerData, (stats) => {
            stats.lpSpent = (stats.lpSpent || 0) + amount;
        });
        
        const meta = allStats[this.META_KEY] || {};
        meta.altarLP = (meta.altarLP || 0) + amount;
        meta.altarContributors = meta.altarContributors || {};
        meta.altarContributors[userId] = (meta.altarContributors[userId] || 0) + amount;
        allStats[this.META_KEY] = meta;
        allStats[userId] = playerData;

        ChatMessage.create({
            content: `
                <div style="text-align:center; font-weight:bold; border: 2px solid #9c27b0; border-radius: 8px; padding: 10px; background: rgba(156, 39, 176, 0.1);">
                    <h3 style="color: #d16ff1; font-family: Georgia, serif; font-size: 1.2rem; border-bottom: none;"><i class="fas fa-fire"></i> Подношение Богам</h3>
                    <p style="font-size: 0.95rem;"><strong>${user.name}</strong> приносит <strong>${amount} LP</strong> на Алтарь Удачи.</p>
                </div>`
        });

        await this.saveAllStats(allStats);
    }

    static async resetAltar() {
        if (!game.user.isGM) return;
        const allStats = this.getStats();
        const meta = allStats[this.META_KEY] || {};
        meta.altarLP = 0;
        meta.altarContributors = {};
        allStats[this.META_KEY] = meta;
        await this.saveAllStats(allStats);
    }

    static async buyBennyForPlayer(userId) {
        const allStats = this.getStats();
        const playerData = this.getPlayerData(userId);
        const user = game.users.get(userId);

        if (!user) return;

        if ((playerData.luckPoints || 0) < 100) {
            if (game.user.isGM) {
                ui.notifications.warn(`У игрока ${user.name} недостаточно LP для покупки фишки!`);
            }
            return;
        }

        const actor = user.character;
        if (!actor) {
            ui.notifications.warn(`Не удалось выдать фишку: у игрока ${user.name} нет назначенного персонажа.`);
            return;
        }

        playerData.luckPoints -= 100;
        this._trackSelfPurchase(playerData, 100);

        const currentBennies = actor.system.bennies.value;
        await actor.update({ 'system.bennies.value': currentBennies + 1 });

        ChatMessage.create({
            content: `
                <div style="text-align:center; font-weight:bold; border: 2px solid #ff9800; padding: 5px;">
                    <h3>Покупка в магазине</h3>
                    <p>Игрок <strong>${user.name}</strong> потратил 100 LP на покупку фишки.</p>
                    <p style="color: #4caf50; font-weight: bold;">Фишка выдана автоматически.</p>
                </div>`
        });

        allStats[userId] = playerData;
        await this.saveAllStats(allStats);
    }

    static async buyBennyGift(buyerId, targetId) {
        const allStats = this.getStats();
        const buyerData = this.getPlayerData(buyerId);
        const targetData = this.getPlayerData(targetId);
        const buyer = game.users.get(buyerId);
        const target = game.users.get(targetId);

        if (!buyer || !target) return;

        if ((buyerData.luckPoints || 0) < 200) {
            if (game.user.isGM) {
                ui.notifications.warn(`У игрока ${buyer.name} недостаточно LP для подарка!`);
            }
            return;
        }

        const targetActor = target.character;
        if (!targetActor) {
            ui.notifications.warn(`Не удалось выдать фишку: у игрока ${target.name} нет назначенного персонажа.`);
            return;
        }

        buyerData.luckPoints -= 200;
        this._trackGiftSender(buyerData, 200);
        this._trackGiftReceiver(targetData);

        const currentBennies = targetActor.system.bennies.value;
        await targetActor.update({ 'system.bennies.value': currentBennies + 1 });

        ChatMessage.create({
            content: `
                <div style="text-align:center; font-weight:bold; border: 2px solid #e91e63; padding: 5px;">
                    <h3>Подарок</h3>
                    <p>Игрок <strong>${buyer.name}</strong> потратил 200 LP, чтобы подарить фишку игроку <strong>${target.name}</strong>.</p>
                    <p style="color: #4caf50; font-weight: bold;">Фишка выдана автоматически.</p>
                </div>`
        });

        allStats[buyerId] = buyerData;
        allStats[targetId] = targetData;
        await this.saveAllStats(allStats);
    }

    static async updatePlayerStats(userId, diceData, isCritFail = false, flavor = '', raises = 0, totalResult = 0, context = {}) {
        if (!this.isTrackingEnabled()) return false;

        const allStats = this.getStats();
        const meta = this.getMeta();
        const playerData = this.getPlayerData(userId);

        const blocks = [playerData.allTime, playerData.session];
        for (const block of blocks) {
            block.totalActions = (block.totalActions || 0) + 1;
            if (isCritFail) block.criticalFailures = (block.criticalFailures || 0) + 1;
            block.raises = (block.raises || 0) + raises;

            if (flavor) {
                if (!block.skillUsage) block.skillUsage = {};

                if (typeof block.skillUsage[flavor] === 'number') {
                    block.skillUsage[flavor] = { count: block.skillUsage[flavor], max: 0 };
                }

                if (!block.skillUsage[flavor]) {
                    block.skillUsage[flavor] = { count: 0, max: 0 };
                }

                block.skillUsage[flavor].count++;
                if (totalResult > block.skillUsage[flavor].max) {
                    block.skillUsage[flavor].max = totalResult;
                }
            }

            for (const die of diceData) {
                block.totalDiceRolled = (block.totalDiceRolled || 0) + 1;
                const faces = die.faces;
                if (!block.dice[faces]) block.dice[faces] = { rolls: 0, results: {}, explosions: 0 };
                const dieStats = block.dice[faces];
                dieStats.rolls++;
                if (die.exploded) dieStats.explosions++;
                if (!dieStats.results[die.result]) dieStats.results[die.result] = 0;
                dieStats.results[die.result]++;
            }
        }

        this._updateRollRecords(userId, playerData, meta, {
            diceData,
            dieTermSummaries: context.dieTermSummaries || [],
            flavor,
            totalResult,
            raises,
            isDamage: Boolean(context.isDamage)
        });

        allStats[userId] = playerData;
        allStats[this.META_KEY] = meta;
        await this.saveAllStats(allStats);
        return true;
    }

    static _mergeRecords(existing, imported) {
        const merged = foundry.utils.mergeObject(this.getDefaultRecordsBlock(), existing || {});
        const normalizedImported = foundry.utils.mergeObject(this.getDefaultRecordsBlock(), imported || {});

        for (const category of Object.keys(RECORD_DEFINITIONS)) {
            const current = merged[category];
            const incoming = normalizedImported[category];
            if ((incoming.value || 0) > (current.value || 0)) {
                merged[category] = incoming;
            }
        }

        return merged;
    }

    static _mergeSkillUsage(existing = {}, imported = {}) {
        const merged = foundry.utils.deepClone(existing || {});

        for (const [skill, rawValue] of Object.entries(imported || {})) {
            const current = merged[skill];
            const next = typeof rawValue === 'object' ? rawValue : { count: rawValue, max: 0 };

            if (typeof current === 'number') {
                merged[skill] = { count: current + next.count, max: next.max };
            } else if (current) {
                merged[skill] = {
                    count: (current.count || 0) + (next.count || 0),
                    max: Math.max(current.max || 0, next.max || 0)
                };
            } else {
                merged[skill] = {
                    count: next.count || 0,
                    max: next.max || 0
                };
            }
        }

        return merged;
    }

    static _mergeDice(existing = {}, imported = {}) {
        const merged = foundry.utils.deepClone(existing || {});

        for (const [faces, dieData] of Object.entries(imported || {})) {
            if (!merged[faces]) {
                merged[faces] = foundry.utils.deepClone(dieData);
                continue;
            }

            merged[faces].rolls = (merged[faces].rolls || 0) + (dieData.rolls || 0);
            merged[faces].explosions = (merged[faces].explosions || 0) + (dieData.explosions || 0);
            merged[faces].results = merged[faces].results || {};

            for (const [result, count] of Object.entries(dieData.results || {})) {
                merged[faces].results[result] = (merged[faces].results[result] || 0) + count;
            }
        }

        return merged;
    }

    static _mergeAchievements(existing = {}, imported = {}) {
        const merged = foundry.utils.deepClone(existing || {});

        for (const [achievementId, record] of Object.entries(imported || {})) {
            if (!merged[achievementId]) {
                merged[achievementId] = foundry.utils.deepClone(record);
                continue;
            }

            merged[achievementId] = {
                unlocked: Math.min(merged[achievementId].unlocked || Date.now(), record.unlocked || Date.now()),
                count: (merged[achievementId].count || 0) + (record.count || 0)
            };
        }

        return merged;
    }

    static _mergeStatsBlock(existing, imported, isSession = false) {
        const base = isSession ? this.getDefaultSessionBlock() : this.getDefaultStatsBlock();
        const left = foundry.utils.mergeObject(base, existing || {});
        const right = foundry.utils.mergeObject(base, imported || {});

        return {
            ...left,
            totalActions: (left.totalActions || 0) + (right.totalActions || 0),
            totalDiceRolled: (left.totalDiceRolled || 0) + (right.totalDiceRolled || 0),
            criticalFailures: (left.criticalFailures || 0) + (right.criticalFailures || 0),
            raises: (left.raises || 0) + (right.raises || 0),
            actions: (left.actions || 0) + (right.actions || 0),
            critFails: (left.critFails || 0) + (right.critFails || 0),
            raiseStreak: Math.max(left.raiseStreak || 0, right.raiseStreak || 0),
            uniqueSkills: Array.from(new Set([...(left.uniqueSkills || []), ...(right.uniqueSkills || [])])),
            skillStreak: (left.skillStreak?.count || 0) >= (right.skillStreak?.count || 0) ? left.skillStreak : right.skillStreak,
            dice: this._mergeDice(left.dice, right.dice),
            skillUsage: this._mergeSkillUsage(left.skillUsage, right.skillUsage),
            records: this._mergeRecords(left.records, right.records)
        };
    }

    static _mergeBennyStats(existing = {}, imported = {}) {
        const left = foundry.utils.mergeObject(this.getDefaultBennyStatsBlock(), existing || {});
        const right = foundry.utils.mergeObject(this.getDefaultBennyStatsBlock(), imported || {});

        return {
            selfPurchased: (left.selfPurchased || 0) + (right.selfPurchased || 0),
            giftsSent: (left.giftsSent || 0) + (right.giftsSent || 0),
            giftsReceived: (left.giftsReceived || 0) + (right.giftsReceived || 0),
            benniesGranted: (left.benniesGranted || 0) + (right.benniesGranted || 0),
            lpSpent: (left.lpSpent || 0) + (right.lpSpent || 0)
        };
    }

    static _mergeWorldRecords(existing = {}, imported = {}) {
        const merged = foundry.utils.mergeObject(this.getDefaultWorldRecordsBlock(), existing || {});
        const incoming = foundry.utils.mergeObject(this.getDefaultWorldRecordsBlock(), imported || {});

        for (const category of Object.keys(RECORD_DEFINITIONS)) {
            if ((incoming[category]?.value || 0) > (merged[category]?.value || 0)) {
                merged[category] = incoming[category];
            }
        }

        return merged;
    }

    static _mergePlayerData(existing, imported) {
        const left = this._normalizePlayerData(existing);
        const right = this._normalizePlayerData(imported);

        return {
            luckPoints: Math.max(left.luckPoints || 0, right.luckPoints || 0),
            achievements: this._mergeAchievements(left.achievements, right.achievements),
            allTime: this._mergeStatsBlock(left.allTime, right.allTime, false),
            session: this._mergeStatsBlock(left.session, right.session, true),
            bennyStats: {
                allTime: this._mergeBennyStats(left.bennyStats?.allTime, right.bennyStats?.allTime),
                session: this._mergeBennyStats(left.bennyStats?.session, right.bennyStats?.session)
            }
        };
    }

    static _normalizeImportPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Неверный формат файла.');
        }

        const rawData = payload.data && typeof payload.data === 'object' ? payload.data : payload;
        const normalized = {};

        for (const [key, value] of Object.entries(rawData)) {
            if (key === this.META_KEY) {
                normalized[key] = foundry.utils.mergeObject(this.getDefaultMeta(), value || {});
                continue;
            }

            normalized[key] = this._normalizePlayerData(value || {});
        }

        normalized[this.META_KEY] = foundry.utils.mergeObject(this.getDefaultMeta(), normalized[this.META_KEY] || {});
        return normalized;
    }

    static getExportPayload() {
        return {
            module: this.ID,
            exportedAt: new Date().toISOString(),
            data: this.getStats()
        };
    }

    static exportStatsToString() {
        return JSON.stringify(this.getExportPayload(), null, 2);
    }

    static async importStats(payload, mode = 'replace') {
        const imported = this._normalizeImportPayload(payload);
        const current = this.getStats();
        const currentMeta = this.getMeta();
        let result;

        if (mode === 'merge') {
            const merged = foundry.utils.deepClone(current);

            for (const [key, value] of Object.entries(imported)) {
                if (key === this.META_KEY) continue;

                if (merged[key]) {
                    merged[key] = this._mergePlayerData(merged[key], value);
                } else {
                    merged[key] = value;
                }
            }

            merged[this.META_KEY] = foundry.utils.mergeObject(currentMeta, imported[this.META_KEY] || {});
            merged[this.META_KEY].worldRecords = this._mergeWorldRecords(
                currentMeta.worldRecords,
                imported[this.META_KEY]?.worldRecords
            );
            merged[this.META_KEY].recordFeed = [
                ...(imported[this.META_KEY]?.recordFeed || []),
                ...(currentMeta.recordFeed || [])
            ]
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, this.RECORD_FEED_LIMIT);

            result = merged;
        } else {
            result = foundry.utils.deepClone(imported);
            result[this.META_KEY] = foundry.utils.mergeObject(this.getDefaultMeta(), result[this.META_KEY] || {});
        }

        result[this.META_KEY].importedAt = Date.now();
        await this.saveAllStats(result);

        const userCount = Object.keys(result).filter((key) => key !== this.META_KEY).length;
        return { mode, userCount };
    }

    static async clearAllStats() {
        await game.settings.set(this.ID, this.SETTING_KEY, {});
    }

    static async resetSessionData() {
        const allStats = this.getStats();
        for (const userId of Object.keys(allStats)) {
            if (userId === this.META_KEY || !allStats[userId]) continue;

            const playerData = this.getPlayerData(userId);
            playerData.session = this.getDefaultSessionBlock();
            playerData.bennyStats.session = this.getDefaultBennyStatsBlock();
            allStats[userId] = playerData;
        }

        await this.saveAllStats(allStats);
    }
}
