// Enhanced fix for chessboard display and interaction issues in lessons

// Board analysis function to verify puzzle validity
function analyzeBoardPosition(chessGame, lesson) {
    const analysis = {
        valid: true,
        issues: [],
        suggestions: []
    };
    
    // Check if the solution move is actually legal
    const solution = lesson.solution;
    if (solution && solution.from && solution.to) {
        const fromPos = notationToCoordinate(solution.from);
        const toPos = notationToCoordinate(solution.to);
        
        if (fromPos && toPos) {
            const validMoves = chessGame.getValidMovesForPiece(fromPos.row, fromPos.col);
            const solutionLegal = validMoves.some(move => 
                move.row === toPos.row && move.col === toPos.col
            );
            
            if (!solutionLegal) {
                analysis.valid = false;
                analysis.issues.push(`Solution move ${solution.notation} is not legal in this position`);
            }
            
            // Check if it's actually the player's turn
            const piece = chessGame.board[fromPos.row][fromPos.col];
            if (piece) {
                const pieceColor = chessGame.getPieceColor(piece);
                if (pieceColor !== lesson.playerColor) {
                    analysis.valid = false;
                    analysis.issues.push(`Solution piece belongs to ${pieceColor} but lesson is for ${lesson.playerColor}`);
                }
            } else {
                analysis.valid = false;
                analysis.issues.push(`No piece found at solution square ${solution.from}`);
            }
        }
    }
    
    // For tactical lessons, check if the position actually contains tactical motifs
    if (lesson.title.toLowerCase().includes('fork')) {
        analysis.suggestions.push('Verify that the solution move creates a fork (attacks 2+ pieces)');
    }
    if (lesson.title.toLowerCase().includes('pin')) {
        analysis.suggestions.push('Verify that the solution move creates a pin (restricts piece movement)');
    }
    
    return analysis;
}

// Helper function to convert chess notation to coordinates
function notationToCoordinate(notation) {
    if (notation.length !== 2) return null;
    const file = notation.charCodeAt(0) - 97; // a-h to 0-7
    const rank = 8 - parseInt(notation[1]); // 1-8 to 7-0
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    return { row: rank, col: file };
}

// Override the setupLessonPosition method to properly initialize the lesson board
LessonEngine.prototype.setupLessonPosition = function() {
    if (!this.currentLesson || !this.chessGame) return;

    console.log('Setting up lesson:', this.currentLesson.title);
    console.log('FEN:', this.currentLesson.fen);
    console.log('Expected player color:', this.currentLesson.playerColor);

    // Enable lesson mode and set the correct board element FIRST
    this.chessGame.setLessonMode(true);
    this.chessGame.currentBoardElement = 'lesson-chessboard';
    
    // Parse FEN and set up board
    this.chessGame.loadFEN(this.currentLesson.fen);
    
    // Set player color
    const playerColor = this.currentLesson.playerColor || 'white';
    this.chessGame.setPlayerColor(playerColor);
    this.chessGame.currentTurn = playerColor;
    
    // Analyze the position for validity
    const analysis = analyzeBoardPosition(this.chessGame, this.currentLesson);
    console.log('📊 Position Analysis Results:');
    console.log('  Valid:', analysis.valid);
    console.log('  Issues:', analysis.issues);
    console.log('  Suggestions:', analysis.suggestions);
    
    if (!analysis.valid) {
        console.warn('⚠️ Lesson position issues detected:');
        analysis.issues.forEach(issue => console.warn('  -', issue));
    }
    if (analysis.suggestions.length > 0) {
        console.info('💡 Suggestions:');
        analysis.suggestions.forEach(suggestion => console.info('  -', suggestion));
    }
    
    // Initialize and render the lesson board with click handlers
    this.chessGame.initializeBoard();
    this.chessGame.renderBoard();
    this.chessGame.updateUI();
    
    console.log('Lesson setup complete. Current turn:', this.chessGame.currentTurn);
    console.log('Player color:', this.chessGame.playerColor);
    
    // Display analysis results in UI if there are issues
    if (!analysis.valid) {
        const feedbackDiv = document.getElementById('lesson-feedback');
        if (feedbackDiv) {
            feedbackDiv.style.display = 'block';
            feedbackDiv.innerHTML = `
                <div class="feedback-error">
                    <div class="feedback-icon">⚠️</div>
                    <div class="feedback-text">
                        <h4>Position Analysis</h4>
                        <p>This lesson position may have issues:</p>
                        <ul>${analysis.issues.map(issue => `<li>${issue}</li>`).join('')}</ul>
                    </div>
                </div>
            `;
        }
    }
};

// Fix the board initialization to add click handlers to lesson board
ChessGame.prototype.initializeLessonBoard = function() {
    const boardElement = document.getElementById('lesson-chessboard');
    if (!boardElement) return;
    boardElement.innerHTML = '';

    // Determine if board should be flipped (black at bottom)
    const isBlackPlayer = this.playerColor === 'black';
    
    // Create squares in display order
    for (let displayRow = 0; displayRow < 8; displayRow++) {
        for (let displayCol = 0; displayCol < 8; displayCol++) {
            const square = document.createElement('div');
            
            // Calculate actual board coordinates (flip for black player)
            const actualRow = isBlackPlayer ? (7 - displayRow) : displayRow;
            const actualCol = isBlackPlayer ? (7 - displayCol) : displayCol;
            
            square.className = `square ${(displayRow + displayCol) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = actualRow;
            square.dataset.col = actualCol;

            const piece = this.board[actualRow][actualCol];
            if (piece) {
                square.textContent = PIECES[piece];
                square.classList.add('piece');
            }

            // Add click handler for lesson mode
            square.addEventListener('click', () => this.handleSquareClick(actualRow, actualCol));
            boardElement.appendChild(square);
        }
    }

    this.updateUI();
};

// Override initializeBoard to use lesson board when in lesson mode
const originalInitializeBoard = ChessGame.prototype.initializeBoard;
ChessGame.prototype.initializeBoard = function() {
    if (this.lessonMode && this.currentBoardElement === 'lesson-chessboard') {
        this.initializeLessonBoard();
    } else {
        originalInitializeBoard.call(this);
    }
};

// Also fix the switchToLessonView method
if (window.SkillTreeRenderer) {
    SkillTreeRenderer.prototype.switchToLessonView = function() {
        document.getElementById('skill-tree-view').style.display = 'none';
        document.getElementById('lesson-view').style.display = 'block';
        
        // Enable lesson mode in chess game
        if (window.game) {
            window.game.setLessonMode(true);
            window.game.currentBoardElement = 'lesson-chessboard';
        }
    };
}