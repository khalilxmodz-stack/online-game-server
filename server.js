// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

// نخلي السيرفر يقدم ملفات ثابتة لو حبيت تحط اللعبة على نفس السيرفر (اختياري)
app.use(express.static("public"));

// بيانات اللاعبين في الماب
// players[id] = { x, y, name }
let players = {};

// لما واحد يتصل بالسيرفر
io.on("connection", (socket) => {
  console.log("player connected:", socket.id);

  // نضيفه في players بقيم افتراضية
  players[socket.id] = {
    x: 2000,
    y: 2000,
    name: "Guest"
  };

  // نرسل state مباشرًا للجميع
  io.emit("state", players);

  // لما اللاعب يرسل بياناته (موقعه + اسمه)
  socket.on("updatePlayer", (data) => {
    // data = { x, y, name }
    if (!players[socket.id]) {
      players[socket.id] = { x: 2000, y: 2000, name: "Guest" };
    }

    if (typeof data.x === "number") players[socket.id].x = data.x;
    if (typeof data.y === "number") players[socket.id].y = data.y;
    if (typeof data.name === "string" && data.name.trim() !== "") {
      players[socket.id].name = data.name.trim().slice(0, 20); // نحدد طول الاسم
    }

    // نرسل لكل اللاعبين قائمة اللاعبين
    io.emit("state", players);
  });

  // استقبال رسالة دردشة من لاعب
  socket.on("chatMessage", (msg) => {
    const text = (msg || "").toString().slice(0, 300);
    const name = players[socket.id]?.name || "Guest";

    // نرسل الرسالة لكل اللاعبين
    io.emit("chatMessage", {
      id: socket.id,
      name,
      msg: text
    });
  });

  // لما اللاعب يخرج
  socket.on("disconnect", () => {
    console.log("player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("state", players);
  });
});

// تشغيل السيرفر
http.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

// By Khalil Xmodz

// By Khalil Xmodz
