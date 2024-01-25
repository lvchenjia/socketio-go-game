// 生成一个随机的房间号
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// 初始化围棋棋盘
function initializeBoard(size = 9) {
    const board = [];
    for (let i = 0; i < size; i++) {
        board.push(new Array(size).fill(0));
    }
    return board;
}

// 检查是否为有效的落子位置
function makeMove(board, playerNumber, rowIndex, colIndex) {
    if (board[rowIndex][colIndex] !== 0) {
        return { isValid: false, errorMessage: '已经有棋子' };
    }

    // 尝试落子，如果落子后没有气，则为无效落子
    const newBoard = board.map((row) => [...row]);
    newBoard[rowIndex][colIndex] = playerNumber;
    let anotherPlayerNumber = playerNumber === 1 ? 2 : 1;
    // 这里先吃对方的棋子，再吃己方的棋子，用于处理打劫
    let { boardState: tmpBoardState, eatAnotherPlayer: eatAnotherPlayer } = removeOnePlayersPieces(newBoard, anotherPlayerNumber);
    let { boardState: newBoardState, eatAnotherPlayer: eatCurrentPlayer } = removeOnePlayersPieces(tmpBoardState, playerNumber);

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
                                    // 算法优化 退出 while 循环
                                    queue.length = 0;
                                    break
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
    return { boardState: newBoardState, eatAnotherPlayer: eat };
}

module.exports = { generateRoomCode, initializeBoard, makeMove, removeOnePlayersPieces };
