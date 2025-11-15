const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

// بيانات اللاعبين في الماب
let players = {};

// لما واحد يتصل بالسيرفر
io.on("connection", (socket) => {
  console.log("player connected:", socket.id);

  // لما اللاعب يرسل بياناته (موقعه)
  socket.on("updatePlayer", (data) => {
    // data = { x, y }
    players[socket.id] = data;
    // نرسل لكل اللاعبين قائمة اللاعبين
    io.emit("state", players);
  });

  // لما اللاعب يخرج
  socket.on("disconnect", () => {
    console.log("player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("state", players);
  });
});

http.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
