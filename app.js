/* ==========================================
   EDGELINK OS - CORE LOGIC
   ========================================== */

// Configuration
const CONFIG = {
    CHANNEL_ID: '3214903',
    READ_API_KEY: 'JW9YB6D8ENYCURR0', // Replace with actual key if needed
    UPDATE_INTERVAL: 15000, // 15 seconds
    MAX_DATA_POINTS: 20,
    ANIMATION_DURATION: 800
};

// State
let state = {
    charts: {
        history: null,
        miniHum: null,
        miniPress: null
    },
    data: {
        temp: [],
        humid: [],
        press: [],
        labels: [],
        feeds: [],
        allFeeds: []  // Store all fetched feeds for 24h view
    },
    currentTab: 'temp',
    timeRange: 20,  // Number of data points to show (20 = recent, 100 = 24h)
    lastUpdate: null,
    lastDataTimestamp: null,
    updateCount: 0,
    isOffline: false
};

// DOM Elements
const UI = {
    temp: document.getElementById('tempValue'),
    humid: document.getElementById('humidValue'),
    press: document.getElementById('pressValue'),
    rainLiquid: document.getElementById('rainLiquid'),
    gaugeValue: document.getElementById('gaugeValue'),
    rainStatus: document.getElementById('rainStatusText'),
    weatherCondition: document.getElementById('weatherCondition'),
    time: document.getElementById('currentTime'),
    ampm: document.getElementById('currentAmPm'),
    date: document.getElementById('currentDate'),
    lastUpdate: document.getElementById('lastUpdate'),
    dataCountdown: document.getElementById('dataCountdown'),
    updateCount: document.getElementById('infoUpdateCount'),
    connection: document.getElementById('connectionStatus'),
    heatIndex: document.getElementById('heatIndexBadge'),
    dewPoint: document.getElementById('dewPointDisplay'),
    toastContainer: document.getElementById('toastContainer'),
    settingsModal: document.getElementById('settingsModal'),
    // New elements
    chartMin: document.getElementById('chartMin'),
    chartMax: document.getElementById('chartMax'),
    chartAvg: document.getElementById('chartAvg'),
    forecastIcon: document.getElementById('forecastIcon'),
    forecastText: document.getElementById('forecastText'),
    forecastDetail: document.getElementById('forecastDetail'),
    exportMenu: document.getElementById('exportMenu')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();       // Load saved theme
    initCharts();
    loadData();        // Load cached data first
    startClock();
    startCountdown();  // Start the data freshness countdown
    fetchData();
    setInterval(fetchData, CONFIG.UPDATE_INTERVAL);
});

/* ==========================================
   CHARTS
   ========================================== */

function initCharts() {
    // Main History Chart
    const ctx = document.getElementById('mainHistoryChart').getContext('2d');

    state.charts.history = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature',
                data: [],
                borderColor: '#0ea5e9', // Neon Blue
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#94a3b8',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            }
        }
    });

    initSparklines();
}

function initSparklines() {
    const commonOptions = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 },
                line: { borderWidth: 2 }
            },
            animation: { duration: 0 }
        }
    };

    // Humidity Sparkline
    state.charts.miniHum = new Chart(document.getElementById('miniChartHum'), {
        ...commonOptions,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#06b6d4',
                backgroundColor: 'transparent',
                fill: false
            }]
        }
    });

    // Pressure Sparkline
    state.charts.miniPress = new Chart(document.getElementById('miniChartPress'), {
        ...commonOptions,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#8b5cf6',
                backgroundColor: 'transparent',
                fill: false
            }]
        }
    });
}

function switchChart(type) {
    state.currentTab = type;

    // Update Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update Chart Data
    const chart = state.charts.history;
    const dataset = chart.data.datasets[0];

    if (type === 'temp') {
        dataset.label = 'Temperature';
        dataset.data = state.data.temp;
        dataset.borderColor = '#0ea5e9'; // Blue
        dataset.backgroundColor = 'rgba(14, 165, 233, 0.1)';
        chart.options.scales.y.ticks.callback = v => v + '°C';
    } else if (type === 'humid') {
        dataset.label = 'Humidity';
        dataset.data = state.data.humid;
        dataset.borderColor = '#06b6d4'; // Cyan
        dataset.backgroundColor = 'rgba(6, 182, 212, 0.1)';
        chart.options.scales.y.ticks.callback = v => v + '%';
    } else if (type === 'press') {
        dataset.label = 'Pressure';
        dataset.data = state.data.press;
        dataset.borderColor = '#8b5cf6'; // Purple
        dataset.backgroundColor = 'rgba(139, 92, 246, 0.1)';
        chart.options.scales.y.ticks.callback = v => v + ' hPa';
    }

    chart.update();
    updateChartStats();  // Update min/max/avg for new tab
}

