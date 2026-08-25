const PeerNetwork = {
    isHost: false,
    roomCode: null,
    myId: null,
    myName: null,
    hostId: null,
    players: {},
    pollTimer: null,
    lastMessageTs: 0,

    callbacks: {
        onPlayerJoin: null,
        onPlayerLeave: null,
        onMessage: null,
        onConnectionError: null
    },

    init(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    },

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    generateId() {
        return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
    },

    async apiCall(method, room, params) {
        let url = `/api/signal?room=${room}`;
        const opts = { method, headers: {} };
        if (method === 'GET' && params) {
            Object.entries(params).forEach(([k, v]) => {
                url += `&${k}=${encodeURIComponent(v)}`;
            });
        } else if (params) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(params);
        }
        const res = await fetch(url, opts);
        return res.json();
    },

    async createRoom(playerName) {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.myName = playerName;
        this.myId = this.generateId();
        this.hostId = this.myId;

        await this.apiCall('POST', this.roomCode, {
            type: 'create',
            peerId: this.myId,
            name: playerName
        });

        this.players[this.myId] = { name: playerName };
        this.startPolling();
        return this.roomCode;
    },

    async joinRoom(roomCode, playerName) {
        this.roomCode = roomCode.toUpperCase();
        this.isHost = false;
        this.myName = playerName;
        this.myId = this.generateId();

        const data = await this.apiCall('POST', this.roomCode, {
            type: 'join',
            peerId: this.myId,
            name: playerName
        });

        if (data.error) throw new Error(data.error);
        this.hostId = data.host;

        this.startPolling();
    },

    startPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);

        this.pollTimer = setInterval(async () => {
            try {
                const data = await this.apiCall('GET', this.roomCode, { since: this.lastMessageTs || 0 });
                if (!data.messages) return;

                for (const msg of data.messages) {
                    if (msg.ts && msg.ts > this.lastMessageTs) this.lastMessageTs = msg.ts;

                    if (msg.type === 'join') {
                        if (this.isHost && msg.peerId !== this.myId) {
                            this.players[msg.peerId] = { name: msg.name };
                            if (this.callbacks.onPlayerJoin) {
                                this.callbacks.onPlayerJoin({ id: msg.peerId, name: msg.name });
                            }
                        }
                        continue;
                    }

                    if (msg.type === 'player-left') {
                        if (this.callbacks.onPlayerLeave) this.callbacks.onPlayerLeave(msg.peerId);
                        continue;
                    }

                    if (msg.type === 'game-message') {
                        if (msg.to && msg.to !== this.myId) continue;
                        if (this.callbacks.onMessage) {
                            this.callbacks.onMessage(msg.data, msg.from);
                        }
                    }
                }
            } catch (e) {
                console.warn('Polling error:', e);
            }
        }, 800);
    },

    async sendToHost(data) {
        await this.apiCall('POST', this.roomCode, {
            type: 'game-message',
            from: this.myId,
            to: this.hostId,
            data: data
        });
    },

    async sendToPlayer(playerId, data) {
        await this.apiCall('POST', this.roomCode, {
            type: 'game-message',
            from: this.myId,
            to: playerId,
            data: data
        });
    },

    async broadcastToClients(data) {
        const promises = [];
        Object.keys(this.players).forEach(id => {
            if (id !== this.myId) {
                promises.push(
                    this.apiCall('POST', this.roomCode, {
                        type: 'game-message',
                        from: this.myId,
                        to: id,
                        data: data
                    }).catch(e => console.error('Broadcast error:', e))
                );
            }
        });
        await Promise.all(promises);
    },

    async disconnect() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        if (this.roomCode && this.myId) {
            try {
                await this.apiCall('POST', this.roomCode, {
                    type: 'leave',
                    peerId: this.myId
                });
            } catch (e) {}
        }

        this.isHost = false;
        this.hostId = null;
        this.roomCode = null;
        this.myName = null;
        this.myId = null;
        this.players = {};
    },

    getConnectedPlayerCount() {
        return Object.keys(this.players).length - 1;
    }
};
