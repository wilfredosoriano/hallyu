import { rankPicks } from '../server/rank.js';

/** Vercel Function. Thin adapter — the logic lives in server/rank.js. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = await rankPicks({
      question: body.question,
      pool: body.pool,
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
