import express from 'express';
import { matchRouter } from './routes/matches.js'; // ADD .js

const app = express();
const PORT = 8000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.use('/matches', matchRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
});