// ==========================================================================
// 1. Reactive State Store (Pub-Sub Pattern)
// ==========================================================================
const Store = {
    // Internal State
    _state: {
        token: localStorage.getItem('token') || null,
        user: null,
        profile: null,
        matches: [],
        bracketMatches: [],
        leaderboard: [],
        activeTab: 'matches',
        filterRound: 'all',
        searchQuery: ''
    },
    
    // Registered Listeners for State changes
    _listeners: {},
    
    // Subscribe a callback function to a state property
    subscribe(property, callback) {
        if (!this._listeners[property]) {
            this._listeners[property] = [];
        }
        this._listeners[property].push(callback);
    },
    
    // Get property value
    get(property) {
        return this._state[property];
    },
    
    // Set property value and trigger listeners
    set(property, newValue) {
        const oldValue = this._state[property];
        // Skip if value is unchanged (strict equality works for primitives + same refs)
        if (newValue === oldValue) return;
        this._state[property] = newValue;

        if (this._listeners[property]) {
            this._listeners[property].forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (err) {
                    console.error(`Error in listener for ${property}:`, err);
                }
            });
        }
    }
};

// Flags emoji helper
const FLAGS = {
    "Qatar": "🇶🇦", "Ecuador": "🇪🇨", "Senegal": "🇸🇳", "Netherlands": "🇳🇱",
    "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Iran": "🇮🇷", "USA": "🇺🇸", "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    "Argentina": "🇦🇷", "Saudi Arabia": "🇸🇦", "Mexico": "🇲🇽", "Poland": "🇵🇱",
    "France": "🇫🇷", "Australia": "🇦🇺", "Denmark": "🇩🇰", "Tunisia": "🇹🇳",
    "Spain": "🇪🇸", "Costa Rica": "🇨🇷", "Germany": "🇩🇪", "Japan": "🇯🇵",
    "Belgium": "🇧🇪", "Canada": "🇨🇦", "Morocco": "🇲🇦", "Croatia": "🇭🇷",
    "Brazil": "🇧🇷", "Serbia": "🇷🇸", "Switzerland": "🇨🇭", "Cameroon": "🇨🇲",
    "Portugal": "🇵🇹", "Ghana": "🇬🇭", "Uruguay": "🇺🇾", "South Korea": "🇰🇷"
};
const getFlag = (team) => team ? (FLAGS[team] || "⚽") : "🏳️";

// Trailing-edge debounce helper
function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}
const debouncedSetSearch = debounce((v) => Store.set('searchQuery', v), 150);

// Mini win probability calculator
function getMatchStats(m) {
    const seed = m.id * 17;
    const homeWinProb = Math.floor(25 + (seed % 40));
    const awayWinProb = Math.floor(20 + ((seed + 23) % 40));
    const drawProb = 100 - homeWinProb - awayWinProb;
    const homeRating = 500 + (seed % 400);
    const awayRating = 450 + ((seed + 77) % 400);
    return { homeWinProb, drawProb, awayWinProb, homeRating, awayRating };
}

// ==========================================================================
// 2. State Observers / Render Listeners
// ==========================================================================

// A. Token Listener: handles app/auth view toggles and triggers data fetches
async function handleAuthState(token) {
    const authSec = document.getElementById('auth-section');
    const appSec = document.getElementById('app-section');

    if (!token) {
        localStorage.removeItem('token');
        Store.set('user', null);
        Store.set('profile', null);
        appSec.style.display = 'none';
        authSec.style.display = 'flex';
        showCard('login');
    } else {
        localStorage.setItem('token', token);
        authSec.style.display = 'none';
        appSec.style.display = 'block';

        // Ensure a valid tab is set; this no-ops if already 'matches'.
        Store.set('activeTab', Store.get('activeTab') || 'matches');

        showOverlay();
        await fetchCurrentUser();
        await refreshDashboardData();
        hideOverlay();
    }
}
Store.subscribe('token', handleAuthState);

