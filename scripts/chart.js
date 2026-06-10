class ChartApplication extends Application {
    constructor(data, options = {}) {
        super(options);
        this.chartData = data;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'dice-chart-window',
            title: `График Распределения: ${this.chartData.dieType}`,
            template: 'modules/statistics_dice/templates/chart-window.hbs',
            width: 600,
            height: 400,
            resizable: true,
        });
    }

    getData() {
        return { dieType: this.chartData.dieType };
    }

    activateListeners(html) {
        super.activateListeners(html);
        const ctx = html.find('canvas')[0].getContext('2d');

        const labels = this.chartData.labels;
        const playerData = this.chartData.playerData;
        const idealData = this.chartData.idealData;

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Броски игрока',
                        data: playerData,
                        backgroundColor: 'rgba(255, 152, 0, 0.5)',
                        borderColor: 'rgba(255, 152, 0, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Идеальная вероятность',
                        data: idealData,
                        type: 'line',
                        borderColor: 'rgba(0, 230, 255, 1)',
                        backgroundColor: 'rgba(0, 230, 255, 0.2)',
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                }
            }
        });
    }
}

// Make it available globally
window.ChartApplication = ChartApplication;
