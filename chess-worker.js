/*
 * CHESS AI WEB WORKER
 * ====================
 * All search and evaluation logic runs in this background thread
 * to keep the UI responsive. Communicates with main thread via postMessage.
 *
 * Message Protocol:
 * - FROM MAIN: { type: 'search', board, settings, aiColor, castlingRights, enPassantTarget, positionHistory, currentTurn }
 * - TO MAIN: { type: 'move', move } or { type: 'progress', depth, nodes, score }
 */

// Piece values for evaluation
const PIECE_VALUES = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000,
    'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000
};

// Piece-square tables for positional evaluation
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

// Worker state
let board = null;
let aiColor = null;
let currentTurn = null;
let castlingRights = null;
let enPassantTarget = null;
let positionHistory = [];
let transpositionTable = new Map();
let killerMoves = Array(20).fill(null).map(() => []);
let historyTable = {};
let nodesSearched = 0;
let forceTimeout = false;

// Handle messages from main thread
self.onmessage = function(e) {
    const { type, ...data } = e.data;

    if (type === 'search') {
        // Initialize worker state from message
        board = data.board;
        aiColor = data.aiColor;
        currentTurn = data.currentTurn;
        castlingRights = data.castlingRights;
        enPassantTarget = data.enPassantTarget;
        positionHistory = data.positionHistory || [];

        const settings = data.settings;
        const startTime = Date.now();
        const deadline = startTime + Math.floor(settings.timePerMove * 0.9); // Finish 10% early

        forceTimeout = false;
        nodesSearched = 0;

        // Clear transposition table if too large
        if (transpositionTable.size > 100000) {
            transpositionTable.clear();
        }

        // Find best move
        const result = getBestMove(settings, deadline, startTime);

        // Send result back to main thread
        self.postMessage({
            type: 'move',
            move: result.move,
            score: result.score,
            depth: result.depth,
            nodes: nodesSearched,
            time: Date.now() - startTime
        });
    } else if (type === 'stop') {
        forceTimeout = true;
    }
};

// SEARCH FUNCTIONS

function getBestMove(settings, deadline, startTime) {
    const moves = getAllValidMoves(aiColor);

    if (moves.length === 0) {
        return { move: null, score: 0, depth: 0 };
    }

    // For very low ELO (depth 0), just pick randomly
    if (settings.searchDepth === 0) {
        return {
            move: moves[Math.floor(Math.random() * moves.length)],
            score: 0,
            depth: 0
        };
    }

    let bestMove = moves[0];
    let bestScore = -Infinity;
    let completedDepth = 0;
    let allMoveScores = [];

    // Iterative deepening
    for (let depth = 1; depth <= settings.searchDepth; depth++) {
        if (forceTimeout || Date.now() >= deadline) break;

        const orderedMoves = orderMoves(moves, bestMove, 0);
        let depthBestMove = null;
        let depthBestScore = -Infinity;
        let depthMoveScores = [];

        for (const move of orderedMoves) {
            if (forceTimeout || Date.now() >= deadline) break;

            // Check node count limit
            if (nodesSearched > settings.maxNodes) {
                forceTimeout = true;
                break;
            }

            const piece = board[move.fromRow][move.fromCol];
            const captured = board[move.toRow][move.toCol];

            // Make move
            board[move.toRow][move.toCol] = piece;
            board[move.fromRow][move.fromCol] = null;

            const score = -alphaBetaSearch(
                depth - 1,
                -Infinity,
                Infinity,
                false,
                settings,
                deadline,
                0
            );

            // Unmake move
            board[move.fromRow][move.fromCol] = piece;
            board[move.toRow][move.toCol] = captured;

            depthMoveScores.push({ move, score });

            if (score > depthBestScore) {
                depthBestScore = score;
                depthBestMove = move;
            }
        }

        // Update best if we completed this depth
        if (depthBestMove && !forceTimeout && Date.now() < deadline) {
            bestMove = depthBestMove;
            bestScore = depthBestScore;
            allMoveScores = depthMoveScores;
            completedDepth = depth;

            // Send progress update
            self.postMessage({
                type: 'progress',
                depth,
                nodes: nodesSearched,
                score: bestScore
            });
        }
    }

    // If we have move scores, check for intentional mistakes or use softmax
    if (allMoveScores.length > 0) {
        // Sort by score descending
        allMoveScores.sort((a, b) => b.score - a.score);

        // Check if we should make an intentional mistake
        const blunderMove = maybeBlunder(allMoveScores, settings);
        if (blunderMove) {
            return { move: blunderMove, score: bestScore, depth: completedDepth };
        }

        // Use softmax selection for variety
        const selectedMove = selectMoveWithSoftmax(allMoveScores, settings);
        if (selectedMove) {
            return { move: selectedMove, score: bestScore, depth: completedDepth };
        }
    }

    return { move: bestMove, score: bestScore, depth: completedDepth };
}

