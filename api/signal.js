const SUPABASE_URL = 'https://qaqigfbuaxycmgxwmpld.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcWlnZmJ1YXh5Y21neHdtcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2Nzg1NTYsImV4cCI6MjEwMzI1NDU1Nn0.VtpR16-Hlau6C-sUClLPy8tok9Xl4LmPgVB8_qM-7Zs';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function supabaseQuery(table, method, params = '', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase error: ${err}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { room } = req.query;
        if (!room) {
            return res.status(400).json({ error: 'Brak parametru room' });
        }
        const code = room.toUpperCase();

        if (req.method === 'GET') {
            const since = parseInt(req.query.since) || 0;

            const msgs = await supabaseQuery(
                'messages',
                'GET',
                `?room_code=eq.${code}&ts=gt.${since}&order=ts.asc`
            );

            return res.status(200).json({ messages: msgs.map(m => m.payload) });
        }

        if (req.method === 'POST') {
            const body = req.body;

            if (body.type === 'create') {
                const existing = await supabaseQuery(
                    'rooms',
                    'GET',
                    `?code=eq.${code}&select=code`
                );

                if (existing.length > 0) {
                    await supabaseQuery('rooms', 'DELETE', `?code=eq.${code}`);
                    await supabaseQuery('messages', 'DELETE', `?room_code=eq.${code}`);
                }

                await supabaseQuery('rooms', 'POST', '', {
                    code: code,
                    host_peer_id: body.peerId,
                    created_at: Date.now()
                });

                return res.status(200).json({ ok: true });
            }

            if (body.type === 'join') {
                const roomCheck = await supabaseQuery(
                    'rooms',
                    'GET',
                    `?code=eq.${code}&select=host_peer_id`
                );

                if (roomCheck.length === 0) {
                    return res.status(404).json({ error: 'Pokój nie istnieje' });
                }

                await supabaseQuery('messages', 'POST', '', {
                    room_code: code,
                    ts: Date.now(),
                    payload: body
                });

                return res.status(200).json({ ok: true, host: roomCheck[0].host_peer_id });
            }

            if (body.type === 'signal') {
                await supabaseQuery('messages', 'POST', '', {
                    room_code: code,
                    ts: Date.now(),
                    payload: body
                });

                return res.status(200).json({ ok: true });
            }

            if (body.type === 'leave') {
                await supabaseQuery('messages', 'POST', '', {
                    room_code: code,
                    ts: Date.now(),
                    payload: { type: 'player-left', peerId: body.peerId }
                });

                const msgs = await supabaseQuery(
                    'messages',
                    'GET',
                    `?room_code=eq.${code}&payload->>type=eq.join`
                );

                const joinPlayers = msgs.filter(m => m.payload.peerId !== body.peerId);

                if (joinPlayers.length === 0) {
                    await supabaseQuery('messages', 'DELETE', `?room_code=eq.${code}`);
                    await supabaseQuery('rooms', 'DELETE', `?code=eq.${code}`);
                }

                return res.status(200).json({ ok: true });
            }

            return res.status(400).json({ error: 'Nieznany typ' });
        }

        if (req.method === 'DELETE') {
            await supabaseQuery('messages', 'DELETE', `?room_code=eq.${code}`);
            await supabaseQuery('rooms', 'DELETE', `?code=eq.${code}`);
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('API Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
