// Chess Learning Extensions - Additional methods for the ChessGame class

// Add lesson mode methods to ChessGame prototype
ChessGame.prototype.initializeLessonMode = function() {
    // Initialize progress tracker and lesson engine
    this.progressTracker = new ProgressTracker();
    this.lessonEngine = new LessonEngine();
    this.lessonEngine.initialize(this, this.progressTracker);
    
    // Initialize skill tree renderer
    const skillTreeContainer = document.getElementById('skill-trees');
    if (skillTreeContainer) {
        this.skillTreeRenderer = new SkillTreeRenderer(
            skillTreeContainer, 
            this.progressTracker, 
            this.lessonEngine
        );
        this.skillTreeRenderer.initialize();
    }
    
    // Update progress display
    this.updateProgressDisplay();
};

ChessGame.prototype.attachLessonEventListeners = function() {
    // Back to tree button
    document.getElementById('back-to-tree')?.addEventListener('click', () => {
        this.skillTreeRenderer?.switchToSkillTreeView();
    });
    
    // Hint button
    document.getElementById('show-hint')?.addEventListener('click', () => {
        this.skillTreeRenderer?.showHint();
    });
    
    // Next lesson button
    document.getElementById('next-lesson')?.addEventListener('click', () => {
        this.skillTreeRenderer?.nextLesson();
    });
    
    // Try again button
    document.getElementById('try-again')?.addEventListener('click', () => {
        this.lessonEngine?.resetLesson();
        this.skillTreeRenderer?.updateLessonUI();
    });
    
    // Previous lesson button
    document.getElementById('prev-lesson')?.addEventListener('click', () => {
        this.skillTreeRenderer?.previousLesson();
    });
    
    // Reset lesson button
    document.getElementById('reset-lesson')?.addEventListener('click', () => {
        this.lessonEngine?.resetLesson();
        this.skillTreeRenderer?.updateLessonUI();
    });
    
    // Skip lesson button
    document.getElementById('skip-lesson')?.addEventListener('click', () => {
        this.skillTreeRenderer?.nextLesson();
    });
};

ChessGame.prototype.switchToLearnMode = function() {
    this.updateModeButtons('learn-mode');
    document.getElementById('skill-tree-view').style.display = 'block';
    document.getElementById('lesson-view').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    this.lessonMode = false;
};

ChessGame.prototype.switchToPracticeMode = function() {
    this.updateModeButtons('practice-mode');
    alert('Practice mode coming soon!');
};

ChessGame.prototype.switchToPlayMode = function() {
    this.updateModeButtons('play-mode');
    document.getElementById('skill-tree-view').style.display = 'none';
    document.getElementById('lesson-view').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    this.lessonMode = false;
    this.currentBoardElement = 'chessboard';
    this.newGame();
};

ChessGame.prototype.updateModeButtons = function(activeMode) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(activeMode)?.classList.add('active');
};

ChessGame.prototype.setLessonMode = function(enabled) {
    this.lessonMode = enabled;
    if (enabled) {
        this.currentBoardElement = 'lesson-chessboard';
    } else {
        this.currentBoardElement = 'chessboard';
    }
};

ChessGame.prototype.handleLessonSquareClick = function(row, col) {
    if (!this.lessonEngine || !this.lessonEngine.getCurrentLesson()) return;
    
    const lesson = this.lessonEngine.getCurrentLesson();
    const piece = this.board[row][col];
    
    // Check if it's the player's turn (lesson color)
    if (this.currentTurn !== lesson.playerColor) return;

    if (this.selectedSquare) {
        const [selectedRow, selectedCol] = this.selectedSquare;
        const isValidMove = this.validMoves.some(
            move => move.row === row && move.col === col
        );

        if (isValidMove) {
            // Validate the move with lesson engine
            const result = this.lessonEngine.validateMove(selectedRow, selectedCol, row, col);
            
            if (result.valid) {
                // Make the move
                this.makeMove(selectedRow, selectedCol, row, col);
                this.selectedSquare = null;
                this.validMoves = [];
                this.renderBoard();
                
                // Update progress tracker
                this.progressTracker.recordMove(result.correct);
                
                if (result.correct) {
                    // Award points and complete lesson
                    const xpResult = this.progressTracker.addXP(result.points);
                    this.lessonEngine.completeCurrentLesson(result.points);
                    
                    // Show level up if occurred
                    if (xpResult.levelUp) {
                        this.showLevelUp(xpResult.newLevel);
                    }
                }
                
                // Show feedback
                this.skillTreeRenderer?.showLessonFeedback(result);
                
                // Update progress display
                this.updateProgressDisplay();
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
};

ChessGame.prototype.loadFEN = function(fen) {
    const parts = fen.split(' ');
    const position = parts[0];
    const turn = parts[1];
    
    // Parse board position
    this.board = [];
    const rows = position.split('/');
    
    for (let i = 0; i < 8; i++) {
        this.board[i] = [];
        let col = 0;
        
        for (const char of rows[i]) {
            if (char >= '1' && char <= '8') {
                // Empty squares
                const emptyCount = parseInt(char);
                for (let j = 0; j < emptyCount; j++) {
                    this.board[i][col++] = null;
                }
            } else {
                // Piece
                this.board[i][col++] = char;
            }
        }
    }
    
    // Set turn
    this.currentTurn = turn === 'w' ? 'white' : 'black';
    
    // Reset other game state
    this.gameOver = false;
    this.selectedSquare = null;
    this.validMoves = [];
    this.lastMove = null;
    
    // Render the board
    this.initializeBoard();
};

ChessGame.prototype.setPlayerColor = function(color) {
    this.playerColor = color;
    this.aiColor = color === 'white' ? 'black' : 'white';
};

ChessGame.prototype.updateProgressDisplay = function() {
    if (!this.progressTracker) return;
    
    const summary = this.progressTracker.getProgressSummary();
    const xpProgress = this.progressTracker.getXPProgress();
    
    // Update level
    const levelElement = document.getElementById('user-level');
    if (levelElement) {
        levelElement.textContent = summary.level;
    }
    
    // Update XP bar
    const xpProgressElement = document.getElementById('xp-progress');
    if (xpProgressElement) {
        xpProgressElement.style.width = `${xpProgress.percentage}%`;
    }
    
    // Update XP text
    const currentXPElement = document.getElementById('current-xp');
    const nextLevelXPElement = document.getElementById('next-level-xp');
    if (currentXPElement && nextLevelXPElement) {
        currentXPElement.textContent = xpProgress.current;
        nextLevelXPElement.textContent = xpProgress.needed;
    }
    
    // Update stats
    const streakElement = document.getElementById('streak-count');
    const accuracyElement = document.getElementById('accuracy');
    if (streakElement) streakElement.textContent = summary.streak;
    if (accuracyElement) accuracyElement.textContent = summary.accuracy;
};

ChessGame.prototype.showLevelUp = function(newLevel) {
    const badge = this.progressTracker.getBadgeForLevel(newLevel);
    this.skillTreeRenderer?.showAchievement({
        name: `Level ${newLevel}!`,
        description: `You are now ${badge}`,
        icon: '🎉'
    });
};