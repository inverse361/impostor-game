const PeerNetwork = {
    peer: null,
    connections: {},
    isHost: false,
    hostPeerId: null,
    roomCode: null,
    playerName: null,
    myId: null,
    connected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    
    callbacks: {
        onPlayerJoin: null,
        onPlayerLeave: null,
        onMessage: null,
        onConnectionError: null,
        onConnected: null,
        onDisconnected: null
    },
    
    iceConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.ekiga.net' },
            { urls: 'stun:stun.ideasip.com' },
            { urls: 'stun:stun.schlund.de' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.voipstunt.com' }
        ],
        iceCandidatePoolSize: 10
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
    
    createRoom(playerName) {
        return new Promise((resolve, reject) => {
            this.roomCode = this.generateRoomCode();
            this.isHost = true;
            this.playerName = playerName;
            this.connected = false;
            this.reconnectAttempts = 0;
            
            const peerId = `impostor-${this.roomCode}`;
            
            this.peer = new Peer(peerId, {
                debug: 1,
                config: this.iceConfig,
                retryMaxTimeout: 5000,
                retryTimeout: 1000
            });
            
            const timeout = setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Timeout - nie można połączyć z serwerem sygnalizacyjnym PeerJS'));
                }
            }, 15000);
            
            this.peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('Host utworzony, ID:', id);
                this.myId = id;
                this.connected = true;
                resolve(this.roomCode);
            });
            
            this.peer.on('connection', (conn) => {
                console.log('Nowe połączenie przychodzące:', conn.peer);
                this.handleIncomingConnection(conn);
            });
            
            this.peer.on('disconnected', () => {
                console.log('Rozłączono z serwerem PeerJS');
                this.tryReconnect();
            });
            
            this.peer.on('close', () => {
                console.log('Peer zamknięty');
                this.connected = false;
                if (this.callbacks.onDisconnected) {
                    this.callbacks.onDisconnected();
                }
            });
            
            this.peer.on('error', (err) => {
                clearTimeout(timeout);
                console.error('Błąd PeerJS:', err);
                if (err.type === 'unavailable-id') {
                    reject(new Error('Pokój o tym kodzie już istnieje. Spróbuj inny kod.'));
                } else if (err.type === 'network') {
                    reject(new Error('Błąd sieci. Sprawdź połączenie internetowe.'));
                } else if (err.type === 'peer-unavailable') {
                    console.log('Gracz już istnieje, pomijam...');
                } else {
                    reject(new Error(`Błąd połączenia: ${err.message || err.type}`));
                }
            });
        });
    },
    
    joinRoom(roomCode, playerName) {
        return new Promise((resolve, reject) => {
            this.roomCode = roomCode.toUpperCase();
            this.isHost = false;
            this.playerName = playerName;
            this.hostPeerId = `impostor-${this.roomCode}`;
            this.connected = false;
            this.reconnectAttempts = 0;
            
            this.peer = new Peer(null, {
                debug: 1,
                config: this.iceConfig,
                retryMaxTimeout: 5000,
                retryTimeout: 1000
            });
            
            const timeout = setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Timeout - nie można połączyć z serwerem. Sprawdź kod pokoju i połączenie internetowe.'));
                }
            }, 20000);
            
            this.peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('Klient dołączył, ID:', id);
                this.myId = id;
                
                this.connectToHost(resolve, reject, timeout);
            });
            
            this.peer.on('disconnected', () => {
                console.log('Rozłączono z serwerem PeerJS');
                this.tryReconnect();
            });
            
            this.peer.on('close', () => {
                console.log('Peer zamknięty');
                this.connected = false;
                if (this.callbacks.onDisconnected) {
                    this.callbacks.onDisconnected();
                }
            });
            
            this.peer.on('error', (err) => {
                clearTimeout(timeout);
                console.error('Błąd PeerJS klienta:', err);
                if (err.type === 'peer-unavailable') {
                    reject(new Error(`Nie znaleziono pokoju ${this.roomCode}. Sprawdź kod.`));
                } else if (err.type === 'network') {
                    reject(new Error('Błąd sieci. Sprawdź połączenie internetowe.'));
                } else {
                    reject(new Error(`Nie udało się dołączyć: ${err.message || err.type}`));
                }
            });
        });
    },
    
    connectToHost(resolve, reject, timeout) {
        let connAttempts = 0;
        const maxAttempts = 3;
        
        const tryConnect = () => {
            connAttempts++;
            console.log(`Próba połączenia z hostem (próba ${connAttempts}/${maxAttempts})...`);
            
            const conn = this.peer.connect(this.hostPeerId, {
                metadata: { name: this.playerName },
                reliable: true,
                serialization: 'json'
            });
            
            conn.on('open', () => {
                clearTimeout(timeout);
                console.log('Połączono z hostem!');
                this.connections['host'] = conn;
                this.setupConnection(conn, 'host');
                this.connected = true;
                
                if (this.callbacks.onConnected) {
                    this.callbacks.onConnected();
                }
                resolve();
            });
            
            conn.on('error', (err) => {
                console.error('Błąd połączenia z hostem:', err);
                if (connAttempts < maxAttempts) {
                    setTimeout(tryConnect, 2000);
                } else {
                    clearTimeout(timeout);
                    reject(new Error('Nie udało się połączyć z hostem. Pokój może nie istnieć.'));
                }
            });
            
            conn.on('close', () => {
                console.log('Połączenie z hostem zamknięte');
                delete this.connections['host'];
                this.connected = false;
                if (this.callbacks.onDisconnected) {
                    this.callbacks.onDisconnected();
                }
            });
        };
        
        tryConnect();
    },
    
    handleIncomingConnection(conn) {
        conn.on('open', () => {
            const playerName = conn.metadata?.name || 'Gracz';
            const playerId = conn.peer;
            
            console.log('Gracz połączony:', playerName, 'ID:', playerId);
            
            if (this.connections[playerId]) {
                console.log('Gracz już istnieje, pomijam');
                return;
            }
            
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
        
        conn.on('error', (err) => {
            console.error('Błąd połączenia z graczem:', conn.peer, err);
        });
    },
    
    setupConnection(conn, peerId) {
        conn.on('data', (data) => {
            if (this.callbacks.onMessage) {
                this.callbacks.onMessage(data, peerId);
            }
        });
        
        conn.on('close', () => {
            console.log('Połączenie zamknięte:', peerId);
            delete this.connections[peerId];
            
            if (this.callbacks.onPlayerLeave) {
                this.callbacks.onPlayerLeave(peerId);
            }
        });
        
        conn.on('error', (err) => {
            console.error('Błąd połączenia z', peerId, ':', err);
        });
    },
    
    tryReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Przekroczono maksymalną liczbę prób reconnect');
            if (this.callbacks.onDisconnected) {
                this.callbacks.onDisconnected();
            }
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`Próba reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        
        setTimeout(() => {
            if (this.peer && !this.peer.destroyed) {
                this.peer.reconnect();
            }
        }, 2000 * this.reconnectAttempts);
    },
    
    sendToHost(data) {
        if (this.connections['host'] && this.connections['host'].open) {
            try {
                this.connections['host'].send(data);
                return true;
            } catch (e) {
                console.error('Błąd wysyłania do hosta:', e);
                return false;
            }
        }
        console.warn('Brak połączenia z hostem');
        return false;
    },
    
    sendToPlayer(playerId, data) {
        if (this.connections[playerId] && this.connections[playerId].open) {
            try {
                this.connections[playerId].send(data);
                return true;
            } catch (e) {
                console.error('Błąd wysyłania do gracza:', playerId, e);
                return false;
            }
        }
        console.warn('Brak połączenia z graczem:', playerId);
        return false;
    },
    
    broadcastToClients(data) {
        let sent = 0;
        Object.entries(this.connections).forEach(([id, conn]) => {
            if (id !== 'host' && conn.open) {
                try {
                    conn.send(data);
                    sent++;
                } catch (e) {
                    console.error('Błąd broadcast do', id, ':', e);
                }
            }
        });
        console.log(`Wysłano do ${sent} klientów`);
        return sent;
    },
    
    broadcastToAll(data) {
        let sent = 0;
        Object.values(this.connections).forEach(conn => {
            if (conn.open) {
                try {
                    conn.send(data);
                    sent++;
                } catch (e) {
                    console.error('Błąd broadcast:', e);
                }
            }
        });
        return sent;
    },
    
    disconnect() {
        console.log('Rozłączanie...');
        
        Object.values(this.connections).forEach(conn => {
            try {
                conn.close();
            } catch (e) {}
        });
        
        this.connections = {};
        
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }
        
        this.peer = null;
        this.isHost = false;
        this.hostPeerId = null;
        this.roomCode = null;
        this.playerName = null;
        this.myId = null;
        this.connected = false;
    },
    
    getConnectedPlayerCount() {
        return Object.keys(this.connections).filter(id => id !== 'host').length;
    },
    
    isConnected() {
        return this.connected && this.peer && !this.peer.destroyed;
    }
};
