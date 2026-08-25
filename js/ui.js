const UI = {
    currentScreen: 'menu',
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(`screen-${screenId}`);
        if (screen) {
            screen.classList.add('active');
            this.currentScreen = screenId;
        }
    },
    
    showModal(modalId) {
        const modal = document.getElementById(`modal-${modalId}`);
        if (modal) modal.classList.remove('hidden');
    },
    
    hideModal(modalId) {
        const modal = document.getElementById(`modal-${modalId}`);
        if (modal) modal.classList.add('hidden');
    },
    
    showError(message) {
        document.getElementById('error-message').textContent = message;
        this.showModal('error');
    },
    
    updateRoomCode(code) {
        document.getElementById('room-code').textContent = code;
    },
    
    updatePlayersList(players, hostId) {
        const container = document.getElementById('players-list');
        const emojis = ['👻', '🎃', '🦇', '🕷️', '💀', '👾', '🤖', '🎭', '🦊', '🐱', '🐶', '🦁', '🐯', '🐸', '🐙'];
        
        container.innerHTML = players.map((p, i) => `
            <div class="player-tag ${p.id === hostId ? 'host' : ''}">
                <span class="player-emoji">${emojis[i % emojis.length]}</span>
                ${p.name}
                ${p.id === hostId ? ' 👑' : ''}
            </div>
        `).join('');
        
        const startBtn = document.getElementById('btn-start-game');
        const status = document.getElementById('lobby-status');
        
        if (players.length >= 3) {
            startBtn.disabled = false;
            status.textContent = 'Gotowy do gry!';
        } else {
            startBtn.disabled = true;
            status.textContent = `Potrzeba minimum 3 graczy (aktualnie: ${players.length})`;
        }
    },
    
    showPlayerWord(word, isImpostor, round, totalRounds) {
        document.getElementById('player-word').textContent = word;
        
        const warning = document.getElementById('impostor-warning');
        if (isImpostor) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
        
        document.getElementById('current-round').textContent = round;
        document.getElementById('total-rounds').textContent = totalRounds;
        
        const card = document.getElementById('word-card');
        card.classList.remove('flipped');
        
        card.onclick = () => card.classList.add('flipped');
    },
    
    updateDiscussionTimer(seconds) {
        const timer = document.getElementById('discussion-timer');
        timer.textContent = seconds;
        
        timer.classList.remove('warning', 'danger');
        if (seconds <= 10) {
            timer.classList.add('danger');
        } else if (seconds <= 20) {
            timer.classList.add('warning');
        }
    },
    
    updateDiscussionPlayers(players, speakingId) {
        const container = document.getElementById('discussion-players-list');
        const emojis = ['👻', '🎃', '🦇', '🕷️', '💀', '👾', '🤖', '🎭', '🦊', '🐱', '🐶', '🦁', '🐯', '🐸', '🐙'];
        
        container.innerHTML = players.map((p, i) => `
            <div class="discussion-player ${p.id === speakingId ? 'speaking' : ''}">
                <div class="player-avatar">${emojis[i % emojis.length]}</div>
                <div class="player-name">${p.name}</div>
            </div>
        `).join('');
    },
    
    updateDiscussionRound(round, totalRounds) {
        document.getElementById('discussion-round').textContent = round;
        document.getElementById('discussion-total-rounds').textContent = totalRounds;
    },
    
    showVoteScreen(players, timerSeconds) {
        const container = document.getElementById('vote-players');
        const emojis = ['👻', '🎃', '🦇', '🕷️', '💀', '👾', '🤖', '🎭', '🦊', '🐱', '🐶', '🦁', '🐯', '🐸', '🐙'];
        
        container.innerHTML = players.map((p, i) => `
            <div class="vote-player" data-player-id="${p.id}">
                <div class="player-avatar">${emojis[i % emojis.length]}</div>
                <div class="player-name">${p.name}</div>
            </div>
        `).join('');
        
        document.getElementById('vote-timer').textContent = timerSeconds;
        document.getElementById('btn-submit-vote').disabled = true;
    },
    
    updateVoteTimer(seconds) {
        document.getElementById('vote-timer').textContent = seconds;
    },
    
    highlightVotedPlayer(playerId) {
        document.querySelectorAll('.vote-player').forEach(p => {
            p.classList.remove('selected');
            if (p.dataset.playerId === playerId) {
                p.classList.add('selected');
            }
        });
        document.getElementById('btn-submit-vote').disabled = false;
    },
    
    showRoundResult(result, scores, round, totalRounds) {
        const content = document.getElementById('round-result-content');
        
        let html = '';
        
        if (result.votedOut) {
            html += `<div class="result-eliminated">🗳️ ${result.votedOut.name} został wyeliminowany!</div>`;
        } else {
            html += `<div class="result-eliminated">⏭️ Nikt nie został wyeliminowany</div>`;
        }
        
        if (result.impostorFound || round === totalRounds) {
            html += `<div class="result-impostor-reveal">🕵️ Impostorem był: ${result.impostor.name}</div>`;
            html += `<div class="result-word-reveal">Hasło: ${result.word}</div>`;
            
            if (result.impostorFound) {
                html += `<p style="color: var(--success); font-weight: 700;">+1 pkt dla wszystkich graczy!</p>`;
            } else {
                html += `<p style="color: var(--danger); font-weight: 700;">+2 pkt dla impostora!</p>`;
            }
        }
        
        content.innerHTML = html;
        
        this.updateScoresList('result-scores-list', scores);
        
        const nextBtn = document.getElementById('btn-next-round');
        if (round >= totalRounds) {
            nextBtn.textContent = 'Zobacz wyniki końcowe';
        } else {
            nextBtn.textContent = 'Następna runda';
        }
    },
    
    showFinalResults(scores) {
        const sorted = [...scores].sort((a, b) => b.score - a.score);
        const winner = sorted[0];
        
        const emojis = ['👻', '🎃', '🦇', '🕷️', '💀', '👾', '🤖', '🎭', '🦊', '🐱', '🐶', '🦁', '🐯', '🐸', '🐙'];
        const winnerIndex = scores.findIndex(p => p.id === winner.id);
        
        document.getElementById('winner-announcement').innerHTML = `
            <span class="winner-emoji">${emojis[winnerIndex % emojis.length]}</span>
            <div class="winner-name">${winner.name}</div>
            <div class="winner-score">${winner.score} punktów</div>
        `;
        
        this.updateScoresList('final-scores-list', scores);
    },
    
    updateScoresList(containerId, scores) {
        const container = document.getElementById(containerId);
        const sorted = [...scores].sort((a, b) => b.score - a.score);
        const emojis = ['👻', '🎃', '🦇', '🕷️', '💀', '👾', '🤖', '🎭', '🦊', '🐱', '🐶', '🦁', '🐯', '🐸', '🐙'];
        
        container.innerHTML = sorted.map((p, i) => {
            const originalIndex = scores.findIndex(s => s.id === p.id);
            return `
                <div class="score-row">
                    <span class="score-name">
                        ${emojis[originalIndex % emojis.length]}
                        ${p.name}
                    </span>
                    <span class="score-points">${p.score} pkt</span>
                </div>
            `;
        }).join('');
    },
    
    setButtonLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>';
        } else {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
            }
        }
    }
};
