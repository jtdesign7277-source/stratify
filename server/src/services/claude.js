import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function translateStrategy(userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are a trading strategy translator. Convert natural language trading strategies into structured JSON for Alpaca. Respond with JSON like: {"symbol": "AAPL", "action": "buy", "quantity": 10, "orderType": "market", "explanation": "Brief explanation"}. If just chatting, respond normally.`,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text;
}
