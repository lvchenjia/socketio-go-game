document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const usernameInput = document.getElementById('usernameInput');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const gameBoard = document.getElementById('gameBoard');
  const messagesDiv = document.getElementById('messages');

  const turnDiv = document.getElementById('turn');
  const roomDiv = document.getElementById('room');
  const infoDiv = document.getElementById('info');
  const scoreDiv = document.getElementById('score');

  let username;
  let roomCode;

  // 监听连接成功事件
  socket.on('connect', () => {
    console.log('Connected to server');
  });

  // 监听房间更新事件
  socket.on('updateRoom', (room) => {
    // current player
    if (room.gameState !== 'inProgress') {
      turnDiv.textContent = '未在游戏中';
      return;
    }
    let anotherPlayer = (room.player1 === username) ? room.player2 : room.player1;
    let currentPlayerName = (room.currentPlayer === 1) ? room.player1 : room.player2;
    if (currentPlayerName === username) {
      turnDiv.textContent = '我方执子';
    } else {
      turnDiv.textContent = '对方(' + anotherPlayer + ')执子';
    }
    infoDiv.textContent = '';

    // score
    let p1Eat = room.p1Eat;
    let p2Eat = room.p2Eat;
    scoreDiv.textContent = '黑方吃' + p1Eat + '子，白方吃' + p2Eat + '子';

    // last move
    let lastMove = room.lastMove;
    updateGameBoard(room.boardState, lastMove);
    updateMessages('Room updated: ' + JSON.stringify(room));
  });

  // 监听加入房间失败事件
  socket.on('joinRoomFailed', (message) => {
    updateMessages('Join room failed: ' + message);
  });

  // 监听房间号事件
  socket.on('roomCode', (code) => {
    roomDiv.textContent = '房间号：' + code;
    roomCode = code;
    updateMessages('Room created! Your room code is: ' + code);
  });

  // 落子失败
  socket.on('makeMoveFailed', (message) => {
    infoDiv.textContent = '不能落子：' + message;
    updateMessages('Make move failed: ' + message);
  });

  // 创建房间
  window.createRoom = () => {
    username = usernameInput.value.trim();
    if (username === '') {
      alert('Please enter a valid username');
      return;
    }

    socket.emit('createRoom', username);
  };

  // 加入房间
  window.joinRoom = () => {
    username = usernameInput.value.trim();
    roomCode = roomCodeInput.value.trim().toUpperCase();

    if (username === '' || roomCode === '') {
      alert('Please enter both username and room code');
      return;
    }

    socket.emit('joinRoom', { username, roomCode });
  };

  // 更新游戏棋盘
  function updateGameBoard(boardState, lastMove) {
    gameBoard.innerHTML = '';

    for (let i = 0; i < boardState.length; i++) {
      for (let j = 0; j < boardState[i].length; j++) {
        const cell = document.createElement('div');
        
        // cell.className = 'cell';
        if (lastMove && lastMove[0] === i && lastMove[1] === j) {
          cell.className = 'cell-last-move';
        } else {
          cell.className = 'cell';
        }
        cell.dataset.row = i;
        cell.dataset.col = j;
        cell.textContent = getPlayerSymbol(boardState[i][j]);
        cell.addEventListener('click', () => makeMove(i, j));

        gameBoard.appendChild(cell);
      }
    }
  }


  // 更新消息
  function updateMessages(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }


  // 根据玩家编号获取玩家符号
  function getPlayerSymbol(playerNumber) {
    if (playerNumber === 1) {
      return '●'; // Black stone
    } else if (playerNumber === 2) {
      return '○'; // White stone
    } else {
      return '';
    }
  }

  // 处理用户下棋
  function makeMove(rowIndex, colIndex) {
    socket.emit('makeMove', { roomCode, rowIndex, colIndex });
  }
});
