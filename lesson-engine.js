class LessonEngine {
    constructor() {
        this.currentLesson = null;
        this.currentLessonIndex = 0;
        this.lessons = [];
        this.skillTrees = null;
        this.progressTracker = null;
        this.chessGame = null;
    }

    async initialize(chessGame, progressTracker) {
        this.chessGame = chessGame;
        this.progressTracker = progressTracker;
        
        // Load skill trees
        try {
            const response = await fetch('skill-trees.json');
            this.skillTrees = await response.json();
        } catch (error) {
            console.error('Failed to load skill trees:', error);
            this.skillTrees = {};
        }
    }

    async loadLessonSet(lessonFile) {
        try {
            const response = await fetch(`lessons/${lessonFile}`);
            const lessonData = await response.json();
            this.lessons = lessonData.lessons;
            this.currentLessonIndex = 0;
            return lessonData;
        } catch (error) {
            console.error(`Failed to load lesson file: ${lessonFile}`, error);
            throw error;
        }
    }

    getCurrentLesson() {
        if (this.currentLessonIndex < this.lessons.length) {
            return this.lessons[this.currentLessonIndex];
        }
        return null;
    }

    startLesson(lessonIndex = 0) {
        if (lessonIndex >= 0 && lessonIndex < this.lessons.length) {
            this.currentLessonIndex = lessonIndex;
            this.currentLesson = this.lessons[lessonIndex];
            this.setupLessonPosition();
            return this.currentLesson;
        }
        return null;
    }

    setupLessonPosition() {
        if (!this.currentLesson || !this.chessGame) return;

        // Parse FEN and set up board
        this.chessGame.loadFEN(this.currentLesson.fen);
        
        // Set player color
        const playerColor = this.currentLesson.playerColor || 'white';
        this.chessGame.setPlayerColor(playerColor);
        
        // Disable AI for lesson mode
        this.chessGame.setLessonMode(true);
        
        // Update UI
        this.chessGame.renderBoard();
        this.chessGame.updateUI();
    }

    validateMove(fromRow, fromCol, toRow, toCol) {
        if (!this.currentLesson) {
            return { valid: false, message: "No active lesson" };
        }

        const moveNotation = this.convertMoveToNotation(fromRow, fromCol, toRow, toCol);
        const solution = this.currentLesson.solution;

        // Check if move matches the solution
        if (this.movesMatch(fromRow, fromCol, toRow, toCol, solution)) {
            return {
                valid: true,
                correct: true,
                message: this.currentLesson.explanation,
                points: this.currentLesson.points || 100
            };
        }

        // Check alternatives for specific feedback
        if (this.currentLesson.alternatives) {
            for (const alt of this.currentLesson.alternatives) {
                if (this.movesMatch(fromRow, fromCol, toRow, toCol, alt)) {
                    return {
                        valid: true,
                        correct: false,
                        message: alt.feedback,
                        hint: "Try again!",
                        points: 0
                    };
                }
            }
        }

        // Generic incorrect move
        return {
            valid: true,
            correct: false,
            message: this.currentLesson.hint || "That's not the best move. Try again!",
            points: 0
        };
    }

    movesMatch(fromRow, fromCol, toRow, toCol, moveData) {
        // Convert chess notation to coordinates
        const fromSquare = this.coordinateToNotation(fromRow, fromCol);
        const toSquare = this.coordinateToNotation(toRow, toCol);
        
        return (fromSquare === moveData.from && toSquare === moveData.to) ||
               (moveData.notation && this.convertMoveToNotation(fromRow, fromCol, toRow, toCol) === moveData.notation);
    }

    coordinateToNotation(row, col) {
        const file = String.fromCharCode(97 + col); // a-h
        const rank = (8 - row).toString(); // 1-8
        return file + rank;
    }

    notationToCoordinate(notation) {
        const file = notation.charCodeAt(0) - 97; // a-h to 0-7
        const rank = 8 - parseInt(notation[1]); // 1-8 to 7-0
        return { row: rank, col: file };
    }

    convertMoveToNotation(fromRow, fromCol, toRow, toCol) {
        // This is a simplified notation converter
        // In a real implementation, you'd need to handle piece disambiguation, castling, etc.
        const piece = this.chessGame.board[fromRow][fromCol];
        const fromSquare = this.coordinateToNotation(fromRow, fromCol);
        const toSquare = this.coordinateToNotation(toRow, toCol);
        const capture = this.chessGame.board[toRow][toCol] ? 'x' : '';
        
        if (piece && piece.toLowerCase() === 'p') {
            // Pawn move
            if (capture) {
                return fromSquare[0] + capture + toSquare;
            }
            return toSquare;
        } else if (piece) {
            // Piece move
            const pieceSymbol = piece.toUpperCase();
            return pieceSymbol + capture + toSquare;
        }
        
        return fromSquare + toSquare;
    }

    completeCurrentLesson(points) {
        if (!this.currentLesson) return false;

        // Award points
        if (this.progressTracker) {
            this.progressTracker.addXP(points);
            this.progressTracker.markLessonComplete(this.currentLesson.id, points);
        }

        return true;
    }

    nextLesson() {
        if (this.currentLessonIndex < this.lessons.length - 1) {
            this.currentLessonIndex++;
            this.startLesson(this.currentLessonIndex);
            return this.getCurrentLesson();
        }
        return null; // No more lessons
    }

    previousLesson() {
        if (this.currentLessonIndex > 0) {
            this.currentLessonIndex--;
            this.startLesson(this.currentLessonIndex);
            return this.getCurrentLesson();
        }
        return null;
    }

    getLessonProgress() {
        return {
            current: this.currentLessonIndex + 1,
            total: this.lessons.length,
            percentage: Math.round(((this.currentLessonIndex + 1) / this.lessons.length) * 100)
        };
    }

    getHint() {
        return this.currentLesson ? this.currentLesson.hint : null;
    }

    getLessonTitle() {
        return this.currentLesson ? this.currentLesson.title : '';
    }

    getLessonDescription() {
        return this.currentLesson ? this.currentLesson.description : '';
    }

    isLessonSetComplete() {
        return this.currentLessonIndex >= this.lessons.length;
    }

    // Multiple choice lesson handling
    validateMultipleChoice(choiceIndex) {
        if (!this.currentLesson || this.currentLesson.type !== 'multiple-choice') {
            return { valid: false, message: "Not a multiple choice lesson" };
        }

        const choice = this.currentLesson.choices[choiceIndex];
        if (!choice) {
            return { valid: false, message: "Invalid choice" };
        }

        return {
            valid: true,
            correct: choice.isCorrect !== false, // Default to true unless explicitly false
            message: choice.feedback,
            points: choice.isCorrect !== false ? (this.currentLesson.points || 100) : 0
        };
    }

    // Sequence lesson handling (for multi-move combinations)
    startSequence() {
        if (this.currentLesson && this.currentLesson.type === 'sequence') {
            this.sequenceIndex = 0;
            this.sequenceMoves = [];
            return true;
        }
        return false;
    }

    validateSequenceMove(fromRow, fromCol, toRow, toCol) {
        if (!this.currentLesson || this.currentLesson.type !== 'sequence') {
            return { valid: false, message: "Not a sequence lesson" };
        }

        const expectedMove = this.currentLesson.sequence[this.sequenceIndex];
        if (this.movesMatch(fromRow, fromCol, toRow, toCol, expectedMove)) {
            this.sequenceMoves.push({ fromRow, fromCol, toRow, toCol });
            this.sequenceIndex++;

            if (this.sequenceIndex >= this.currentLesson.sequence.length) {
                // Sequence complete
                return {
                    valid: true,
                    correct: true,
                    complete: true,
                    message: this.currentLesson.explanation,
                    points: this.currentLesson.points || 150
                };
            } else {
                // Continue sequence
                return {
                    valid: true,
                    correct: true,
                    complete: false,
                    message: `Good! Now play move ${this.sequenceIndex + 1}`,
                    points: 0
                };
            }
        } else {
            // Wrong move in sequence
            return {
                valid: true,
                correct: false,
                message: "That's not the right move in this sequence. Try again!",
                points: 0
            };
        }
    }

    resetLesson() {
        if (this.currentLesson) {
            this.setupLessonPosition();
            this.sequenceIndex = 0;
            this.sequenceMoves = [];
        }
    }

    getAvailableSkillTrees() {
        return this.skillTrees ? Object.values(this.skillTrees) : [];
    }

    getSkillTree(treeId) {
        return this.skillTrees ? this.skillTrees[treeId] : null;
    }

    getAvailableNodes(treeId) {
        const tree = this.getSkillTree(treeId);
        if (!tree || !this.progressTracker) return [];

        return tree.nodes.filter(node => {
            if (!node.prerequisite) return true;
            
            if (Array.isArray(node.prerequisite)) {
                return node.prerequisite.every(prereq => 
                    this.progressTracker.isNodeComplete(prereq)
                );
            } else {
                return this.progressTracker.isNodeComplete(node.prerequisite);
            }
        });
    }
}