function alphaBetaSearch(depth, alpha, beta, isMaximizing, settings, deadline, searchDepth) {
    nodesSearched++;

    // Check timeout
    if (forceTimeout || Date.now() >= deadline || nodesSearched > settings.maxNodes) {
        return quickEval(settings);
    }

    // Check for repetition draw
    const repetitions = countRepetitions();
    if (repetitions >= 2) {
        return 0;
    }

    // Check transposition table
    const boardKey = getFEN();
    const ttEntry = transpositionTable.get(boardKey);
    if (ttEntry && ttEntry.depth >= depth) {
        return ttEntry.score;
    }

    // Leaf node - use quiescence search if enabled
    if (depth === 0) {
        const score = settings.useQuiescence ?
            quiescenceSearch(alpha, beta, isMaximizing, settings, deadline, 0) :
            evaluatePosition(settings);

        transpositionTable.set(boardKey, { score, depth });
        return score;
    }

    const color = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
    const moves = getAllValidMoves(color);

    if (moves.length === 0) {
        const score = isInCheck(color) ?
            (isMaximizing ? -999999 : 999999) : 0;
        transpositionTable.set(boardKey, { score, depth });
        return score;
    }

    const orderedMoves = orderMoves(moves, ttEntry?.bestMove, searchDepth);

    if (isMaximizing) {
        let maxEval = -Infinity;
        let bestMoveAtDepth = null;

        for (const move of orderedMoves) {
            if (forceTimeout || Date.now() >= deadline || nodesSearched > settings.maxNodes) break;

            const piece = board[move.fromRow][move.fromCol];
            const captured = board[move.toRow][move.toCol];

            board[move.toRow][move.toCol] = piece;
            board[move.fromRow][move.fromCol] = null;

            const evaluation = alphaBetaSearch(depth - 1, alpha, beta, false, settings, deadline, searchDepth + 1);

            board[move.fromRow][move.fromCol] = piece;
            board[move.toRow][move.toCol] = captured;

            if (evaluation > maxEval) {
                maxEval = evaluation;
                bestMoveAtDepth = move;
            }

            alpha = Math.max(alpha, evaluation);

            if (beta <= alpha) {
                if (!captured) {
                    storeKillerMove(move, searchDepth);
                }
                updateHistory(move, depth);
                break;
            }
        }

        transpositionTable.set(boardKey, { score: maxEval, depth, bestMove: bestMoveAtDepth });
        return maxEval;
    } else {
        let minEval = Infinity;
        let bestMoveAtDepth = null;

        for (const move of orderedMoves) {
            if (forceTimeout || Date.now() >= deadline || nodesSearched > settings.maxNodes) break;

            const piece = board[move.fromRow][move.fromCol];
            const captured = board[move.toRow][move.toCol];

            board[move.toRow][move.toCol] = piece;
            board[move.fromRow][move.fromCol] = null;

            const evaluation = alphaBetaSearch(depth - 1, alpha, beta, true, settings, deadline, searchDepth + 1);

            board[move.fromRow][move.fromCol] = piece;
            board[move.toRow][move.toCol] = captured;

            if (evaluation < minEval) {
                minEval = evaluation;
                bestMoveAtDepth = move;
            }

            beta = Math.min(beta, evaluation);

            if (beta <= alpha) {
                if (!captured) {
                    storeKillerMove(move, searchDepth);
                }
                updateHistory(move, depth);
                break;
            }
        }

        transpositionTable.set(boardKey, { score: minEval, depth, bestMove: bestMoveAtDepth });
        return minEval;
    }
}

