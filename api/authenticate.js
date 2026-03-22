// api/authenticate.js
// Vercel serverless function — runs on the server, cipher never sent to browser.
//
// SETUP: Add your ciphers to Vercel environment variables:
//   CIPHER_1=GENESIS2026
//   CIPHER_2=KINETIC2026
//
// In Vercel dashboard → Project → Settings → Environment Variables
// Then redeploy. Never hardcode ciphers in source.

export default function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cipher } = req.body;

  if (!cipher || typeof cipher !== 'string') {
    return res.status(400).json({ success: false, error: 'No cipher provided' });
  }

  const input = cipher.trim().toUpperCase();

  // Ciphers live in environment variables — never in client code
  const validCiphers = [
    process.env.CIPHER_1,
    process.env.CIPHER_2,
    process.env.CIPHER_3, // spare slot for future cohorts
  ].filter(Boolean); // removes undefined slots

  if (validCiphers.length === 0) {
    // Fallback for local dev without env vars set
    console.warn('No CIPHER env vars set. Using dev fallback.');
    if (input === 'DEVMODE') {
      return res.status(200).json({ success: true });
    }
    return res.status(401).json({ success: false, error: 'Invalid cipher' });
  }

  if (validCiphers.includes(input)) {
    // Issue a simple session token
    // For production, replace with a signed JWT or httpOnly cookie
    return res.status(200).json({ success: true, token: generateToken() });
  }

  // Rate limiting note: for production, add IP-based rate limiting here
  // e.g. using Vercel KV or Upstash Redis to track failed attempts
  return res.status(401).json({ success: false, error: 'Invalid cipher' });
}

function generateToken() {
  // Simple token — replace with crypto.randomUUID() or JWT in production
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

