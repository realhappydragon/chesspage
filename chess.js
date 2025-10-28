// Chess piece Unicode characters
const PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Piece values for AI evaluation
const PIECE_VALUES = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
    'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000
};

// Position bonus tables for AI evaluation
const PAWN_TABLE = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
];

const KING_TABLE = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
];

class ChessGame {
    constructor() {
        this.board = this.createInitialBoard();
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.playerColor = 'white';
        this.aiColor = 'black';
        this.gameOver = false;
        this.lastMove = null;
        this.enPassantTarget = null;
        this.aiElo = 1000; // Default AI Elo rating
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };

        this.initializeBoard();
        this.attachEventListeners();
    }

    createInitialBoard() {
        return [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];
    }

    initializeBoard() {
        const boardElement = document.getElementById('chessboard');
        boardElement.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                const piece = this.board[row][col];
                if (piece) {
                    square.textContent = PIECES[piece];
                    square.classList.add('piece');
                }

                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }

        this.updateUI();
    }

    handleSquareClick(row, col) {
        if (this.gameOver || this.currentTurn !== this.playerColor) return;

        const piece = this.board[row][col];

        if (this.selectedSquare) {
            const [selectedRow, selectedCol] = this.selectedSquare;
            const isValidMove = this.validMoves.some(
                move => move.row === row && move.col === col
            );

            if (isValidMove) {
                this.makeMove(selectedRow, selectedCol, row, col);
                this.selectedSquare = null;
                this.validMoves = [];
                this.renderBoard();

                if (!this.gameOver && this.currentTurn === this.aiColor) {
                    setTimeout(() => this.makeAIMove(), 500);
                }
            } else if (piece && this.getPieceColor(piece) === this.currentTurn) {
                this.selectSquare(row, col);
            } else {
                this.selectedSquare = null;
                this.validMoves = [];
                this.renderBoard();
            }
        } else if (piece && this.getPieceColor(piece) === this.currentTurn) {
            this.selectSquare(row, col);
        }
    }

    selectSquare(row, col) {
        this.selectedSquare = [row, col];
        this.validMoves = this.getValidMovesForPiece(row, col);
        this.renderBoard();
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        const isEnPassant = this.enPassantTarget &&
                           toRow === this.enPassantTarget.row &&
                           toCol === this.enPassantTarget.col &&
                           piece.toLowerCase() === 'p';

        // Record move
        const moveNotation = this.getMoveNotation(fromRow, fromCol, toRow, toCol);

        // Handle en passant capture
        if (isEnPassant) {
            const capturedRow = this.currentTurn === 'white' ? toRow + 1 : toRow - 1;
            const capturedPawn = this.board[capturedRow][toCol];
            this.board[capturedRow][toCol] = null;
            if (capturedPawn) {
                const captureColor = this.getPieceColor(capturedPawn) === 'white' ? 'black' : 'white';
                this.capturedPieces[captureColor].push(capturedPawn);
            }
        }

        // Handle castling
        if (piece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
            const rookFromCol = toCol > fromCol ? 7 : 0;
            const rookToCol = toCol > fromCol ? toCol - 1 : toCol + 1;
            this.board[toRow][rookToCol] = this.board[toRow][rookFromCol];
            this.board[toRow][rookFromCol] = null;
        }

        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // Handle pawn promotion
        if (piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7)) {
            this.board[toRow][toCol] = this.currentTurn === 'white' ? 'Q' : 'q';
        }

        // Update castling rights
        if (piece.toLowerCase() === 'k') {
            this.castlingRights[this.currentTurn].kingside = false;
            this.castlingRights[this.currentTurn].queenside = false;
        }
        if (piece.toLowerCase() === 'r') {
            if (fromCol === 0) this.castlingRights[this.currentTurn].queenside = false;
            if (fromCol === 7) this.castlingRights[this.currentTurn].kingside = false;
        }

        // Set en passant target
        this.enPassantTarget = null;
        if (piece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
            this.enPassantTarget = {
                row: this.currentTurn === 'white' ? fromRow - 1 : fromRow + 1,
                col: fromCol
            };
        }

        // Capture piece
        if (capturedPiece) {
            const captureColor = this.getPieceColor(capturedPiece) === 'white' ? 'black' : 'white';
            this.capturedPieces[captureColor].push(capturedPiece);
        }

        this.lastMove = { fromRow, fromCol, toRow, toCol };
        this.moveHistory.push({ moveNotation, piece, fromRow, fromCol, toRow, toCol, capturedPiece, board: JSON.parse(JSON.stringify(this.board)) });

        // Switch turns
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

        // Check for checkmate or stalemate
        this.checkGameOver();
        this.updateUI();
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const pieceSymbol = piece.toUpperCase() === 'P' ? '' : piece.toUpperCase();
        const fromSquare = String.fromCharCode(97 + fromCol) + (8 - fromRow);
        const toSquare = String.fromCharCode(97 + toCol) + (8 - toRow);
        const capture = this.board[toRow][toCol] ? 'x' : '';
        return `${pieceSymbol}${fromSquare}${capture}${toSquare}`;
    }

    getValidMovesForPiece(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const moves = [];
        const pieceType = piece.toLowerCase();

        switch (pieceType) {
            case 'p':
                moves.push(...this.getPawnMoves(row, col));
                break;
            case 'n':
                moves.push(...this.getKnightMoves(row, col));
                break;
            case 'b':
                moves.push(...this.getBishopMoves(row, col));
                break;
            case 'r':
                moves.push(...this.getRookMoves(row, col));
                break;
            case 'q':
                moves.push(...this.getQueenMoves(row, col));
                break;
            case 'k':
                moves.push(...this.getKingMoves(row, col));
                break;
        }

        // Filter out moves that would put own king in check
        return moves.filter(move => !this.wouldBeInCheck(row, col, move.row, move.col));
    }

    getPawnMoves(row, col) {
        const moves = [];
        const piece = this.board[row][col];
        const direction = piece === 'P' ? -1 : 1;
        const startRow = piece === 'P' ? 6 : 1;

        // Forward move
        if (this.isValidSquare(row + direction, col) && !this.board[row + direction][col]) {
            moves.push({ row: row + direction, col });

            // Double move from start
            if (row === startRow && !this.board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col });
            }
        }

        // Captures
        for (const colOffset of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + colOffset;
            if (this.isValidSquare(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (targetPiece && this.getPieceColor(targetPiece) !== this.getPieceColor(piece)) {
                    moves.push({ row: newRow, col: newCol });
                }
                // En passant
                if (this.enPassantTarget &&
                    newRow === this.enPassantTarget.row &&
                    newCol === this.enPassantTarget.col) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        return moves;
    }

    getKnightMoves(row, col) {
        const moves = [];
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        for (const [rowOffset, colOffset] of offsets) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            if (this.isValidSquare(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || this.getPieceColor(targetPiece) !== this.getPieceColor(this.board[row][col])) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        return moves;
    }

    getBishopMoves(row, col) {
        return this.getSlidingMoves(row, col, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    }

    getRookMoves(row, col) {
        return this.getSlidingMoves(row, col, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
    }

    getQueenMoves(row, col) {
        return this.getSlidingMoves(row, col, [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ]);
    }

    getKingMoves(row, col) {
        const moves = [];
        const offsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (const [rowOffset, colOffset] of offsets) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            if (this.isValidSquare(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || this.getPieceColor(targetPiece) !== this.getPieceColor(this.board[row][col])) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        // Castling
        const color = this.getPieceColor(this.board[row][col]);
        if (this.castlingRights[color].kingside &&
            !this.board[row][5] && !this.board[row][6] &&
            !this.isSquareUnderAttack(row, 4, color) &&
            !this.isSquareUnderAttack(row, 5, color) &&
            !this.isSquareUnderAttack(row, 6, color)) {
            moves.push({ row, col: 6 });
        }
        if (this.castlingRights[color].queenside &&
            !this.board[row][1] && !this.board[row][2] && !this.board[row][3] &&
            !this.isSquareUnderAttack(row, 4, color) &&
            !this.isSquareUnderAttack(row, 3, color) &&
            !this.isSquareUnderAttack(row, 2, color)) {
            moves.push({ row, col: 2 });
        }

        return moves;
    }

    getSlidingMoves(row, col, directions) {
        const moves = [];
        const piece = this.board[row][col];

        for (const [rowDir, colDir] of directions) {
            let newRow = row + rowDir;
            let newCol = col + colDir;

            while (this.isValidSquare(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (this.getPieceColor(targetPiece) !== this.getPieceColor(piece)) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
                newRow += rowDir;
                newCol += colDir;
            }
        }

        return moves;
    }

    isValidSquare(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    getPieceColor(piece) {
        return piece === piece.toUpperCase() ? 'white' : 'black';
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        // Simulate move
        const originalPiece = this.board[toRow][toCol];
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        const color = this.getPieceColor(this.board[toRow][toCol]);
        const inCheck = this.isInCheck(color);

        // Undo move
        this.board[fromRow][fromCol] = this.board[toRow][toCol];
        this.board[toRow][toCol] = originalPiece;

        return inCheck;
    }

    isInCheck(color) {
        // Find king position
        let kingRow, kingCol;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.toLowerCase() === 'k' && this.getPieceColor(piece) === color) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
        }

        return this.isSquareUnderAttack(kingRow, kingCol, color);
    }

    isSquareUnderAttack(row, col, defenderColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && this.getPieceColor(piece) !== defenderColor) {
                    const moves = this.getRawMoves(r, c);
                    if (moves.some(move => move.row === row && move.col === col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getRawMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const pieceType = piece.toLowerCase();
        switch (pieceType) {
            case 'p': return this.getPawnMoves(row, col);
            case 'n': return this.getKnightMoves(row, col);
            case 'b': return this.getBishopMoves(row, col);
            case 'r': return this.getRookMoves(row, col);
            case 'q': return this.getQueenMoves(row, col);
            case 'k': return this.getKingMoves(row, col).filter(m => Math.abs(m.col - col) <= 1); // Exclude castling for attack detection
            default: return [];
        }
    }

    checkGameOver() {
        const hasValidMoves = this.hasAnyValidMoves(this.currentTurn);
        const inCheck = this.isInCheck(this.currentTurn);

        if (!hasValidMoves) {
            this.gameOver = true;
            if (inCheck) {
                const winner = this.currentTurn === 'white' ? 'Black' : 'White';
                document.getElementById('status').textContent = `Checkmate! ${winner} wins!`;
            } else {
                document.getElementById('status').textContent = 'Stalemate!';
            }
        } else if (inCheck) {
            document.getElementById('status').textContent = 'Check!';
        } else {
            document.getElementById('status').textContent = 'Playing';
        }
    }

    hasAnyValidMoves(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.getPieceColor(piece) === color) {
                    const moves = this.getValidMovesForPiece(row, col);
                    if (moves.length > 0) return true;
                }
            }
        }
        return false;
    }

    // AI Implementation
    makeAIMove() {
        if (this.gameOver) return;

        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking';
        thinkingDiv.textContent = 'AI is thinking...';
        document.body.appendChild(thinkingDiv);

        const TIMEOUT_MS = 10000;
        this.aiStartTime = Date.now();
        this.aiTimeoutMs = TIMEOUT_MS;

        const settings = this.getAISettings();
        const maxTime = Math.min(settings.timePerMove, TIMEOUT_MS) / 1000;

        // Update timer display
        document.getElementById('timer-max').textContent = maxTime.toFixed(1);
        document.getElementById('timer-current').textContent = '0.0';
        document.getElementById('timer-bar').style.width = '0%';

        // Start timer with setInterval - updates every 50ms
        const timerInterval = setInterval(() => {
            const elapsed = (Date.now() - this.aiStartTime) / 1000;
            const percentage = (elapsed / maxTime) * 100;

            document.getElementById('timer-current').textContent = elapsed.toFixed(1);
            document.getElementById('timer-bar').style.width = Math.min(percentage, 100) + '%';

            const timerBar = document.getElementById('timer-bar');
            if (percentage > 80) {
                timerBar.classList.add('warning');
            } else {
                timerBar.classList.remove('warning');
            }
        }, 50);

        // Use callback-based getBestMove - this yields to event loop
        this.getBestMove((bestMove) => {
            try {
                // Stop timer
                clearInterval(timerInterval);
                const finalTime = ((Date.now() - this.aiStartTime) / 1000).toFixed(1);

                if (bestMove) {
                    this.makeMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
                    this.renderBoard();
                } else {
                    console.error('AI failed to find a move');
                }

                // Show final time
                document.getElementById('timer-current').textContent = finalTime;
                document.getElementById('timer-bar').style.width = '100%';
                document.getElementById('timer-bar').classList.remove('warning');

                // Reset timer after delay
                setTimeout(() => {
                    document.getElementById('timer-bar').style.width = '0%';
                    document.getElementById('timer-current').textContent = '0.0';
                }, 1000);

            } catch (error) {
                console.error('AI error:', error);
                clearInterval(timerInterval);
            }

            thinkingDiv.remove();
        });
    }

    isAITimedOut() {
        if (!this.aiStartTime || !this.aiTimeoutMs) return false;
        return (Date.now() - this.aiStartTime) > this.aiTimeoutMs;
    }

    getAISettings() {
        const settings = {
            // 500 Elo: Complete beginner - almost random
            500: {
                searchDepth: 0,           // NO search, just pick randomly
                randomness: 0.95,         // 95% completely random
                timePerMove: 300,
                positionWeight: 0.0,
                mobilityWeight: 0.0
            },
            // 750 Elo: Beginner - terrible but tries a bit
            750: {
                searchDepth: 1,          // Looks 1 ahead
                randomness: 0.80,        // 80% picks bad moves
                timePerMove: 500,
                positionWeight: 0.0,
                mobilityWeight: 0.0
            },
            // 1000 Elo: Weak - sees simple tactics
            1000: {
                searchDepth: 1,
                randomness: 0.60,        // 60% picks suboptimal
                timePerMove: 1000,
                positionWeight: 0.1,
                mobilityWeight: 0.0
            },
            // 1250 Elo: Improving - 2-move tactics
            1250: {
                searchDepth: 2,
                randomness: 0.40,        // 40% mistakes
                timePerMove: 2000,
                positionWeight: 0.3,
                mobilityWeight: 0.1
            },
            // 1500 Elo: Intermediate
            1500: {
                searchDepth: 2,
                randomness: 0.25,        // 25% mistakes
                timePerMove: 3000,
                positionWeight: 0.5,
                mobilityWeight: 0.2
            },
            // 1750 Elo: Good player
            1750: {
                searchDepth: 3,
                randomness: 0.15,        // 15% mistakes
                timePerMove: 4000,
                positionWeight: 0.7,
                mobilityWeight: 0.3
            },
            // 2000 Elo: Strong
            2000: {
                searchDepth: 3,
                randomness: 0.08,        // 8% mistakes
                timePerMove: 5000,
                positionWeight: 1.0,
                mobilityWeight: 0.4
            },
            // 2250 Elo: Master
            2250: {
                searchDepth: 4,
                randomness: 0.03,        // 3% mistakes
                timePerMove: 7000,
                positionWeight: 1.2,
                mobilityWeight: 0.5
            }
        };
        return settings[this.aiElo] || settings[1000];
    }

    getBestMove(callback) {
        const moves = this.getAllValidMoves(this.aiColor);
        if (moves.length === 0) {
            callback(null);
            return;
        }

        const settings = this.getAISettings();
        const deadline = this.aiStartTime + Math.min(settings.timePerMove, this.aiTimeoutMs);

        // For depth 0 (500 Elo), just pick randomly
        if (settings.searchDepth === 0) {
            console.log(`${this.aiElo} Elo: Completely random move`);
            callback(moves[Math.floor(Math.random() * moves.length)]);
            return;
        }

        // Apply randomness FIRST - decide if this is a "mistake" move
        if (Math.random() < settings.randomness) {
            const randomIndex = Math.floor(Math.random() * moves.length);
            console.log(`${this.aiElo} Elo: MISTAKE - Random move ${randomIndex + 1}/${moves.length}`);
            callback(moves[randomIndex]);
            return;
        }

        // Play a good move - evaluate with chunked processing
        const evaluatedMoves = [];
        let moveIndex = 0;

        const evaluateNextMove = () => {
            // Process one move
            if (moveIndex < moves.length && Date.now() < deadline) {
                const move = moves[moveIndex];
                const piece = this.board[move.fromRow][move.fromCol];
                const capturedPiece = this.board[move.toRow][move.toCol];

                this.board[move.toRow][move.toCol] = piece;
                this.board[move.fromRow][move.fromCol] = null;

                const score = -this.alphaBetaSearch(
                    settings.searchDepth - 1,
                    -Infinity,
                    Infinity,
                    true,
                    settings,
                    deadline
                );

                this.board[move.fromRow][move.fromCol] = piece;
                this.board[move.toRow][move.toCol] = capturedPiece;

                evaluatedMoves.push({ move, score });
                moveIndex++;

                // Continue with next move (yield to event loop)
                setTimeout(evaluateNextMove, 0);
            } else {
                // Done evaluating all moves
                if (evaluatedMoves.length === 0) {
                    callback(moves[0]);
                    return;
                }

                evaluatedMoves.sort((a, b) => b.score - a.score);
                console.log(`${this.aiElo} Elo: BEST move (score: ${evaluatedMoves[0].score.toFixed(0)})`);
                callback(evaluatedMoves[0].move);
            }
        };

        // Start evaluation
        evaluateNextMove();
    }

    alphaBetaSearch(depth, alpha, beta, isMaximizing, settings, deadline) {
        // Check time
        if (Date.now() >= deadline) {
            return this.quickEval(settings);
        }

        if (depth === 0) {
            return this.evaluatePosition(settings);
        }

        const color = isMaximizing ? this.aiColor : (this.aiColor === 'white' ? 'black' : 'white');
        const moves = this.getAllValidMoves(color);

        if (moves.length === 0) {
            if (this.isInCheck(color)) {
                return isMaximizing ? -999999 : 999999;
            }
            return 0; // Stalemate
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                if (Date.now() >= deadline) break;

                const piece = this.board[move.fromRow][move.fromCol];
                const captured = this.board[move.toRow][move.toCol];

                this.board[move.toRow][move.toCol] = piece;
                this.board[move.fromRow][move.fromCol] = null;

                const evaluation = this.alphaBetaSearch(depth - 1, alpha, beta, false, settings, deadline);

                this.board[move.fromRow][move.fromCol] = piece;
                this.board[move.toRow][move.toCol] = captured;

                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                if (Date.now() >= deadline) break;

                const piece = this.board[move.fromRow][move.fromCol];
                const captured = this.board[move.toRow][move.toCol];

                this.board[move.toRow][move.toCol] = piece;
                this.board[move.fromRow][move.fromCol] = null;

                const evaluation = this.alphaBetaSearch(depth - 1, alpha, beta, true, settings, deadline);

                this.board[move.fromRow][move.fromCol] = piece;
                this.board[move.toRow][move.toCol] = captured;

                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    quickEval(settings) {
        // Fast evaluation for when time is running out
        let score = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    const value = PIECE_VALUES[piece];
                    if (this.getPieceColor(piece) === this.aiColor) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }
        return score;
    }

    evaluatePosition(settings) {
        let materialScore = 0;
        let positionScore = 0;
        let mobilityScore = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (!piece) continue;

                const pieceColor = this.getPieceColor(piece);
                const isAI = pieceColor === this.aiColor;
                const multiplier = isAI ? 1 : -1;

                // Material
                materialScore += PIECE_VALUES[piece] * multiplier;

                // Position (if this level understands it)
                if (!settings.materialOnly && settings.positionWeight) {
                    const posValue = this.getPositionValue(piece, row, col);
                    positionScore += posValue * settings.positionWeight * multiplier;
                }

                // Mobility (if this level values it)
                if (settings.mobilityWeight && settings.mobilityWeight > 0) {
                    const moves = this.getValidMovesForPiece(row, col);
                    mobilityScore += moves.length * settings.mobilityWeight * 10 * multiplier;
                }
            }
        }

        return materialScore + positionScore + mobilityScore;
    }


    getPositionValue(piece, row, col) {
        const pieceType = piece.toLowerCase();
        const isWhite = piece === piece.toUpperCase();
        const index = isWhite ? (7 - row) * 8 + col : row * 8 + col;

        switch (pieceType) {
            case 'p': return PAWN_TABLE[index];
            case 'n': return KNIGHT_TABLE[index];
            case 'b': return BISHOP_TABLE[index];
            case 'k': return KING_TABLE[index];
            default: return 0;
        }
    }

    getAllValidMoves(color) {
        const moves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && this.getPieceColor(piece) === color) {
                    const pieceMoves = this.getValidMovesForPiece(row, col);
                    for (const move of pieceMoves) {
                        moves.push({ fromRow: row, fromCol: col, toRow: move.row, toCol: move.col });
                    }
                }
            }
        }
        return moves;
    }

    renderBoard() {
        const squares = document.querySelectorAll('.square');
        squares.forEach(square => {
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            const piece = this.board[row][col];

            square.textContent = piece ? PIECES[piece] : '';
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;

            if (piece) square.classList.add('piece');

            if (this.selectedSquare && this.selectedSquare[0] === row && this.selectedSquare[1] === col) {
                square.classList.add('selected');
            }

            if (this.validMoves.some(move => move.row === row && move.col === col)) {
                square.classList.add('valid-move');
                if (piece) square.classList.add('capture-move');
            }

            if (this.lastMove &&
                ((this.lastMove.fromRow === row && this.lastMove.fromCol === col) ||
                 (this.lastMove.toRow === row && this.lastMove.toCol === col))) {
                square.classList.add('last-move');
            }

            // Highlight king in check
            if (piece && piece.toLowerCase() === 'k') {
                const color = this.getPieceColor(piece);
                if (this.isInCheck(color)) {
                    square.classList.add('check-indicator');
                }
            }
        });
    }

    updateUI() {
        document.getElementById('turn').textContent = this.currentTurn.charAt(0).toUpperCase() + this.currentTurn.slice(1);

        // Update captured pieces
        document.getElementById('captured-white').textContent =
            this.capturedPieces.white.map(p => PIECES[p]).join(' ');
        document.getElementById('captured-black').textContent =
            this.capturedPieces.black.map(p => PIECES[p]).join(' ');

        // Update move history
        const historyDiv = document.getElementById('history');
        historyDiv.innerHTML = this.moveHistory.map((move, index) =>
            `<div class="move-entry">${Math.floor(index / 2) + 1}. ${move.moveNotation}</div>`
        ).join('');
        historyDiv.scrollTop = historyDiv.scrollHeight;
    }

    newGame() {
        this.board = this.createInitialBoard();
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.lastMove = null;
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };

        this.initializeBoard();

        if (this.playerColor === 'black') {
            setTimeout(() => this.makeAIMove(), 500);
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;

        // Undo last move (player's move)
        this.moveHistory.pop();

        // Undo AI's move if it exists
        if (this.moveHistory.length > 0 && this.currentTurn === this.playerColor) {
            this.moveHistory.pop();
        }

        if (this.moveHistory.length > 0) {
            const lastState = this.moveHistory[this.moveHistory.length - 1];
            this.board = JSON.parse(JSON.stringify(lastState.board));
        } else {
            this.board = this.createInitialBoard();
        }

        this.currentTurn = this.playerColor;
        this.gameOver = false;
        this.selectedSquare = null;
        this.validMoves = [];

        // Recalculate captured pieces
        this.capturedPieces = { white: [], black: [] };
        for (const move of this.moveHistory) {
            if (move.capturedPiece) {
                const color = this.getPieceColor(move.capturedPiece) === 'white' ? 'black' : 'white';
                this.capturedPieces[color].push(move.capturedPiece);
            }
        }

        this.renderBoard();
        this.updateUI();
    }

    setAIElo(elo) {
        this.aiElo = elo;
        document.getElementById('current-elo').textContent = elo;

        // Update active button styling
        document.querySelectorAll('.elo-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.elo) === elo) {
                btn.classList.add('active');
            }
        });
    }

    attachEventListeners() {
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
        document.getElementById('undo-move').addEventListener('click', () => this.undoMove());

        // Elo selection buttons
        document.querySelectorAll('.elo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const elo = parseInt(btn.dataset.elo);
                this.setAIElo(elo);
            });
        });

        document.querySelectorAll('input[name="player-color"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.playerColor = e.target.value;
                this.aiColor = this.playerColor === 'white' ? 'black' : 'white';
                this.newGame();
            });
        });
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new ChessGame();
});
