// Currency Strength Scalper - Main Logic
// Configuration
const CONFIG = {
    MIN_DIVERGENCE: 8, // Minimum 8 points divergence
    MIN_SPEED: 1.5, // Minimum 1.5 points/tick reduction speed
    API_INTERVAL: 5000, // Update every 5 seconds
    HISTORY_SIZE: 20, // Keep last 20 data points
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];
const BASE_PAIRS = {
    'USD': ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD'],
    'EUR': ['EURUSD', 'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURNZD', 'EURCAD'],
    'GBP': ['GBPUSD', 'EURGBP', 'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPNZD', 'GBPCAD'],
    'JPY': ['USDJPY', 'EURJPY', 'GBPJPY', 'CHFJPY', 'AUDJPY', 'NZDJPY', 'CADJPY'],
    'CHF': ['USDCHF', 'EURCHF', 'GBPCHF', 'CHFJPY', 'AUDCHF', 'NZDCHF', 'CADCHF'],
    'AUD': ['AUDUSD', 'EURAUD', 'GBPAUD', 'AUDJPY', 'AUDCHF', 'AUDNZD', 'AUDCAD'],
    'NZD': ['NZDUSD', 'EURNZD', 'GBPNZD', 'NZDJPY', 'NZDCHF', 'AUDNZD', 'NZDCAD'],
    'CAD': ['USDCAD', 'EURCAD', 'GBPCAD', 'CADJPY', 'CADCHF', 'AUDCAD', 'NZDCAD']
};

// Global state
let isRunning = false;
let currencyStrengths = {};
let strengthHistory = {};
let signals = [];
let chart = null;

// Initialize strength history
CURRENCIES.forEach(curr => {
    currencyStrengths[curr] = 0;
    strengthHistory[curr] = [];
});

// UI Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const lastUpdate = document.getElementById('lastUpdate');
const signalContainer = document.getElementById('signalContainer');

// Event Listeners
startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);

// Mock data generator (replace with real API)
function generateMockPrices() {
    const prices = {};
    CURRENCIES.forEach(curr => {
        CURRENCIES.forEach(other => {
            if (curr !== other) {
                const pair = curr + other;
                prices[pair] = 100 + Math.random() * 0.1 - 0.05;
            }
        });
    });
    return prices;
}

// Calculate currency strength using multiple pairs
function calculateStrengths(prices) {
    const strengths = {};
    
    CURRENCIES.forEach(curr => {
        let score = 0;
        let count = 0;
        
        BASE_PAIRS[curr].forEach(pair => {
            if (prices[pair]) {
                // Simplified calculation: check if currency is strong in the pair
                if (pair.startsWith(curr)) {
                    score += prices[pair] > 100 ? 1 : -1;
                } else {
                    score += prices[pair] < 100 ? 1 : -1;
                }
                count++;
            }
        });
        
        strengths[curr] = count > 0 ? (score / count) * 10 : 0;
    });
    
    return strengths;
}

// Detect signals based on divergence and speed
function detectSignals(newStrengths) {
    const detectedSignals = [];
    
    CURRENCIES.forEach(curr1 => {
        CURRENCIES.forEach(curr2 => {
            if (curr1 < curr2) {
                const divergence = Math.abs(newStrengths[curr1] - newStrengths[curr2]);
                
                // Check if divergence meets minimum threshold
                if (divergence >= CONFIG.MIN_DIVERGENCE) {
                    let prevDivergence = 0;
                    
                    if (strengthHistory[curr1].length > 0 && strengthHistory[curr2].length > 0) {
                        const prevStr1 = strengthHistory[curr1][strengthHistory[curr1].length - 1];
                        const prevStr2 = strengthHistory[curr2][strengthHistory[curr2].length - 1];
                        prevDivergence = Math.abs(prevStr1 - prevStr2);
                    }
                    
                    // Check if divergence is contracting (signals start of mean reversion)
                    if (prevDivergence > 0 && prevDivergence > divergence) {
                        const speed = prevDivergence - divergence;
                        
                        if (speed >= CONFIG.MIN_SPEED) {
                            const stronger = newStrengths[curr1] > newStrengths[curr2] ? curr1 : curr2;
                            const weaker = stronger === curr1 ? curr2 : curr1;
                            
                            detectedSignals.push({
                                timestamp: new Date(),
                                stronger: stronger,
                                weaker: weaker,
                                divergence: divergence.toFixed(2),
                                speed: speed.toFixed(3),
                                direction: newStrengths[stronger] > newStrengths[weaker] ? 'bullish' : 'bearish'
                            });
                        }
                    }
                }
            }
        });
    });
    
    return detectedSignals;
}

