// Currency Strength Scalper - 4H Environment + Scalping
// Configuration
const CONFIG = {
    // Scalping (1min/5min) settings
    MIN_DIVERGENCE_SCALP: 3,    // Minimum 3 points divergence for scalp signals
    MIN_SPEED_SCALP: 0.5,       // Minimum 0.5 points/tick reduction speed
    SCALP_UPDATE_INTERVAL: 1000, // Update every 1 second for scalping

    // 4H Environment settings
    MIN_DIVERGENCE_4H: 5,       // Minimum 5 points for 4H environment
    ENV_UPDATE_INTERVAL: 30000, // Update every 30 seconds for 4H

    HISTORY_SIZE: 30,
    VOLATILITY_FACTOR: 1.5,
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];

// Global state
let isRunning = false;
let scalpStrengths = {};      // 1min/5min strengths
let scalpHistory = {};        // 1min/5min history
let envStrengths = {};        // 4H strengths
let signals = [];
let chart = null;
let updateCounter = 0;
let envUpdateCounter = 0;

// Initialize
CURRENCIES.forEach(curr => {
    scalpStrengths[curr] = 0;
    scalpHistory[curr] = [];
    envStrengths[curr] = 0;
});

// UI Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const lastUpdate = document.getElementById('lastUpdate');
const signalContainer = document.getElementById('signalContainer');
const environmentContainer = document.getElementById('environmentContainer');

// Event Listeners
startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);

// Generate mock prices with realistic volatility
function generateMockPrices(volatilityFactor = CONFIG.VOLATILITY_FACTOR) {
    const prices = {};
    
    CURRENCIES.forEach(curr1 => {
        CURRENCIES.forEach(curr2 => {
            if (curr1 !== curr2) {
                const pair = curr1 + curr2;
                const volatility = (Math.random() - 0.5) * volatilityFactor;
                prices[pair] = 100 + volatility;
            }
        });
    });
    
    return prices;
}

// Calculate currency strength
function calculateStrengths(prices) {
    const strengths = {};
    
    CURRENCIES.forEach(curr => {
        let totalScore = 0;
        let count = 0;
        
        CURRENCIES.forEach(other => {
            if (curr !== other) {
                const pair1 = curr + other;
                const pair2 = other + curr;
                
                const price = prices[pair1] || prices[pair2];
                
                if (price !== undefined) {
                    const isStrong = prices[pair1] ? (price > 100) : (price < 100);
                    totalScore += isStrong ? 1 : -1;
                    count++;
                }
            }
        });
        
        strengths[curr] = count > 0 ? (totalScore / count) * 10 : 0;
    });
    
    return strengths;
}

// Detect scalping signals (filtered by 4H environment)
function detectScalpingSignals(newScalpStrengths) {
    const detectedSignals = [];
    
    CURRENCIES.forEach(curr1 => {
        CURRENCIES.forEach(curr2 => {
            if (curr1 < curr2) {
                const divergence = Math.abs(newScalpStrengths[curr1] - newScalpStrengths[curr2]);
                
                if (divergence >= CONFIG.MIN_DIVERGENCE_SCALP) {
                    let prevDivergence = 0;
                    
                    if (scalpHistory[curr1].length > 0 && scalpHistory[curr2].length > 0) {
                        const prevStr1 = scalpHistory[curr1][scalpHistory[curr1].length - 1];
                        const prevStr2 = scalpHistory[curr2][scalpHistory[curr2].length - 1];
                        prevDivergence = Math.abs(prevStr1 - prevStr2);
                    }
                    
                    if (prevDivergence > divergence) {
                        const speed = prevDivergence - divergence;
                        
                        if (speed >= CONFIG.MIN_SPEED_SCALP) {
                            const stronger = newScalpStrengths[curr1] > newScalpStrengths[curr2] ? curr1 : curr2;
                            const weaker = stronger === curr1 ? curr2 : curr1;
                            
                            // Check if signal aligns with 4H environment
                            const env4hStrong = envStrengths[stronger];
                            const env4hWeak = envStrengths[weaker];
                            
                            // Only show signals that align with 4H trend (bonus filtering)
                            const alignmentBonus = (env4hStrong > env4hWeak) ? 1.2 : 0.8;
                            
                            detectedSignals.push({
                                timestamp: new Date(),
                                stronger: stronger,
                                weaker: weaker,
                                divergence: divergence.toFixed(2),
                                speed: speed.toFixed(3),
                                direction: newScalpStrengths[stronger] > newScalpStrengths[weaker] ? 'bullish' : 'bearish',
                                alignment: alignmentBonus > 1 ? '✅' : '⚠️'
                            });
                        }
                    }
                }
            }
        });
    });
    
    return detectedSignals;
}

// Update 4H environment display
function updateEnvironmentDisplay() {
    const sorted = CURRENCIES.map(curr => ({
        curr: curr,
        strength: envStrengths[curr]
    })).sort((a, b) => b.strength - a.strength);
    
    environmentContainer.innerHTML = sorted.map(item => {
        const className = item.strength > 0 ? 'strong' : 'weak';
        const arrow = item.strength > 0 ? '📈' : '📉';
        return `
            <div class="environment-item ${className}">
                <div class="environment-currency">${item.curr}</div>
                <div class="environment-strength">${arrow} ${Math.abs(item.strength).toFixed(1)}</div>
            </div>
        `;
    }).join('');
}

