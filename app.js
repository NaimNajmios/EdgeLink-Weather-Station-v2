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
        feeds: []
    },
    currentTab: 'temp',
    lastUpdate: null,
    updateCount: 0
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
    updateCount: document.getElementById('infoUpdateCount'),
    connection: document.getElementById('connectionStatus'),
    heatIndex: document.getElementById('heatIndexBadge'),
    dewPoint: document.getElementById('dewPointDisplay'),
    toastContainer: document.getElementById('toastContainer'),
    settingsModal: document.getElementById('settingsModal')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadData(); // Load cached data first
    startClock();
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
}

/* ==========================================
   DATA FETCHING
   ========================================== */

async function fetchData() {
    try {
        const response = await fetch(`https://api.thingspeak.com/channels/${CONFIG.CHANNEL_ID}/feeds.json?results=${CONFIG.MAX_DATA_POINTS}&api_key=${CONFIG.READ_API_KEY}`);
        const data = await response.json();

        if (data.feeds && data.feeds.length > 0) {
            updateDashboard(data.feeds);
            updateStatus(true);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        updateStatus(false);
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

function toggleTheme() {
    // Placeholder for theme toggle logic
    console.log('Theme toggle clicked');
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

function exportData() {
    if (!state.data.feeds || state.data.feeds.length === 0) {
        alert('No data to export');
        return;
    }

    const headers = ['Timestamp', 'Temperature (C)', 'Humidity (%)', 'Pressure (hPa)', 'Rainfall (mm)'];
    const rows = state.data.feeds.map(f => [
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `weather_data_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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