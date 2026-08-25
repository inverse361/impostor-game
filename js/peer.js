const PeerNetwork = {
    peer: null,
    connections: {},
    isHost: false,
    hostPeerId: null,
    roomCode: null,
    playerName: null,
    
    callbacks: {
        onPlayerJoin: null,
        onPlayerLeave: null,
        onMessage: null,
        onConnectionError: null,
        onConnected: null
    },
    
    init(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    },
    
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },
    
    createRoom(playerName) {
        return new Promise((resolve, reject) => {
            this.roomCode = this.generateRoomCode();
            this.isHost = true;
            this.playerName = playerName;
            
            this.peer = new Peer(`impostor-${this.roomCode}`);
            
            this.peer.on('open', (id) => {
                console.log('Host created with ID:', id);
                resolve(this.roomCode);
            });
            
            this.peer.on('connection', (conn) => {
                console.log('Incoming connection from:', conn.peer);
                this.handleIncomingConnection(conn);
            });
            
            this.peer.on('error', (err) => {
                console.error('Host peer error:', err);
                if (this.callbacks.onConnectionError) {
                    this.callbacks.onConnectionError(err);
                }
                reject(err);
            });
        });
    },
    
    joinRoom(roomCode, playerName) {
        return new Promise((resolve, reject) => {
            this.roomCode = roomCode.toUpperCase();
            this.isHost = false;
            this.playerName = playerName;
            this.hostPeerId = `impostor-${this.roomCode}`;
            
            this.peer = new Peer();
            
            this.peer.on('open', (id) => {
                console.log('Client joined with ID:', id);
                
                const conn = this.peer.connect(this.hostPeerId, {
                    metadata: { name: playerName },
                    reliable: true
                });
                
                conn.on('open', () => {
                    console.log('Connected to host');
                    this.connections['host'] = conn;
                    this.setupConnection(conn, 'host');
                    
                    if (this.callbacks.onConnected) {
                        this.callbacks.onConnected();
                    }
                    resolve();
                });
                
                conn.on('error', (err) => {
                    console.error('Connection to host error:', err);
                    reject(err);
                });
            });
            
            this.peer.on('error', (err) => {
                console.error('Client peer error:', err);
                if (this.callbacks.onConnectionError) {
                    this.callbacks.onConnectionError(err);
                }
                reject(err);
            });
        });
    },
    
    handleIncomingConnection(conn) {
        conn.on('open', () => {
            const playerName = conn.metadata?.name || 'Gracz';
            const playerId = conn.peer;
            
            console.log('Player connected:', playerName, 'ID:', playerId);
            
            this.connections[playerId] = conn;
            this.setupConnection(conn, playerId);
            
            if (this.callbacks.onPlayerJoin) {
                this.callbacks.onPlayerJoin({
                    id: playerId,
                    name: playerName,
                    conn: conn
                });
            }
        });
    },
    
    setupConnection(conn, peerId) {
        conn.on('data', (data) => {
            if (this.callbacks.onMessage) {
                this.callbacks.onMessage(data, peerId);
            }
        });
        
        conn.on('close', () => {
            console.log('Connection closed:', peerId);
            delete this.connections[peerId];
            
            if (this.callbacks.onPlayerLeave) {
                this.callbacks.onPlayerLeave(peerId);
            }
        });
        
        conn.on('error', (err) => {
            console.error('Connection error with', peerId, ':', err);
        });
    },
    
    sendToHost(data) {
        if (this.connections['host'] && this.connections['host'].open) {
            this.connections['host'].send(data);
        }
    },
    
    sendToPlayer(playerId, data) {
        if (this.connections[playerId] && this.connections[playerId].open) {
            this.connections[playerId].send(data);
        }
    },
    
    broadcastToClients(data) {
        Object.entries(this.connections).forEach(([id, conn]) => {
            if (id !== 'host' && conn.open) {
                try {
                    conn.send(data);
                } catch (e) {
                    console.error('Error sending to', id, ':', e);
                }
            }
        });
    },
    
    broadcastToAll(data) {
        Object.values(this.connections).forEach(conn => {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (e) {
                    console.error('Error broadcasting:', e);
                }
            }
        });
    },
    
    disconnect() {
        Object.values(this.connections).forEach(conn => {
            try {
                conn.close();
            } catch (e) {}
        });
        
        this.connections = {};
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.isHost = false;
        this.hostPeerId = null;
        this.roomCode = null;
        this.playerName = null;
    },
    
    getConnectedPlayerCount() {
        return Object.keys(this.connections).filter(id => id !== 'host').length;
    }
};