function quiescenceSearch(alpha, beta, isMaximizing, settings, deadline, depth) {
    if (depth > 4 || forceTimeout || Date.now() >= deadline || nodesSearched > settings.maxNodes) {
        return evaluatePosition(settings);
    }

    const standPat = evaluatePosition(settings);

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;
    } else {
        if (standPat <= alpha) return alpha;
        if (beta > standPat) beta = standPat;
    }

    const color = isMaximizing ? aiColor : (aiColor === 'white' ? 'black' : 'white');
    const allMoves = getAllValidMoves(color);
    const tacticalMoves = allMoves.filter(move => {
        if (board[move.toRow][move.toCol]) return true;

        const piece = board[move.fromRow][move.fromCol];
        board[move.toRow][move.toCol] = piece;
        board[move.fromRow][move.fromCol] = null;
        const opponentColor = color === 'white' ? 'black' : 'white';
        const givesCheck = isInCheck(opponentColor);
        board[move.fromRow][move.fromCol] = piece;
        board[move.toRow][move.toCol] = null;

        return givesCheck;
    });

    if (tacticalMoves.length === 0) {
        return standPat;
    }

    const orderedMoves = orderMoves(tacticalMoves, null, 0);

    for (const move of orderedMoves) {
        if (forceTimeout || Date.now() >= deadline || nodesSearched > settings.maxNodes) break;

        const piece = board[move.fromRow][move.fromCol];
        const captured = board[move.toRow][move.toCol];

        board[move.toRow][move.toCol] = piece;
        board[move.fromRow][move.fromCol] = null;

        const score = quiescenceSearch(alpha, beta, !isMaximizing, settings, deadline, depth + 1);

        board[move.fromRow][move.fromCol] = piece;
        board[move.toRow][move.toCol] = captured;

        if (isMaximizing) {
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        } else {
            if (score <= alpha) return alpha;
            if (score < beta) beta = score;
        }
    }

    return isMaximizing ? alpha : beta;
}

// MOVE SELECTION FUNCTIONS

function maybeBlunder(moveScores, settings) {
    if (Math.random() >= settings.mistakeRate) {
        return null; // No blunder
    }

    const bestScore = moveScores[0].score;
    const targetScore = bestScore - settings.mistakeSizeCp;

    // Find moves near target score (within ±50cp)
    const blunderCandidates = moveScores.filter(m =>
        Math.abs(m.score - targetScore) < 50 && m.score < bestScore - 50
    );

    if (blunderCandidates.length > 0) {
        const selected = blunderCandidates[Math.floor(Math.random() * blunderCandidates.length)];
        return selected.move;
    }

    // Fallback: pick a worse move if available
    if (moveScores.length > 1) {
        const worseIndex = Math.min(
            Math.floor(moveScores.length / 2),
            moveScores.length - 1
        );
        return moveScores[worseIndex].move;
    }

    return null;
}

function selectMoveWithSoftmax(moveScores, settings) {
    const bestScore = moveScores[0].score;
    const windowSize = settings.softmaxWindow || 50;

    // Filter moves within window
    const topMoves = moveScores.filter(m => m.score >= bestScore - windowSize);

    if (topMoves.length === 1) {
        return topMoves[0].move;
    }

    // Apply softmax with temperature
    const temperature = settings.temperature || 0.5;
    const expScores = topMoves.map(m => Math.exp(m.score / temperature));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probabilities = expScores.map(e => e / sumExp);

    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;

    for (let i = 0; i < topMoves.length; i++) {
        cumulative += probabilities[i];
        if (rand <= cumulative) {
            return topMoves[i].move;
        }
    }

    return topMoves[0].move; // Fallback
}

// EVALUATION FUNCTIONS

function evaluatePosition(settings) {
    let materialScore = 0;
    let positionScore = 0;
    let mobilityScore = 0;
    let pawnStructureScore = 0;
    let kingSafetyScore = 0;

    const whitePawns = [];
    const blackPawns = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const pieceColor = getPieceColor(piece);
            const isAI = pieceColor === aiColor;
            const multiplier = isAI ? 1 : -1;

            materialScore += PIECE_VALUES[piece] * multiplier;

            if (settings.positionWeight > 0) {
                const posValue = getPositionValue(piece, row, col);
                positionScore += posValue * settings.positionWeight * multiplier;
            }

            if (piece.toLowerCase() === 'p') {
                if (pieceColor === 'white') {
                    whitePawns.push({ row, col });
                } else {
                    blackPawns.push({ row, col });
                }
            }
        }
    }

    if (settings.mobilityWeight > 0) {
        mobilityScore = evaluateMobility(settings);
    }

    if (settings.pawnStructureWeight > 0) {
        pawnStructureScore = evaluatePawnStructure(whitePawns, blackPawns, settings);
    }

    if (settings.kingSafetyWeight > 0) {
        kingSafetyScore = evaluateKingSafety(settings);
    }

    return materialScore + positionScore + mobilityScore + pawnStructureScore + kingSafetyScore;
}

