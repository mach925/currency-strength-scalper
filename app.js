// Currency Strength Scalper - Main Logic (Improved)
// Configuration
const CONFIG = {
    MIN_DIVERGENCE: 3,      // Minimum 3 points divergence (lowered for better sensitivity)
    MIN_SPEED: 0.5,         // Minimum 0.5 points/tick reduction speed (lowered)
    API_INTERVAL: 2000,     // Update every 2 seconds (faster)
    HISTORY_SIZE: 30,       // Keep last 30 data points
    VOLATILITY_FACTOR: 1.5, // Increase volatility for better signal generation
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD'];

// Global state
let isRunning = false;
let currencyStrengths = {};
let strengthHistory = {};
let signals = [];
let chart = null;
let updateCounter = 0;

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

// Enhanced mock data generator with realistic volatility
function generateMockPrices() {
    const prices = {};
    
    CURRENCIES.forEach(curr1 => {
        CURRENCIES.forEach(curr2 => {
            if (curr1 !== curr2) {
                const pair = curr1 + curr2;
                // Increased volatility for better signal generation
                const volatility = (Math.random() - 0.5) * CONFIG.VOLATILITY_FACTOR;
                prices[pair] = 100 + volatility;
            }
        });
    });
    
    return prices;
}

// Improved currency strength calculation
function calculateStrengths(prices) {
    const strengths = {};
    
    CURRENCIES.forEach(curr => {
        let totalScore = 0;
        let count = 0;
        
        CURRENCIES.forEach(other => {
            if (curr !== other) {
                const pair1 = curr + other;
                const pair2 = other + curr;
                
                // Use the pair that exists in prices
                const price = prices[pair1] || prices[pair2];
                
                if (price !== undefined) {
                    // If curr is first in pair, price > 100 means strong
                    // If curr is second in pair, price < 100 means strong
                    const isStrong = prices[pair1] ? (price > 100) : (price < 100);
                    totalScore += isStrong ? 1 : -1;
                    count++;
                }
            }
        });
        
        // Scale to -15 to +15 range for visualization
        strengths[curr] = count > 0 ? (totalScore / count) * 10 : 0;
    });
    
    return strengths;
}

// Improved signal detection
function detectSignals(newStrengths) {
    const detectedSignals = [];
    
    CURRENCIES.forEach(curr1 => {
        CURRENCIES.forEach(curr2 => {
            if (curr1 < curr2) {
                const divergence = Math.abs(newStrengths[curr1] - newStrengths[curr2]);
                
                // Check if divergence meets minimum threshold
                if (divergence >= CONFIG.MIN_DIVERGENCE) {
                    let prevDivergence = 0;
                    
                    // Get previous divergence from history
                    if (strengthHistory[curr1].length > 0 && strengthHistory[curr2].length > 0) {
                        const prevStr1 = strengthHistory[curr1][strengthHistory[curr1].length - 1];
                        const prevStr2 = strengthHistory[curr2][strengthHistory[curr2].length - 1];
                        prevDivergence = Math.abs(prevStr1 - prevStr2);
                    }
                    
                    // Check if divergence is contracting (mean reversion signal)
                    if (prevDivergence > divergence) {
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

// Update display with real-time info
function updateDisplay() {
    const now = new Date();
    lastUpdate.textContent = `最終更新: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    if (signals.length === 0) {
        signalContainer.innerHTML = '<p class="no-signal">シグナル監視中... (更新回数: ' + updateCounter + ')</p>';
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
    
    // Update config display
    document.getElementById('configDivergence').textContent = CONFIG.MIN_DIVERGENCE + 'ポイント以上';
    document.getElementById('configSpeed').textContent = CONFIG.MIN_SPEED + 'ポイント/tick以上';
    
    updateChart();
}

function getSpeedLevel(speed) {
    if (speed >= 1.5) return 'high';
    if (speed >= 0.8) return 'medium';
    return 'low';
}

// Update Chart
function updateChart() {
    const ctx = document.getElementById('chart');
    if (!ctx) return;
    
    const labels = strengthHistory[CURRENCIES[0]].map((_, i) => i + 1);
    const datasets = CURRENCIES.map((curr) => ({
        label: curr,
        data: strengthHistory[curr],
        borderColor: getColorForCurrency(curr),
        backgroundColor: `${getColorForCurrency(curr)}20`,
        tension: 0.3,
        fill: false,
        pointRadius: 3,
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
            animation: {
                duration: 0
            },
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
        updateCounter++;
        
        // Generate prices with better volatility
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
    updateCounter = 0;
    
    // Reset histories
    CURRENCIES.forEach(curr => {
        strengthHistory[curr] = [];
    });
    
    // Rapid initial updates to build history
    for (let i = 0; i < 5; i++) {
        updateData();
    }
    
    // Set interval for updates
    window.dataInterval = setInterval(updateData, CONFIG.API_INTERVAL);
    
    statusText.textContent = '🟢 ライブ';
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
    document.getElementById('configDivergence').textContent = CONFIG.MIN_DIVERGENCE + 'ポイント以上';
    document.getElementById('configSpeed').textContent = CONFIG.MIN_SPEED + 'ポイント/tick以上';
});
