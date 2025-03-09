const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

// Quiz Mode: OpenTDB
app.get('/api/trivia', async (req, res) => {
  try {
    const category = req.query.category || '';
    console.log(`Quiz Mode - Received request for category: ${category || 'any'}`);
    const url = category && category !== 'random'
      ? `https://opentdb.com/api.php?amount=10&type=multiple&category=${category}`
      : 'https://opentdb.com/api.php?amount=10&type=multiple';
    console.log(`Quiz Mode - Fetching from OpenTDB: ${url}`);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const response = await axios.get(url, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    console.log('Quiz Mode - OpenTDB Response:', response.data);

    if (response.data.response_code === 0) {
      res.json(response.data.results);
    } else if (response.data.response_code === 5) {
      res.status(429).send('Rate limit exceeded, please try again later');
    } else {
      res.status(500).send(`OpenTDB error code: ${response.data.response_code}`);
    }
  } catch (error) {
    console.error('Quiz Mode - Error fetching trivia:', error.message);
    res.status(500).send('Error fetching trivia questions');
  }
});

// Training Mode: questions.json
app.get('/api/training-trivia', async (req, res) => {
  try {
    const category = req.query.category || '';
    console.log(`Training Mode - Received request for category: ${category || 'any'}`);
    const filePath = path.join(__dirname, 'questions.json');
    const data = await fs.readFile(filePath, 'utf8');
    let questions = JSON.parse(data);

    if (category && category !== 'random') {
      questions = questions.filter(q => q.category.toLowerCase() === category.toLowerCase());
    }
    // Shuffle and limit to 10 (or all if less)
    questions = questions.sort(() => Math.random() - 0.5).slice(0, Math.min(10, questions.length));

    if (questions.length === 0) {
      return res.status(404).send('No questions found for this category');
    }
    res.json(questions);
  } catch (error) {
    console.error('Training Mode - Error fetching trivia:', error.message);
    res.status(500).send('Error fetching trivia questions');
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});