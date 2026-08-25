const PeerNetwork = {
    isHost: false,
    roomCode: null,
    myId: null,
    myName: null,
    hostId: null,
    connections: {},
    pollTimer: null,
    lastMessageTs: 0,
    iceConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
        ]
    },

    callbacks: {
        onPlayerJoin: null,
        onPlayerLeave: null,
        onMessage: null,
        onConnectionError: null,
        onConnected: null,
        onDisconnected: null
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
        return Math.random().toString(36).substr(2, 12);
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

        await this.connectToHost();
        this.startPolling();
    },

    async connectToHost() {
        const pc = new RTCPeerConnection(this.iceConfig);
        this.connections[this.hostId] = { pc, dataChannel: null, name: 'Host' };

        const dc = pc.createDataChannel('game', { ordered: true });
        this.connections[this.hostId].dataChannel = dc;

        dc.onopen = () => {
            console.log('Client: DataChannel OPEN z hostem');
            if (this.callbacks.onConnected) this.callbacks.onConnected();
        };

        dc.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (this.callbacks.onMessage) this.callbacks.onMessage(data, this.hostId);
        };

        dc.onclose = () => {
            console.log('Client: DataChannel CLOSE z hostem');
            if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
        };

        pc.onicecandidate = async (e) => {
            if (e.candidate) {
                await this.apiCall('POST', this.roomCode, {
                    type: 'signal',
                    signalType: 'ice-candidate',
                    from: this.myId,
                    to: this.hostId,
                    candidate: e.candidate.toJSON()
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('Client connection state:', pc.connectionState);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await this.apiCall('POST', this.roomCode, {
            type: 'signal',
            signalType: 'offer',
            from: this.myId,
            to: this.hostId,
            name: this.myName,
            offer: pc.localDescription.toJSON()
        });

        await this.waitForAnswer();
    },

    async waitForAnswer() {
        const start = Date.now();
        while (Date.now() - start < 20000) {
            const data = await this.apiCall('GET', this.roomCode, { since: this.lastMessageTs || 0 });
            if (data.messages) {
                for (const msg of data.messages) {
                    if (msg.ts && msg.ts > this.lastMessageTs) this.lastMessageTs = msg.ts;
                    if (msg.signalType === 'answer' && msg.to === this.myId) {
                        const conn = this.connections[this.hostId];
                        if (conn) {
                            await conn.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                            return;
                        }
                    }
                    if (msg.signalType === 'ice-candidate' && msg.to === this.myId) {
                        const conn = this.connections[msg.from];
                        if (conn && conn.pc) {
                            await conn.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                        }
                    }
                }
            }
            await new Promise(r => setTimeout(r, 800));
        }
        throw new Error('Timeout - nie otrzymano odpowiedzi od hosta');
    },

    async handleOffer(msg) {
        const peerId = msg.from;
        const playerName = msg.name;

        if (this.connections[peerId]) return;

        const pc = new RTCPeerConnection(this.iceConfig);
        const conn = { pc, dataChannel: null, name: playerName };
        this.connections[peerId] = conn;

        pc.ondatachannel = (event) => {
            console.log('Host: otrzymano DataChannel od:', playerName);
            const dc = event.channel;
            conn.dataChannel = dc;

            dc.onopen = () => {
                console.log('Host: DataChannel OPEN z:', playerName);
                if (this.callbacks.onPlayerJoin) {
                    this.callbacks.onPlayerJoin({ id: peerId, name: playerName });
                }
            };

            dc.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (this.callbacks.onMessage) this.callbacks.onMessage(data, peerId);
            };

            dc.onclose = () => {
                console.log('Host: DataChannel CLOSE z:', playerName);
                delete this.connections[peerId];
                if (this.callbacks.onPlayerLeave) this.callbacks.onPlayerLeave(peerId);
            };
        };

        pc.onicecandidate = async (e) => {
            if (e.candidate) {
                await this.apiCall('POST', this.roomCode, {
                    type: 'signal',
                    signalType: 'ice-candidate',
                    from: this.myId,
                    to: peerId,
                    candidate: e.candidate.toJSON()
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Host: connection state z ${playerName}:`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                delete this.connections[peerId];
                if (this.callbacks.onPlayerLeave) this.callbacks.onPlayerLeave(peerId);
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await this.apiCall('POST', this.roomCode, {
            type: 'signal',
            signalType: 'answer',
            from: this.myId,
            to: peerId,
            answer: pc.localDescription.toJSON()
        });
    },

    async handleIceCandidate(msg) {
        const conn = this.connections[msg.from];
        if (conn && conn.pc && msg.candidate) {
            try {
                await conn.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
                console.warn('Błąd dodawania ICE candidate:', e);
            }
        }
    },

    async handlePlayerLeft(msg) {
        const peerId = msg.peerId;
        const conn = this.connections[peerId];
        if (conn) {
            try { if (conn.dataChannel) conn.dataChannel.close(); } catch (e) {}
            try { if (conn.pc) conn.pc.close(); } catch (e) {}
            delete this.connections[peerId];
        }
        if (this.callbacks.onPlayerLeave) this.callbacks.onPlayerLeave(peerId);
    },

    startPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);

        this.pollTimer = setInterval(async () => {
            try {
                const data = await this.apiCall('GET', this.roomCode, { since: this.lastMessageTs || 0 });
                if (!data.messages) return;

                for (const msg of data.messages) {
                    if (msg.ts && msg.ts > this.lastMessageTs) this.lastMessageTs = msg.ts;

                    if (msg.type === 'signal') {
                        if (msg.signalType === 'offer' && this.isHost && msg.to === this.myId) {
                            await this.handleOffer(msg);
                        }
                        if (msg.signalType === 'answer' && !this.isHost && msg.to === this.myId) {
                            const conn = this.connections[this.hostId];
                            if (conn && conn.pc && !conn.pc.remoteDescription) {
                                await conn.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                            }
                        }
                        if (msg.signalType === 'ice-candidate' && msg.to === this.myId) {
                            await this.handleIceCandidate(msg);
                        }
                    }

                    if (msg.type === 'player-left') {
                        await this.handlePlayerLeft(msg);
                    }

                    if (msg.type === 'game-message') {
                        if (this.callbacks.onMessage) {
                            this.callbacks.onMessage(msg.data, msg.from);
                        }
                    }
                }
            } catch (e) {
                console.warn('Polling error:', e);
            }
        }, 1000);
    },

    sendToHost(data) {
        const conn = this.connections[this.hostId];
        if (conn && conn.dataChannel && conn.dataChannel.readyState === 'open') {
            conn.dataChannel.send(JSON.stringify(data));
            return true;
        }
        return false;
    },

    sendToPlayer(playerId, data) {
        const conn = this.connections[playerId];
        if (conn && conn.dataChannel && conn.dataChannel.readyState === 'open') {
            conn.dataChannel.send(JSON.stringify(data));
            return true;
        }
        return false;
    },

    broadcastToClients(data) {
        let sent = 0;
        Object.entries(this.connections).forEach(([id, conn]) => {
            if (id !== this.hostId && conn.dataChannel && conn.dataChannel.readyState === 'open') {
                try {
                    conn.dataChannel.send(JSON.stringify(data));
                    sent++;
                } catch (e) {
                    console.error('Błąd broadcast do', id, ':', e);
                }
            }
        });
        return sent;
    },

    async disconnect() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        Object.values(this.connections).forEach(c => {
            try { if (c.dataChannel) c.dataChannel.close(); } catch (e) {}
            try { if (c.pc) c.pc.close(); } catch (e) {}
        });

        this.connections = {};

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
    },

    getConnectedPlayerCount() {
        return Object.keys(this.connections).filter(id => id !== this.hostId).length;
    }
};
