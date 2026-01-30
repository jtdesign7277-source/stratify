import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function translateStrategy(userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a trading strategy code generator. When given a trading strategy description, respond with a brief explanation followed by Python code in a markdown code block. Always use the Alpaca trading library.`,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text;
}
