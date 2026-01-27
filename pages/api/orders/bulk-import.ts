import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../src/lib/supabase';
import type { Order } from '../../../src/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const purchases: Order[] = req.body;

    // Validate that we received an array
    if (!Array.isArray(purchases)) {
      return res.status(400).json({
        error: 'Invalid data format. Expected an array of orders.'
      });
    }

    if (purchases.length === 0) {
      return res.status(400).json({
        error: 'No orders to import.'
      });
    }

    console.log(`Starting bulk import of ${purchases.length} orders...`);

    // Insert all orders in batches of 100 to avoid timeout issues
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < purchases.length; i += batchSize) {
      const batch = purchases.slice(i, i + batchSize);
      batches.push(batch);
    }

    let totalInserted = 0;
    const errors = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1} of ${batches.length} (${batch.length} orders)`);

      const { data, error } = await supabase
        .from('orders')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error in batch ${i + 1}:`, error);
        errors.push({
          batch: i + 1,
          error: error.message
        });
      } else {
        totalInserted += data.length;
        console.log(`Batch ${i + 1} completed: ${data.length} orders inserted`);
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({
        success: false,
        message: 'Bulk import completed with errors',
        totalOrders: purchases.length,
        inserted: totalInserted,
        failed: purchases.length - totalInserted,
        errors
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bulk import completed successfully',
      totalOrders: purchases.length,
      inserted: totalInserted
    });

  } catch (error) {
    console.error('Server error during bulk import:', error);
    return res.status(500).json({
      error: 'Internal server error during bulk import',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Increase API route timeout for bulk operations
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};
