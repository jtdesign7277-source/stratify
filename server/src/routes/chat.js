import express from 'express';
import { translateStrategy } from '../services/claude.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const response = await translateStrategy(message);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
