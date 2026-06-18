import { StatisticsStorage, RECORD_DEFINITIONS } from './storage.js';
import { ACHIEVEMENTS } from './achievements.js';

class SessionSummaryPresentation extends Application {
    constructor(summary, options = {}) {
        super(options);
        this.slides = summary?.slides || [];
        this.index = 0;
        this.autoPlay = false;
        this.timer = null;
        this.options.title = summary?.windowTitle || this.options.title;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'statistics-dice-session-summary',
            title: 'Сводка сессии',
            template: 'modules/statistics_dice/templates/session-summary.hbs',
            width: 920,
            height: 720,
            resizable: true,
            classes: ['statistics-dice-app', 'statistics-dice-summary']
        });
    }

    getData() {
        const slides = this.slides.map((slide, index) => ({ ...slide, index, isActive: index === this.index }));
        return {
            hasSlides: slides.length > 0,
            slides,
            currentSlide: slides[this.index] || null,
            activeSlide: this.index + 1,
            totalSlides: slides.length,
            autoPlay: this.autoPlay
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.summary-prev').click(() => this._step(-1));
        html.find('.summary-next').click(() => this._step(1));
        html.find('.summary-auto').click(() => this._toggleAuto());
        html.find('.summary-share').click(() => this._onShareChat());
        html.find('.summary-dot').click((event) => this._set(Number.parseInt(event.currentTarget.dataset.index || '0', 10)));
    }

    async close(options) {
        this._stopAuto();
        return super.close(options);
    }

    _set(index) {
        if (!this.slides.length) return;
        this.index = Math.max(0, Math.min(index, this.slides.length - 1));
        this.render();
    }

    _step(delta) {
        if (!this.slides.length) return;
        this._set((this.index + delta + this.slides.length) % this.slides.length);
    }

    _startAuto() {
        this._stopAuto();
        this.autoPlay = true;
        this.timer = window.setInterval(() => this._step(1), 4800);
    }

    _stopAuto() {
        this.autoPlay = false;
        if (this.timer) window.clearInterval(this.timer);
        this.timer = null;
    }

    _toggleAuto() {
        if (this.autoPlay) this._stopAuto();
        else this._startAuto();
        this.render();
    }

    async _onShareChat() {
        if (!this.slides.length) return;
        
        let content = `<div style="background: linear-gradient(140deg, #0d151c, #2c1d12); border: 1px solid rgba(224, 166, 87, 0.35); border-radius: 12px; color: #f6ead1; overflow: hidden; padding: 12px; font-family: sans-serif;">`;
        content += `<div style="text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 12px;">`;
        content += `<h3 style="margin: 0; color: #e0a657; font-size: 1.2em; border: none;">${this.options.title}</h3>`;
        content += `</div>`;

        for (const slide of this.slides) {
            if (slide.themeClass === 'summary-theme-intro' || slide.themeClass === 'summary-theme-finale') continue;
            if (slide.themeClass === 'summary-theme-clean') continue;

            let icon = '✨';
            let color = '#f6ead1';
            if (slide.themeClass === 'summary-theme-luck') { icon = '⭐'; color = '#a7f3b0'; }
            else if (slide.themeClass === 'summary-theme-explosions') { icon = '🔥'; color = '#ffca7a'; }
            else if (slide.themeClass === 'summary-theme-failures') { icon = '💀'; color = '#ff8c7a'; }
            else if (slide.themeClass === 'summary-theme-records') { icon = '🏆'; color = '#ffd700'; }

            content += `<div style="margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; border-left: 3px solid ${color};">`;
            content += `<div style="font-size: 0.85em; text-transform: uppercase; color: rgba(246,234,209,0.7); margin-bottom: 4px;">${icon} ${slide.title}</div>`;
            content += `<div style="font-size: 1.1em; font-weight: bold;">${slide.lead}: <span style="color: ${color};">${slide.highlight}</span></div>`;
            if (slide.accentLabel) {
                content += `<div style="font-size: 0.85em; color: rgba(246,234,209,0.8); margin-top: 2px;">${slide.accentLabel}</div>`;
            }
            content += `</div>`;
        }

        content += `</div>`;
        
        ChatMessage.create({
            user: game.user.id,
            content: content
        });
        ui.notifications.info("Сводка успешно отправлена в чат.");
    }
}

export class StatisticsUI extends Application {
    constructor(options = {}) {
        super(options);
        this.scope = 'allTime';
        this.activeTab = 'stats';
    }