function quickEval(settings) {
    let score = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                const value = PIECE_VALUES[piece];
                if (getPieceColor(piece) === aiColor) {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }
    }
    return score;
}

function evaluateMobility(settings) {
    const aiMoves = getAllValidMoves(aiColor).length;
    const opponentColor = aiColor === 'white' ? 'black' : 'white';

    const originalTurn = currentTurn;
    currentTurn = opponentColor;
    const opponentMoves = getAllValidMoves(opponentColor).length;
    currentTurn = originalTurn;

    return (aiMoves - opponentMoves) * 10 * settings.mobilityWeight;
}

function evaluatePawnStructure(whitePawns, blackPawns, settings) {
    let score = 0;

    for (const pawn of whitePawns) {
        const doubled = whitePawns.some(p => p.col === pawn.col && p.row < pawn.row);
        if (doubled) score -= 20;

        const isolated = !whitePawns.some(p => Math.abs(p.col - pawn.col) === 1);
        if (isolated) score -= 15;

        const passed = !blackPawns.some(p =>
            Math.abs(p.col - pawn.col) <= 1 && p.row > pawn.row
        );
        if (passed) {
            score += (6 - pawn.row) * 10;
        }
    }

    for (const pawn of blackPawns) {
        const doubled = blackPawns.some(p => p.col === pawn.col && p.row > pawn.row);
        if (doubled) score += 20;

        const isolated = !blackPawns.some(p => Math.abs(p.col - pawn.col) === 1);
        if (isolated) score += 15;

        const passed = !whitePawns.some(p =>
            Math.abs(p.col - pawn.col) <= 1 && p.row < pawn.row
        );
        if (passed) {
            score -= (pawn.row - 1) * 10;
        }
    }

    return (aiColor === 'white' ? score : -score) * settings.pawnStructureWeight;
}

function evaluateKingSafety(settings) {
    let safety = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece || piece.toLowerCase() !== 'k') continue;

            const pieceColor = getPieceColor(piece);
            const multiplier = (pieceColor === aiColor) ? 1 : -1;

            let pawnShield = 0;
            const direction = pieceColor === 'white' ? -1 : 1;
            for (let dc = -1; dc <= 1; dc++) {
                const shieldRow = row + direction;
                const shieldCol = col + dc;
                if (isValidSquare(shieldRow, shieldCol)) {
                    const shieldPiece = board[shieldRow][shieldCol];
                    if (shieldPiece && shieldPiece.toLowerCase() === 'p' &&
                        getPieceColor(shieldPiece) === pieceColor) {
                        pawnShield += 20;
                    }
                }
            }

            let defenders = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = row + dr;
                    const c = col + dc;
                    if (isValidSquare(r, c)) {
                        const nearby = board[r][c];
                        if (nearby && getPieceColor(nearby) === pieceColor) {
                            defenders += 8;
                        }
                    }
                }
            }

            const pieceCount = countPieces();
            let centralization = 0;
            if (pieceCount <= 12) {
                const centerDist = Math.abs(3.5 - row) + Math.abs(3.5 - col);
                centralization = (7 - centerDist) * 15;
            } else {
                const centerDist = Math.abs(3.5 - row) + Math.abs(3.5 - col);
                centralization = centerDist * 5;
            }

            let openFilePenalty = 0;
            for (let dc = -1; dc <= 1; dc++) {
                const fileCol = col + dc;
                if (fileCol >= 0 && fileCol < 8) {
                    let hasOwnPawn = false;
                    for (let r = 0; r < 8; r++) {
                        const p = board[r][fileCol];
                        if (p && p.toLowerCase() === 'p' && getPieceColor(p) === pieceColor) {
                            hasOwnPawn = true;
                            break;
                        }
                    }
                    if (!hasOwnPawn) openFilePenalty -= 15;
                }
            }

            safety += (pawnShield + defenders + centralization + openFilePenalty) * multiplier * settings.kingSafetyWeight;
        }
    }

    return safety;
}

function getPositionValue(piece, row, col) {
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

function countPieces() {
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col]) count++;
        }
    }
    return count;
}

// MOVE ORDERING

