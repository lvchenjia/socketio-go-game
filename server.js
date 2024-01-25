const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { createRoom, joinRoom, move, disconnect } = require('./routes');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// 存储用户和房间信息的全局变量
const users = {};
const rooms = {};

// 处理新用户连接
io.on('connection', (socket) => {
  console.log('A user connected');

  // 路由处理
  createRoom(io, socket, users, rooms);
  joinRoom(io, socket, users, rooms);
  move(io, socket, users, rooms);
  disconnect(io, socket, users, rooms);
});

// 静态文件服务
app.use(express.static('public'));

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
