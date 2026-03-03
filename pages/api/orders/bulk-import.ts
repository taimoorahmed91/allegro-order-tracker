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
    let totalDuplicates = 0;
    const orderResults = [];

    // Process each order individually to handle upsert logic
    for (let i = 0; i < purchases.length; i++) {
      const newOrder = purchases[i];
      const orderLabel = `${newOrder.date} | ${newOrder.seller || 'Unknown'} | PLN ${newOrder.total}`;

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
          // Order exists - update it if status or delivery_cost changed
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
              orderResults.push({
                index: i + 1,
                order: orderLabel,
                result: 'failed',
                action: 'update',
                error: updateError.message
              });
            } else {
              totalUpdated++;
              console.log(`Order ${i + 1} updated (was: ${matchingOrder.status}, now: ${newOrder.status})`);
              orderResults.push({
                index: i + 1,
                order: orderLabel,
                result: 'updated',
                detail: `Status: ${matchingOrder.status} → ${newOrder.status}`
              });
            }
          } else {
            // Exact duplicate — no changes needed
            totalDuplicates++;
            console.log(`Order ${i + 1} unchanged, skipping`);
            orderResults.push({
              index: i + 1,
              order: orderLabel,
              result: 'duplicate'
            });
          }
        } else {
          // Order doesn't exist - insert it
          const { error: insertError } = await supabase
            .from('orders')
            .insert([newOrder]);

          if (insertError) {
            console.error(`Error inserting order ${i + 1}:`, insertError);
            orderResults.push({
              index: i + 1,
              order: orderLabel,
              result: 'failed',
              action: 'insert',
              error: insertError.message
            });
          } else {
            totalInserted++;
            console.log(`Order ${i + 1} inserted`);
            orderResults.push({
              index: i + 1,
              order: orderLabel,
              result: 'inserted'
            });
          }
        }
      } catch (orderError) {
        console.error(`Error processing order ${i + 1}:`, orderError);
        orderResults.push({
          index: i + 1,
          order: orderLabel,
          result: 'failed',
          error: orderError instanceof Error ? orderError.message : 'Unknown error'
        });
      }
    }

    const totalFailed = orderResults.filter(r => r.result === 'failed').length;

    if (totalFailed > 0) {
      return res.status(207).json({
        success: false,
        message: 'Bulk import completed with some errors',
        totalOrders: purchases.length,
        inserted: totalInserted,
        updated: totalUpdated,
        duplicates: totalDuplicates,
        failed: totalFailed,
        orderResults
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bulk import completed successfully',
      totalOrders: purchases.length,
      inserted: totalInserted,
      updated: totalUpdated,
      duplicates: totalDuplicates,
      failed: 0,
      orderResults
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
