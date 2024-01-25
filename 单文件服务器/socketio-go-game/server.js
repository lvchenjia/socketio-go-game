const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

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

  // 处理用户创建房间请求
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
      lastMove: [-1,-1],
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

  // 处理用户加入房间请求
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

  // 处理用户下棋请求
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

    // console.log(room.boardState);
    // const { isValid, newBoardState, eatAnotherPlayer, eatCurrentPlayer, errorMessage } = makeMove(
    //   room.boardState,
    //   playerNum,
    //   rowIndex,
    //   colIndex
    // );

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

  // 处理用户断开连接
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
});

// 生成一个随机的房间号
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// 初始化一个19*19的围棋棋盘
function initializeBoard(size = 9) {
  const board = [];
  for (let i = 0; i < size; i++) {
    board.push(new Array(size).fill(0));
  }
  return board;
}

// // 检查是否为有效的落子位置
function makeMove(board, playerNumber, rowIndex, colIndex) {
  if (board[rowIndex][colIndex] !== 0) {
    return { isValid: false, errorMessage: '已经有棋子' };
  }

  // 尝试落子，如果落子后没有气，则为无效落子
  const newBoard = board.map((row) => [...row]);
  newBoard[rowIndex][colIndex] = playerNumber;
  let anotherPlayerNumber = playerNumber === 1 ? 2 : 1;
  // 这里先吃对方的棋子，再吃己方的棋子，用于处理打劫
  let {boardState: tmpBoardState, eatAnotherPlayer: eatAnotherPlayer} = removeOnePlayersPieces(newBoard, anotherPlayerNumber);
  let {boardState: newBoardState, eatAnotherPlayer: eatCurrentPlayer} = removeOnePlayersPieces(tmpBoardState, playerNumber);

  if (newBoardState[rowIndex][colIndex] === 0) {
    return { isValid: false, errorMessage: '没有气' };
  }

  return { isValid: true, boardState: newBoardState, eatAnotherPlayer: eatAnotherPlayer, eatCurrentPlayer: eatCurrentPlayer };
}


function removeOnePlayersPieces(boardState, playerNumber) {
  const newBoardState = boardState.map((row) => [...row]);
  const size = boardState.length;

  // 存储需要删除的棋子坐标
  const piecesToRemove = [];

  // 检查每个棋子的气
  for (let rowIndex = 0; rowIndex < size; rowIndex++) {
    for (let colIndex = 0; colIndex < size; colIndex++) {
      if (newBoardState[rowIndex][colIndex] !== 0) {
        // const playerNumber = newBoardState[rowIndex][colIndex];
        if (newBoardState[rowIndex][colIndex] !== playerNumber) {
          continue;
        }
        const visited = initializeBoard(size);
        const queue = [[rowIndex, colIndex]];
        let hasLiberty = false;

        while (queue.length > 0) {
          const [row, col] = queue.shift();
          visited[row][col] = true;

          // 检查上下左右四个方向
          const directions = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1],
          ];

          for (const [nextRow, nextCol] of directions) {
            // 如果下一个位置在棋盘内
            if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) {
              // 如果下一个位置没有被访问过
              if (!visited[nextRow][nextCol]) {
                // 如果下一个位置为空
                if (newBoardState[nextRow][nextCol] === 0) {
                  hasLiberty = true;
                }
                // 如果下一个位置有棋子且为同一玩家的棋子
                else if (newBoardState[nextRow][nextCol] === playerNumber) {
                  queue.push([nextRow, nextCol]);
                }
              }
            }
          }
        }

        // 如果没有气，将该棋子坐标存入 piecesToRemove 数组
        if (!hasLiberty) {
          piecesToRemove.push([rowIndex, colIndex]);
        }
      }
    }
  }

  // 删除 piecesToRemove 中的棋子
  for (const [row, col] of piecesToRemove) {
    newBoardState[row][col] = 0;
  }

  let eat = piecesToRemove.length;
  return {boardState: newBoardState, eatAnotherPlayer: eat};
}

// app.get('/', (req, res) => {
//   res.sendFile(__dirname + '/index.html');
// });

// app.get('/client.js', (req, res) => {
//   res.sendFile(__dirname + '/client.js');
// });

// get file from public folder
app.use(express.static('public'));

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