function orderMoves(moves, bestMove = null, depth = 0) {
    const scoredMoves = moves.map(move => {
        let score = 0;

        if (bestMove &&
            move.fromRow === bestMove.fromRow &&
            move.fromCol === bestMove.fromCol &&
            move.toRow === bestMove.toRow &&
            move.toCol === bestMove.toCol) {
            score += 100000;
        }

        const targetPiece = board[move.toRow][move.toCol];
        const movingPiece = board[move.fromRow][move.fromCol];

        if (targetPiece) {
            score += 10000 + (PIECE_VALUES[targetPiece] * 10 - PIECE_VALUES[movingPiece]);
        }

        if (movingPiece.toLowerCase() === 'p' && (move.toRow === 0 || move.toRow === 7)) {
            score += 9000;
        }

        if (!targetPiece && depth < killerMoves.length) {
            const killers = killerMoves[depth];
            for (let i = 0; i < killers.length; i++) {
                const killer = killers[i];
                if (killer &&
                    killer.fromRow === move.fromRow &&
                    killer.fromCol === move.fromCol &&
                    killer.toRow === move.toRow &&
                    killer.toCol === move.toCol) {
                    score += 8000 - i * 1000;
                }
            }
        }

        const historyKey = `${move.fromRow},${move.fromCol},${move.toRow},${move.toCol}`;
        if (historyTable[historyKey]) {
            score += historyTable[historyKey];
        }

        const centerDistance = Math.abs(3.5 - move.toRow) + Math.abs(3.5 - move.toCol);
        score += (7 - centerDistance) * 10;

        if (movingPiece.toLowerCase() === 'n' || movingPiece.toLowerCase() === 'b') {
            const startRow = movingPiece === movingPiece.toUpperCase() ? 7 : 0;
            if (move.fromRow === startRow) {
                score += 50;
            }
        }

        return { move, score };
    });

    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves.map(sm => sm.move);
}

function storeKillerMove(move, depth) {
    if (depth >= killerMoves.length) return;

    const killers = killerMoves[depth];
    const exists = killers.some(k =>
        k && k.fromRow === move.fromRow && k.fromCol === move.fromCol &&
        k.toRow === move.toRow && k.toCol === move.toCol
    );

    if (!exists) {
        killers.unshift(move);
        if (killers.length > 2) killers.pop();
    }
}

function updateHistory(move, depth) {
    const historyKey = `${move.fromRow},${move.fromCol},${move.toRow},${move.toCol}`;
    if (!historyTable[historyKey]) {
        historyTable[historyKey] = 0;
    }
    historyTable[historyKey] += depth * depth;
}

// MOVE GENERATION

function getAllValidMoves(color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && getPieceColor(piece) === color) {
                const pieceMoves = getValidMovesForPiece(row, col);
                for (const move of pieceMoves) {
                    moves.push({ fromRow: row, fromCol: col, toRow: move.row, toCol: move.col });
                }
            }
        }
    }
    return moves;
}

function getValidMovesForPiece(row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    const pieceType = piece.toLowerCase();

    switch (pieceType) {
        case 'p':
            moves.push(...getPawnMoves(row, col));
            break;
        case 'n':
            moves.push(...getKnightMoves(row, col));
            break;
        case 'b':
            moves.push(...getBishopMoves(row, col));
            break;
        case 'r':
            moves.push(...getRookMoves(row, col));
            break;
        case 'q':
            moves.push(...getQueenMoves(row, col));
            break;
        case 'k':
            moves.push(...getKingMoves(row, col));
            break;
    }

    return moves.filter(move => !wouldBeInCheck(row, col, move.row, move.col));
}