/* ==========================================
   DATA FETCHING
   ========================================== */

async function fetchData() {
    try {
        // Fetch more data points for 24h view
        const dataPoints = Math.max(state.timeRange, 100);
        const response = await fetch(`https://api.thingspeak.com/channels/${CONFIG.CHANNEL_ID}/feeds.json?results=${dataPoints}&api_key=${CONFIG.READ_API_KEY}`);

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        if (data.feeds && data.feeds.length > 0) {
            // Store all feeds for 24h view
            state.data.allFeeds = data.feeds;

            // Use time range to slice data for display
            const displayFeeds = data.feeds.slice(-state.timeRange);
            updateDashboard(displayFeeds);
            updateForecast(data.feeds);  // Use all data for forecast
            updateStatus(true);

            // Save compressed data for offline use
            saveCompressedData(data.feeds);

            // Clear offline mode if we were offline
            if (state.isOffline) {
                state.isOffline = false;
                hideOfflineBanner();
            }
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        updateStatus(false);

        // Try to load cached data if offline
        if (!state.isOffline) {
            state.isOffline = true;
            showOfflineBanner();
            loadCachedData();
        }
    }
}

function updateDashboard(feeds) {
    const latest = feeds[feeds.length - 1];

    // Parse Data
    const temp = parseFloat(latest.field1) || 0;
    const humid = parseFloat(latest.field2) || 0;
    const press = parseFloat(latest.field3) || 0;
    const rain = parseFloat(latest.field5) || 0;

    // Update DOM
    UI.temp.textContent = temp.toFixed(1);
    UI.humid.textContent = humid.toFixed(0);
    UI.press.textContent = press.toFixed(0);

    // Update Rain Gauge (Liquid Height)
    // Assuming max rain for visual is 100mm
    const liquidHeight = Math.min((rain / 100) * 100, 100);
    UI.rainLiquid.style.height = `${liquidHeight}%`;
    UI.gaugeValue.textContent = rain.toFixed(3);
    UI.rainStatus.textContent = rain > 0 ? 'Raining' : 'No Rain';

    // Update Weather Condition (Mock Logic)
    updateWeatherCondition(temp, rain);

    // Update History Data
    state.data.feeds = feeds; // Store for export
    state.data.labels = feeds.map(f => {
        const date = new Date(f.created_at);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    state.data.temp = feeds.map(f => parseFloat(f.field1));
    state.data.humid = feeds.map(f => parseFloat(f.field2));
    state.data.press = feeds.map(f => parseFloat(f.field3));

    // Refresh Chart
    const chart = state.charts.history;
    chart.data.labels = state.data.labels;

    // Update Sparklines
    updateSparkline(state.charts.miniHum, state.data.humid);
    updateSparkline(state.charts.miniPress, state.data.press);

    // Update Calculated Metrics
    const hi = calculateHeatIndex(temp, humid);
    const dp = calculateDewPoint(temp, humid);

    if (UI.heatIndex) UI.heatIndex.textContent = `Feels like ${hi.toFixed(1)}°C`;
    if (UI.dewPoint) UI.dewPoint.textContent = `DP: ${dp.toFixed(1)}°C`;

    // Update Pressure Trend
    updatePressureTrend(feeds);

    // Update Chart Stats (Min/Max/Avg)
    updateChartStats();

    // Update Page Title
    document.title = `${temp.toFixed(1)}°C | EdgeLink OS`;

    // Smart Features
    checkAlerts(temp, rain);
    saveData(feeds);

    if (state.currentTab === 'temp') chart.data.datasets[0].data = state.data.temp;
    else if (state.currentTab === 'humid') chart.data.datasets[0].data = state.data.humid;
    else if (state.currentTab === 'press') chart.data.datasets[0].data = state.data.press;

    chart.update('none'); // No animation for updates

    // Update Metadata
    state.updateCount++;
    UI.updateCount.textContent = state.updateCount;

    // Show actual data timestamp from ThingSpeak (when sensor recorded it)
    const dataTimestamp = new Date(latest.created_at);
    state.lastDataTimestamp = dataTimestamp;  // Save for countdown timer

    UI.lastUpdate.textContent = dataTimestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updateWeatherCondition(temp, rain) {
    let icon = '🌤️';
    let text = 'Clear';

    if (rain > 0) {
        icon = '🌧️';
        text = 'Rainy';
    } else if (temp > 30) {
        icon = '☀️';
        text = 'Sunny';
    } else if (temp < 20) {
        icon = '❄️';
        text = 'Cold';
    }

    UI.weatherCondition.innerHTML = `<span class="condition-icon">${icon}</span><span class="condition-text">${text}</span>`;
}

function updateStatus(isOnline) {
    const statusText = UI.connection.querySelector('.status-text');
    const statusDot = UI.connection.querySelector('.status-dot');

    if (isOnline) {
        statusText.textContent = 'Live';
        statusDot.style.background = 'var(--neon-green)';
        statusDot.style.boxShadow = '0 0 8px var(--neon-green)';
    } else {
        statusText.textContent = 'Offline';
        statusDot.style.background = 'var(--neon-red)';
        statusDot.style.boxShadow = '0 0 8px var(--neon-red)';
    }
}

function updateSparkline(chart, data) {
    if (!chart) return;
    // Keep last 10 points for sparkline
    const recentData = data.slice(-10);
    chart.data.labels = new Array(recentData.length).fill('');
    chart.data.datasets[0].data = recentData;
    chart.update('none');
}

function calculateHeatIndex(T, RH) {
    // Simple formula for Heat Index (Rothfusz regression)
    // T in Celsius, RH in %
    // Convert T to Fahrenheit for formula
    const T_F = (T * 9 / 5) + 32;

    let HI = 0.5 * (T_F + 61.0 + ((T_F - 68.0) * 1.2) + (RH * 0.094));

    if (HI > 80) {
        HI = -42.379 + 2.04901523 * T_F + 10.14333127 * RH - .22475541 * T_F * RH - .00683783 * T_F * T_F - .05481717 * RH * RH + .00122874 * T_F * T_F * RH + .00085282 * T_F * RH * RH - .00000199 * T_F * T_F * RH * RH;
    }

    // Convert back to Celsius
    return (HI - 32) * 5 / 9;
}

function calculateDewPoint(T, RH) {
    // Magnus formula
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * T) / (b + T)) + Math.log(RH / 100.0);
    return (b * alpha) / (a - alpha);
}

/* ==========================================
   UTILITIES
   ========================================== */

function startClock() {
    function update() {
        const now = new Date();
        UI.time.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ AM| PM/, '');
        UI.ampm.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).slice(-2);
        UI.date.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    update();
    setInterval(update, 1000);
}

// Data freshness countdown timer (30 minutes = 1800 seconds)
const FRESHNESS_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

function startCountdown() {
    function updateCountdown() {
        if (!state.lastDataTimestamp) {
            if (UI.dataCountdown) {
                UI.dataCountdown.textContent = '--:--';
                UI.dataCountdown.className = 'value mono countdown';
            }
            return;
        }

        const now = new Date();
        const elapsed = now - state.lastDataTimestamp;
        const remaining = FRESHNESS_LIMIT - elapsed;

        if (UI.dataCountdown) {
            if (remaining <= 0) {
                // Data is stale (older than 30 minutes)
                UI.dataCountdown.textContent = 'Stale';
                UI.dataCountdown.className = 'value mono countdown expired';
            } else {
                // Calculate minutes and seconds remaining
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                UI.dataCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                // Update color class based on time remaining
                if (remaining > 15 * 60 * 1000) {
                    // More than 15 minutes - fresh (green)
                    UI.dataCountdown.className = 'value mono countdown fresh';
                } else if (remaining > 5 * 60 * 1000) {
                    // 5-15 minutes - warning (amber)
                    UI.dataCountdown.className = 'value mono countdown warning';
                } else {
                    // Less than 5 minutes - critical (red, blinking)
                    UI.dataCountdown.className = 'value mono countdown expired';
                }
            }
        }
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('edgeLinkDarkMode', newTheme);

    // Update the theme toggle button icon
    const themeBtn = document.querySelector('.icon-btn[onclick="toggleTheme()"]');
    if (themeBtn) {
        themeBtn.querySelector('.icon').textContent = newTheme === 'light' ? '🌙' : '☀️';
    }

    // Show feedback toast
    showToast(`Switched to ${newTheme} mode`, 'info');
}

// Initialize theme on page load
function initTheme() {
    const savedTheme = localStorage.getItem('edgeLinkDarkMode');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Update button icon
        const themeBtn = document.querySelector('.icon-btn[onclick="toggleTheme()"]');
        if (themeBtn) {
            themeBtn.querySelector('.icon').textContent = savedTheme === 'light' ? '🌙' : '☀️';
        }
    }
}

function updatePressureTrend(feeds) {
    if (feeds.length < 6) return;

    const recent = feeds.slice(-3);
    const previous = feeds.slice(-6, -3);

    const avgRecent = recent.reduce((a, b) => a + (parseFloat(b.field3) || 0), 0) / 3;
    const avgPrev = previous.reduce((a, b) => a + (parseFloat(b.field3) || 0), 0) / 3;

    const diff = avgRecent - avgPrev;
    const element = document.getElementById('pressureTrend'); // Make sure this ID matches HTML

    // Note: HTML id is 'pressureTrend' or 'pressTrend'? 
    // Checking index.html: id="pressureTrend" (line 138)

    if (!element) return;

    if (diff > 0.5) {
        element.innerHTML = '<span class="trend-arrow" style="color: var(--neon-green)">↑</span> Rising';
    } else if (diff < -0.5) {
        element.innerHTML = '<span class="trend-arrow" style="color: var(--neon-red)">↓</span> Falling';
    } else {
        element.innerHTML = '<span class="trend-arrow">→</span> Stable';
    }
}

function exportData(format = 'csv') {
    const feeds = state.data.allFeeds.length > 0 ? state.data.allFeeds : state.data.feeds;

    if (!feeds || feeds.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    // Close export menu
    if (UI.exportMenu) UI.exportMenu.classList.remove('active');

    const filename = `weather_data_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
        const headers = ['Timestamp', 'Temperature (C)', 'Humidity (%)', 'Pressure (hPa)', 'Rainfall (mm)'];
        const rows = feeds.map(f => [
            f.created_at,
            f.field1,
            f.field2,
            f.field3,
            f.field5
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');

    } else if (format === 'json') {
        const jsonData = feeds.map(f => ({
            timestamp: f.created_at,
            temperature: parseFloat(f.field1) || 0,
            humidity: parseFloat(f.field2) || 0,
            pressure: parseFloat(f.field3) || 0,
            rainfall: parseFloat(f.field5) || 0
        }));

        downloadFile(JSON.stringify(jsonData, null, 2), `${filename}.json`, 'application/json;charset=utf-8;');

    } else if (format === 'xlsx') {
        // Create Excel using SheetJS library
        const data = [
            ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Pressure (hPa)', 'Rainfall (mm)'],
            ...feeds.map(f => [
                f.created_at,
                parseFloat(f.field1) || 0,
                parseFloat(f.field2) || 0,
                parseFloat(f.field3) || 0,
                parseFloat(f.field5) || 0
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Weather Data');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    showToast(`Exported as ${format.toUpperCase()}`, 'info');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function toggleExportMenu() {
    if (UI.exportMenu) {
        UI.exportMenu.classList.toggle('active');
    }
}

// Update Min/Max/Avg stats in chart footer
function updateChartStats() {
    let data;
    let unit;

    if (state.currentTab === 'temp') {
        data = state.data.temp;
        unit = '°C';
    } else if (state.currentTab === 'humid') {
        data = state.data.humid;
        unit = '%';
    } else {
        data = state.data.press;
        unit = ' hPa';
    }

    if (data && data.length > 0) {
        const validData = data.filter(v => !isNaN(v) && v !== null);
        if (validData.length > 0) {
            const min = Math.min(...validData);
            const max = Math.max(...validData);
            const avg = validData.reduce((a, b) => a + b, 0) / validData.length;

            if (UI.chartMin) UI.chartMin.textContent = min.toFixed(1) + unit;
            if (UI.chartMax) UI.chartMax.textContent = max.toFixed(1) + unit;
            if (UI.chartAvg) UI.chartAvg.textContent = avg.toFixed(1) + unit;
        }
    }
}

// Set time range for chart (Recent vs 24h)
function setTimeRange(range) {
    state.timeRange = range;

    // Update button states
    document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Re-slice data from allFeeds
    if (state.data.allFeeds.length > 0) {
        const displayFeeds = state.data.allFeeds.slice(-range);
        updateDashboard(displayFeeds);
    } else {
        // Fetch new data with larger range
        fetchData();
    }
}

// Weather forecast based on pressure trends
function updateForecast(feeds) {
    if (!feeds || feeds.length < 10) return;

    // Get pressure readings from last 3 hours (approx 12 readings at 15min intervals)
    const recentPressure = feeds.slice(-12).map(f => parseFloat(f.field3) || 0);
    const olderPressure = feeds.slice(-24, -12).map(f => parseFloat(f.field3) || 0);

    const avgRecent = recentPressure.reduce((a, b) => a + b, 0) / recentPressure.length;
    const avgOlder = olderPressure.length > 0
        ? olderPressure.reduce((a, b) => a + b, 0) / olderPressure.length
        : avgRecent;

    const pressureChange = avgRecent - avgOlder;

    let forecastText, forecastDetail, iconSVG;

    if (pressureChange < -2) {
        // Rapidly falling pressure - storm coming
        forecastText = 'Storm Coming';
        forecastDetail = `Pressure dropping ${Math.abs(pressureChange).toFixed(1)} hPa`;
        iconSVG = `<svg class="weather-svg" viewBox="0 0 100 100">
            <path class="cloud" d="M25,60 Q15,60 15,50 Q15,40 25,40 Q25,30 40,30 Q50,25 60,32 Q75,30 80,45 Q90,48 85,60 Z" fill="#64748b"/>
            <line class="rain-drop" x1="30" y1="70" x2="25" y2="85" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
            <line class="rain-drop" x1="50" y1="70" x2="45" y2="85" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
            <line class="rain-drop" x1="70" y1="70" x2="65" y2="85" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
            <path class="lightning" d="M55,45 L50,55 L58,55 L52,70" fill="none" stroke="#f59e0b" stroke-width="3"/>
        </svg>`;
    } else if (pressureChange < -0.5) {
        // Falling pressure - rain likely
        forecastText = 'Rain Likely';
        forecastDetail = `Pressure falling ${Math.abs(pressureChange).toFixed(1)} hPa`;
        iconSVG = `<svg class="weather-svg" viewBox="0 0 100 100">
            <path class="cloud" d="M25,55 Q15,55 15,45 Q15,35 25,35 Q25,25 40,25 Q50,20 60,27 Q75,25 80,40 Q90,43 85,55 Z" fill="#94a3b8"/>
            <line class="rain-drop" x1="30" y1="65" x2="25" y2="80" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
            <line class="rain-drop" x1="50" y1="65" x2="45" y2="80" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
            <line class="rain-drop" x1="70" y1="65" x2="65" y2="80" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/>
        </svg>`;
    } else if (pressureChange > 1) {
        // Rising pressure - clearing up
        forecastText = 'Clearing Up';
        forecastDetail = `Pressure rising ${pressureChange.toFixed(1)} hPa`;
        iconSVG = `<svg class="weather-svg" viewBox="0 0 100 100">
            <circle class="sun" cx="35" cy="35" r="15" fill="#f59e0b"/>
            <path class="cloud" d="M45,70 Q35,70 35,60 Q35,50 45,50 Q50,45 60,48 Q70,45 75,55 Q82,57 80,65 Q82,70 75,70 Z" fill="#e2e8f0"/>
        </svg>`;
    } else {
        // Stable pressure - fair weather
        forecastText = 'Fair Weather';
        forecastDetail = 'Pressure stable';
        iconSVG = `<svg class="weather-svg" viewBox="0 0 100 100">
            <circle class="sun" cx="50" cy="50" r="20" fill="#f59e0b"/>
            <g class="rays">
                <line x1="50" y1="15" x2="50" y2="5" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="50" y1="95" x2="50" y2="85" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="15" y1="50" x2="5" y2="50" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="95" y1="50" x2="85" y2="50" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="25" y1="25" x2="18" y2="18" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="75" y1="25" x2="82" y2="18" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="25" y1="75" x2="18" y2="82" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
                <line x1="75" y1="75" x2="82" y2="82" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
            </g>
        </svg>`;
    }

    if (UI.forecastIcon) UI.forecastIcon.innerHTML = iconSVG;
    if (UI.forecastText) UI.forecastText.textContent = forecastText;
    if (UI.forecastDetail) UI.forecastDetail.textContent = forecastDetail;
}

// Fullscreen toggle
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showToast('Fullscreen not available', 'warning');
        });
        document.getElementById('fullscreenIcon').innerHTML = '<path d="M4 14H10V20M20 10H14V4M14 10L21 3M3 21L10 14"></path>';
    } else {
        document.exitFullscreen();
        document.getElementById('fullscreenIcon').innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>';
    }
}

// Compressed data storage for offline mode
function saveCompressedData(feeds) {
    try {
        // Only save essential fields to reduce storage size
        const compressed = feeds.map(f => ({
            t: f.created_at,
            1: f.field1,
            2: f.field2,
            3: f.field3,
            5: f.field5
        }));
        localStorage.setItem('edgeLinkCompressedData', JSON.stringify(compressed));
    } catch (e) {
        console.warn('Could not save compressed data:', e);
    }
}

function loadCachedData() {
    try {
        const compressed = localStorage.getItem('edgeLinkCompressedData');
        if (compressed) {
            const data = JSON.parse(compressed);
            // Decompress back to original format
            const feeds = data.map(d => ({
                created_at: d.t,
                field1: d['1'],
                field2: d['2'],
                field3: d['3'],
                field5: d['5']
            }));

            if (feeds.length > 0) {
                showToast('Showing cached data (offline)', 'warning');
                updateDashboard(feeds.slice(-state.timeRange));
            }
        }
    } catch (e) {
        console.warn('Could not load cached data:', e);
    }
}

// Offline banner management
function showOfflineBanner() {
    let banner = document.querySelector('.offline-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.className = 'offline-banner';
        banner.innerHTML = '⚠️ You are offline. Showing cached data.';
        document.body.prepend(banner);
    }
    setTimeout(() => banner.classList.add('visible'), 100);
}

function hideOfflineBanner() {
    const banner = document.querySelector('.offline-banner');
    if (banner) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 300);
    }
}

/* ==========================================
   SMART FEATURES
   ========================================== */

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'alert') icon = '🚨';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;

    UI.toastContainer.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function checkAlerts(temp, rain) {
    // Rain Alert
    if (rain > 0 && !state.rainAlertShown) {
        showToast('Rain detected! Take an umbrella.', 'info');
        state.rainAlertShown = true;
    } else if (rain === 0) {
        state.rainAlertShown = false;
    }

    // Heat Alert
    if (temp > 35 && !state.heatAlertShown) {
        showToast(`High temperature warning: ${temp.toFixed(1)}°C`, 'warning');
        state.heatAlertShown = true;
    } else if (temp < 30) {
        state.heatAlertShown = false;
    }
}

function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.toggle('active');
}

function setTheme(color) {
    document.documentElement.style.setProperty('--neon-blue', color);

    // Update active button state
    document.querySelectorAll('.color-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(color)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Save preference
    localStorage.setItem('edgeLinkTheme', color);
}

// Update data fetch interval
let fetchIntervalId = null;

function updateInterval(ms) {
    const interval = parseInt(ms);
    CONFIG.UPDATE_INTERVAL = interval;

    // Clear existing interval and set new one
    if (fetchIntervalId) clearInterval(fetchIntervalId);
    fetchIntervalId = setInterval(fetchData, interval);

    // Save preference
    localStorage.setItem('edgeLinkInterval', interval);

    // Show feedback
    showToast(`Update interval set to ${interval / 1000}s`, 'info');
}

// Toggle notifications
let notificationsEnabled = true;

function toggleNotifications(enabled) {
    notificationsEnabled = enabled;
    localStorage.setItem('edgeLinkNotifications', enabled);

    if (enabled) {
        showToast('Notifications enabled', 'info');
    }
}

// Reset all settings to defaults
function resetSettings() {
    // Reset theme
    setTheme('#0ea5e9');

    // Reset interval
    document.getElementById('intervalSelect').value = '15000';
    updateInterval(15000);

    // Reset notifications
    document.getElementById('notifToggle').checked = true;
    toggleNotifications(true);

    // Clear local storage settings
    localStorage.removeItem('edgeLinkTheme');
    localStorage.removeItem('edgeLinkInterval');
    localStorage.removeItem('edgeLinkNotifications');

    showToast('Settings reset to defaults', 'info');
}

// Override showToast to respect notification settings
const originalShowToast = showToast;
showToast = function (message, type = 'info') {
    if (!notificationsEnabled && type !== 'alert') return;

    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'alert') icon = '🚨';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;

    container.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
};

function saveData(feeds) {
    localStorage.setItem('edgeLinkData', JSON.stringify(feeds));
}

function loadData() {
    // Load Theme
    const savedTheme = localStorage.getItem('edgeLinkTheme');
    if (savedTheme) setTheme(savedTheme);

    // Load Data
    const savedData = localStorage.getItem('edgeLinkData');
    if (savedData) {
        try {
            const feeds = JSON.parse(savedData);
            if (feeds && feeds.length > 0) {
                console.log('Loaded cached data');
                updateDashboard(feeds);
            }
        } catch (e) {
            console.error('Error loading cached data', e);
        }
    }
}