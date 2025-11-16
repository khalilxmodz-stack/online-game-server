// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// optional: serve a public folder if you host frontend on same server
app.use(express.static("public"));

// game state
let players = {}; // id -> { x,y,name,coins,features }
let coins = {};   // coinId -> { id, x, y }
let coinCounter = 0;

// utility: spawn initial coins
function spawnCoin(x,y){
  const id = 'c'+(coinCounter++);
  coins[id] = { id, x, y };
}

function randomMapPos(){
  return {
    x: Math.floor(Math.random()*4000),
    y: Math.floor(Math.random()*4000)
  };
}

// spawn some coins at start
for(let i=0;i<30;i++){
  const p = randomMapPos();
  spawnCoin(p.x, p.y);
}

// broadcast helper
function broadcastState(){
  io.emit('state', players);
  io.emit('coinsState', Object.values(coins));
}

io.on('connection', (socket) => {
  console.log('player connected', socket.id);
  // add player with default values
  players[socket.id] = { x:2000, y:2000, name:'Guest', coins:0, features:{} };

  // send initial state to everyone
  broadcastState();

  // updatePlayer from client
  socket.on('updatePlayer', (data) => {
    if(!players[socket.id]) players[socket.id] = { x:2000, y:2000, name:'Guest', coins:0, features:{} };
    if(typeof data.x === 'number') players[socket.id].x = data.x;
    if(typeof data.y === 'number') players[socket.id].y = data.y;
    if(typeof data.name === 'string' && data.name.trim() !== '') players[socket.id].name = data.name.trim().slice(0,24);
    // publish to others (lightweight)
    io.emit('state', players);
  });

  // chat
  socket.on('chatMessage', (msg) => {
    const text = (msg || '').toString().slice(0,300);
    const name = players[socket.id]?.name || 'Guest';
    io.emit('chatMessage', { id: socket.id, name, msg: text });
  });

  // collect coin request
  socket.on('collectCoin', (data) => {
    const coinId = data && data.coinId;
    if(!coinId || !coins[coinId]) return;
    const coin = coins[coinId];
    const pl = players[socket.id];
    if(!pl) return;
    const dx = coin.x - pl.x, dy = coin.y - pl.y;
    const dist = Math.hypot(dx, dy);
    // server-side validation: only allow collect if within threshold
    if(dist <= 48){ // reachable distance
      // give coin
      pl.coins = (pl.coins || 0) + 1;
      // remove coin
      delete coins[coinId];
      // spawn a replacement coin somewhere else after short delay
      setTimeout(() => {
        const p = randomMapPos();
        spawnCoin(p.x, p.y);
        // broadcast new coins state
        io.emit('coinsState', Object.values(coins));
      }, 900); // respawn delay
      // notify and broadcast updated player state
      io.emit('coinCollected', { coinId, byId: socket.id, newCoins: pl.coins });
      io.emit('state', players);
    }
  });

  // buy feature request
  socket.on('buyFeature', (obj) => {
    const feature = obj && obj.feature;
    const cost = typeof obj.cost === 'number' ? obj.cost : 0;
    const pl = players[socket.id];
    if(!pl) return;
    if(pl.coins >= cost){
      // apply feature (simple: support 'speed')
      pl.coins -= cost;
      if(!pl.features) pl.features = {};
      if(feature === 'speed'){
        pl.features.speed = true;
        // optional: set timeout for temporary boost (e.g., 60s)
        setTimeout(() => {
          if(players[socket.id]) {
            players[socket.id].features.speed = false;
            io.emit('state', players);
          }
        }, 60000); // 60 seconds
      } else {
        pl.features[feature] = true;
      }
      io.emit('buyResult', { ok:true, feature, newCoins: pl.coins });
      io.emit('state', players);
    } else {
      io.emit('buyResult', { ok:false, reason:'لا يوجد عملات كافية' });
    }
  });

  socket.on('disconnect', () => {
    console.log('player disconnected', socket.id);
    delete players[socket.id];
    io.emit('state', players);
  });
});

// periodic broadcast to keep clients in sync
setInterval(() => {
  io.emit('state', players);
  io.emit('coinsState', Object.values(coins));
}, 800);

http.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
