const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());

// ===== قاعدة بيانات مؤقتة (في الذاكرة) =====
const accounts = {}; // username -> { passwordHash, coins, xp }
const rooms = {};    // roomName -> { players: {} }

// ===== APIs تسجيل دخول / إنشاء حساب =====
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'مطلوب اسم وكلمة سر' });
    if (accounts[username]) return res.status(400).json({ error: 'الاسم موجود بالفعل' });
    const hash = await bcrypt.hash(password, 10);
    accounts[username] = { passwordHash: hash, coins: 100, xp: 0 };
    res.json({ success: true });
});

app.post('/login', async (req,res)=>{
    const { username, password } = req.body;
    const acc = accounts[username];
    if (!acc) return res.status(400).json({ error: 'الحساب غير موجود' });
    const ok = await bcrypt.compare(password, acc.passwordHash);
    if (!ok) return res.status(400).json({ error: 'كلمة السر خاطئة' });
    res.json({ success: true, coins: acc.coins, xp: acc.xp });
});

// ===== Socket.io للغرف =====
io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomName, username }) => {
        if (!rooms[roomName]) rooms[roomName] = { players: {} };
        const room = rooms[roomName];

        room.players[socket.id] = {
            id: socket.id,
            username,
            x: Math.random()*5000,
            y: Math.random()*5000,
            hp: 100,
            kills:0,
            coins: accounts[username]?.coins || 100,
            xp: accounts[username]?.xp || 0,
            weapon: "Pistol"
        };
        socket.join(roomName);

        // إرسال كل اللاعبين الحاليين
        io.to(roomName).emit('state', room.players);

        socket.on('updatePlayer', (data)=>{
            const p = room.players[socket.id];
            if (!p) return;
            p.x = data.x; p.y = data.y;
            p.hp = data.hp;
            p.kills = data.kills;
            p.coins = data.coins;
            p.xp = data.xp;
            p.weapon = data.weapon;
            io.to(roomName).emit('state', room.players);
        });

        socket.on('shoot', (bullet)=>{
            // bullet: { x, y, dx, dy, dmg }
            for (const id in room.players) {
                if (id === socket.id) continue;
                const target = room.players[id];
                const dist = Math.hypot(target.x - bullet.x, target.y - bullet.y);
                if (dist < 25) {
                    // KhalilXmodz GodMode
                    if (target.username === "KhalilXmodz") continue;

                    target.hp -= bullet.dmg;
                    if (target.hp <= 0) {
                        target.hp = 0;
                        room.players[socket.id].kills +=1;
                        room.players[socket.id].xp += 10;
                        room.players[socket.id].coins += 20;
                    }
                }
            }
            io.to(roomName).emit('state', room.players);
        });

        socket.on('disconnect', ()=>{
            delete room.players[socket.id];
            io.to(roomName).emit('state', room.players);
        });
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
