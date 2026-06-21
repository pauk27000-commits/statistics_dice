import { StatisticsStorage } from './storage.js';

export class StatisticsSettingsUI extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'statistics-dice-settings',
            title: 'Настройки Statistics Dice',
            template: 'modules/statistics_dice/templates/settings-window.hbs',
            width: 760,
            height: 'auto',
            resizable: true,
            closeOnSubmit: false,
            submitOnClose: false,
            classes: ['statistics-dice-app', 'statistics-dice-settings']
        });
    }

    getData() {
        const config = StatisticsStorage.getConfig();
        const hiddenSet = new Set(config.hiddenUserIds || []);

        const orphans = StatisticsStorage.getOrphanStats();

        const users = game.users.contents
            .map((user) => ({
                id: user.id,
                userName: user.name,
                characterName: user.character?.name || '',
                isHidden: hiddenSet.has(user.id)
            }))
            .sort((a, b) => a.userName.localeCompare(b.userName, 'ru'));

        const staleHiddenUsers = [...hiddenSet]
            .filter((userId) => !game.users.has(userId))
            .map((userId) => ({ id: userId }));

        return {
            users,
            orphans,
            hasOrphans: orphans.length > 0,
            staleHiddenUsers,
            hasStaleHiddenUsers: staleHiddenUsers.length > 0,
            exportText: StatisticsStorage.exportStatsToString(),
            trackingEnabled: config.trackingEnabled !== false,
            enableEconomy: config.enableEconomy !== false,
            costBenny: config.costBenny ?? 100,
            costGift: config.costGift ?? 200,
            enableFlashback: config.enableFlashback !== false,
            costFlashback: config.costFlashback ?? 500,
            enableAltar: config.enableAltar !== false,
            altarTitle: config.altarTitle || 'Алтарь Удачи',
            altarDescription: config.altarDescription || '',
            altarRewardDesc: config.altarRewardDesc || '',
            altarGoal: config.altarGoal || 1000,
            altarImage: config.altarImage || ''
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.copy-export').click(this._onCopyExport.bind(this));
        html.find('.import-replace').click((event) => this._onImportStats(event, 'replace'));
        html.find('.import-merge').click((event) => this._onImportStats(event, 'merge'));
        html.find('.clear-all-stats').click(this._onClearAllStats.bind(this));
        html.find('.reassign-orphan').click(this._onReassignOrphan.bind(this));
        html.find('.altar-reset-defaults').click(this._onAltarResetDefaults.bind(this));
    }

    async _updateObject(_event, formData) {
        const currentHiddenIds = StatisticsStorage.getHiddenUserIds();
        const staleHiddenIds = currentHiddenIds.filter((userId) => !game.users.has(userId));
        const trackingEnabled = this.element.find('[name="trackingEnabled"]').is(':checked');
        const enableEconomy = this.element.find('[name="enableEconomy"]').is(':checked');
        const enableAltar = this.element.find('[name="enableAltar"]').is(':checked');
        const enableFlashback = this.element.find('[name="enableFlashback"]').is(':checked');
        const hiddenUserIds = game.users.contents
            .filter((user) => Boolean(formData[`hiddenUsers.${user.id}`]))
            .map((user) => user.id);
        
        const costBenny = parseInt(this.element.find('[name="costBenny"]').val(), 10) || 100;
        const costGift = parseInt(this.element.find('[name="costGift"]').val(), 10) || 200;
        const costFlashback = parseInt(this.element.find('[name="costFlashback"]').val(), 10) || 500;

        const altarTitle = this.element.find('[name="altarTitle"]').val()?.trim() || '';
        const altarGoal = parseInt(this.element.find('[name="altarGoal"]').val(), 10) || 1000;
        const altarImage = this.element.find('[name="altarImage"]').val()?.trim() || '';
        const altarDescription = this.element.find('[name="altarDescription"]').val()?.trim() || '';
        const altarRewardDesc = this.element.find('[name="altarRewardDesc"]').val()?.trim() || '';

        await StatisticsStorage.saveConfig({
            hiddenUserIds: [...staleHiddenIds, ...hiddenUserIds],
            trackingEnabled,
            enableEconomy,
            costBenny,
            costGift,
            enableFlashback,
            costFlashback,
            enableAltar,
            altarTitle,
            altarGoal,
            altarImage,
            altarDescription,
            altarRewardDesc
        });

        ui.notifications.info('Настройки модуля сохранены.');
        this.render();
    }

    async _onReassignOrphan(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const orphanKey = button.dataset.orphanId;
        const select = this.element.find(`select[name="reassign-${orphanKey}"]`);
        const targetUserId = select.val();

        if (!targetUserId) {
            ui.notifications.warn('Выберите игрока для перепривязки статистики.');
            return;
        }

        const user = game.users.get(targetUserId);

        Dialog.confirm({
            title: 'Перепривязка статистики',
            content: `<p>Вы уверены, что хотите перепривязать эту статистику к игроку <strong>${user.name}</strong>?</p><p>Текущая статистика этого игрока будет объединена с перепривязываемой.</p>`,
            yes: async () => {
                await StatisticsStorage.reassignStats(orphanKey, targetUserId);
                ui.notifications.info(`Статистика успешно перепривязана к ${user.name}.`);
                this.render();
            },
            defaultYes: false
        });
    }

    async _onCopyExport(event) {
        event.preventDefault();

        const textarea = this.element.find('[name="export-text"]')[0];
        const exportText = StatisticsStorage.exportStatsToString();

        if (!textarea) return;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(exportText);
            } else {
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
            }

            ui.notifications.info('JSON статистики скопирован в буфер обмена.');
        } catch (error) {
            textarea.focus();
            textarea.select();
            ui.notifications.warn('Не удалось скопировать автоматически. Текст выделен, скопируйте вручную.');
        }
    }

    async _onImportStats(event, mode) {
        event.preventDefault();

        const importText = String(this.element.find('[name="import-text"]').val() || '').trim();
        if (!importText) {
            ui.notifications.warn('Вставьте JSON статистики в поле импорта.');
            return;
        }

        let payload;
        try {
            payload = JSON.parse(importText);
        } catch (error) {
            ui.notifications.error('Текст не похож на JSON со статистикой.');
            return;
        }

        const result = await StatisticsStorage.importStats(payload, mode);
        ui.notifications.info(
            mode === 'merge'
                ? `Импорт завершен: данные объединены, игроков ${result.userCount}.`
                : `Импорт завершен: снимок восстановлен, игроков ${result.userCount}.`
        );

        this.render();
    }

    async _onAltarResetDefaults(event) {
        event.preventDefault();
        
        Dialog.confirm({
            title: 'Сброс настроек Алтаря',
            content: '<p>Вы уверены, что хотите сбросить настройки Алтаря (название, цель, картинку и тексты) к базовым значениям?</p>',
            yes: async () => {
                const config = StatisticsStorage.getConfig();
                const defaultConfig = StatisticsStorage.getDefaultConfig();
                
                await StatisticsStorage.saveConfig({
                    ...config,
                    altarTitle: defaultConfig.altarTitle,
                    altarGoal: defaultConfig.altarGoal,
                    altarImage: defaultConfig.altarImage,
                    altarDescription: defaultConfig.altarDescription,
                    altarRewardDesc: defaultConfig.altarRewardDesc
                });
                
                ui.notifications.info('Настройки Алтаря сброшены к базовым.');
                this.render();
            }
        });
    }

    async _onClearAllStats(event) {
        event.preventDefault();

        Dialog.confirm({
            title: 'Сбросить всю статистику',
            content: "<p>Вы уверены, что хотите <strong>навсегда</strong> удалить всю статистику для всех игроков?</p><p style='color:#ff8c7a;'>Это действие необратимо. Настройки скрытия и паузы учета не будут затронуты.</p>",
            yes: async () => {
                await StatisticsStorage.clearAllStats();
                ui.notifications.info('Вся статистика удалена.');
                this.render();
            },
            defaultYes: false
        });
    }
}
