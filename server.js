const express = require('express');
const path = require('path');

const app = express();
const PORT = 8000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Handle SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nChess Learning App is running!`);
  console.log(`\nOpen your browser and navigate to: http://localhost:${PORT}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});
