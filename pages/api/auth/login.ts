import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../src/lib/supabase';
import bcrypt from 'bcryptjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    console.log('Login attempt:', { username, passwordLength: password?.length });

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Fetch user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    console.log('User lookup:', { found: !!user, error: error?.message });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(401).json({ error: 'Invalid username or password', debug: error.message });
    }

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    console.log('User found:', { username: user.username, hasHash: !!user.password_hash });

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    console.log('Password comparison:', { isValid: isValidPassword });

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Return success (you can add JWT token here if needed)
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