function getPawnMoves(row, col) {
    const moves = [];
    const piece = board[row][col];
    const direction = piece === 'P' ? -1 : 1;
    const startRow = piece === 'P' ? 6 : 1;

    if (isValidSquare(row + direction, col) && !board[row + direction][col]) {
        moves.push({ row: row + direction, col });

        if (row === startRow && !board[row + 2 * direction][col]) {
            moves.push({ row: row + 2 * direction, col });
        }
    }

    for (const colOffset of [-1, 1]) {
        const newRow = row + direction;
        const newCol = col + colOffset;
        if (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (targetPiece && getPieceColor(targetPiece) !== getPieceColor(piece)) {
                moves.push({ row: newRow, col: newCol });
            }
            if (enPassantTarget &&
                newRow === enPassantTarget.row &&
                newCol === enPassantTarget.col) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    return moves;
}

function getKnightMoves(row, col) {
    const moves = [];
    const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const [rowOffset, colOffset] of offsets) {
        const newRow = row + rowOffset;
        const newCol = col + colOffset;
        if (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece || getPieceColor(targetPiece) !== getPieceColor(board[row][col])) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    return moves;
}

function getBishopMoves(row, col) {
    return getSlidingMoves(row, col, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
}

function getRookMoves(row, col) {
    return getSlidingMoves(row, col, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
}

function getQueenMoves(row, col) {
    return getSlidingMoves(row, col, [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ]);
}

function getKingMoves(row, col) {
    const moves = [];
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    for (const [rowOffset, colOffset] of offsets) {
        const newRow = row + rowOffset;
        const newCol = col + colOffset;
        if (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece || getPieceColor(targetPiece) !== getPieceColor(board[row][col])) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    // Castling
    const color = getPieceColor(board[row][col]);
    if (castlingRights[color].kingside &&
        !board[row][5] && !board[row][6] &&
        !isSquareUnderAttack(row, 4, color) &&
        !isSquareUnderAttack(row, 5, color) &&
        !isSquareUnderAttack(row, 6, color)) {
        moves.push({ row, col: 6 });
    }
    if (castlingRights[color].queenside &&
        !board[row][1] && !board[row][2] && !board[row][3] &&
        !isSquareUnderAttack(row, 4, color) &&
        !isSquareUnderAttack(row, 3, color) &&
        !isSquareUnderAttack(row, 2, color)) {
        moves.push({ row, col: 2 });
    }

    return moves;
}

function getSlidingMoves(row, col, directions) {
    const moves = [];
    const piece = board[row][col];

    for (const [rowDir, colDir] of directions) {
        let newRow = row + rowDir;
        let newCol = col + colDir;

        while (isValidSquare(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece) {
                moves.push({ row: newRow, col: newCol });
            } else {
                if (getPieceColor(targetPiece) !== getPieceColor(piece)) {
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

// UTILITY FUNCTIONS

function isValidSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getPieceColor(piece) {
    return piece === piece.toUpperCase() ? 'white' : 'black';
}

function wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
    const originalPiece = board[toRow][toCol];
    board[toRow][toCol] = board[fromRow][fromCol];
    board[fromRow][fromCol] = null;

    const color = getPieceColor(board[toRow][toCol]);
    const inCheck = isInCheck(color);

    board[fromRow][fromCol] = board[toRow][toCol];
    board[toRow][toCol] = originalPiece;

    return inCheck;
}

function isInCheck(color) {
    let kingRow, kingCol;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.toLowerCase() === 'k' && getPieceColor(piece) === color) {
                kingRow = row;
                kingCol = col;
                break;
            }
        }
    }

    return isSquareUnderAttack(kingRow, kingCol, color);
}

function isSquareUnderAttack(row, col, defenderColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPieceColor(piece) !== defenderColor) {
                const moves = getRawMoves(r, c);
                if (moves.some(move => move.row === row && move.col === col)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getRawMoves(row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const pieceType = piece.toLowerCase();
    switch (pieceType) {
        case 'p': return getPawnMoves(row, col);
        case 'n': return getKnightMoves(row, col);
        case 'b': return getBishopMoves(row, col);
        case 'r': return getRookMoves(row, col);
        case 'q': return getQueenMoves(row, col);
        case 'k': return getKingMoves(row, col).filter(m => Math.abs(m.col - col) <= 1);
        default: return [];
    }
}

// FEN GENERATION

function getFEN() {
    let fen = '';

    for (let row = 0; row < 8; row++) {
        let emptyCount = 0;
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
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

    fen += ' ' + (currentTurn === 'white' ? 'w' : 'b');

    let castling = '';
    if (castlingRights.white.kingside) castling += 'K';
    if (castlingRights.white.queenside) castling += 'Q';
    if (castlingRights.black.kingside) castling += 'k';
    if (castlingRights.black.queenside) castling += 'q';
    fen += ' ' + (castling || '-');

    if (enPassantTarget) {
        fen += ' ' + String.fromCharCode(97 + enPassantTarget.col) + (8 - enPassantTarget.row);
    } else {
        fen += ' -';
    }

    return fen;
}

function countRepetitions() {
    const currentFEN = getFEN().split(' ')[0];
    let count = 0;
    for (const fen of positionHistory) {
        if (fen.split(' ')[0] === currentFEN) {
            count++;
        }
    }
    return count;
}
