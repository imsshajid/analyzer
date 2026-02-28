// Global state
let currentPlatform = 'quotex';
let currentAsset = null;
let assetsData = [];
let candlesData = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    initializePlatformSelector();
    loadAssets();
    initializeSearch();
    initializeReAnalyzeButton();
    initializeHideClosedToggle();
    
    // Initialize show asset selector button after a small delay to ensure DOM is ready
    setTimeout(() => {
        initializeShowAssetSelectorButton();
    }, 100);
});

// Platform Selector
function initializePlatformSelector() {
    const platformBtns = document.querySelectorAll('.platform-btn');
    
    if (platformBtns.length === 0) {
        console.error('No platform buttons found!');
        return;
    }
    
    platformBtns.forEach((btn, index) => {
        const platform = btn.dataset.platform;
        console.log(`Initializing platform button ${index}: ${platform}`);
        
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const newPlatform = this.dataset.platform;
            console.log(`Platform button clicked: ${newPlatform}`);
            
            // Remove active class from all buttons
            platformBtns.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update platform
            if (newPlatform) {
                const platformChanged = currentPlatform !== newPlatform;
                currentPlatform = newPlatform;
                console.log(`Switched to platform: ${currentPlatform}`);
                
                // Reset state
                currentAsset = null;
                assetsData = [];
                candlesData = [];
                
                // Clear search
                const searchInput = document.getElementById('assetSearch');
                if (searchInput) {
                    searchInput.value = '';
                }
                
                // Close analysis panel
                const analysisPanel = document.getElementById('analysisPanel');
                if (analysisPanel) {
                    analysisPanel.style.display = 'none';
                }
                
                // Load assets for new platform
                loadAssets();
            } else {
                console.error('No platform data attribute found on button');
            }
        });
    });
}

