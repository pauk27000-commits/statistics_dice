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
            enableAltar: config.enableAltar !== false
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.copy-export').click(this._onCopyExport.bind(this));
        html.find('.import-replace').click((event) => this._onImportStats(event, 'replace'));
        html.find('.import-merge').click((event) => this._onImportStats(event, 'merge'));
        html.find('.clear-all-stats').click(this._onClearAllStats.bind(this));
        html.find('.reassign-orphan').click(this._onReassignOrphan.bind(this));
    }

    async _updateObject(_event, formData) {
        const currentHiddenIds = StatisticsStorage.getHiddenUserIds();
        const staleHiddenIds = currentHiddenIds.filter((userId) => !game.users.has(userId));
        const trackingEnabled = this.element.find('[name="trackingEnabled"]').is(':checked');
        const enableEconomy = this.element.find('[name="enableEconomy"]').is(':checked');
        const enableAltar = this.element.find('[name="enableAltar"]').is(':checked');
        const hiddenUserIds = game.users.contents
            .filter((user) => Boolean(formData[`hiddenUsers.${user.id}`]))
            .map((user) => user.id);

        await StatisticsStorage.saveConfig({
            hiddenUserIds: [...staleHiddenIds, ...hiddenUserIds],
            trackingEnabled,
            enableEconomy,
            enableAltar
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
