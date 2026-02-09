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

    // Fetch all existing orders to check for duplicates
    const { data: existingOrders, error: fetchError } = await supabase
      .from('orders')
      .select('*');

    if (fetchError) {
      console.error('Error fetching existing orders:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch existing orders',
        details: fetchError.message
      });
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    const errors = [];

    // Process each order individually to handle upsert logic
    for (let i = 0; i < purchases.length; i++) {
      const newOrder = purchases[i];

      // Find matching existing order (same seller, date, items, total)
      const matchingOrder = existingOrders?.find(existing => {
        return (
          existing.seller === newOrder.seller &&
          existing.date === newOrder.date &&
          existing.total === newOrder.total &&
          JSON.stringify(existing.items) === JSON.stringify(newOrder.items)
        );
      });

      try {
        if (matchingOrder) {
          // Order exists - update it if status is different
          if (matchingOrder.status !== newOrder.status ||
              matchingOrder.delivery_cost !== newOrder.delivery_cost) {
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: newOrder.status,
                delivery_cost: newOrder.delivery_cost,
                total: newOrder.total
              })
              .eq('id', matchingOrder.id);

            if (updateError) {
              console.error(`Error updating order ${i + 1}:`, updateError);
              errors.push({
                order: i + 1,
                action: 'update',
                error: updateError.message
              });
            } else {
              totalUpdated++;
              console.log(`Order ${i + 1} updated (was: ${matchingOrder.status}, now: ${newOrder.status})`);
            }
          } else {
            console.log(`Order ${i + 1} unchanged, skipping`);
          }
        } else {
          // Order doesn't exist - insert it
          const { error: insertError } = await supabase
            .from('orders')
            .insert([newOrder]);

          if (insertError) {
            console.error(`Error inserting order ${i + 1}:`, insertError);
            errors.push({
              order: i + 1,
              action: 'insert',
              error: insertError.message
            });
          } else {
            totalInserted++;
            console.log(`Order ${i + 1} inserted`);
          }
        }
      } catch (orderError) {
        console.error(`Error processing order ${i + 1}:`, orderError);
        errors.push({
          order: i + 1,
          error: orderError instanceof Error ? orderError.message : 'Unknown error'
        });
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({
        success: false,
        message: 'Bulk import completed with some errors',
        totalOrders: purchases.length,
        inserted: totalInserted,
        updated: totalUpdated,
        failed: errors.length,
        errors
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bulk import completed successfully',
      totalOrders: purchases.length,
      inserted: totalInserted,
      updated: totalUpdated
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