// Load Assets
async function loadAssets() {
    const assetsGrid = document.getElementById('assetsGrid');
    if (!assetsGrid) return;
    
    assetsGrid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading assets...</p></div>';
    
    try {
        const response = await fetch(`api/get_assets.php?platform=${encodeURIComponent(currentPlatform)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            assetsData = result.data;
            filterAndDisplayAssets();
        } else {
            assetsGrid.innerHTML = `<div class="error-message">Failed to load assets: ${result.message || 'Unknown error'}</div>`;
        }
    } catch (error) {
        console.error('Error loading assets:', error);
        assetsGrid.innerHTML = `<div class="error-message">Error loading assets: ${error.message}</div>`;
    }
}

// Display Assets
function displayAssets(assets) {
    const assetsGrid = document.getElementById('assetsGrid');
    
    if (assets.length === 0) {
        assetsGrid.innerHTML = '<div class="error-message">No assets found</div>';
        return;
    }
    
    assetsGrid.innerHTML = assets.map(asset => {
        const isOpen = asset.is_open;
        const statusClass = isOpen ? 'open' : 'closed';
        const statusText = isOpen ? 'Open' : 'Closed';
        const statusIcon = isOpen ? 'âœ“' : 'âœ—';
        const disabledClass = isOpen ? '' : 'disabled';
        const payout = asset.payment !== undefined ? asset.payment : 'N/A';
        
        return `
            <div class="asset-card ${statusClass} ${disabledClass}" 
                 data-asset="${asset.asset_name}" 
                 data-pair="${asset.pair || asset.asset_name}"
                 data-is-open="${isOpen}">
                <div class="asset-payout-badge">
                    <span class="payout-value">${payout}%</span>
                </div>
                <div class="asset-name">${asset.pair || asset.asset_name}</div>
                <div class="asset-pair">${asset.asset_name}</div>
                <div class="asset-status ${statusClass}">
                    <span>${statusIcon}</span>
                    <span>${statusText}</span>
                </div>
                ${!isOpen ? '<div class="disabled-overlay"></div>' : ''}
            </div>
        `;
    }).join('');
    
    // Add click handlers
    document.querySelectorAll('.asset-card').forEach(card => {
        card.addEventListener('click', function(e) {
            const isOpen = this.dataset.isOpen === 'true';
            
            // Prevent clicking on closed assets
            if (!isOpen) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show a brief visual feedback
                this.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    this.style.animation = '';
                }, 500);
                
                // Show temporary message
                showTemporaryMessage('This asset is currently closed', 'warning');
                
                return false;
            }
            
            const asset = this.dataset.asset;
            const pair = this.dataset.pair;
            selectAsset(asset, pair);
        });
    });
}

// Show temporary message
function showTemporaryMessage(message, type = 'info') {
    // Remove existing message if any
    const existingMsg = document.getElementById('tempMessage');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    // Create message element
    const msgEl = document.createElement('div');
    msgEl.id = 'tempMessage';
    msgEl.className = `temp-message temp-message-${type}`;
    msgEl.textContent = message;
    
    // Add to body
    document.body.appendChild(msgEl);
    
    // Animate in
    setTimeout(() => {
        msgEl.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        msgEl.classList.remove('show');
        setTimeout(() => {
            msgEl.remove();
        }, 300);
    }, 3000);
}

// Search Functionality
function initializeSearch() {
    const searchInput = document.getElementById('assetSearch');
    searchInput.addEventListener('input', function(e) {
        filterAndDisplayAssets();
    });
}

// Initialize Hide Closed Toggle
function initializeHideClosedToggle() {
    const hideClosedCheckbox = document.getElementById('hideClosedAssets');
    if (hideClosedCheckbox) {
        // Update text and icon on initial load
        updateToggleLabel(hideClosedCheckbox.checked);
        
        hideClosedCheckbox.addEventListener('change', function() {
            updateToggleLabel(this.checked);
            filterAndDisplayAssets();
        });
    }
}

// Update Toggle Label and Icon
function updateToggleLabel(isHidingClosed) {
    const toggleLabel = document.querySelector('.hide-closed-toggle .toggle-label');
    if (!toggleLabel) return;
    
    const icon = toggleLabel.querySelector('i');
    // Select the span that contains the text (the direct child span, not the toggle-label itself)
    const textSpan = Array.from(toggleLabel.children).find(el => el.tagName === 'SPAN');
    
    if (isHidingClosed) {
        // When showing closed: show "Show Closed" with eye icon
        if (icon) icon.className = 'fas fa-eye';
        if (textSpan) textSpan.textContent = 'Show Closed';
    } else {
        // When hiding closed: show "Hide Closed" with eye-slash icon
        if (icon) icon.className = 'fas fa-eye-slash';
        if (textSpan) textSpan.textContent = 'Hide Closed';
    }
}

// Filter and Display Assets (respects search and hide closed)
function filterAndDisplayAssets() {
    const searchInput = document.getElementById('assetSearch');
    const hideClosedCheckbox = document.getElementById('hideClosedAssets');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const hideClosed = hideClosedCheckbox ? hideClosedCheckbox.checked : false;
    
    let filtered = assetsData;
    
    // Filter by search query
    if (query) {
        filtered = filtered.filter(asset => {
            const pair = (asset.pair || '').toLowerCase();
            const name = (asset.asset_name || '').toLowerCase();
            return pair.includes(query) || name.includes(query);
        });
    }
    
    // Filter closed assets if checkbox is checked
    if (hideClosed) {
        filtered = filtered.filter(asset => asset.is_open === true);
    }
    
    // Sort by payout (high to low)
    filtered.sort((a, b) => {
        const payoutA = a.payment !== undefined ? a.payment : 0;
        const payoutB = b.payment !== undefined ? b.payment : 0;
        return payoutB - payoutA; // Descending order (high to low)
    });
    
    displayAssets(filtered);
}

// Initialize Show Asset Selector Button
function initializeShowAssetSelectorButton() {
    const showAssetSelectorBtn = document.getElementById('showAssetSelectorBtn');
    if (!showAssetSelectorBtn) {
        console.error('Show Asset Selector Button not found!');
        return;
    }
    
    console.log('Show Asset Selector Button initialized');
    
    showAssetSelectorBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Show Asset Selector Button clicked');
        
        const assetSelectorCard = document.getElementById('assetSelectorCard');
        const analysisPanel = document.getElementById('analysisPanel');
        
        if (assetSelectorCard) {
            assetSelectorCard.style.display = 'block';
            assetSelectorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log('Asset selector card shown');
        } else {
            console.error('Asset selector card not found');
        }
        
        this.style.display = 'none';
        
        // Close analysis panel
        if (analysisPanel) {
            analysisPanel.style.display = 'none';
            console.log('Analysis panel hidden');
        }
        
        // Reset current asset
        currentAsset = null;
    });
    
    // Also add touch support for mobile
    showAssetSelectorBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        this.click();
    });
}

// Select Asset
async function selectAsset(asset, pair) {
    currentAsset = asset;
    
    // Hide asset selector
    const assetSelectorCard = document.getElementById('assetSelectorCard');
    const showAssetSelectorBtn = document.getElementById('showAssetSelectorBtn');
    if (assetSelectorCard) {
        assetSelectorCard.style.display = 'none';
    }
    if (showAssetSelectorBtn) {
        showAssetSelectorBtn.style.display = 'flex';
    }
    
    // Show analysis panel
    const analysisPanel = document.getElementById('analysisPanel');
    analysisPanel.style.display = 'block';
    analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Update selected asset name
    document.getElementById('selectedAssetName').textContent = pair;
    
    // Load chart and analyze in parallel
    // Use Promise.allSettled so if one fails, the other can still complete
    const results = await Promise.allSettled([
        loadChart(asset).catch(err => {
            console.warn('Chart loading failed:', err);
            return null; // Continue even if chart fails
        }),
        loadCandlesAndAnalyze(asset).catch(err => {
            console.error('Analysis failed:', err);
            return null;
        })
    ]);
    
    // Log results
    if (results[0].status === 'fulfilled') {
        console.log('Chart loaded successfully');
    } else {
        console.warn('Chart loading had issues:', results[0].reason);
    }
    
    if (results[1].status === 'fulfilled') {
        console.log('Analysis completed successfully');
    } else {
        console.error('Analysis had issues:', results[1].reason);
    }
}

// Load Chart Screenshot
async function loadChart(asset) {
    const chartImage = document.getElementById('chartImage');
    const chartLoading = document.getElementById('chartLoading');
    
    if (!chartImage || !chartLoading) {
        console.error('Chart elements not found');
        return;
    }
    
    // Show loading state
    chartLoading.style.display = 'flex';
    chartLoading.innerHTML = '<div class="spinner"></div><p>Loading chart...</p>';
    chartImage.style.display = 'none';
    chartImage.style.opacity = '0';
    
    return new Promise((resolve, reject) => {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const imageUrl = `api/get_screenshot.php?platform=${currentPlatform}&asset=${encodeURIComponent(asset)}&zoom=2.5&t=${timestamp}`;
        
        // Set timeout for image loading (15 seconds)
        const timeout = setTimeout(() => {
            chartLoading.innerHTML = '<p style="color: #f87171;">â±ï¸ Chart loading timeout. Please try refreshing.</p>';
            reject(new Error('Chart loading timeout'));
        }, 15000);
        
        // Handle successful load
        chartImage.onload = function() {
            clearTimeout(timeout);
            chartLoading.style.display = 'none';
            chartImage.style.display = 'block';
            chartImage.style.opacity = '1';
            chartImage.style.animation = 'fadeIn 0.5s ease';
            console.log('Chart image loaded successfully');
            
            
            resolve();
        };
        
        // Handle load error
        chartImage.onerror = function() {
            clearTimeout(timeout);
            chartLoading.style.display = 'flex';
            chartLoading.innerHTML = '<p style="color: #f87171;">âŒ Failed to load chart. The asset may not have chart data available.</p>';
            chartImage.style.display = 'none';
            console.error('Chart image failed to load');
            reject(new Error('Chart image failed to load'));
        };
        
        // Start loading the image
        console.log(`Loading chart for ${asset} from ${currentPlatform}`);
        chartImage.src = imageUrl;
        
        // If image is already cached, trigger onload manually
        if (chartImage.complete && chartImage.naturalHeight !== 0) {
            chartImage.onload();
        }
    });
}

// Chart Modal Functions
// Initialize Re-analyze Button
function initializeReAnalyzeButton() {
    const reAnalyzeBtn = document.getElementById('reAnalyzeBtn');
    if (!reAnalyzeBtn) {
        console.warn('Re-analyze button not found');
        return;
    }
    
    reAnalyzeBtn.addEventListener('click', async function() {
        if (!currentAsset) {
            showTemporaryMessage('Please select an asset first', 'warning');
            return;
        }
        
        // Disable button during analysis
        this.disabled = true;
        const originalHTML = this.innerHTML;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        
        try {
            // Get the asset pair for display
            const selectedAssetName = document.getElementById('selectedAssetName');
            const pair = selectedAssetName ? selectedAssetName.textContent : currentAsset;
            
            console.log(`Re-analyzing ${pair} (${currentAsset})`);
            
            // Reload chart and re-analyze in parallel (market conditions included in analysis)
            const results = await Promise.allSettled([
                loadChart(currentAsset).catch(err => {
                    console.warn('Chart reload failed:', err);
                    return null;
                }),
                loadCandlesAndAnalyze(currentAsset).catch(err => {
                    console.error('Re-analysis failed:', err);
                    return null;
                })
            ]);
            
            // Check results
            if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled') {
                console.log('Re-analysis completed successfully');
                showTemporaryMessage('Analysis updated successfully!', 'info');
            } else {
                console.warn('Re-analysis completed with some issues');
            }
        } catch (error) {
            console.error('Re-analysis error:', error);
            showTemporaryMessage('Re-analysis failed. Please try again.', 'warning');
        } finally {
            // Re-enable button
            this.disabled = false;
            this.innerHTML = originalHTML;
        }
    });
}

// Load Candles and Analyze
async function loadCandlesAndAnalyze(asset) {
    try {
        // Show loading state
        updateAnalysisUI({
            currency_trend: 'Analyzing...',
            trend_direction: '...',
            market_momentum_pct: 0,
            take_this_trade: false,
            notes: 'Loading candle data...',
            candle_count: 0,
            bullish_count: 0,
            bearish_count: 0
        });
        
        // Fetch and analyze market conditions (includes basic trend analysis)
        const response = await fetch(`api/market_analysis.php?platform=${currentPlatform}&asset=${encodeURIComponent(asset)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        let result;
        
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.error('Response text:', responseText.substring(0, 200));
            throw new Error('Invalid JSON response from server');
        }
        
        if (result.success && result.analysis) {
            const analysis = result.analysis;
            
            // Check if there's an error in analysis
            if (analysis.error) {
                updateAnalysisUI({
                    currency_trend: 'Error',
                    trend_direction: 'N/A',
                    market_momentum_pct: 0,
                    take_this_trade: false,
                    notes: analysis.error || 'Analysis error',
                    candle_count: analysis.candles_count || 0,
                    bullish_count: 0,
                    bearish_count: 0
                });
                return;
            }
            
            // Update basic analysis UI (signal cards)
            if (analysis.currency_trend !== undefined) {
                updateAnalysisUI({
                    currency_trend: analysis.currency_trend,
                    trend_direction: analysis.trend_direction || 'Neutral',
                    market_momentum_pct: analysis.market_momentum_pct || 0,
                    take_this_trade: analysis.take_this_trade || false,
                    notes: analysis.notes || 'Analysis complete',
                    candle_count: analysis.candle_count || 0,
                    bullish_count: analysis.bullish_count || 0,
                    bearish_count: analysis.bearish_count || 0,
                    bullish_percent: analysis.bullish_percent,
                    bearish_percent: analysis.bearish_percent
                });
            }
            
            // Update market conditions UI
            updateMarketConditionsUI(analysis);
            const marketConditionsEl = document.getElementById('marketConditions');
            if (marketConditionsEl) {
                marketConditionsEl.style.display = 'block';
            }
        } else {
            updateAnalysisUI({
                currency_trend: 'Error',
                trend_direction: 'N/A',
                market_momentum_pct: 0,
                take_this_trade: false,
                notes: result.message || 'Analysis failed',
                candle_count: 0,
                bullish_count: 0,
                bearish_count: 0
            });
        }
    } catch (error) {
        updateAnalysisUI({
            currency_trend: 'Error',
            trend_direction: 'N/A',
            market_momentum_pct: 0,
            take_this_trade: false,
            notes: `Error: ${error.message}`,
            candle_count: 0,
            bullish_count: 0,
            bearish_count: 0
        });
    }
}

// Update Analysis UI
function updateAnalysisUI(analysis) {
    // Trend
    const trendValue = document.getElementById('trendValue');
    const trendIcon = document.getElementById('trendIcon');
    if (trendValue && trendIcon) {
        trendValue.textContent = analysis.currency_trend || '-';
        
        if (analysis.currency_trend === 'Uptrend') {
            trendIcon.className = 'fas fa-arrow-trend-up';
            trendValue.style.color = '#4ade80';
        } else if (analysis.currency_trend === 'Downtrend') {
            trendIcon.className = 'fas fa-arrow-trend-down';
            trendValue.style.color = '#f87171';
        } else {
            trendIcon.className = 'fas fa-minus';
            trendValue.style.color = '#94a3b8';
        }
    }
    
    // Volatility
    const volatilityValue = document.getElementById('volatilityValue');
    const volatilityIcon = document.getElementById('volatilityIcon');
    if (volatilityValue && volatilityIcon) {
        // Volatility will be updated from market conditions
        volatilityValue.textContent = 'Loading...';
        volatilityIcon.className = 'fas fa-chart-area';
        volatilityValue.style.color = '#94a3b8';
    }
    
    // Market Momentum
    const momentumValue = document.getElementById('momentumValue');
    const momentumBar = document.getElementById('momentumBar');
    if (momentumValue && momentumBar) {
        const momentum = analysis.market_momentum_pct || 0;
        momentumValue.textContent = `${momentum}%`;
        
        // Animate momentum bar
        setTimeout(() => {
            if (momentumBar) {
                momentumBar.style.width = `${momentum}%`;
                
                // Color based on momentum
                if (momentum >= 80) {
                    momentumBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
                } else if (momentum >= 60) {
                    momentumBar.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
                } else if (momentum >= 40) {
                    momentumBar.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
                } else {
                    momentumBar.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
                }
            }
        }, 100);
    }
    
    // Trade Recommendation
    const tradeValue = document.getElementById('tradeValue');
    const tradeIcon = document.getElementById('tradeIcon');
    if (tradeValue && tradeIcon) {
        if (analysis.take_this_trade) {
            tradeValue.textContent = 'YES - Take Trade';
            tradeValue.style.color = '#4ade80';
            tradeIcon.className = 'fas fa-check-circle';
        } else {
            tradeValue.textContent = 'NO - Skip Trade';
            tradeValue.style.color = '#f87171';
            tradeIcon.className = 'fas fa-times-circle';
        }
    }
    
    // Details
    const candleCount = analysis.candle_count || 0;
    const bullishCount = analysis.bullish_count || 0;
    const bearishCount = analysis.bearish_count || 0;
    
    // Calculate percentages if not provided
    let bullishPercent = analysis.bullish_percent;
    let bearishPercent = analysis.bearish_percent;
    
    if (bullishPercent === undefined || bearishPercent === undefined) {
        bullishPercent = candleCount > 0 ? Math.round((bullishCount / candleCount) * 100 * 10) / 10 : 0;
        bearishPercent = candleCount > 0 ? Math.round((bearishCount / candleCount) * 100 * 10) / 10 : 0;
    }
    
    // Display percentages (candle count removed as requested)
    const bullishCountEl = document.getElementById('bullishCount');
    const bearishCountEl = document.getElementById('bearishCount');
    const analysisNotesEl = document.getElementById('analysisNotes');
    
    if (bullishCountEl) {
        bullishCountEl.textContent = `${bullishPercent}%`;
    }
    if (bearishCountEl) {
        bearishCountEl.textContent = `${bearishPercent}%`;
    }
    if (analysisNotesEl) {
        analysisNotesEl.textContent = analysis.notes || 'No notes available';
    }
    
    // Add fade-in animation
    const signalCards = document.querySelectorAll('.signal-card');
    signalCards.forEach((card, index) => {
        card.style.animation = 'none';
        setTimeout(() => {
            card.style.animation = `fadeInUp 0.5s ease ${index * 0.1}s both`;
        }, 10);
    });
}

// Close Panel
const closePanelBtn = document.getElementById('closePanel');
if (closePanelBtn) {
    closePanelBtn.addEventListener('click', function() {
        document.getElementById('analysisPanel').style.display = 'none';
        currentAsset = null;
        
        // Show asset selector again
        const assetSelectorCard = document.getElementById('assetSelectorCard');
        const showAssetSelectorBtn = document.getElementById('showAssetSelectorBtn');
        if (assetSelectorCard) {
            assetSelectorCard.style.display = 'block';
        }
        if (showAssetSelectorBtn) {
            showAssetSelectorBtn.style.display = 'none';
        }
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Market conditions are now loaded together with basic analysis in loadCandlesAndAnalyze

// Update Market Conditions UI
function updateMarketConditionsUI(analysis) {
    // Update Volatility in signal card
    if (analysis.volatility) {
        const volatilityValue = document.getElementById('volatilityValue');
        const volatilityIcon = document.getElementById('volatilityIcon');
        if (volatilityValue && volatilityIcon) {
            const vol = analysis.volatility;
            
            let volText = vol.volatility_level ? vol.volatility_level.replace('_', ' ').toUpperCase() : 'N/A';
            let volColor = '#94a3b8';
            
            if (vol.volatility_level === 'very_high' || vol.volatility_level === 'high') {
                volColor = '#f87171';
            } else if (vol.volatility_level === 'moderate') {
                volColor = '#fbbf24';
            } else if (vol.volatility_level === 'low' || vol.volatility_level === 'very_low') {
                volColor = '#4ade80';
            }
            
            volatilityValue.textContent = volText;
            volatilityValue.style.color = volColor;
            volatilityIcon.className = 'fas fa-chart-area';
        }
    }
    
    // Gap Analysis
    const gapAnalysis = document.getElementById('gapAnalysis');
    if (gapAnalysis && analysis.gap_analysis) {
        const gap = analysis.gap_analysis;
        if (gap.has_gap && gap.latest_gap) {
            const gapType = gap.latest_gap.type === 'gap_up' ? 'Gap Up' : 'Gap Down';
            const gapColor = gap.latest_gap.type === 'gap_up' ? '#4ade80' : '#f87171';
            gapAnalysis.innerHTML = `
                <div class="condition-item">
                    <span class="condition-label">Latest Gap:</span>
                    <span class="condition-value" style="color: ${gapColor}">${gapType} ${gap.latest_gap.percent.toFixed(4)}%</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Gap Up Count:</span>
                    <span class="condition-value">${gap.gap_up_count}</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Gap Down Count:</span>
                    <span class="condition-value">${gap.gap_down_count}</span>
                </div>
            `;
        } else if (gapAnalysis) {
            gapAnalysis.innerHTML = '<div class="condition-item">No significant gaps detected</div>';
        }
    } else if (gapAnalysis) {
        gapAnalysis.innerHTML = '<div class="condition-item">Gap analysis data not available</div>';
    }
    
    // Rejection Analysis
    const rejectionAnalysis = document.getElementById('rejectionAnalysis');
    if (rejectionAnalysis && analysis.rejection_value) {
        const rejection = analysis.rejection_value;
        if (rejection.rejection_detected) {
            const rejectionColor = rejection.rejection_type === 'upper' ? '#f87171' : '#4ade80';
            const patterns = rejection.rejection_patterns || [];
            const patternText = patterns.length > 0 ? patterns.map(p => p.replace('_', ' ').toUpperCase()).join(', ') : 'Standard Rejection';
            rejectionAnalysis.innerHTML = `
                <div class="condition-item">
                    <span class="condition-label">Rejection Type:</span>
                    <span class="condition-value" style="color: ${rejectionColor}">${rejection.rejection_type.toUpperCase()}</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Rejection Patterns:</span>
                    <span class="condition-value" style="color: ${rejectionColor}">${patternText}</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Rejection Confidence:</span>
                    <span class="condition-value">${rejection.rejection_confidence || rejection.rejection_strength}%</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Rejection Strength:</span>
                    <span class="condition-value">${rejection.rejection_strength}%</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Rejection Level:</span>
                    <span class="condition-value">${rejection.rejection_level.toFixed(6)}</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Upper Wick:</span>
                    <span class="condition-value">${rejection.upper_wick_ratio}%</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Lower Wick:</span>
                    <span class="condition-value">${rejection.lower_wick_ratio}%</span>
                </div>
                <div class="condition-item">
                    <span class="condition-label">Body Ratio:</span>
                    <span class="condition-value">${rejection.body_ratio}%</span>
                </div>
            `;
        } else if (rejectionAnalysis) {
            rejectionAnalysis.innerHTML = '<div class="condition-item">No rejection detected</div>';
        }
    } else if (rejectionAnalysis) {
        rejectionAnalysis.innerHTML = '<div class="condition-item">Rejection analysis data not available</div>';
    }
    
    // Support & Resistance
    const snrAnalysis = document.getElementById('snrAnalysis');
    if (snrAnalysis && analysis.snr_levels && !analysis.snr_levels.error) {
        const snr = analysis.snr_levels;
        snrAnalysis.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Nearest Resistance:</span>
                <span class="condition-value">${snr.nearest_resistance ? snr.nearest_resistance.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Distance to Resistance:</span>
                <span class="condition-value">${snr.distance_to_resistance !== null ? snr.distance_to_resistance.toFixed(4) + '%' : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Nearest Support:</span>
                <span class="condition-value">${snr.nearest_support ? snr.nearest_support.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Distance to Support:</span>
                <span class="condition-value">${snr.distance_to_support !== null ? snr.distance_to_support.toFixed(4) + '%' : 'N/A'}</span>
            </div>
        `;
    } else if (snrAnalysis) {
        snrAnalysis.innerHTML = '<div class="condition-item">Insufficient data for SNR calculation</div>';
    }
    
    // Volatility Analysis
    const volatilitySection = document.getElementById('volatilityAnalysis');
    if (volatilitySection && analysis.volatility && !analysis.volatility.error) {
        const vol = analysis.volatility;
        const volLevelColor = vol.volatility_level === 'very_high' || vol.volatility_level === 'high' ? '#f87171' : 
                             vol.volatility_level === 'moderate' ? '#fbbf24' : '#4ade80';
        volatilitySection.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Volatility Level:</span>
                <span class="condition-value" style="color: ${volLevelColor}">${vol.volatility_level.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">ATR (Average True Range):</span>
                <span class="condition-value">${vol.atr.toFixed(6)}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Volatility %:</span>
                <span class="condition-value">${vol.volatility_percent.toFixed(4)}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Recent Volatility %:</span>
                <span class="condition-value">${vol.recent_volatility_percent.toFixed(4)}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Std Deviation:</span>
                <span class="condition-value">${vol.std_deviation.toFixed(4)}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Max Range:</span>
                <span class="condition-value">${vol.max_range.toFixed(6)}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Min Range:</span>
                <span class="condition-value">${vol.min_range.toFixed(6)}</span>
            </div>
        `;
    } else if (volatilitySection) {
        volatilitySection.innerHTML = '<div class="condition-item">Insufficient data for volatility analysis</div>';
    }
    
    // Moving Averages
    const maAnalysis = document.getElementById('maAnalysis');
    if (maAnalysis && analysis.trend) {
        const trend = analysis.trend;
        const trendDisplay = trend.trend_display || trend.trend;
        const trendColor = trendDisplay === 'Uptrend' ? '#4ade80' : trendDisplay === 'Downtrend' ? '#f87171' : '#94a3b8';
        const ema200Color = trend.ema200_trend === 'above' ? '#4ade80' : '#f87171';
        const ema200Text = trend.ema200_trend === 'above' ? 'ABOVE EMA 200 (BULLISH)' : 'BELOW EMA 200 (BEARISH)';
        maAnalysis.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Trend:</span>
                <span class="condition-value" style="color: ${trendColor}">${trendDisplay.toUpperCase()}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Trend Strength:</span>
                <span class="condition-value">${trend.strength}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">EMA 200:</span>
                <span class="condition-value">${trend.ema200 ? trend.ema200.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Price vs EMA 200:</span>
                <span class="condition-value" style="color: ${ema200Color}">${trend.price_vs_ema200 !== null ? trend.price_vs_ema200.toFixed(4) + '%' : 'N/A'} - ${ema200Text}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">SMA 1:</span>
                <span class="condition-value">${trend.sma1 ? trend.sma1.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">SMA 2:</span>
                <span class="condition-value">${trend.sma2 ? trend.sma2.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">SMA 3:</span>
                <span class="condition-value">${trend.sma3 ? trend.sma3.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">EMA 1:</span>
                <span class="condition-value">${trend.ema1 ? trend.ema1.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">EMA 2:</span>
                <span class="condition-value">${trend.ema2 ? trend.ema2.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">EMA 3:</span>
                <span class="condition-value">${trend.ema3 ? trend.ema3.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Current Price:</span>
                <span class="condition-value">${trend.current_price ? trend.current_price.toFixed(6) : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Trend Confidence:</span>
                <span class="condition-value">${trend.trend_confidence ? trend.trend_confidence.toFixed(2) + '%' : 'N/A'}</span>
            </div>
        `;
    } else if (maAnalysis) {
        maAnalysis.innerHTML = '<div class="condition-item">Trend analysis data not available</div>';
    }
    
    // Trend Line
    const trendLineAnalysis = document.getElementById('trendLineAnalysis');
    if (trendLineAnalysis && analysis.trend_line_touch) {
        const trendLine = analysis.trend_line_touch;
        const touchColor = trendLine.touching_trendline ? '#4ade80' : '#94a3b8';
        trendLineAnalysis.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Touching Trend Line:</span>
                <span class="condition-value" style="color: ${touchColor}">${trendLine.touching_trendline ? 'YES' : 'NO'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Distance to Trend Line:</span>
                <span class="condition-value">${trendLine.distance_percent ? trendLine.distance_percent.toFixed(4) + '%' : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Trend Line Value:</span>
                <span class="condition-value">${trendLine.trendline_value ? trendLine.trendline_value.toFixed(6) : 'N/A'}</span>
            </div>
        `;
    } else if (trendLineAnalysis) {
        trendLineAnalysis.innerHTML = '<div class="condition-item">Trend line data not available</div>';
    }
    
    // ZigZag Analysis
    const zigzagAnalysis = document.getElementById('zigzagAnalysis');
    if (zigzagAnalysis && analysis.zigzag && !analysis.zigzag.error) {
        const zz = analysis.zigzag;
        const patternColor = zz.pattern === 'uptrend' ? '#4ade80' : zz.pattern === 'downtrend' ? '#f87171' : '#94a3b8';
        zigzagAnalysis.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Pattern:</span>
                <span class="condition-value" style="color: ${patternColor}">${zz.pattern.toUpperCase()}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Trend Strength:</span>
                <span class="condition-value">${zz.trend_strength}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">ZigZag Points:</span>
                <span class="condition-value">${zz.total_points}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Last Direction:</span>
                <span class="condition-value">${zz.last_direction ? zz.last_direction.toUpperCase() : 'N/A'}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Last Extreme Price:</span>
                <span class="condition-value">${zz.last_extreme_price ? zz.last_extreme_price.toFixed(6) : 'N/A'}</span>
            </div>
        `;
    } else if (zigzagAnalysis) {
        zigzagAnalysis.innerHTML = '<div class="condition-item">Insufficient data for ZigZag calculation</div>';
    }
    
    // Price Movement Analysis
    const movementAnalysis = document.getElementById('movementAnalysis');
    if (movementAnalysis && analysis.price_movement && !analysis.price_movement.error) {
        const movement = analysis.price_movement;
        const activityColor = movement.activity_level === 'very_high' || movement.activity_level === 'high' ? '#4ade80' : 
                             movement.activity_level === 'normal' ? '#fbbf24' : '#f87171';
        movementAnalysis.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Activity Level:</span>
                <span class="condition-value" style="color: ${activityColor}">${movement.activity_level.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Average Movements:</span>
                <span class="condition-value">${movement.average_movements}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Recent Average Movements:</span>
                <span class="condition-value">${movement.recent_average_movements}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Latest Movements:</span>
                <span class="condition-value">${movement.latest_movements}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Movement Change %:</span>
                <span class="condition-value" style="color: ${movement.movement_change_percent > 0 ? '#4ade80' : '#f87171'}">${movement.movement_change_percent > 0 ? '+' : ''}${movement.movement_change_percent}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Average Price Movement:</span>
                <span class="condition-value">${movement.average_price_movement.toFixed(4)}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Recent Price Movement:</span>
                <span class="condition-value">${movement.recent_price_movement.toFixed(4)}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Price Movement Change:</span>
                <span class="condition-value" style="color: ${movement.price_movement_change > 0 ? '#4ade80' : '#f87171'}">${movement.price_movement_change > 0 ? '+' : ''}${movement.price_movement_change}%</span>
            </div>
        `;
    } else if (movementAnalysis) {
        movementAnalysis.innerHTML = '<div class="condition-item">Insufficient data for movement analysis</div>';
    }
    
    // Market Condition Summary
    const marketConditionSummary = document.getElementById('marketConditionSummary');
    if (marketConditionSummary && analysis.market_condition) {
        const mc = analysis.market_condition;
        const conditionColor = mc.condition === 'strong_trend' || mc.condition === 'favorable' ? '#4ade80' : 
                               mc.condition === 'moderate' ? '#fbbf24' : '#f87171';
        const recommendationColor = mc.trade_recommendation === 'consider_long' ? '#4ade80' : 
                                   mc.trade_recommendation === 'consider_short' ? '#f87171' : '#94a3b8';
        marketConditionSummary.innerHTML = `
            <div class="condition-item">
                <span class="condition-label">Market Condition:</span>
                <span class="condition-value" style="color: ${conditionColor}; font-weight: bold;">${mc.condition.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Confidence:</span>
                <span class="condition-value">${mc.confidence}%</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Description:</span>
                <span class="condition-value">${mc.description}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Trade Recommendation:</span>
                <span class="condition-value" style="color: ${recommendationColor}; font-weight: bold;">${mc.trade_recommendation.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Overall Score:</span>
                <span class="condition-value">${mc.overall_score}/100</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Volatility Contribution:</span>
                <span class="condition-value">${mc.volatility_contribution}/30</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Trend Contribution:</span>
                <span class="condition-value">${mc.trend_contribution}/40</span>
            </div>
            <div class="condition-item">
                <span class="condition-label">Movement Contribution:</span>
                <span class="condition-value">${mc.movement_contribution}/30</span>
            </div>
        `;
    } else if (marketConditionSummary) {
        marketConditionSummary.innerHTML = '<div class="condition-item">Market condition data not available</div>';
    }
}

// Auto-refresh removed - chart only refreshes when Re-analyze button is clicked

