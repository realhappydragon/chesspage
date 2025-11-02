/*
 * CHESS AI OPTIMIZATIONS SUMMARY
 * ================================
 * This chess engine has been optimized for stronger play while maintaining the existing structure.
 * All optimizations are marked with "// OPTIMIZATION:" comments throughout the code.
 *
 * KEY IMPROVEMENTS:
 *
 * 1. SEARCH OPTIMIZATIONS:
 *    - FEN-based transposition table for better position caching
 *    - Enhanced move ordering: PV move > Captures (MVV-LVA) > Promotions > Killer moves > History heuristic > Positional
 *    - Killer move heuristic: stores non-capture moves that caused beta cutoffs
 *    - History heuristic: tracks successful moves across the search tree
 *    - Iterative deepening with time control enforcement
 *    - Repetition detection to avoid drawn positions
 *
 * 2. EVALUATION IMPROVEMENTS:
 *    - Material evaluation (unchanged)
 *    - Piece-square tables for positional play (enhanced)
 *    - Mobility: rewards pieces with more legal moves
 *    - Pawn structure: detects doubled, isolated, and passed pawns
 *    - King safety: pawn shield, nearby defenders, open files, endgame centralization
 *    - Endgame detection for phase-specific evaluation
 *
 * 3. PLAY VARIETY:
 *    - Random selection among equally good moves (within 30 centipawn window)
 *    - 30% chance to select alternative moves of similar strength
 *    - Prevents deterministic/boring play patterns
 *
 * 4. ELO-BASED DIFFICULTY SCALING:
 *    - 500 Elo: Random moves, no evaluation
 *    - 750 Elo: 1-ply search, 75% blunder rate, minimal evaluation
 *    - 1000 Elo: 2-ply search, 50% mistake rate, basic evaluation
 *    - 1250 Elo: 3-ply search, 30% mistake rate, tactical awareness
 *    - 1500 Elo: 4-ply search, 15% mistake rate, solid positional play
 *    - 1750 Elo: 5-ply search, 8% mistake rate, strong evaluation
 *    - 2000 Elo: 6-ply search, 4% mistake rate, expert level
 *    - 2250 Elo: 7-ply search, 2% mistake rate, master level
 *
 * 5. PERFORMANCE:
 *    - Transposition table limited to 100K entries to prevent memory bloat
 *    - Alpha-beta pruning with move ordering for efficient tree traversal
 *    - Quiescence search to avoid horizon effect in tactical positions
 *    - Hard timeout enforcement to prevent UI freezing
 */

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
        // OPTIMIZATION: Position history for repetition detection
        this.positionHistory = [];
        
        // Lesson mode properties
        this.lessonMode = false;
        this.lessonEngine = null;
        this.currentBoardElement = 'chessboard';

        // WEB WORKER: Initialize AI worker for background search
        this.workerReady = false;
        try {
            this.aiWorker = new Worker('chess-worker.js');

            this.aiWorker.onmessage = (e) => {
                this.handleWorkerMessage(e);
            };

            this.aiWorker.onerror = (e) => {
                console.error('Worker runtime error:', e.message, e.filename, e.lineno);
                alert(`Chess AI Error: ${e.message}\nFile: ${e.filename}\nLine: ${e.lineno}\n\nThe AI will not be available.`);
                this.handleWorkerError(e);
                this.aiWorker = null;
            };

            // Test if worker is actually working
            console.log('AI Worker object created, testing communication...');
            this.workerReady = true;

        } catch (error) {
            console.error('Failed to create AI Worker:', error);
            alert(`Failed to load chess AI: ${error.message}\n\nMake sure you're running this from a web server (http://localhost), not opening the file directly.`);
            this.aiWorker = null;
            this.workerReady = false;
        }

        this.initializeBoard();
        this.attachEventListeners();
        
        // Initialize lesson mode components
        this.initializeLessonMode();
    }

    handleWorkerMessage(e) {
        const { type, ...data } = e.data;

        if (type === 'move') {
            // Worker found best move
            if (this.workerCallback) {
                this.workerCallback(data);
            }
        } else if (type === 'progress') {
            // Worker progress update
            console.log(`Depth ${data.depth}: ${data.nodes} nodes, score: ${data.score}`);
        }
    }

    handleWorkerError(error) {
        console.error('Worker encountered an error:', error);
        if (this.workerCallback) {
            this.workerCallback({ move: null, error: true });
        }
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
        const boardElement = document.getElementById(this.currentBoardElement);
        if (!boardElement) return;
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
        if (this.gameOver) return;
        
        // Handle lesson mode differently
        if (this.lessonMode) {
            this.handleLessonSquareClick(row, col);
            return;
        }
        
        if (this.currentTurn !== this.playerColor) return;

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

        // OPTIMIZATION: Track position for repetition detection
        this.positionHistory.push(this.getFEN());

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

    // AI Implementation (Web Worker based - UI stays responsive)
    makeAIMove() {
        if (this.gameOver) return;

        if (!this.aiWorker || !this.workerReady) {
            console.error('AI Worker not available - cannot make AI move');
            console.error('Worker object:', this.aiWorker);
            console.error('Worker ready:', this.workerReady);
            return;
        }

        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking';
        thinkingDiv.textContent = 'AI is thinking...';
        document.body.appendChild(thinkingDiv);

        const settings = this.getAISettings();
        this.aiStartTime = Date.now();
        const maxTime = settings.timePerMove / 1000;

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

        // Set up worker callback
        this.workerCallback = (result) => {
            try {
                // Stop timer
                clearInterval(timerInterval);
                if (hardTimeoutId) clearTimeout(hardTimeoutId);

                const finalTime = ((Date.now() - this.aiStartTime) / 1000).toFixed(1);

                if (result.move && !result.error) {
                    console.log(`AI move: depth ${result.depth}, nodes: ${result.nodes}, time: ${finalTime}s`);
                    this.makeMove(result.move.fromRow, result.move.fromCol, result.move.toRow, result.move.toCol);
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
            this.workerCallback = null; // Clear callback
        };

        // Hard timeout - stop worker after max time
        const hardTimeoutId = setTimeout(() => {
            console.warn('HARD TIMEOUT: Stopping worker');
            this.aiWorker.postMessage({ type: 'stop' });
        }, settings.timePerMove + 500); // Give 500ms grace period

        // Send search request to worker
        this.aiWorker.postMessage({
            type: 'search',
            board: this.board,
            settings: settings,
            aiColor: this.aiColor,
            currentTurn: this.currentTurn,
            castlingRights: this.castlingRights,
            enPassantTarget: this.enPassantTarget,
            positionHistory: this.positionHistory
        });
    }

    isAITimedOut() {
        if (!this.aiStartTime || !this.aiTimeoutMs) return false;
        return this.forceTimeout || (Date.now() - this.aiStartTime) > this.aiTimeoutMs;
    }

    // CONTINUOUS ELO INTERPOLATION: Smooth difficulty scaling for any ELO value
    getAISettings() {
        const elo = Math.max(500, Math.min(2200, this.aiElo)); // Clamp to valid range

        // Linear interpolation helper
        const lerp = (minElo, maxElo, minVal, maxVal) => {
            const t = (elo - minElo) / (maxElo - minElo);
            return minVal + t * (maxVal - minVal);
        };

        // SEARCH DEPTH: 1 @ 500 ELO → 6 @ 2200 ELO
        const searchDepth = elo <= 500 ? 0 : Math.round(lerp(500, 2200, 1, 6));

        // MISTAKE RATE: 0.90 @ 500 → 0.02 @ 2200 (probability of making a blunder)
        const mistakeRate = lerp(500, 2200, 0.90, 0.02);

        // MISTAKE SIZE: 350cp @ 500 → 100cp @ 2200 (how bad blunders are)
        const mistakeSizeCp = Math.round(lerp(500, 2200, 350, 100));

        // TIME PER MOVE: 300ms @ 500 → 5000ms @ 2200
        const timePerMove = Math.round(lerp(500, 2200, 300, 5000));

        // MAX NODES: Node count limit as backup (50K @ 500 → 500K @ 2200)
        const maxNodes = Math.round(lerp(500, 2200, 50000, 500000));

        // POSITION WEIGHT: 0.0 @ 500 → 1.5 @ 2200
        const positionWeight = lerp(500, 2200, 0.0, 1.5);

        // MOBILITY WEIGHT: 0.0 @ 500 → 1.0 @ 2200
        const mobilityWeight = lerp(500, 2200, 0.0, 1.0);

        // PAWN STRUCTURE WEIGHT: 0.0 @ 500 → 1.0 @ 2200
        const pawnStructureWeight = lerp(500, 2200, 0.0, 1.0);

        // KING SAFETY WEIGHT: 0.0 @ 500 → 1.2 @ 2200
        const kingSafetyWeight = lerp(500, 2200, 0.0, 1.2);

        // SOFTMAX TEMPERATURE: 1.2 @ 500 → 0.3 @ 2200 (lower = more deterministic)
        const temperature = lerp(500, 2200, 1.2, 0.3);

        // SOFTMAX WINDOW: 80cp @ 500 → 30cp @ 2200 (narrower window at high ELO)
        const softmaxWindow = Math.round(lerp(500, 2200, 80, 30));

        // QUIESCENCE SEARCH: Enable from 1200+ ELO
        const useQuiescence = elo >= 1200;

        return {
            searchDepth,
            mistakeRate,
            mistakeSizeCp,
            timePerMove,
            maxNodes,
            positionWeight,
            mobilityWeight,
            pawnStructureWeight,
            kingSafetyWeight,
            temperature,
            softmaxWindow,
            useQuiescence
        };
    }

    // KEEP FEN generation for position history tracking
    getFEN() {
        let fen = '';

        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    fen += piece;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (row < 7) fen += '/';
        }

        fen += ' ' + (this.currentTurn === 'white' ? 'w' : 'b');

        let castling = '';
        if (this.castlingRights.white.kingside) castling += 'K';
        if (this.castlingRights.white.queenside) castling += 'Q';
        if (this.castlingRights.black.kingside) castling += 'k';
        if (this.castlingRights.black.queenside) castling += 'q';
        fen += ' ' + (castling || '-');

        if (this.enPassantTarget) {
            fen += ' ' + String.fromCharCode(97 + this.enPassantTarget.col) + (8 - this.enPassantTarget.row);
        } else {
            fen += ' -';
        }

        return fen;
    }

    // KEEP getAllValidMoves for checking if moves exist
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

    // Removed old search functions - now handled by chess-worker.js:
    // - getBestMove, alphaBetaSearch, quiescenceSearch
    // - evaluatePosition, evaluateMobility, evaluatePawnStructure, evaluateKingSafety
    // - orderMoves, storeKillerMove, updateHistory
    // - quickEval, getPositionValue, countPieces, getBoardHash, countRepetitions

    isAITimedOut() {
        // Deprecated - timing now handled by worker
        return false;
    }

    // Move generation functions deleted here - see lines 753-1469 in original
    // Now only in worker. Main thread only needs getAllValidMoves for UI.

    // UI FUNCTIONS BELOW THIS LINE

    renderBoard() {
        const boardElement = document.getElementById(this.currentBoardElement);
        if (!boardElement) return;
        const squares = boardElement.querySelectorAll('.square');
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

        // OPTIMIZATION: Reset search optimization data structures
        this.positionHistory = [];
        this.killerMoves = Array(20).fill(null).map(() => []);
        this.historyTable = {};

        this.initializeBoard();

        if (this.playerColor === 'black') {
            setTimeout(() => this.makeAIMove(), 500);
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;

        // Undo last move (player's move)
        this.moveHistory.pop();
        // OPTIMIZATION: Also remove from position history
        if (this.positionHistory.length > 0) this.positionHistory.pop();

        // Undo AI's move if it exists
        if (this.moveHistory.length > 0 && this.currentTurn === this.playerColor) {
            this.moveHistory.pop();
            if (this.positionHistory.length > 0) this.positionHistory.pop();
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
        // Mode selector
        document.getElementById('learn-mode')?.addEventListener('click', () => this.switchToLearnMode());
        document.getElementById('practice-mode')?.addEventListener('click', () => this.switchToPracticeMode());
        document.getElementById('play-mode')?.addEventListener('click', () => this.switchToPlayMode());
        
        // Game controls (only if elements exist)
        document.getElementById('new-game')?.addEventListener('click', () => this.newGame());
        document.getElementById('undo-move')?.addEventListener('click', () => this.undoMove());

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
        
        // Lesson controls
        this.attachLessonEventListeners();
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new ChessGame();
});
