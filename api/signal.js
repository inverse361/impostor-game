const SUPABASE_URL = 'https://qaqigfbuaxycmgxwmpld.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcWlnZmJ1YXh5Y21neHdtcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2Nzg1NTYsImV4cCI6MjEwMzI1NDU1Nn0.VtpR16-Hlau6C-sUClLPy8tok9Xl4LmPgVB8_qM-7Zs';

const defaultHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function sbGet(table, query) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        headers: { ...defaultHeaders }
    });
    return res.json();
}

async function sbPost(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
}

async function sbDelete(table, query) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
        method: 'DELETE',
        headers: { ...defaultHeaders, 'Prefer': 'return=minimal' }
    });
    if (!res.ok) throw new Error(await res.text());
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { room } = req.query;
        if (!room) return res.status(400).json({ error: 'Missing room' });

        const code = room.toUpperCase();

        if (req.method === 'GET') {
            const since = parseInt(req.query.since) || 0;
            const msgs = await sbGet('messages',
                `?select=payload&room_code=eq.${code}&ts=gt.${since}&order=ts.asc`
            );
            return res.status(200).json({ messages: Array.isArray(msgs) ? msgs : [] });
        }

        if (req.method === 'POST') {
            const body = req.body;

            if (body.type === 'create') {
                await sbDelete('messages', `?room_code=eq.${code}`);
                await sbDelete('rooms', `?code=eq.${code}`);
                await sbPost('rooms', {
                    code: code,
                    host_peer_id: body.peerId,
                    created_at: Date.now()
                });
                return res.status(200).json({ ok: true });
            }

            if (body.type === 'join') {
                const rooms = await sbGet('rooms', `?code=eq.${code}&select=host_peer_id`);
                if (!rooms.length) return res.status(404).json({ error: 'Pokój nie istnieje' });
                await sbPost('messages', {
                    room_code: code,
                    ts: Date.now(),
                    payload: body
                });
                return res.status(200).json({ ok: true, host: rooms[0].host_peer_id });
            }

            if (body.type === 'signal' || body.type === 'game-message') {
                await sbPost('messages', {
                    room_code: code,
                    ts: Date.now(),
                    payload: body
                });
                return res.status(200).json({ ok: true });
            }

            if (body.type === 'leave') {
                await sbPost('messages', {
                    room_code: code,
                    ts: Date.now(),
                    payload: { type: 'player-left', peerId: body.peerId }
                });
                return res.status(200).json({ ok: true });
            }

            return res.status(400).json({ error: 'Unknown type' });
        }

        if (req.method === 'DELETE') {
            await sbDelete('messages', `?room_code=eq.${code}`);
            await sbDelete('rooms', `?code=eq.${code}`);
            return res.status(200).json({ ok: true });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}
