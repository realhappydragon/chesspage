// Test script to verify chess positions and solutions
console.log('🧪 Testing Chess Positions...');

// Simple FEN parser for testing
function parseFEN(fen) {
    const parts = fen.split(' ');
    const position = parts[0];
    const turn = parts[1];
    
    const board = [];
    const rows = position.split('/');
    
    for (let i = 0; i < 8; i++) {
        board[i] = [];
        let col = 0;
        
        for (const char of rows[i]) {
            if (char >= '1' && char <= '8') {
                const emptyCount = parseInt(char);
                for (let j = 0; j < emptyCount; j++) {
                    board[i][col++] = null;
                }
            } else {
                board[i][col++] = char;
            }
        }
    }
    
    return { board, turn: turn === 'w' ? 'white' : 'black' };
}

// Test knight fork position
const knightForkFEN = "r3k3/8/8/4N3/8/8/8/4K3 w - - 0 1";
const parsed = parseFEN(knightForkFEN);

console.log('🏰 Knight Fork Position:');
console.log('Turn:', parsed.turn);
console.log('Knight on e5:', parsed.board[3][4]); // e5 = row 3, col 4
console.log('Black king on e8:', parsed.board[0][4]); // e8 = row 0, col 4  
console.log('Black rook on a8:', parsed.board[0][0]); // a8 = row 0, col 0

// Test solution: Nd7+
const d7Row = 1, d7Col = 3; // d7 = row 1, col 3
console.log('Solution square d7 is empty:', parsed.board[d7Row][d7Col] === null);

// Check if knight can actually reach d7 from e5
function isKnightMove(fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

const canMove = isKnightMove(3, 4, 1, 3); // e5 to d7
console.log('Knight can move e5 to d7:', canMove);

console.log('✅ Position test complete');

if (typeof module !== 'undefined') {
    module.exports = { parseFEN, isKnightMove };
}