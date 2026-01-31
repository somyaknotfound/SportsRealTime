import express from 'express';

const app = express();
const PORT = process.env.PORT || 8000;

// JSON middleware
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Start server and log URL
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}/`);
});
