const App = {
    timers: {
        discussion: null,
        vote: null
    },
    selectedVote: null,
    
    init() {
        this.bindEvents();
        UI.showScreen('menu');
    },
    
    bindEvents() {
        document.getElementById('btn-create').addEventListener('click', () => {
            UI.showScreen('create');
        });
        
        document.getElementById('btn-join').addEventListener('click', () => {
            UI.showScreen('join');
        });
        
        document.getElementById('btn-back-create').addEventListener('click', () => {
            UI.showScreen('menu');
        });
        
        document.getElementById('btn-back-join').addEventListener('click', () => {
            UI.showScreen('menu');
        });
        
        document.getElementById('create-nick').addEventListener('input', (e) => {
            document.getElementById('btn-create-room').disabled = !e.target.value.trim();
        });
        
        document.getElementById('join-nick').addEventListener('input', () => {
            this.checkJoinReady();
        });
        
        document.getElementById('join-code').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
            this.checkJoinReady();
        });
        
        document.getElementById('btn-create-room').addEventListener('click', () => {
            this.createRoom();
        });
        
        document.getElementById('btn-join-room').addEventListener('click', () => {
            this.joinRoom();
        });
        
        document.getElementById('btn-copy-code').addEventListener('click', () => {
            const code = document.getElementById('room-code').textContent;
            navigator.clipboard.writeText(code).then(() => {
                const btn = document.getElementById('btn-copy-code');
                btn.textContent = '✅';
                setTimeout(() => btn.textContent = '📋', 1500);
            });
        });
        
        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('btn-ready').addEventListener('click', () => {
            this.playerReady();
        });
        
        document.getElementById('btn-submit-vote').addEventListener('click', () => {
            this.submitVote();
        });
        
        document.getElementById('btn-skip-vote').addEventListener('click', () => {
            this.skipVote();
        });
        
        document.getElementById('btn-next-round').addEventListener('click', () => {
            this.nextRound();
        });
        
        document.getElementById('btn-play-again').addEventListener('click', () => {
            this.playAgain();
        });
        
        document.getElementById('btn-leave').addEventListener('click', () => {
            this.leaveGame();
        });
        
        document.getElementById('btn-close-error').addEventListener('click', () => {
            UI.hideModal('error');
        });
        
        document.getElementById('rounds-select').addEventListener('change', () => {
            this.broadcastSettings();
        });
        
        document.getElementById('discussion-time').addEventListener('change', () => {
            this.broadcastSettings();
        });
    },
    
    checkJoinReady() {
        const nick = document.getElementById('join-nick').value.trim();
        const code = document.getElementById('join-code').value.trim();
        document.getElementById('btn-join-room').disabled = !(nick && code);
    },
    
    async createRoom() {
        const nick = document.getElementById('create-nick').value.trim();
        if (!nick) return;
        
        UI.setButtonLoading('btn-create-room', true);
        
        try {
            PeerNetwork.init({
                onPlayerJoin: (player) => this.handlePlayerJoin(player),
                onPlayerLeave: (playerId) => this.handlePlayerLeave(playerId),
                onMessage: (data, peerId) => this.handleMessage(data, peerId),
                onConnectionError: (err) => this.handleError(err)
            });
            
            await PeerNetwork.createRoom(nick);
            
            Game.state.myId = PeerNetwork.myId;
            Game.state.myName = nick;
            Game.state.isHost = true;
            Game.state.hostId = PeerNetwork.myId;
            
            Game.state.players = [{
                id: PeerNetwork.myId,
                name: nick
            }];
            
            UI.updateRoomCode(PeerNetwork.roomCode);
            UI.updatePlayersList(Game.state.players, Game.state.hostId);
            UI.showScreen('lobby');
        } catch (err) {
            UI.showError('Nie udało się stworzyć pokoju: ' + err.message);
        } finally {
            UI.setButtonLoading('btn-create-room', false);
        }
    },
    
    async joinRoom() {
        const nick = document.getElementById('join-nick').value.trim();
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        if (!nick || !code) return;
        
        UI.setButtonLoading('btn-join-room', true);
        
        try {
            PeerNetwork.init({
                onPlayerJoin: (player) => this.handlePlayerJoin(player),
                onPlayerLeave: (playerId) => this.handlePlayerLeave(playerId),
                onMessage: (data, peerId) => this.handleMessage(data, peerId),
                onConnectionError: (err) => this.handleError(err),
                onConnected: () => this.handleConnected()
            });
            
            await PeerNetwork.joinRoom(code, nick);
            
            Game.state.myId = PeerNetwork.myId;
            Game.state.myName = nick;
            Game.state.roomCode = code;
            
        } catch (err) {
            UI.showError('Nie udało się dołączyć do pokoju: ' + err.message);
        } finally {
            UI.setButtonLoading('btn-join-room', false);
        }
    },
    
    handleConnected() {
        PeerNetwork.sendToHost({
            type: 'player-join',
            name: Game.state.myName
        });
    },
    
    handlePlayerJoin(player) {
        if (Game.state.players.find(p => p.id === player.id)) return;
        
        Game.state.players.push({
            id: player.id,
            name: player.name
        });
        
        UI.updatePlayersList(Game.state.players, Game.state.hostId);
        
        PeerNetwork.sendToPlayer(player.id, {
            type: 'welcome',
            players: Game.state.players,
            hostId: Game.state.hostId,
            myId: player.id,
            settings: {
                totalRounds: parseInt(document.getElementById('rounds-select').value),
                discussionTime: parseInt(document.getElementById('discussion-time').value)
            }
        });
    },
    
    handlePlayerLeave(playerId) {
        Game.state.players = Game.state.players.filter(p => p.id !== playerId);
        UI.updatePlayersList(Game.state.players, Game.state.hostId);
    },
    
    handleMessage(data, peerId) {
        switch (data.type) {
            case 'player-join':
                this.handlePlayerJoin({ id: peerId, name: data.name });
                break;
                
            case 'welcome':
                Game.state.players = data.players;
                Game.state.hostId = data.hostId;
                Game.state.myId = data.myId;
                Game.state.totalRounds = data.settings.totalRounds;
                Game.state.discussionTime = data.settings.discussionTime;
                document.getElementById('rounds-select').value = data.settings.totalRounds;
                document.getElementById('discussion-time').value = data.settings.discussionTime;
                
                UI.updateRoomCode(PeerNetwork.roomCode);
                UI.updatePlayersList(Game.state.players, Game.state.hostId);
                UI.showScreen('lobby');
                break;
                
            case 'settings-update':
                Game.state.totalRounds = data.totalRounds;
                Game.state.discussionTime = data.discussionTime;
                document.getElementById('rounds-select').value = data.totalRounds;
                document.getElementById('discussion-time').value = data.discussionTime;
                break;
                
            case 'game-start':
                Game.initGame(data.players, data.hostId, data.totalRounds, data.discussionTime);
                break;
                
            case 'word-assignment':
                Game.state.currentRound = data.round;
                Game.state.currentWord = data.wordData;
                Game.state.impostorId = data.impostorId;
                Game.state.alivePlayers = data.alivePlayers;
                this.showWordScreenClient(data.assignments);
                break;
                
            case 'player-ready':
                if (Game.state.isHost) {
                    const allReady = Game.playerReady(data.playerId);
                    if (allReady) {
                        this.startDiscussion();
                    }
                }
                break;
                
            case 'start-discussion':
                this.startDiscussionUI();
                break;
                
            case 'start-voting':
                this.startVotingUI();
                break;
                
            case 'vote':
                if (Game.state.isHost) {
                    Game.castVote(data.voterId, data.targetId);
                }
                break;
                
            case 'skip-vote':
                if (Game.state.isHost) {
                    Game.castVote(data.voterId, 'skip');
                }
                break;
                
            case 'round-result':
                this.showRoundResultUI(data);
                break;
                
            case 'final-result':
                this.showFinalResultUI(data.scores);
                break;
                
            case 'play-again':
                this.playAgainUI();
                break;
        }
    },
    
    handleError(err) {
        UI.showError(err.message || 'Wystąpił nieoczekiwany błąd');
    },
    
    broadcastSettings() {
        if (!Game.state.isHost) return;
        
        PeerNetwork.broadcastToClients({
            type: 'settings-update',
            totalRounds: parseInt(document.getElementById('rounds-select').value),
            discussionTime: parseInt(document.getElementById('discussion-time').value)
        });
    },
    
    async startGame() {
        if (!Game.state.isHost || Game.state.players.length < 3) return;
        
        const totalRounds = parseInt(document.getElementById('rounds-select').value);
        const discussionTime = parseInt(document.getElementById('discussion-time').value);
        
        Game.initGame(Game.state.players, Game.state.hostId, totalRounds, discussionTime);
        Game.startRound();
        
        const assignments = Game.getWordAssignment();
        
        PeerNetwork.broadcastToClients({
            type: 'game-start',
            players: Game.state.players,
            hostId: Game.state.hostId,
            totalRounds: totalRounds,
            discussionTime: discussionTime
        });
        
        setTimeout(() => {
            PeerNetwork.broadcastToClients({
                type: 'word-assignment',
                assignments: assignments,
                round: Game.state.currentRound,
                wordData: Game.state.currentWord,
                impostorId: Game.state.impostorId,
                alivePlayers: Game.state.alivePlayers
            });
            
            this.showWordScreen(assignments);
        }, 300);
    },
    
    showWordScreen(assignments) {
        const myAssignment = assignments[Game.state.myId];
        
        if (myAssignment) {
            UI.showPlayerWord(
                myAssignment.word,
                myAssignment.isImpostor,
                Game.state.currentRound,
                Game.state.totalRounds
            );
        }
        
        UI.showScreen('word');
    },
    
    showWordScreenClient(assignments) {
        const myAssignment = assignments[Game.state.myId];
        
        if (myAssignment) {
            UI.showPlayerWord(
                myAssignment.word,
                myAssignment.isImpostor,
                Game.state.currentRound,
                Game.state.totalRounds
            );
        }
        
        UI.showScreen('word');
    },
    
    playerReady() {
        if (Game.state.isHost) {
            const allReady = Game.playerReady(Game.state.myId);
            
            if (allReady) {
                this.startDiscussion();
            }
        } else {
            PeerNetwork.sendToHost({
                type: 'player-ready',
                playerId: Game.state.myId
            });
            
            document.getElementById('btn-ready').disabled = true;
            document.getElementById('btn-ready').textContent = 'Oczekiwanie na innych...';
        }
    },
    
    startDiscussion() {
        Game.startDiscussion();
        
        PeerNetwork.broadcastToClients({
            type: 'start-discussion'
        });
        
        this.startDiscussionUI();
    },
    
    startDiscussionUI() {
        Game.state.phase = 'discussion';
        
        const alivePlayers = Game.getAlivePlayers();
        UI.updateDiscussionPlayers(alivePlayers, null);
        UI.updateDiscussionRound(Game.state.currentRound, Game.state.totalRounds);
        UI.showScreen('discussion');
        
        let timeLeft = Game.state.discussionTime;
        UI.updateDiscussionTimer(timeLeft);
        
        this.clearTimers();
        
        this.timers.discussion = setInterval(() => {
            timeLeft--;
            UI.updateDiscussionTimer(timeLeft);
            
            if (timeLeft <= 0) {
                this.clearTimers();
                this.startVoting();
            }
        }, 1000);
    },
    
    startVoting() {
        Game.startVoting();
        
        if (Game.state.isHost) {
            PeerNetwork.broadcastToClients({
                type: 'start-voting'
            });
        }
        
        this.startVotingUI();
    },
    
    startVotingUI() {
        Game.state.phase = 'voting';
        Game.state.votes = {};
        this.selectedVote = null;
        
        const alivePlayers = Game.getAlivePlayers();
        UI.showVoteScreen(alivePlayers, Game.state.voteTime);
        UI.showScreen('vote');
        
        document.querySelectorAll('.vote-player').forEach(el => {
            el.addEventListener('click', () => {
                this.selectedVote = el.dataset.playerId;
                UI.highlightVotedPlayer(this.selectedVote);
            });
        });
        
        let timeLeft = Game.state.voteTime;
        
        this.clearTimers();
        
        this.timers.vote = setInterval(() => {
            timeLeft--;
            UI.updateVoteTimer(timeLeft);
            
            if (timeLeft <= 0) {
                this.clearTimers();
                this.skipVote();
            }
        }, 1000);
    },
    
    submitVote() {
        if (!this.selectedVote) return;
        
        this.clearTimers();
        
        if (Game.state.isHost) {
            Game.castVote(Game.state.myId, this.selectedVote);
            
            PeerNetwork.broadcastToClients({
                type: 'vote',
                voterId: Game.state.myId,
                targetId: this.selectedVote
            });
            
            setTimeout(() => this.processRoundEnd(), 1500);
        } else {
            PeerNetwork.sendToHost({
                type: 'vote',
                voterId: Game.state.myId,
                targetId: this.selectedVote
            });
            
            UI.showModal('waiting');
        }
    },
    
    skipVote() {
        this.clearTimers();
        
        if (Game.state.isHost) {
            Game.castVote(Game.state.myId, 'skip');
            
            PeerNetwork.broadcastToClients({
                type: 'skip-vote',
                voterId: Game.state.myId
            });
            
            setTimeout(() => this.processRoundEnd(), 1500);
        } else {
            PeerNetwork.sendToHost({
                type: 'skip-vote',
                voterId: Game.state.myId
            });
            
            UI.showModal('waiting');
        }
    },
    
    processRoundEnd() {
        const result = Game.getVoteResults();
        
        UI.hideModal('waiting');
        
        PeerNetwork.broadcastToClients({
            type: 'round-result',
            result: result
        });
        
        this.showRoundResultUI(result);
    },
    
    showRoundResultUI(data) {
        UI.hideModal('waiting');
        
        const result = data.result || data;
        const scores = result.scores || Game.getScores();
        const round = result.round || Game.state.currentRound;
        const totalRounds = result.totalRounds || Game.state.totalRounds;
        
        UI.showRoundResult(result, scores, round, totalRounds);
        UI.showScreen('round-result');
    },
    
    nextRound() {
        if (Game.state.phase === 'gameover') {
            const scores = Game.getScores();
            
            PeerNetwork.broadcastToClients({
                type: 'final-result',
                scores: scores
            });
            
            this.showFinalResultUI(scores);
        } else {
            if (Game.state.isHost) {
                this.startNewRound();
            }
        }
    },
    
    startNewRound() {
        Game.startRound();
        
        const assignments = Game.getWordAssignment();
        
        PeerNetwork.broadcastToClients({
            type: 'word-assignment',
            assignments: assignments,
            round: Game.state.currentRound,
            wordData: Game.state.currentWord,
            impostorId: Game.state.impostorId,
            alivePlayers: Game.state.alivePlayers
        });
        
        this.showWordScreen(assignments);
    },
    
    showFinalResultUI(scores) {
        UI.showFinalResults(scores);
        UI.showScreen('final-result');
    },
    
    playAgain() {
        PeerNetwork.broadcastToClients({
            type: 'play-again'
        });
        
        this.playAgainUI();
    },
    
    playAgainUI() {
        Game.state.phase = 'lobby';
        Game.state.currentRound = 0;
        Game.state.scores = Game.state.players.map(p => ({ id: p.id, name: p.name, score: 0 }));
        Game.state.alivePlayers = Game.state.players.map(p => p.id);
        
        document.getElementById('btn-ready').disabled = false;
        document.getElementById('btn-ready').textContent = 'Jestem gotowy!';
        
        UI.updatePlayersList(Game.state.players, Game.state.hostId);
        UI.showScreen('lobby');
    },
    
    leaveGame() {
        this.clearTimers();
        PeerNetwork.disconnect();
        Game.reset();
        UI.showScreen('menu');
        
        document.getElementById('create-nick').value = '';
        document.getElementById('join-nick').value = '';
        document.getElementById('join-code').value = '';
    },
    
    clearTimers() {
        if (this.timers.discussion) {
            clearInterval(this.timers.discussion);
            this.timers.discussion = null;
        }
        if (this.timers.vote) {
            clearInterval(this.timers.vote);
            this.timers.vote = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
