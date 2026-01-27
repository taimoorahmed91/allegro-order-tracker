import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Generate hash
    const hash = await bcrypt.hash(password, 10);

    return res.status(200).json({
      password,
      hash
    });
  } catch (error) {
    console.error('Hash error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