    static init() {
        game.keybindings.register('statistics_dice', 'openStats', {
            name: 'Открыть статистику кубиков',
            hint: 'Открывает окно статистики бросков',
            editable: [{ key: 'KeyS', modifiers: ['Alt'] }],
            onDown: () => new StatisticsUI().render(true),
            restricted: false
        });

        Hooks.on('getSceneControls', (controls) => {
            const tokenControls = controls.tokens;
            if (!tokenControls || tokenControls.tools.find((tool) => tool.name === 'dice-stats')) return;
            tokenControls.tools.push({
                name: 'dice-stats',
                title: 'Статистика кубиков',
                icon: 'fas fa-chart-bar',
                onClick: () => new StatisticsUI().render(true),
                button: true,
                visible: true
            });
        });
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'statistics-dice-window',
            title: 'Статистика бросков (SWADE)',
            template: 'modules/statistics_dice/templates/stats-window.hbs',
            width: 1040,
            height: 760,
            resizable: true,
            classes: ['statistics-dice-app', 'dark-theme'],
            tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'stats' }]
        });
    }

    _scopeLabel(scope = this.scope) {
        return scope === 'session' ? 'Сессия' : 'Все время';
    }

    _expectedAverage(faces) {
        return (faces + 1) / 2;
    }

    _luckTier(playerAverage, expectedAverage) {
        if (!expectedAverage) return { tier: '-', cssClass: '' };
        const factor = (playerAverage - expectedAverage) / expectedAverage;
        if (factor > 0.20) return { tier: 'Благословлен', cssClass: 'luck-blessed' };
        if (factor > 0.05) return { tier: 'Везунчик', cssClass: 'luck-lucky' };
        if (factor < -0.20) return { tier: 'Проклят', cssClass: 'luck-cursed' };
        if (factor < -0.05) return { tier: 'Неудачник', cssClass: 'luck-unlucky' };
        return { tier: 'Обычный', cssClass: 'luck-average' };
    }

    _luckText(factor) {
        return `${factor > 0 ? '+' : ''}${(factor * 100).toFixed(1)}%`;
    }

    _prepareDisplayData(playerData, scope = this.scope) {
        const source = scope === 'session' ? (playerData.session || {}) : (playerData.allTime || {});
        const dice = [];
        const skills = [];
        let totalPlayerSum = 0;
        let totalExpectedSum = 0;
        let totalExplosions = 0;
        const totalDiceRolled = source.totalDiceRolled || 0;

        for (const [faces, dieData] of Object.entries(source.dice || {})) {
            let sum = 0;
            let count = 0;
            for (const [result, quantity] of Object.entries(dieData.results || {})) {
                sum += Number.parseInt(result, 10) * quantity;
                count += quantity;
            }

            const average = count ? (sum / count) : 0;
            const expected = this._expectedAverage(Number.parseInt(faces, 10));
            const luck = this._luckTier(average, expected);
            totalPlayerSum += sum;
            totalExpectedSum += count * expected;
            totalExplosions += dieData.explosions || 0;

            dice.push({
                type: `d${faces}`,
                rolls: dieData.rolls || 0,
                explosions: dieData.explosions || 0,
                average: average.toFixed(2),
                luckTier: luck.tier,
                luckCssClass: luck.cssClass,
                distributionEntries: Object.entries(dieData.results || {})
                    .map(([result, quantity]) => ({ result, quantity, percent: count ? Math.round((quantity / count) * 100) : 0 }))
                    .sort((a, b) => Number.parseInt(a.result, 10) - Number.parseInt(b.result, 10))
            });
        }

        for (const [name, data] of Object.entries(source.skillUsage || {})) {
            skills.push({
                name,
                count: typeof data === 'object' ? data.count : data,
                max: typeof data === 'object' ? data.max : 0
            });
        }

        dice.sort((a, b) => Number.parseInt(a.type.slice(1), 10) - Number.parseInt(b.type.slice(1), 10));
        skills.sort((a, b) => b.count - a.count || b.max - a.max);

        const playerAverage = totalDiceRolled ? totalPlayerSum / totalDiceRolled : 0;
        const expectedAverage = totalDiceRolled ? totalExpectedSum / totalDiceRolled : 0;
        const luckFactor = expectedAverage ? (playerAverage - expectedAverage) / expectedAverage : 0;
        const overallLuck = this._luckTier(playerAverage, expectedAverage);

        return {
            totalActions: source.totalActions || 0,
            totalDiceRolled,
            criticalFailures: source.criticalFailures || 0,
            raises: source.raises || 0,
            totalExplosions,
            totalDieTypes: dice.length,
            overallAverage: totalDiceRolled ? playerAverage.toFixed(2) : '0.00',
            overallLuckFactor: luckFactor,
            overallLuckText: this._luckText(luckFactor),
            favoriteDie: [...dice].sort((a, b) => b.rolls - a.rolls)[0] || null,
            topSkill: skills[0] || null,
            dice,
            luck: overallLuck,
            skillUsage: skills.slice(0, 5)
        };
    }

    _prepareBennyData(playerData) {
        const key = this.scope === 'session' ? 'session' : 'allTime';
        const stats = playerData.bennyStats?.[key] || {};
        return [
            { label: 'Купил себе', value: stats.selfPurchased || 0, icon: 'fas fa-shopping-cart' },
            { label: 'Подарил', value: stats.giftsSent || 0, icon: 'fas fa-gift' },
            { label: 'Получил', value: stats.giftsReceived || 0, icon: 'fas fa-hand-holding-heart' },
            { label: 'Выдано всего', value: stats.benniesGranted || 0, icon: 'fas fa-coins' },
            { label: 'Потрачено LP', value: stats.lpSpent || 0, icon: 'fas fa-wallet' }
        ];
    }

    _prepareRecordList(playerData) {
        const source = this.scope === 'session' ? (playerData.session?.records || {}) : (playerData.allTime?.records || {});
        return Object.entries(RECORD_DEFINITIONS)
            .filter(([id]) => id !== 'biggestSingleDie')
            .map(([id, definition]) => {
                const record = source[id] || {};
                return {
                    id,
                    title: definition.title,
                    icon: definition.icon,
                    value: record.value || 0,
                    label: record.label || ''
                };
            })
            .filter((record) => record.value > 0);
    }

    _prepareRecordFeed() {
        const hiddenUserIds = new Set(StatisticsStorage.getHiddenUserIds());
        return (StatisticsStorage.getMeta().recordFeed || [])
            .filter((entry) => !hiddenUserIds.has(entry.userId))
            .slice(0, 8)
            .map((entry) => {
            const user = game.users.get(entry.userId);
            return {
                ...entry,
                userName: user?.name || 'Неизвестный игрок',
                levelClass: entry.level === 'world' ? 'world-record' : 'personal-record',
                levelText: entry.level === 'world' ? 'Мировой рекорд' : 'Личный рекорд',
                timeText: entry.timestamp ? new Date(entry.timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
            };
        });
    }

    _achievementSummary(achievements) {
        const total = achievements.length;
        const unlocked = achievements.filter((item) => item.isUnlocked).length;
        const legendary = achievements.filter((item) => item.isUnlocked && item.rarity === 'legendary').length;
        return { total, unlocked, legendary, completion: total ? Math.round((unlocked / total) * 100) : 0 };
    }

    _economy(luckPoints = 0) {
        return {
            buyProgress: Math.min(luckPoints, 100),
            giftProgress: Math.min((luckPoints / 200) * 100, 100),
            nextBuyText: luckPoints >= 100 ? 'Готово' : `${100 - luckPoints} LP`,
            nextGiftText: luckPoints >= 200 ? 'Готово' : `${200 - luckPoints} LP`
        };
    }

    _buildBoard(config, entries) {
        const sorted = [...entries]
            .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ru'))
            .slice(0, 5)
            .map((entry, index) => ({ ...entry, position: index + 1, isWinner: index === 0 }));
        return { ...config, entries: sorted, winner: sorted[0] || null, hasEntries: sorted.length > 0 };
    }

    _prepareRankings(profiles, scope = this.scope) {
        const scopeLabel = this._scopeLabel(scope).toLowerCase();
        const scoped = profiles.map((profile) => ({
            ...profile,
            scopeData: scope === 'session' ? profile.sessionDisplayStats : profile.allTimeDisplayStats,
            scopeBlock: scope === 'session' ? profile.playerData.session : profile.playerData.allTime
        }));

        const luckEntries = scoped
            .filter((profile) => profile.scopeData.totalDiceRolled > 0)
            .map((profile) => ({
                id: profile.id,
                name: profile.name,
                value: profile.scopeData.overallLuckFactor,
                scoreText: profile.scopeData.overallLuckText,
                scoreClass: profile.scopeData.overallLuckFactor > 0 ? 'ranking-positive' : (profile.scopeData.overallLuckFactor < 0 ? 'ranking-negative' : ''),
                secondary: `${profile.scopeData.totalDiceRolled} кубов · среднее ${profile.scopeData.overallAverage}`
            }));

        const explosionEntries = scoped
            .filter((profile) => profile.scopeData.totalExplosions > 0)
            .map((profile) => ({
                id: profile.id,
                name: profile.name,
                value: profile.scopeData.totalExplosions,
                scoreText: `${profile.scopeData.totalExplosions}`,
                scoreClass: 'ranking-warm',
                secondary: (profile.scopeBlock?.records?.longestAceChain?.value || 0) > 0
                    ? `Цепочка x${profile.scopeBlock.records.longestAceChain.value} · ${profile.scopeData.totalDiceRolled} кубов`
                    : `${profile.scopeData.totalDiceRolled} кубов`
            }));

        const failureEntries = scoped
            .filter((profile) => profile.scopeData.criticalFailures > 0)
            .map((profile) => ({
                id: profile.id,
                name: profile.name,
                value: profile.scopeData.criticalFailures,
                scoreText: `${profile.scopeData.criticalFailures}`,
                scoreClass: 'ranking-negative',
                secondary: `${profile.scopeData.totalActions} действий · ${profile.scopeData.totalActions ? Math.round((profile.scopeData.criticalFailures / profile.scopeData.totalActions) * 100) : 0}% критов`
            }));

        return [
            this._buildBoard({
                id: 'luck',
                icon: 'fas fa-star',
                title: 'Топ удачи',
                subtitle: `Кто бросает выше ожиданий за ${scopeLabel}.`,
                emptyText: `За ${scopeLabel} пока мало бросков для оценки удачи.`,
                accentClass: 'board-luck',
                winnerLabel: 'Фаворит судьбы'
            }, luckEntries),
            this._buildBoard({
                id: 'explosions',
                icon: 'fas fa-fire',
                title: 'Топ взрывов',
                subtitle: `Самые жаркие кубы и длинные серии за ${scopeLabel}.`,
                emptyText: `За ${scopeLabel} еще не было взрывов.`,
                accentClass: 'board-explosions',
                winnerLabel: 'Король взрывов'
            }, explosionEntries),
            this._buildBoard({
                id: 'failures',
                icon: 'fas fa-skull',
                title: 'Топ провалов',
                subtitle: `Кого судьба кусала чаще за ${scopeLabel}.`,
                emptyText: `За ${scopeLabel} критпровалов пока нет.`,
                accentClass: 'board-failures',
                winnerLabel: 'Магнит катастроф'
            }, failureEntries)
        ];
    }

    _topRecord(profiles, category, scope = 'session') {
        const ranked = profiles
            .map((profile) => ({ profile, record: (scope === 'session' ? profile.playerData.session : profile.playerData.allTime)?.records?.[category] }))
            .filter((entry) => (entry.record?.value || 0) > 0)
            .sort((a, b) => (b.record.value || 0) - (a.record.value || 0) || a.profile.name.localeCompare(b.profile.name, 'ru'));
        if (!ranked.length) return null;
        return {
            name: ranked[0].profile.name,
            value: ranked[0].record.value || 0,
            label: ranked[0].record.label || '',
            icon: RECORD_DEFINITIONS[category]?.icon || 'fas fa-medal'
        };
    }

    _prepareScopedSummary(profiles, scope = this.scope) {
        const scopeLabel = this._scopeLabel(scope);
        const scopeText = scopeLabel.toLowerCase();
        const displayKey = scope === 'session' ? 'sessionDisplayStats' : 'allTimeDisplayStats';
        const recordScope = scope === 'session' ? 'session' : 'allTime';

        const totals = profiles.reduce((acc, profile) => {
            acc.actions += profile[displayKey].totalActions || 0;
            acc.dice += profile[displayKey].totalDiceRolled || 0;
            acc.explosions += profile[displayKey].totalExplosions || 0;
            acc.failures += profile[displayKey].criticalFailures || 0;
            acc.raises += profile[displayKey].raises || 0;
            return acc;
        }, { actions: 0, dice: 0, explosions: 0, failures: 0, raises: 0 });

        if (!totals.actions && !totals.dice) return { hasData: false, slides: [] };

        const boards = this._prepareRankings(profiles, scope);
        const byId = Object.fromEntries(boards.map((board) => [board.id, board]));
        const bestRoll = this._topRecord(profiles, 'highestTotal', scope);
        const bestDamage = this._topRecord(profiles, 'highestDamage', scope);
        const bestAce = this._topRecord(profiles, 'longestAceChain', scope);

        const slides = [{
            themeClass: 'summary-theme-intro',
            kicker: scope === 'session' ? 'SWADE Session Wrap' : 'SWADE Chronicle',
            title: scope === 'session' ? 'Финальная сводка сессии' : 'Большая сводка за все время',
            subtitle: scope === 'session'
                ? 'Кто тащил, кто поджигал кубы и сколько хаоса вы успели создать.'
                : 'Вся накопленная история удачи, провалов и взрывов в одной презентации.',
            leadLabel: scope === 'session' ? 'За этот вечер' : 'За всю историю',
            lead: scope === 'session' ? 'Сессия завершена' : 'История накоплена',
            highlight: `${totals.actions}`,
            highlightClass: 'summary-highlight-gold',
            accentLabel: `проверок за ${scopeText}`,
            stats: [
                { label: 'Кубов', value: `${totals.dice}`, meta: 'Все типы вместе' },
                { label: 'Подъемов', value: `${totals.raises}`, meta: 'С размахом' },
                { label: 'Взрывов', value: `${totals.explosions}`, meta: 'Самые громкие моменты' },
                { label: 'Критпровалов', value: `${totals.failures}`, meta: 'Темная сторона удачи' }
            ],
            roster: boards.filter((board) => board.winner).map((board, index) => ({
                position: index + 1,
                name: board.winner.name,
                primary: board.winner.scoreText,
                secondary: board.winnerLabel,
                scoreClass: board.winner.scoreClass || ''
            }))
        }];

        if (byId.luck?.winner) {
            const winner = profiles.find((profile) => profile.id === byId.luck.winner.id);
            slides.push({
                themeClass: 'summary-theme-luck',
                kicker: 'Барабанная дробь',
                title: 'Фаворит судьбы',
                subtitle: `Игрок, который чаще остальных бросал выше среднего ожидания за ${scopeText}.`,
                leadLabel: scope === 'session' ? 'Сегодня фортуна рядом' : 'Самый стабильный любимец фортуны',
                lead: byId.luck.winner.name,
                highlight: byId.luck.winner.scoreText,
                highlightClass: 'summary-highlight-cyan',
                accentLabel: 'к среднему ожиданию',
                stats: [
                    { label: 'Средний результат', value: winner?.[displayKey].overallAverage || '0.00', meta: 'На всех кубах' },
                    { label: 'Бросков', value: `${winner?.[displayKey].totalDiceRolled || 0}`, meta: 'Размер выборки' },
                    { label: 'Титул', value: winner?.[displayKey].luck.tier || 'Обычный', meta: 'Текущая аура' }
                ],
                roster: byId.luck.entries.slice(0, 3)
            });
        }

        if (byId.explosions?.winner) {
            const winner = profiles.find((profile) => profile.id === byId.explosions.winner.id);
            slides.push({
                themeClass: 'summary-theme-explosions',
                kicker: 'Барабанная дробь',
                title: 'Король взрывов',
                subtitle: `Самая горячая серия aces за ${scopeText}.`,
                leadLabel: scope === 'session' ? 'Пироман вечера' : 'Главный пироман хроники',
                lead: byId.explosions.winner.name,
                highlight: byId.explosions.winner.scoreText,
                highlightClass: 'summary-highlight-fire',
                accentLabel: `взрывов за ${scopeText}`,
                stats: [
                    { label: 'Лучшая цепочка', value: `${winner?.playerData[recordScope]?.records?.longestAceChain?.value || 0}`, meta: winner?.playerData[recordScope]?.records?.longestAceChain?.label || 'Без длинной серии' },
                    { label: 'Подъемов', value: `${winner?.[displayKey].raises || 0}`, meta: 'Сколько раз дожал выше порога' },
                    { label: 'Кубов', value: `${winner?.[displayKey].totalDiceRolled || 0}`, meta: 'Учтено в статистике' }
                ],
                roster: byId.explosions.entries.slice(0, 3)
            });
        }

        slides.push(byId.failures?.winner
            ? {
                themeClass: 'summary-theme-failures',
                kicker: 'Барабанная дробь',
                title: 'Магнит катастроф',
                subtitle: `Даже легендарная неудача заслуживает красивого выхода на сцену за ${scopeText}.`,
                leadLabel: scope === 'session' ? 'Главный конфликт с кубами' : 'Самая упрямая война с кубами',
                lead: byId.failures.winner.name,
                highlight: byId.failures.winner.scoreText,
                highlightClass: 'summary-highlight-danger',
                accentLabel: `критпровалов за ${scopeText}`,
                stats: [
                    { label: 'Частота беды', value: byId.failures.winner.secondary.split(' · ')[1] || '0% критов', meta: 'От числа действий' },
                    { label: 'Всего действий', value: byId.failures.winner.secondary.split(' · ')[0]?.replace(' действий', '') || '0', meta: 'Чтобы понять масштаб' },
                    { label: 'Но все еще в строю', value: 'Да', meta: 'И это тоже достижение' }
                ],
                roster: byId.failures.entries.slice(0, 3)
            }
            : {
                themeClass: 'summary-theme-clean',
                kicker: 'Барабанная дробь',
                title: 'Чистая игра',
                subtitle: `За ${scopeText} никто не словил критпровал.`,
                leadLabel: 'Коллективное достижение',
                lead: 'Ноль критпровалов',
                highlight: '0',
                highlightClass: 'summary-highlight-emerald',
                accentLabel: 'на всю команду',
                stats: [
                    { label: 'Действий', value: `${totals.actions}`, meta: 'И ни одного срыва' },
                    { label: 'Взрывов', value: `${totals.explosions}`, meta: 'Хаос под контролем' },
                    { label: 'Подъемов', value: `${totals.raises}`, meta: 'Успехов было достаточно' }
                ],
                roster: []
            });

        if (bestRoll || bestDamage || bestAce) {
            slides.push({
                themeClass: 'summary-theme-records',
                kicker: 'Hall of Fame',
                title: scope === 'session' ? 'Рекорды вечера' : 'Рекорды за все время',
                subtitle: scope === 'session' ? 'Самые сильные числа этой сессии.' : 'Самые сильные числа за все время.',
                leadLabel: 'Главный момент',
                lead: bestRoll?.name || bestDamage?.name || bestAce?.name || 'Команда',
                highlight: `${bestRoll?.value || bestDamage?.value || bestAce?.value || 0}`,
                highlightClass: 'summary-highlight-gold',
                accentLabel: bestRoll?.label || bestDamage?.label || bestAce?.label || 'Главный эпизод',
                stats: [
                    { label: 'Лучший итоговый бросок', value: `${bestRoll?.value || 0}`, meta: bestRoll ? `${bestRoll.name} · ${bestRoll.label}` : 'Пока без данных' },
                    { label: 'Самый сильный урон', value: `${bestDamage?.value || 0}`, meta: bestDamage ? `${bestDamage.name} · ${bestDamage.label}` : 'Пока без данных' },
                    { label: 'Цепочка взрывов', value: `${bestAce?.value || 0}`, meta: bestAce ? `${bestAce.name} · ${bestAce.label}` : 'Пока без данных' }
                ],
                roster: [
                    bestRoll && { position: 1, name: bestRoll.name, primary: `${bestRoll.value}`, secondary: 'Лучший итоговый бросок', scoreClass: 'ranking-warm' },
                    bestDamage && { position: 2, name: bestDamage.name, primary: `${bestDamage.value}`, secondary: 'Самый сильный урон', scoreClass: 'ranking-warm' },
                    bestAce && { position: 3, name: bestAce.name, primary: `${bestAce.value}`, secondary: 'Цепочка взрывов', scoreClass: 'ranking-warm' }
                ].filter(Boolean)
            });
        }

        slides.push({
            themeClass: 'summary-theme-finale',
            kicker: 'До следующего броска',
            title: scope === 'session' ? 'Легенды вечера' : 'Легенды хроники',
            subtitle: scope === 'session' ? 'Финальная афиша перед следующим сеансом хаоса.' : 'Финальная афиша всей накопленной истории.',
            leadLabel: 'Главные имена',
            lead: byId.luck?.winner?.name || byId.explosions?.winner?.name || 'Команда',
            highlight: 'Финал',
            highlightClass: 'summary-highlight-gold',
            accentLabel: 'занавес этой сессии',
            stats: [
                { label: 'Фаворит судьбы', value: byId.luck?.winner?.name || 'Нет данных', meta: byId.luck?.winner?.scoreText || '—' },
                { label: 'Король взрывов', value: byId.explosions?.winner?.name || 'Нет данных', meta: byId.explosions?.winner?.scoreText || '—' },
                { label: 'Магнит катастроф', value: byId.failures?.winner?.name || 'Без критпровалов', meta: byId.failures?.winner?.scoreText || '0' }
            ],
            roster: [
                byId.luck?.winner && { position: 1, name: byId.luck.winner.name, primary: byId.luck.winner.scoreText, secondary: 'Фаворит судьбы', scoreClass: byId.luck.winner.scoreClass || '' },
                byId.explosions?.winner && { position: 2, name: byId.explosions.winner.name, primary: byId.explosions.winner.scoreText, secondary: 'Король взрывов', scoreClass: byId.explosions.winner.scoreClass || '' },
                (byId.failures?.winner
                    ? { position: 3, name: byId.failures.winner.name, primary: byId.failures.winner.scoreText, secondary: 'Магнит катастроф', scoreClass: byId.failures.winner.scoreClass || '' }
                    : { position: 3, name: 'Вся команда', primary: '0', secondary: 'Критпровалов не было', scoreClass: 'ranking-positive' })
            ]
        });

        return {
            hasData: true,
            windowTitle: scope === 'session' ? 'Сводка сессии' : 'Сводка за все время',
            slides
        };
    }

    _preparePlayersContext() {
        const allStats = StatisticsStorage.getStats();
        const hiddenUserIds = new Set(StatisticsStorage.getHiddenUserIds());
        const currentUserId = game.user.id;
        const isGM = game.user.isGM;
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
        const players = [];
        const profiles = [];

        for (const userId of Object.keys(allStats)) {
            if (userId === StatisticsStorage.META_KEY) continue;
            if (hiddenUserIds.has(userId)) continue;
            const user = game.users.get(userId);
            if (!user) continue;

            const playerData = StatisticsStorage.getPlayerData(userId);
            const allTimeDisplayStats = this._prepareDisplayData(playerData, 'allTime');
            const sessionDisplayStats = this._prepareDisplayData(playerData, 'session');
            profiles.push({ id: userId, name: user.name, playerData, allTimeDisplayStats, sessionDisplayStats });
            if (!isGM && userId !== currentUserId) continue;

            const achievements = Object.entries(ACHIEVEMENTS).map(([id, achievement]) => {
                const record = playerData.achievements?.[id];
                const isUnlocked = Boolean(record);
                return {
                    id,
                    name: achievement.name,
                    description: achievement.description,
                    lp: achievement.lp,
                    rarity: achievement.rarity,
                    isUnlocked,
                    count: isUnlocked ? (record.count || 1) : 0,
                    cssClass: isUnlocked ? `ach-unlocked ach-${achievement.rarity}` : 'ach-locked'
                };
            }).sort((a, b) => {
                if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
                const rarityDiff = (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99);
                return rarityDiff || a.name.localeCompare(b.name, 'ru');
            });

            const displayStats = this.scope === 'session' ? sessionDisplayStats : allTimeDisplayStats;
            const luckPoints = playerData.luckPoints || 0;
            players.push({
                id: userId,
                name: user.name,
                isSelf: userId === currentUserId,
                luckPoints,
                achievements,
                displayStats,
                bennyStats: this._prepareBennyData(playerData),
                recordList: this._prepareRecordList(playerData),
                achievementSummary: this._achievementSummary(achievements),
                economy: this._economy(luckPoints)
            });
        }

        players.sort((a, b) => (a.isSelf !== b.isSelf ? (a.isSelf ? -1 : 1) : a.name.localeCompare(b.name, 'ru')));
        return { players, profiles, isGM };
    }

    getData() {
        const { players, profiles, isGM } = this._preparePlayersContext();
        const recordFeed = this._prepareRecordFeed();
        return {
            players,
            isGM,
            scope: this.scope,
            trackingEnabled: StatisticsStorage.isTrackingEnabled(),
            recordFeed,
            hasRecordFeed: recordFeed.length > 0,
            topBoards: this._prepareRankings(profiles, this.scope),
            hasScopedSummary: this._prepareScopedSummary(profiles, this.scope).hasData
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        if (this._tabs?.[0]) this._tabs[0].activate(this.activeTab);

        html.find('.tabs .item').on('click', (event) => {
            this.activeTab = event.currentTarget.dataset.tab || this.activeTab;
        });

        html.find('.stats-scope-toggle').prop('checked', this.scope === 'allTime').on('change', (event) => {
            this.scope = event.currentTarget.checked ? 'allTime' : 'session';
            this.render();
        });

        html.find('.toggle-switch .label').on('click', (event) => {
            const scope = event.currentTarget.dataset.scope;
            if (scope && scope !== this.scope) {
                this.scope = scope;
                this.render();
            }
        });

        html.find('.share-chat').click(this._onShareChat.bind(this));
        html.find('.share-extended').click(this._onShareExtended.bind(this));
        html.find('.share-skills').click(this._onShareSkills.bind(this));
        html.find('.reset-session').click(this._onResetSession.bind(this));
        html.find('.buy-benny').click(this._onBuyBenny.bind(this));
        html.find('.gift-benny').click(this._onGiftBenny.bind(this));
        html.find('.show-session-summary').click(this._onShowSessionSummary.bind(this));

        html.find('.player-header[data-collapsible="true"]').click((event) => {
            if ($(event.target).closest('button, a').length) return;
            const card = $(event.currentTarget).closest('.player-card');
            card.toggleClass('expanded');
            card.find('.dice-table-container').slideToggle(250);
            card.find('.toggle-icon').toggleClass('fa-chevron-down fa-chevron-up');
        });
    }

    async _onResetSession() {
        Dialog.confirm({
            title: 'Начать новую сессию',
            content: '<p>Вы уверены, что хотите сбросить только сессионную статистику для всех игроков?</p>',
            yes: () => StatisticsStorage.resetSessionData(),
            defaultYes: false
        });
    }

    async _onBuyBenny(event) {
        const userId = event.currentTarget.dataset.userid;
        if (game.user.isGM) return StatisticsStorage.buyBennyForPlayer(userId);
        if (userId !== game.user.id) return;

        const playerData = StatisticsStorage.getPlayerData(userId);
        if ((playerData.luckPoints || 0) < 100) return ui.notifications.warn('Недостаточно LP для покупки фишки.');
        if (!game.users.activeGM) return ui.notifications.error('Покупка невозможна: мастер не в сети.');

        ui.notifications.info('Отправлен запрос на покупку фишки.');
        ChatMessage.create({
            content: 'Запрос на покупку фишки...',
            whisper: ChatMessage.getWhisperRecipients('GM'),
            flags: { 'statistics_dice.buyRequest': true, 'statistics_dice.userId': userId }
        });
    }

    async _onGiftBenny(event) {
        const buyerId = event.currentTarget.dataset.userid;
        const buyerData = StatisticsStorage.getPlayerData(buyerId);
        if ((buyerData.luckPoints || 0) < 200) return ui.notifications.warn('Недостаточно LP для подарка.');
        if (!game.user.isGM && !game.users.activeGM) return ui.notifications.error('Подарок невозможен: мастер не в сети.');

        const otherPlayers = game.users.filter((user) => user.active && user.id !== buyerId);
        if (!otherPlayers.length) return ui.notifications.info('Нет других игроков онлайн, чтобы сделать подарок.');

        new Dialog({
            title: 'Подарить фишку',
            content: `
                <p>Выберите игрока, которому хотите подарить фишку:</p>
                <form><div class="form-group"><label>Игрок:</label><select name="target-player">
                    ${otherPlayers.map((player) => `<option value="${player.id}">${player.name}</option>`).join('')}
                </select></div></form>
            `,
            buttons: {
                gift: {
                    icon: '<i class="fas fa-gift"></i>',
                    label: 'Подарить (200 LP)',
                    callback: async (dialogHtml) => {
                        const targetId = dialogHtml.find('[name="target-player"]').val();
                        if (!targetId) return;
                        if (game.user.isGM) return StatisticsStorage.buyBennyGift(buyerId, targetId);
                        ui.notifications.info('Отправлен запрос на подарок.');
                        ChatMessage.create({
                            content: 'Запрос на подарок фишки...',
                            whisper: ChatMessage.getWhisperRecipients('GM'),
                            flags: {
                                'statistics_dice.giftRequest': true,
                                'statistics_dice.buyerId': buyerId,
                                'statistics_dice.targetId': targetId
                            }
                        });
                    }
                },
                cancel: { icon: '<i class="fas fa-times"></i>', label: 'Отмена' }
            },
            default: 'cancel'
        }).render(true);
    }

    async _onExportStats() {
        ui.notifications.info('Экспорт перенесен в настройки модуля.');
        ui.notifications.info('Экспорт статистики сохранен в JSON.');
    }

    _readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
            reader.readAsText(file, 'utf-8');
        });
    }

    async _importStatsFromDialog(dialogHtml, mode) {
        const file = dialogHtml.find('[name="stats-file"]')[0]?.files?.[0];
        if (!file) return ui.notifications.warn('Сначала выберите JSON-файл.');

        let payload;
        try {
            payload = JSON.parse(await this._readFileAsText(file));
        } catch (error) {
            return ui.notifications.error('Файл не похож на JSON со статистикой.');
        }

        const result = await StatisticsStorage.importStats(payload, mode);
        ui.notifications.info(mode === 'merge'
            ? `Импорт завершен: данные объединены, игроков ${result.userCount}.`
            : `Импорт завершен: снимок восстановлен, игроков ${result.userCount}.`);
    }

    async _onImportStats() {
        if (!game.user.isGM) return;
        new Dialog({
            title: 'Импорт статистики',
            content: `
                <form class="statistics-import-form">
                    <p>Перед импортом модуль автоматически выгрузит резервную копию текущей статистики.</p>
                    <div class="form-group"><label>JSON-файл</label><input type="file" name="stats-file" accept=".json,application/json" /></div>
                    <p><strong>Заменить</strong> восстанавливает снимок целиком. <strong>Объединить</strong> суммирует счетчики и подходит для ручной склейки разных статистик.</p>
                </form>
            `,
            buttons: {
                replace: { icon: '<i class="fas fa-file-import"></i>', label: 'Заменить', callback: async (dialogHtml) => this._importStatsFromDialog(dialogHtml, 'replace') },
                merge: { icon: '<i class="fas fa-layer-group"></i>', label: 'Объединить', callback: async (dialogHtml) => this._importStatsFromDialog(dialogHtml, 'merge') },
                cancel: { icon: '<i class="fas fa-times"></i>', label: 'Отмена' }
            },
            default: 'replace'
        }).render(true);
    }

    async _onShowSessionSummary() {
        const summary = this._prepareScopedSummary(this._preparePlayersContext().profiles, this.scope);
        if (!summary.hasData) return ui.notifications.info(`Для сводки "${this._scopeLabel()}" пока недостаточно данных.`);
        new SessionSummaryPresentation(summary).render(true);
    }

    _buildShareCard(user, stats, title) {
        return `
            <div style="background: linear-gradient(140deg, rgba(13, 21, 28, 0.97), rgba(44, 29, 18, 0.93)); border: 1px solid rgba(224, 166, 87, 0.35); border-radius: 16px; color: #f6ead1; overflow: hidden;">
                <div style="padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
                    <strong style="font-size: 1.06em;">${title}: ${user.name}</strong>
                    <span style="font-size: 0.78em; text-transform: uppercase; color: rgba(246,234,209,0.65);">${this._scopeLabel()}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 12px 14px;">
                    <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px; text-align: center;"><div style="font-size: 1.2em; font-weight: 700;">${stats.totalActions}</div><div style="font-size: 0.72em; color: rgba(246,234,209,0.65);">Действий</div></div>
                    <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px; text-align: center;"><div style="font-size: 1.2em; font-weight: 700;">${stats.totalDiceRolled}</div><div style="font-size: 0.72em; color: rgba(246,234,209,0.65);">Кубов</div></div>
                    <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px; text-align: center;"><div style="font-size: 1.2em; font-weight: 700; color: #a7f3b0;">${stats.raises}</div><div style="font-size: 0.72em; color: rgba(246,234,209,0.65);">Подъемов</div></div>
                    <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px; text-align: center;"><div style="font-size: 1.2em; font-weight: 700; color: #ffca7a;">${stats.totalExplosions}</div><div style="font-size: 0.72em; color: rgba(246,234,209,0.65);">Взрывов</div></div>
                    <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px; text-align: center;"><div style="font-size: 1.2em; font-weight: 700; color: ${stats.criticalFailures > 0 ? '#ff8c7a' : '#f6ead1'};">${stats.criticalFailures}</div><div style="font-size: 0.72em; color: rgba(246,234,209,0.65);">Крит. провалов</div></div>
                </div>
                <div style="padding: 0 14px 12px; color: rgba(246,234,209,0.84);">Средний результат: <strong>${stats.overallAverage}</strong> · Удача: <strong class="${stats.luck.cssClass}">${stats.luck.tier}</strong></div>
            </div>
        `;
    }

    async _onShareChat(event) {
        const user = game.users.get($(event.currentTarget).data('userid'));
        if (!user) return;
        const stats = this._prepareDisplayData(StatisticsStorage.getPlayerData(user.id));
        ChatMessage.create({ user: game.user.id, content: this._buildShareCard(user, stats, 'Статистика') });
    }

    async _onShareExtended(event) {
        const user = game.users.get($(event.currentTarget).data('userid'));
        if (!user) return;
        const stats = this._prepareDisplayData(StatisticsStorage.getPlayerData(user.id));
        const rows = stats.dice.length
            ? stats.dice.map((die, index) => `<tr style="background:${index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'};"><td style="padding:6px 8px; font-weight:700; color:#d97706; white-space:nowrap;">${die.type}</td><td style="padding:6px 8px;">${die.rolls}</td><td style="padding:6px 8px;">${die.average}</td><td style="padding:6px 8px;" class="${die.luckCssClass}">${die.luckTier}</td><td style="padding:6px 8px;">${die.explosions}</td></tr>`).join('')
            : '<tr><td colspan="5" style="padding:10px; color:rgba(246,234,209,0.7);">Нет данных по кубам.</td></tr>';
        ChatMessage.create({
            user: game.user.id,
            content: `${this._buildShareCard(user, stats, 'Подробная статистика')}<table style="width: calc(100% - 28px); margin: -4px 14px 14px; border-collapse: collapse; text-align: center;"><thead><tr style="background: rgba(255,255,255,0.08); color: #1f2937; text-transform: uppercase; font-size: 0.78em; font-weight: bold;"><th style="padding:8px;">Куб</th><th style="padding:8px;">Бросков</th><th style="padding:8px;">Среднее</th><th style="padding:8px;">Удача</th><th style="padding:8px;">Взрывов</th></tr></thead><tbody>${rows}</tbody></table>`
        });
    }

    async _onShareSkills(event) {
        const user = game.users.get($(event.currentTarget).data('userid'));
        if (!user) return;
        const stats = this._prepareDisplayData(StatisticsStorage.getPlayerData(user.id));
        const rows = stats.skillUsage.length
            ? stats.skillUsage.map((skill, index) => `<tr style="background:${index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'};"><td style="padding:6px 8px; text-align:left;">${skill.name}</td><td style="padding:6px 8px; color:#d97706; font-weight:700;">${skill.count}</td><td style="padding:6px 8px; color:#a7f3b0;">${skill.max}</td></tr>`).join('')
            : '<tr><td colspan="3" style="padding:10px; color:rgba(246,234,209,0.7);">Нет данных по навыкам.</td></tr>';
        ChatMessage.create({
            user: game.user.id,
            content: `
                <div style="background: linear-gradient(140deg, rgba(13, 21, 28, 0.97), rgba(44, 29, 18, 0.93)); border: 1px solid rgba(224, 166, 87, 0.35); border-radius: 16px; color: #f6ead1; overflow: hidden;">
                    <div style="padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);"><strong style="font-size:1.06em;">Топ навыков: ${user.name}</strong><span style="font-size:0.78em; text-transform:uppercase; color:rgba(246,234,209,0.65);">${this._scopeLabel()}</span></div>
                    <table style="width: calc(100% - 28px); margin: 14px; border-collapse: collapse; text-align: center;"><thead><tr style="background: rgba(255,255,255,0.08); color: #1f2937; text-transform: uppercase; font-size: 0.78em; font-weight: bold;"><th style="padding:8px; text-align:left;">Навык</th><th style="padding:8px;">Раз</th><th style="padding:8px;">Макс</th></tr></thead><tbody>${rows}</tbody></table>
                </div>
            `
        });
    }

    async _onResetStats() {
        if (!game.user.isGM) return;
        Dialog.confirm({
            title: 'Сбросить всю статистику',
            content: "<p>Вы уверены, что хотите <strong>навсегда</strong> удалить всю статистику для всех игроков?</p><p style='color:#ff8c7a;'>Это действие необратимо.</p>",
            yes: () => StatisticsStorage.clearAllStats(),
            defaultYes: false
        });
    }
}
