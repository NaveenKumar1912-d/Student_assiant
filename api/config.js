export default function handler(req, res) {
  res.status(200).json({
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  });
}
