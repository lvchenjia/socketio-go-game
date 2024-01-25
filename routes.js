const { generateRoomCode, initializeBoard, makeMove, removeOnePlayersPieces } = require('./game');

function createRoom(io, socket, users, rooms) {
  socket.on('createRoom', (username) => {
    const roomCode = generateRoomCode();
    const room = {
      player1: username,
      player2: null,
      currentPlayer: 1,
      gameState: 'waiting',
      boardState: initializeBoard(),
      p1Eat: 0,
      p2Eat: 0,
      lastMove: [-1, -1],
    };

    rooms[roomCode] = room;

    // 将用户添加到房间
    socket.join(roomCode);
    users[socket.id] = { username, roomCode };

    console.log('Room created: ' + roomCode);

    // 通知客户端更新房间信息
    io.to(roomCode).emit('updateRoom', room);

    // 向当前用户发送房间号
    socket.emit('roomCode', roomCode);
  });
}

function joinRoom(io, socket, users, rooms) {
  socket.on('joinRoom', (data) => {
    console.log('Join room request: ' + JSON.stringify(data));
    const { username, roomCode } = data;
    let room = rooms[roomCode];

    if (!room){
      socket.emit('joinRoomFailed', '房间不存在');
      return;
    }

    if (room.gameState === 'inProgress'){
      socket.emit('joinRoomFailed', '游戏已经开始');
      return;
    }

    if (room.player1 === username || room.player2 === username){
      socket.emit('joinRoomFailed', '你已经在房间中');
      return;
    }

    if (room.player1 !== null && room.player2 !== null){
      socket.emit('joinRoomFailed', '房间已满');
      return;
    }

    if (room.player1 === null){
      socket.join(roomCode);
      users[socket.id] = { username, roomCode };
      room.player1 = username;
    }else if (room.player2 === null){
      socket.join(roomCode);
      users[socket.id] = { username, roomCode };
      room.player2 = username;
    }

    if (room.player1 !== null && room.player2 !== null){
      room.gameState = 'inProgress';
    }

    io.to(roomCode).emit('updateRoom', room);
  });
}

function move(io, socket, users, rooms) {
  socket.on('makeMove', (data) => {
    const { roomCode, rowIndex, colIndex } = data;
    if(!users[socket.id]){
      socket.emit('makeMoveFailed', '你不在房间中');
      return;
    }
    const makeMovePlayer = users[socket.id].username;
    const room = rooms[roomCode];
    const player1 = room.player1;
    const player2 = room.player2;
    const playerNum = room.currentPlayer;

    let makeMovePlayerNum;
    if (makeMovePlayer === player1){
      makeMovePlayerNum = 1;
    }else if (makeMovePlayer === player2){
      makeMovePlayerNum = 2;
    }else{
      socket.emit('makeMoveFailed', '你不在房间中');
      return;
    }

    // 错误处理
    if (!room) {
      socket.emit('makeMoveFailed', '房间不存在');
      return;
    }
    if (room.gameState !== 'inProgress') {
      socket.emit('makeMoveFailed', '游戏不在进行中');
      return;
    }
    if (room.currentPlayer !== makeMovePlayerNum) {
      socket.emit('makeMoveFailed', '没轮到你！');
      return;
    }

    const { isValid: isValid, boardState: newBoardState, eatAnotherPlayer: eatAnotherPlayer, eatCurrentPlayer: eatCurrentPlayer, errorMessage: errorMessage } = makeMove(
      room.boardState,
      playerNum,
      rowIndex,
      colIndex
    );

    if (isValid) {
      // 更新棋盘状态
      room.boardState = newBoardState;

      // 切换当前玩家
      if (room.currentPlayer === 1) {
        room.currentPlayer = 2;
      } else {
        room.currentPlayer = 1;
      }

      // 更新吃子数
      if (playerNum === 1) {
        room.p1Eat += eatAnotherPlayer;
        room.p2Eat += eatCurrentPlayer;
      } else {
        room.p1Eat += eatCurrentPlayer;
        room.p2Eat += eatAnotherPlayer;
      }

      // 更新最后一步
      room.lastMove = [rowIndex, colIndex];
      
      // 通知客户端更新房间信息和棋盘状态
      io.to(roomCode).emit('updateRoom', room);
    }
    else {
      socket.emit('makeMoveFailed', errorMessage);
    }
  });
}

function disconnect(io, socket, users, rooms) {
  socket.on('disconnect', () => {
    console.log('A user disconnected');

    // 如果用户在房间中，更新房间信息并通知客户端
    if (users[socket.id]) {
      const { roomCode } = users[socket.id];
      
      if (rooms[roomCode]) {
        // 如果房间还存在，通知客户端更新房间信息
        if(rooms[roomCode].player1 === users[socket.id].username){
          rooms[roomCode].player1 = null;
          rooms[roomCode].gameState = 'waiting';
        }
        if(rooms[roomCode].player2 === users[socket.id].username){
          rooms[roomCode].player2 = null;
          rooms[roomCode].gameState = 'waiting';
        }
        io.to(roomCode).emit('updateRoom', rooms[roomCode]);
      }
      delete users[socket.id];
    }
  });
}

module.exports = { createRoom, joinRoom, move, disconnect };