// Update scalping signals display
function updateScalpingDisplay() {
    const now = new Date();
    lastUpdate.textContent = `最終更新: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (signals.length === 0) {
        signalContainer.innerHTML = '<p class="no-signal">スキャルピングシグナル待機中... (更新: ' + updateCounter + ')</p>';
    } else {
        signalContainer.innerHTML = signals.map((signal) => `
            <div class="signal-card ${signal.direction}">
                <div class="signal-info">
                    <div class="signal-pair ${signal.direction}">
                        ${signal.stronger}/${signal.weaker}
                        <span class="signal-arrow ${signal.direction === 'bullish' ? 'up' : 'down'}">
                            ${signal.direction === 'bullish' ? '📈 ↑' : '📉 ↓'}
                        </span>
                        <span>${signal.alignment}</span>
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
    
    updateConfigDisplay();
    updateChart();
}

function getSpeedLevel(speed) {
    if (speed >= 1.5) return 'high';
    if (speed >= 0.8) return 'medium';
    return 'low';
}

function updateConfigDisplay() {
    document.getElementById('configDivergence').textContent = CONFIG.MIN_DIVERGENCE_SCALP + 'ポイント以上';
    document.getElementById('configSpeed').textContent = CONFIG.MIN_SPEED_SCALP + 'ポイント/tick以上';
}

// Update Chart
function updateChart() {
    const ctx = document.getElementById('chart');
    if (!ctx) return;
    
    if (scalpHistory[CURRENCIES[0]].length === 0) return;
    
    const labels = scalpHistory[CURRENCIES[0]].map((_, i) => i + 1);
    const datasets = CURRENCIES.map((curr) => ({
        label: curr,
        data: scalpHistory[curr],
        borderColor: getColorForCurrency(curr),
        backgroundColor: `${getColorForCurrency(curr)}20`,
        tension: 0.3,
        fill: false,
        pointRadius: 2,
        pointBackgroundColor: getColorForCurrency(curr),
        borderWidth: 2
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
            animation: { duration: 0 },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { size: 12 }, padding: 15, usePointStyle: true }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: -15,
                    max: 15,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function getColorForCurrency(curr) {
    const colors = {
        'USD': '#8B7355', 'EUR': '#FF0000', 'GBP': '#00AA00', 'JPY': '#00CCFF',
        'CHF': '#9370DB', 'AUD': '#0066FF', 'NZD': '#FF69B4', 'CAD': '#663399'
    };
    return colors[curr] || '#000000';
}

// Update scalping data (fast update)
function updateScalpingData() {
    try {
        updateCounter++;
        
        const prices = generateMockPrices(CONFIG.VOLATILITY_FACTOR);
        const newScalpStrengths = calculateStrengths(prices);
        scalpStrengths = newScalpStrengths;
        
        CURRENCIES.forEach(curr => {
            scalpHistory[curr].push(newScalpStrengths[curr]);
            if (scalpHistory[curr].length > CONFIG.HISTORY_SIZE) {
                scalpHistory[curr].shift();
            }
        });
        
        const newSignals = detectScalpingSignals(newScalpStrengths);
        if (newSignals.length > 0) {
            signals = [...newSignals, ...signals].slice(0, 10);
        }
        
        statusText.textContent = '🟢 ライブ（スキャルピング監視中）';
        updateScalpingDisplay();
    } catch (error) {
        console.error('Scalping update error:', error);
        statusText.textContent = '🔴 エラー';
    }
}

// Update 4H environment data (slow update)
function updateEnvironmentData() {
    try {
        envUpdateCounter++;
        
        // 4H uses less volatile data
        const prices = generateMockPrices(CONFIG.VOLATILITY_FACTOR * 0.5);
        envStrengths = calculateStrengths(prices);
        
        updateEnvironmentDisplay();
    } catch (error) {
        console.error('Environment update error:', error);
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
    updateCounter = 0;
    envUpdateCounter = 0;
    
    CURRENCIES.forEach(curr => {
        scalpHistory[curr] = [];
    });
    
    // Initial rapid updates
    for (let i = 0; i < 5; i++) {
        updateScalpingData();
    }
    updateEnvironmentData();
    
    // Set intervals
    window.scalpInterval = setInterval(updateScalpingData, CONFIG.SCALP_UPDATE_INTERVAL);
    window.envInterval = setInterval(updateEnvironmentData, CONFIG.ENV_UPDATE_INTERVAL);
    
    statusText.textContent = '🟢 ライブ（スキャルピング監視中）';
}

// Stop monitoring
function stop() {
    if (!isRunning) return;
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = '🔴 停止';
    
    if (window.scalpInterval) clearInterval(window.scalpInterval);
    if (window.envInterval) clearInterval(window.envInterval);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    statusText.textContent = '準備完了';
    updateConfigDisplay();
    environmentContainer.innerHTML = '<p class="no-data">環境分析準備中...</p>';
});
