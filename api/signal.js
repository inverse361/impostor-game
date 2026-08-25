const rooms = {};

function cleanup() {
    const now = Date.now();
    for (const code in rooms) {
        if (now - rooms[code].createdAt > 3600000) {
            delete rooms[code];
        }
    }
}

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    cleanup();

    const { room } = req.query;
    if (!room) {
        return res.status(400).json({ error: 'Brak parametru room' });
    }

    const code = room.toUpperCase();

    if (req.method === 'GET') {
        if (!rooms[code]) {
            return res.status(404).json({ error: 'Pokój nie istnieje' });
        }
        const r = rooms[code];
        const since = parseInt(req.query.since) || 0;
        const messages = r.messages.filter(m => m.ts > since);
        return res.status(200).json({ messages, host: r.host ? true : false });
    }

    if (req.method === 'POST') {
        const body = req.body;
        if (!rooms[code]) {
            rooms[code] = { createdAt: Date.now(), messages: [], host: null, players: [] };
        }
        const r = rooms[code];

        if (body.type === 'create') {
            r.host = body.peerId;
            r.players = [{ peerId: body.peerId, name: body.name }];
            return res.status(200).json({ ok: true });
        }

        if (body.type === 'join') {
            r.messages.push({ ts: Date.now(), ...body });
            r.players.push({ peerId: body.peerId, name: body.name });
            return res.status(200).json({ ok: true, host: r.host });
        }

        if (body.type === 'signal') {
            r.messages.push({ ts: Date.now(), ...body });
            return res.status(200).json({ ok: true });
        }

        if (body.type === 'leave') {
            r.players = r.players.filter(p => p.peerId !== body.peerId);
            r.messages.push({ ts: Date.now(), type: 'player-left', peerId: body.peerId });
            if (r.players.length === 0) {
                delete rooms[code];
            }
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Nieznany typ' });
    }

    if (req.method === 'DELETE') {
        delete rooms[code];
        return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
