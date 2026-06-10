import { StatisticsStorage } from './storage.js';
import { DiceTracker } from './tracker.js';
import { StatisticsUI } from './ui.js';
import { StatisticsSettingsUI } from './settings-ui.js';

Hooks.once('init', () => {
    console.log('Statistics Dice | Initializing module');

    Handlebars.registerHelper('min', (a, b) => Math.min(a, b));
    Handlebars.registerHelper('multiply', (a, b) => a * b);
    Handlebars.registerHelper('lt', (a, b) => a < b);
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('eq', (a, b) => a === b);

    StatisticsStorage.registerSettings();
    game.settings.registerMenu(StatisticsStorage.ID, 'management-menu', {
        name: 'Statistics Dice',
        label: 'Настройки',
        hint: 'Скрытие игроков, copy-paste импорт/экспорт и полный сброс статистики.',
        icon: 'fas fa-sliders-h',
        type: StatisticsSettingsUI,
        restricted: true
    });
    StatisticsUI.init();
});

Hooks.once('ready', () => {
    DiceTracker.init();

    // Preserve stats for deleted users by converting their stats to orphan format
    Hooks.on('deleteUser', async (user) => {
        if (!game.user.isGM) return;
        const allStats = StatisticsStorage.getStats();
        if (allStats[user.id]) {
            const orphanKey = `orphan_${user.id}_${Date.now()}`;
            allStats[orphanKey] = allStats[user.id];
            allStats[orphanKey].originalName = user.name;
            delete allStats[user.id];

            // Update global records to point to orphan key instead of deleted user
            const meta = allStats[StatisticsStorage.META_KEY];
            if (meta) {
                if (meta.worldRecords) {
                    for (const category of Object.keys(meta.worldRecords)) {
                        if (meta.worldRecords[category].userId === user.id) {
                            meta.worldRecords[category].userId = orphanKey;
                        }
                    }
                }
                if (meta.recordFeed) {
                    for (const entry of meta.recordFeed) {
                        if (entry.userId === user.id) {
                            entry.userId = orphanKey;
                        }
                    }
                }
            }

            await StatisticsStorage.saveAllStats(allStats);
            console.log(`Statistics Dice | Preserved stats for deleted user ${user.name} as ${orphanKey}`);
        }
    });

    // Listen for "Buy Benny" and "Gift Benny" requests via Chat Messages
    Hooks.on('createChatMessage', async (message) => {
        if (!game.user.isGM) return; // Only GM processes these

        const flags = message.flags?.statistics_dice || {};
        const { buyRequest, userId, giftRequest, buyerId, targetId } = flags;

        if (buyRequest && userId) {
            console.log(`Statistics Dice | GM received buy request from ${userId}`);
            await StatisticsStorage.buyBennyForPlayer(userId);
            await message.delete();
        }

        if (giftRequest && buyerId && targetId) {
            console.log(`Statistics Dice | GM received gift request from ${buyerId} to ${targetId}`);
            await StatisticsStorage.buyBennyGift(buyerId, targetId);
            await message.delete();
        }
    });

    Hooks.on('getSceneControls', (controls) => {
        const tokenControls = controls.tokens;
        if (tokenControls && game.user.isGM) {
            if (!tokenControls.tools.find(t => t.name === 'reset-session-stats')) {
                tokenControls.tools.push({
                    name: 'reset-session-stats',
                    title: 'Начать новую сессию',
                    icon: 'fas fa-hourglass-start',
                    onClick: () => {
                        Dialog.confirm({
                            title: "Начать новую сессию",
                            content: "<p>Вы уверены, что хотите сбросить сессионную статистику для всех игроков?</p><p>Это действие начнет новый отчетный период для статистики и ачивок.</p>",
                            yes: () => StatisticsStorage.resetSessionData(),
                            defaultYes: false
                        });
                    },
                    button: true
                });
            }
        }
    });
});
