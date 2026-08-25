const Game = {
    state: {
        phase: 'lobby',
        players: [],
        hostId: null,
        myId: null,
        myName: '',
        isHost: false,
        roomCode: '',
        currentRound: 0,
        totalRounds: 5,
        discussionTime: 60,
        voteTime: 30,
        words: [],
        scores: [],
        impostorId: null,
        currentWord: null,
        currentAssignments: null,
        votes: {},
        alivePlayers: [],
        readyPlayers: []
    },
    
    reset() {
        this.state = {
            phase: 'lobby',
            players: [],
            hostId: null,
            myId: null,
            myName: '',
            isHost: false,
            roomCode: '',
            currentRound: 0,
            totalRounds: 5,
            discussionTime: 60,
            voteTime: 30,
            words: [],
            scores: [],
            impostorId: null,
            currentWord: null,
            currentAssignments: null,
            votes: {},
            alivePlayers: [],
            readyPlayers: []
        };
    },
    
    initGame(players, hostId, totalRounds, discussionTime) {
        this.state.players = [...players];
        this.state.hostId = hostId;
        this.state.totalRounds = totalRounds;
        this.state.discussionTime = discussionTime;
        this.state.currentRound = 0;
        this.state.scores = players.map(p => ({ id: p.id, name: p.name, score: 0 }));
        this.state.alivePlayers = players.map(p => p.id);
        this.state.words = getRandomWords(totalRounds + 2);
    },
    
    startRound() {
        this.state.currentRound++;
        this.state.phase = 'word';
        this.state.readyPlayers = [];
        this.state.votes = {};
        this.state.currentAssignments = null;
        
        const wordData = this.state.words[this.state.currentRound - 1];
        this.state.currentWord = wordData;
        
        const alivePlayersList = this.state.players.filter(p => this.state.alivePlayers.includes(p.id));
        const randomIndex = Math.floor(Math.random() * alivePlayersList.length);
        this.state.impostorId = alivePlayersList[randomIndex].id;
        
        this.state.currentAssignments = this.buildAssignments();
        
        return this.state.currentAssignments;
    },
    
    buildAssignments() {
        const assignments = {};
        const word = this.state.currentWord;
        
        this.state.players.forEach(p => {
            if (!this.state.alivePlayers.includes(p.id)) {
                assignments[p.id] = { word: '---', isImpostor: false, alive: false };
            } else if (p.id === this.state.impostorId) {
                assignments[p.id] = { word: word.impostorWord, isImpostor: true, alive: true };
            } else {
                assignments[p.id] = { word: word.word, isImpostor: false, alive: true };
            }
        });
        
        return assignments;
    },
    
    getWordAssignment() {
        if (!this.state.currentAssignments) {
            this.state.currentAssignments = this.buildAssignments();
        }
        return this.state.currentAssignments;
    },
    
    setAssignments(assignments) {
        this.state.currentAssignments = assignments;
    },
    
    playerReady(playerId) {
        if (!this.state.readyPlayers.includes(playerId)) {
            this.state.readyPlayers.push(playerId);
        }
        
        const aliveCount = this.state.alivePlayers.length;
        return this.state.readyPlayers.length >= aliveCount;
    },
    
    startDiscussion() {
        this.state.phase = 'discussion';
    },
    
    startVoting() {
        this.state.phase = 'voting';
        this.state.votes = {};
    },
    
    castVote(voterId, targetId) {
        this.state.votes[voterId] = targetId;
    },
    
    getVoteResults() {
        const alivePlayers = this.state.players.filter(p => this.state.alivePlayers.includes(p.id));
        const voteCounts = {};
        
        alivePlayers.forEach(p => {
            voteCounts[p.id] = 0;
        });
        
        let skipVotes = 0;
        
        Object.values(this.state.votes).forEach(targetId => {
            if (targetId === 'skip') {
                skipVotes++;
            } else if (voteCounts[targetId] !== undefined) {
                voteCounts[targetId]++;
            }
        });
        
        let maxVotes = skipVotes;
        let votedOutId = null;
        
        Object.entries(voteCounts).forEach(([id, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                votedOutId = id;
            } else if (count === maxVotes) {
                votedOutId = null;
            }
        });
        
        const impostorFound = votedOutId === this.state.impostorId;
        
        if (votedOutId) {
            this.state.alivePlayers = this.state.alivePlayers.filter(id => id !== votedOutId);
        }
        
        const impostor = this.state.players.find(p => p.id === this.state.impostorId);
        const votedOut = votedOutId ? this.state.players.find(p => p.id === votedOutId) : null;
        
        if (impostorFound) {
            this.state.scores.forEach(s => {
                if (s.id !== this.state.impostorId) {
                    s.score++;
                }
            });
        } else {
            const impostorScore = this.state.scores.find(s => s.id === this.state.impostorId);
            if (impostorScore) impostorScore.score += 2;
        }
        
        const gameOver = impostorFound || this.state.currentRound >= this.state.totalRounds;
        
        if (gameOver) {
            this.state.phase = 'gameover';
        } else {
            this.state.phase = 'roundend';
        }
        
        return {
            votedOut,
            impostor,
            impostorFound,
            word: this.state.currentWord.word,
            scores: [...this.state.scores],
            gameOver,
            round: this.state.currentRound,
            totalRounds: this.state.totalRounds
        };
    },
    
    isAlive(playerId) {
        return this.state.alivePlayers.includes(playerId);
    },
    
    getMyWord() {
        const assignments = this.getWordAssignment();
        const myAssignment = assignments[this.state.myId];
        return myAssignment || { word: '---', isImpostor: false, alive: false };
    },
    
    getAlivePlayers() {
        return this.state.players.filter(p => this.state.alivePlayers.includes(p.id));
    },
    
    getPlayers() {
        return this.state.players;
    },
    
    getScores() {
        return [...this.state.scores];
    },
    
    getWinner() {
        const sorted = [...this.state.scores].sort((a, b) => b.score - a.score);
        return sorted[0];
    }
};