// B. User Details Listener: updates user header elements
Store.subscribe('user', (user) => {
    if (user) {
        document.getElementById('user-display-name').textContent = user.username;
        document.getElementById('user-welcome-name').textContent = user.username;
        
        // Show Admin menu tab if admin
        const adminTab = document.getElementById('admin-menu-tab');
        if (user.is_admin) {
            adminTab.style.display = 'inline-block';
        } else {
            adminTab.style.display = 'none';
        }
    }
});

// C. Active Tab Listener: switches visual tabs and triggers updates
Store.subscribe('activeTab', async (tab) => {
    // Update Menu button states
    document.querySelectorAll('.menu-tab').forEach(btn => {
        if (btn.getAttribute('data-target') === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update Content Pane visibility
    document.querySelectorAll('.tab-content').forEach(pane => {
        if (pane.id === `tab-${tab}`) {
            pane.style.display = 'block';
        } else {
            pane.style.display = 'none';
        }
    });
    
    // Fetch relevant data on tab entry
    showOverlay();
    if (tab === 'matches') {
        await fetchMatches();
    } else if (tab === 'bracket') {
        await fetchBracket();
    } else if (tab === 'leaderboard') {
        await fetchLeaderboard();
    } else if (tab === 'profile') {
        await fetchProfile();
    } else if (tab === 'admin') {
        await fetchAdminMatches();
    }
    hideOverlay();
});

// D. Matches / Search / Filter Listeners: renders matches view
const triggerMatchesRender = () => renderMatchesList();
Store.subscribe('matches', triggerMatchesRender);
Store.subscribe('filterRound', triggerMatchesRender);
Store.subscribe('searchQuery', triggerMatchesRender);

// E. Bracket Matches Listener: renders visual bracket column list
Store.subscribe('bracketMatches', () => renderBracketTree());

// F. Leaderboard Listener: renders leaderboard ranking table
Store.subscribe('leaderboard', () => {
    renderLeaderboardTable();
    updateSidebarStanding(); // Sidebar depends on rank
});

// G. Profile Listener: renders stats summary card & history list
Store.subscribe('profile', () => {
    renderProfileDashboard();
    updateSidebarStanding(); // Sidebar depends on points
});

// ==========================================================================
// 3. Render Implementations
// ==========================================================================

function renderMatchesList() {
    const container = document.getElementById('matches-list-container');
    container.innerHTML = '';
    
    const matches = Store.get('matches');
    const filter = Store.get('filterRound');
    const search = Store.get('searchQuery').toLowerCase();
    
    const filtered = matches.filter(m => {
        // Round filter
        if (filter !== 'all') {
            if (filter === 'group') {
                if (!m.group_name) return false;
            } else if (filter === 'Final') {
                if (m.round !== 'Final') return false;
            } else {
                if (!m.round.includes(filter)) return false;
            }
        }
        
        // Search filter
        const hName = (m.home_team || m.home_placeholder || '').toLowerCase();
        const aName = (m.away_team || m.away_placeholder || '').toLowerCase();
        const round = m.round.toLowerCase();
        return hName.includes(search) || aName.includes(search) || round.includes(search);
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-data">No matches match your filters.</div>';
        return;
    }
    
    filtered.forEach(m => {
        const card = document.createElement('div');
        card.className = 'match-card';
        
        const isCompleted = m.status === 'completed';
        const isLocked = m.prediction_status === 'locked';
        const isOpen = m.prediction_status === 'open';
        
        const homeTeam = m.home_team || m.home_placeholder || 'TBD';
        const awayTeam = m.away_team || m.away_placeholder || 'TBD';
        const homeCode = m.home_team ? m.home_team.substring(0, 3).toUpperCase() : 'TBD';
        const awayCode = m.away_team ? m.away_team.substring(0, 3).toUpperCase() : 'TBD';
        
        const hasPredicted = m.user_prediction !== null;
        let predHomeVal = hasPredicted ? m.user_prediction.predicted_home_goals : 1;
        let predAwayVal = hasPredicted ? m.user_prediction.predicted_away_goals : 1;
        
        const matchTime = new Date(m.kickoff_time);
        const timeStr = matchTime.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                        matchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let leftSideHtml = '';
        if (isCompleted) {
            let predSummary = '';
            if (hasPredicted) {
                const pts = m.user_prediction.points_earned;
                let ptsClass = 'danger';
                if (pts === 10) ptsClass = 'gold';
                else if (pts > 0) ptsClass = 'green';
                
                predSummary = `
                    <div class="card-prediction-result">
                        <span class="pred-label">Predicted:</span>
                        <span class="pred-value">${m.user_prediction.predicted_home_goals} - ${m.user_prediction.predicted_away_goals}</span>
                        <span class="points-badge ${ptsClass}">${pts} PTS</span>
                    </div>
                `;
            } else {
                predSummary = `
                    <div class="card-prediction-result">
                        <span class="pred-label" style="color: var(--text-muted)">No prediction</span>
                        <span class="points-badge danger">0 PTS</span>
                    </div>
                `;
            }
            
            leftSideHtml = `
                <div class="match-score-result-row">
                    <div class="team-score-block">
                        <span class="score-team-name">${homeTeam}</span>
                        <span class="score-team-goals">${m.home_score}</span>
                    </div>
                    <div class="team-score-block">
                        <span class="score-team-name">${awayTeam}</span>
                        <span class="score-team-goals">${m.away_score}</span>
                    </div>
                </div>
                ${predSummary}
            `;
        } else {
            leftSideHtml = `
                <div class="match-predict-inputs">
                    <div class="predict-input-row">
                        <span class="predict-team-name" title="${homeTeam}">${homeTeam}</span>
                        <div class="predict-selector-counter">
                            <button class="counter-btn dec-home" ${!isOpen ? 'disabled' : ''}>-</button>
                            <span class="counter-value" id="home-counter-${m.id}">${predHomeVal}</span>
                            <button class="counter-btn inc-home" ${!isOpen ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                    <div class="predict-input-row">
                        <span class="predict-team-name" title="${awayTeam}">${awayTeam}</span>
                        <div class="predict-selector-counter">
                            <button class="counter-btn dec-away" ${!isOpen ? 'disabled' : ''}>-</button>
                            <span class="counter-value" id="away-counter-${m.id}">${predAwayVal}</span>
                            <button class="counter-btn inc-away" ${!isOpen ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const stats = getMatchStats(m);
        let actionBtnHtml = '';
        if (isCompleted) {
            actionBtnHtml = `
                <div class="completed-badge-box">
                    <i class="fa-solid fa-circle-check"></i> Evaluated
                </div>
            `;
        } else {
            actionBtnHtml = `
                <button class="submit-prediction-btn" id="submit-pred-btn-${m.id}" ${!isOpen ? 'disabled' : ''}>
                    ${hasPredicted ? 'Update Prediction' : 'Save Prediction'}
                </button>
            `;
        }
        
        card.innerHTML = `
            <div class="match-card-top-header">
                <div class="flags-codes-container">
                    <span>${getFlag(m.home_team)}</span>
                    <span>${homeCode}</span>
                    <span class="vs-text">vs</span>
                    <span>${awayCode}</span>
                    <span>${getFlag(m.away_team)}</span>
                </div>
                <div class="kickoff-time-badge">${timeStr}</div>
            </div>
            
            <div class="match-card-main-grid">
                <div class="match-card-left-panel">
                    ${leftSideHtml}
                </div>
                <div class="match-card-right-panel">
                    <div class="match-stats-table">
                        <div class="stats-row header-row">
                            <span>Stat</span>
                            <span>${homeCode}</span>
                            <span>Draw</span>
                            <span>${awayCode}</span>
                        </div>
                        <div class="stats-row">
                            <span>Win%</span>
                            <span class="color-success">${stats.homeWinProb}%</span>
                            <span>${stats.drawProb}%</span>
                            <span class="color-info">${stats.awayWinProb}%</span>
                        </div>
                        <div class="stats-row">
                            <span>Rate</span>
                            <span>${stats.homeRating}</span>
                            <span>—</span>
                            <span>${stats.awayRating}</span>
                        </div>
                    </div>
                    ${actionBtnHtml}
                </div>
            </div>
            
            <div class="match-card-bottom-bar">
                <span class="badge ${m.prediction_status}">${m.prediction_status}</span>
                <span class="countdown-timer-span" id="match-countdown-${m.id}"></span>
            </div>
        `;
        
        // Counter event triggers
        if (!isCompleted && isOpen) {
            const hVal = card.querySelector(`#home-counter-${m.id}`);
            const aVal = card.querySelector(`#away-counter-${m.id}`);
            const saveBtn = card.querySelector(`#submit-pred-btn-${m.id}`);
            
            card.querySelector('.dec-home').onclick = () => {
                let v = parseInt(hVal.textContent);
                if (v > 0) { hVal.textContent = --v; saveBtn.disabled = false; }
            };
            card.querySelector('.inc-home').onclick = () => {
                let v = parseInt(hVal.textContent);
                if (v < 15) { hVal.textContent = ++v; saveBtn.disabled = false; }
            };
            card.querySelector('.dec-away').onclick = () => {
                let v = parseInt(aVal.textContent);
                if (v > 0) { aVal.textContent = --v; saveBtn.disabled = false; }
            };
            card.querySelector('.inc-away').onclick = () => {
                let v = parseInt(aVal.textContent);
                if (v < 15) { aVal.textContent = ++v; saveBtn.disabled = false; }
            };
            
            saveBtn.onclick = async () => {
                saveBtn.disabled = true;
                const homePred = parseInt(hVal.textContent);
                const awayPred = parseInt(aVal.textContent);

                try {
                    const res = await fetch(`/api/matches/${m.id}/predict`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${Store.get('token')}`
                        },
                        body: JSON.stringify({
                            predicted_home_goals: homePred,
                            predicted_away_goals: awayPred
                        })
                    });

                    if (res.ok) {
                        const saved = await res.json();
                        showToast("Prediction saved!", "success");
                        // Patch the cached match in-place; no full refetch needed.
                        m.user_prediction = saved;
                        saveBtn.textContent = 'Update Prediction';
                        // Only the profile's total_predictions count changed.
                        await fetchProfile();
                    } else {
                        const err = await res.json();
                        showToast(err.detail || "Error saving prediction", "danger");
                        saveBtn.disabled = false;
                    }
                } catch (e) {
                    showToast("Server connection error", "danger");
                    saveBtn.disabled = false;
                }
            };
        }
        
        // Countdown timer updates
        if (!isCompleted) {
            const countdownSpan = card.querySelector(`#match-countdown-${m.id}`);
            
            const runTimer = () => {
                const now = new Date();
                const timeDiff = matchTime - now;
                
                if (timeDiff <= 0) {
                    countdownSpan.textContent = "Closed";
                    countdownSpan.style.color = "var(--danger)";
                    return;
                }
                
                const minsLeft = Math.floor(timeDiff / 1000 / 60);
                if (minsLeft <= 15) {
                    countdownSpan.textContent = `Locks in ${minsLeft}m`;
                    countdownSpan.style.color = "var(--warning)";
                } else {
                    const hours = Math.floor(minsLeft / 60);
                    if (hours > 24) {
                        countdownSpan.textContent = `${Math.floor(hours / 24)}d left`;
                    } else {
                        countdownSpan.textContent = `${hours}h ${minsLeft % 60}m left`;
                    }
                    countdownSpan.style.color = "var(--text-muted)";
                }
            };
            
            runTimer();
            // Store interval inside a global list to clear later
            const intervalId = setInterval(runTimer, 30000);
            window.activeIntervals.push(intervalId);
        }
        
        container.appendChild(card);
    });
}

function renderBracketTree() {
    const bracketMatches = Store.get('bracketMatches');
    
    // Group matches: R32 (73-88), R16 (89-96), QF (97-100), SF (101-102), F (103-104)
    const r32 = bracketMatches.filter(m => m.id >= 73 && m.id <= 88);
    const r16 = bracketMatches.filter(m => m.id >= 89 && m.id <= 96);
    const qf = bracketMatches.filter(m => m.id >= 97 && m.id <= 100);
    const sf = bracketMatches.filter(m => m.id >= 101 && m.id <= 102);
    const finals = bracketMatches.filter(m => m.id >= 103 && m.id <= 104).sort((a,b) => b.id - a.id); // Final (104) first
    
    const renderList = (elementId, matches) => {
        const div = document.getElementById(elementId);
        div.innerHTML = '';
        
        matches.forEach(m => {
            const box = document.createElement('div');
            box.className = 'bracket-box';
            
            const homeStr = m.home_team || m.home_placeholder || 'TBD';
            const awayStr = m.away_team || m.away_placeholder || 'TBD';
            const isCompleted = m.status === 'completed';
            
            const homeWinnerClass = isCompleted && m.winning_team === m.home_team ? 'winner' : '';
            const awayWinnerClass = isCompleted && m.winning_team === m.away_team ? 'winner' : '';
            
            box.innerHTML = `
                <div class="bracket-box-header">Match ${m.id} - ${m.round}</div>
                <div class="bracket-row-team ${homeWinnerClass} ${!m.home_team ? 'placeholder' : ''}">
                    <span>${getFlag(m.home_team)} ${homeStr}</span>
                    <span class="bracket-score">${isCompleted ? m.home_score : ''}</span>
                </div>
                <div class="bracket-row-team ${awayWinnerClass} ${!m.away_team ? 'placeholder' : ''}">
                    <span>${getFlag(m.away_team)} ${awayStr}</span>
                    <span class="bracket-score">${isCompleted ? m.away_score : ''}</span>
                </div>
            `;
            
            box.onclick = () => {
                Store.set('activeTab', 'matches');
                // Scroll focus
                setTimeout(() => {
                    const card = document.getElementById(`match-card-${m.id}`);
                    if (card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        card.style.borderColor = 'var(--primary)';
                        setTimeout(() => card.style.borderColor = '', 2000);
                    }
                }, 200);
            };
            
            div.appendChild(box);
        });
    };
    
    renderList('bracket-list-r32', r32);
    renderList('bracket-list-r16', r16);
    renderList('bracket-list-qf', qf);
    renderList('bracket-list-sf', sf);
    renderList('bracket-list-finals', finals);
}

function renderLeaderboardTable() {
    const container = document.getElementById('leaderboard-table-body');
    // Using container as a wrapper for cards
    container.innerHTML = '';

    const lb = Store.get('leaderboard');
    const user = Store.get('user');

    if (lb.length === 0) {
        container.innerHTML = '<div class="no-data">No data.</div>';
        return;
    }

    lb.forEach(row => {
        const card = document.createElement('div');
        card.className = `leaderboard-card ${user && row.username === user.username ? 'active-user-row' : ''}`;

        card.innerHTML = `
            <div class="lb-rank">${row.rank}</div>
            <div class="lb-user">${row.username} ${user && row.username === user.username ? '<span class="badge open" style="font-size:0.6rem">You</span>' : ''}</div>
            <div style="text-align: center;">
                <small style="color:var(--text-muted); display:block; font-size:0.6rem;">Exact</small>
                <strong>${row.exact_predictions}</strong>
            </div>
            <div style="text-align: center;">
                <small style="color:var(--text-muted); display:block; font-size:0.6rem;">Total</small>
                <strong>${row.total_predictions}</strong>
            </div>
            <div class="lb-pts">${row.total_points} pts</div>
        `;
        container.appendChild(card);
    });
}

function renderProfileDashboard() {
    const profile = Store.get('profile');
    if (!profile) return;
    
    // Stats overview
    document.getElementById('profile-stat-points').textContent = profile.stats.total_points;
    document.getElementById('profile-stat-predicted').textContent = profile.stats.total_predictions;
    document.getElementById('profile-stat-exact').textContent = profile.stats.exact_predictions;
    document.getElementById('profile-stat-accuracy').textContent = `${profile.stats.accuracy_rate}%`;
    
    // History list
    const container = document.getElementById('history-items-container');
    container.innerHTML = '';
    
    if (profile.history.length === 0) {
        container.innerHTML = '<div class="no-data">You have not submitted any predictions.</div>';
        return;
    }
    
    profile.history.forEach(item => {
        const row = document.createElement('div');
        row.className = 'history-item-row';
        
        const homeName = item.home_team || item.home_placeholder || 'TBD';
        const awayName = item.away_team || item.away_placeholder || 'TBD';
        const isScored = item.status === 'scored';
        
        let finalScore = '—';
        let ptsBadge = '<span class="points-badge danger">Open</span>';
        
        if (isScored) {
            finalScore = `${item.home_score} - ${item.away_score}`;
            const pts = item.points_earned;
            let ptsClass = 'danger';
            if (pts === 10) ptsClass = 'gold';
            else if (pts > 0) ptsClass = 'green';
            
            ptsBadge = `<span class="points-badge ${ptsClass}">${pts} PTS</span>`;
        } else if (item.status === 'locked') {
            ptsBadge = '<span class="points-badge danger">Locked</span>';
        }
        
        row.innerHTML = `
            <div class="history-info-match">
                <span class="history-round-label">${item.round}</span>
                <span class="history-team-label">${getFlag(item.home_team)} ${homeName} vs ${getFlag(item.away_team)} ${awayName}</span>
            </div>
            <div class="history-nums">
                <div class="history-num-col">
                    <span class="history-num-lbl">Your Pick</span>
                    <span class="history-num-val" style="color:var(--primary)">${item.predicted_home_goals} - ${item.predicted_away_goals}</span>
                </div>
                <div class="history-num-col">
                    <span class="history-num-lbl">Result</span>
                    <span class="history-num-val">${finalScore}</span>
                </div>
            </div>
            <div>
                ${ptsBadge}
            </div>
        `;
        
        container.appendChild(row);
    });
}

function updateSidebarStanding() {
    const user = Store.get('user');
    const profile = Store.get('profile');
    const lb = Store.get('leaderboard');
    
    if (!user || !profile) return;
    
    // Avatar and info
    document.getElementById('sidebar-user-avatar').textContent = user.username.substring(0, 2).toUpperCase();
    document.getElementById('sidebar-user-username').textContent = user.username;
    
    // Points
    document.getElementById('sidebar-metric-points').textContent = profile.stats.total_points;
    document.getElementById('user-display-points').textContent = `${profile.stats.total_points} pts`;
    
    // Global Rank
    const userRank = lb.find(row => row.username === user.username);
    const rankNum = document.getElementById('sidebar-metric-rank');
    const rankPct = document.getElementById('sidebar-metric-percent');
    const barFill = document.getElementById('sidebar-metric-progress');
    
    if (userRank) {
        rankNum.textContent = `#${userRank.rank}`;
        const total = lb.length || 1;
        const percentile = Math.round((userRank.rank / total) * 100);
        rankPct.textContent = `(Top ${percentile}%)`;
        barFill.style.width = `${Math.max(10, 100 - percentile)}%`;
    } else {
        rankNum.textContent = '#--';
        rankPct.textContent = '(Top --%)';
        barFill.style.width = '0%';
    }
}

async function renderAdminConsole() {
    const body = document.getElementById('admin-matches-table-body');
    body.innerHTML = '';
    
    try {
        const res = await fetch('/api/matches', {
            headers: { 'Authorization': `Bearer ${Store.get('token')}` }
        });
        if (!res.ok) return;
        const matches = await res.json();
        
        matches.forEach(m => {
            const tr = document.createElement('tr');
            
            const home = m.home_team || m.home_placeholder || 'TBD';
            const away = m.away_team || m.away_placeholder || 'TBD';
            
            const isCompleted = m.status === 'completed';
            const hVal = isCompleted ? m.home_score : '';
            const aVal = isCompleted ? m.away_score : '';
            
            let winnerSelect = '—';
            if (!m.group_name && m.home_team && m.away_team) {
                winnerSelect = `
                    <select class="admin-winner-select" id="admin-winner-override-${m.id}">
                        <option value="" ${m.winning_team === null ? 'selected' : ''}>Draw (Shootout TBD)</option>
                        <option value="${m.home_team}" ${m.winning_team === m.home_team ? 'selected' : ''}>${m.home_team} wins</option>
                        <option value="${m.away_team}" ${m.winning_team === m.away_team ? 'selected' : ''}>${m.away_team} wins</option>
                    </select>
                `;
            }
            
            tr.innerHTML = `
                <td><strong>${m.id}</strong></td>
                <td><small>${m.round}</small></td>
                <td>${getFlag(m.home_team)} ${home} vs ${away} ${getFlag(m.away_team)}</td>
                <td>
                    <div class="admin-score-inputs">
                        <input type="number" min="0" class="admin-score-input" id="admin-score-home-${m.id}" value="${hVal}" placeholder="H">
                        <span>-</span>
                        <input type="number" min="0" class="admin-score-input" id="admin-score-away-${m.id}" value="${aVal}" placeholder="A">
                        ${winnerSelect}
                    </div>
                </td>
                <td>
                    <button class="btn success-btn btn-sm" onclick="saveMatchScore(${m.id})">
                        ${isCompleted ? 'Update' : 'Confirm'}
                    </button>
                </td>
            `;
            
            body.appendChild(tr);
        });
    } catch (e) {
        console.error("Admin render matches error:", e);
    }
}

// Global score saver bound for admin row buttons
window.saveMatchScore = async (match_id) => {
    const hVal = document.getElementById(`admin-score-home-${match_id}`).value;
    const aVal = document.getElementById(`admin-score-away-${match_id}`).value;
    const select = document.getElementById(`admin-winner-override-${match_id}`);
    
    if (hVal === "" || aVal === "") {
        showToast("Enter home and away scores", "warning");
        return;
    }
    
    const payload = {
        home_score: parseInt(hVal),
        away_score: parseInt(aVal)
    };
    if (select && select.value) {
        payload.winning_team = select.value;
    }
    
    showOverlay();
    try {
        const res = await fetch(`/api/admin/matches/${match_id}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Store.get('token')}`
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            showToast("Match updated!", "success");
            await refreshDashboardData();
            await renderAdminConsole();
        } else {
            const err = await res.json();
            showToast(err.detail || "Update failed", "danger");
        }
    } catch (e) {
        showToast("Network error", "danger");
    }
    hideOverlay();
};

// ==========================================================================
// 4. API Fetch Handlers
// ==========================================================================

async function fetchCurrentUser() {
    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${Store.get('token')}` }
        });
        if (res.ok) {
            const user = await res.json();
            Store.set('user', user);
        } else {
            Store.set('token', null); // clear session if auth failed
        }
    } catch (e) {
        Store.set('token', null);
    }
}

async function fetchMatches() {
    clearActiveIntervals();
    try {
        const res = await fetch('/api/matches', {
            headers: { 'Authorization': `Bearer ${Store.get('token')}` }
        });
        if (res.ok) {
            const list = await res.json();
            Store.set('matches', list);
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchBracket() {
    try {
        const res = await fetch('/api/matches/bracket', {
            headers: { 'Authorization': `Bearer ${Store.get('token')}` }
        });
        if (res.ok) {
            const list = await res.json();
            Store.set('bracketMatches', list);
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchLeaderboard() {
    try {
        const res = await fetch('/api/matches/leaderboard');
        if (res.ok) {
            const list = await res.json();
            Store.set('leaderboard', list);
        }
    } catch (e) {
        console.error(e);
    }
}

async function fetchProfile() {
    try {
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${Store.get('token')}` }
        });
        if (res.ok) {
            const profile = await res.json();
            Store.set('profile', profile);
        }
    } catch (e) {
        console.error(e);
    }
}

async function refreshDashboardData() {
    // Leaderboard, profile, and matches are independent — fetch in parallel.
    const fetches = [fetchLeaderboard(), fetchProfile()];
    if (Store.get('activeTab') === 'matches') fetches.push(fetchMatches());
    await Promise.all(fetches);
}

function clearActiveIntervals() {
    if (window.activeIntervals) {
        window.activeIntervals.forEach(clearInterval);
    }
    window.activeIntervals = [];
}

// ==========================================================================
// 5. User Input Events & Boot Setup
// ==========================================================================

function setupAppEvents() {
    // Auth toggles
    document.getElementById('toggle-to-register').onclick = (e) => { e.preventDefault(); showCard('register'); };
    document.getElementById('toggle-to-login').onclick = (e) => { e.preventDefault(); showCard('login'); };
    
    // Auth submits
    document.getElementById('login-form').onsubmit = handleLoginSubmit;
    document.getElementById('register-form').onsubmit = handleRegisterSubmit;
    document.getElementById('btn-logout').onclick = () => Store.set('token', null);
    
    // Tab navigations
    document.querySelectorAll('.menu-tab').forEach(btn => {
        btn.onclick = () => {
            const target = btn.getAttribute('data-target');
            Store.set('activeTab', target);
        };
    });
    
    // Match filters & search triggers
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Store.set('filterRound', btn.getAttribute('data-filter'));
        };
    });

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    themeBtn.onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeBtn.querySelector('i').className = 'fa-solid fa-moon';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeBtn.querySelector('i').className = 'fa-solid fa-sun';
        }
    };

    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeBtn.querySelector('i').className = 'fa-solid fa-sun';
    }

    document.getElementById('input-search').oninput = (e) => {
        debouncedSetSearch(e.target.value);
    };
    
    // Admin buttons
    document.getElementById('btn-admin-sim').onclick = async () => {
        showOverlay();
        try {
            const res = await fetch('/api/admin/simulate-group-stage', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Store.get('token')}` }
            });
            if (res.ok) {
                showToast("Group stage simulated!", "success");
                await refreshDashboardData();
                await renderAdminConsole();
            } else {
                showToast("Simulate failed", "danger");
            }
        } catch (e) {
            showToast("Connection failed", "danger");
        }
        hideOverlay();
    };
    
    document.getElementById('btn-admin-reset').onclick = async () => {
        if (!confirm("Wipe all predictions and scores? User accounts persist.")) return;
        showOverlay();
        try {
            const res = await fetch('/api/admin/reset', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Store.get('token')}` }
            });
            if (res.ok) {
                showToast("Tournament reset complete", "success");
                await refreshDashboardData();
                await renderAdminConsole();
            } else {
                showToast("Reset failed", "danger");
            }
        } catch (e) {
            showToast("Connection failed", "danger");
        }
        hideOverlay();
    };
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);
    
    showOverlay();
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast("Welcome back!", "success");
            Store.set('token', data.access_token);
        } else {
            const err = await res.json();
            showToast(err.detail || "Invalid login credentials", "danger");
        }
    } catch (err) {
        showToast("Connection error", "danger");
    }
    hideOverlay();
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    showOverlay();
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        if (res.ok) {
            showToast("Registered! Sign in below.", "success");
            showCard('login');
            document.getElementById('login-username').value = username;
        } else {
            const err = await res.json();
            showToast(err.detail || "Registration failed", "danger");
        }
    } catch (err) {
        showToast("Connection error", "danger");
    }
    hideOverlay();
}

// UI Toggles
function showCard(card) {
    document.getElementById('login-card').style.display = card === 'login' ? 'block' : 'none';
    document.getElementById('register-card').style.display = card === 'register' ? 'block' : 'none';
}

function showOverlay() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideOverlay() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <span class="toast-close">&times;</span>
    `;
    container.appendChild(toast);
    
    toast.querySelector('.toast-close').onclick = () => toast.remove();
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

// Boot Sequence
window.activeIntervals = [];
document.addEventListener('DOMContentLoaded', async () => {
    setupAppEvents();

    // Bootstrap auth UI directly. Going through Store.set would be skipped by
    // the equality short-circuit when the initial token already matches state.
    await handleAuthState(Store.get('token'));
});