// Update display
function updateDisplay() {
    const now = new Date();
    lastUpdate.textContent = `最終更新: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (signals.length === 0) {
        signalContainer.innerHTML = '<p class="no-signal">シグナル待機中...</p>';
    } else {
        signalContainer.innerHTML = signals.map((signal, index) => `
            <div class="signal-card ${signal.direction}">
                <div class="signal-info">
                    <div class="signal-pair ${signal.direction}">
                        ${signal.stronger}/${signal.weaker}
                        <span class="signal-arrow ${signal.direction === 'bullish' ? 'up' : 'down'}">
                            ${signal.direction === 'bullish' ? '📈 ↑' : '📉 ↓'}
                        </span>
                    </div>
                    <div class="signal-details">
                        <span>乖離: ${signal.divergence}pt</span>
                        <span>時刻: ${signal.timestamp.getHours().toString().padStart(2, '0')}:${signal.timestamp.getMinutes().toString().padStart(2, '0')}:${signal.timestamp.getSeconds().toString().padStart(2, '0')}</span>
                    </div>
                </div>
                <div class="signal-speed ${getSpeedLevel(parseFloat(signal.speed))}">
                    速度: ${signal.speed}pt/tick
                </div>
            </div>
        `).join('');
    }
    
    updateChart();
}

function getSpeedLevel(speed) {
    if (speed >= 3) return 'high';
    if (speed >= 2) return 'medium';
    return 'low';
}

// Update Chart
function updateChart() {
    const ctx = document.getElementById('chart');
    if (!ctx) return;
    
    const labels = strengthHistory[CURRENCIES[0]].map((_, i) => i + 1);
    const datasets = CURRENCIES.map((curr, index) => ({
        label: curr,
        data: strengthHistory[curr],
        borderColor: getColorForCurrency(curr),
        backgroundColor: `${getColorForCurrency(curr)}20`,
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointBackgroundColor: getColorForCurrency(curr)
    }));
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 12 },
                        padding: 15,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: -15,
                    max: 15,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function getColorForCurrency(curr) {
    const colors = {
        'USD': '#8B7355',
        'EUR': '#FF0000',
        'GBP': '#00AA00',
        'JPY': '#00CCFF',
        'CHF': '#9370DB',
        'AUD': '#0066FF',
        'NZD': '#FF69B4',
        'CAD': '#663399'
    };
    return colors[curr] || '#000000';
}

// Main update loop
async function updateData() {
    try {
        // Generate mock prices (replace with API call)
        const prices = generateMockPrices();
        
        // Calculate new strengths
        const newStrengths = calculateStrengths(prices);
        currencyStrengths = newStrengths;
        
        // Update history
        CURRENCIES.forEach(curr => {
            strengthHistory[curr].push(newStrengths[curr]);
            if (strengthHistory[curr].length > CONFIG.HISTORY_SIZE) {
                strengthHistory[curr].shift();
            }
        });
        
        // Detect signals
        const newSignals = detectSignals(newStrengths);
        if (newSignals.length > 0) {
            signals = [...newSignals, ...signals].slice(0, 10); // Keep last 10 signals
        }
        
        statusText.textContent = '🟢 ライブ';
        updateDisplay();
    } catch (error) {
        console.error('Update error:', error);
        statusText.textContent = '🔴 エラー';
    }
}

// Start monitoring
function start() {
    if (isRunning) return;
    
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusText.textContent = '🟡 起動中...';
    signals = [];
    
    // Initial update
    updateData();
    
    // Set interval for updates
    window.dataInterval = setInterval(updateData, CONFIG.API_INTERVAL);
}

// Stop monitoring
function stop() {
    if (!isRunning) return;
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = '🔴 停止';
    
    if (window.dataInterval) {
        clearInterval(window.dataInterval);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    statusText.textContent = '準備完了';
});
