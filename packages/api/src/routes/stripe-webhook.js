/**
 * Stripe webhook handler (separate file to handle raw body)
 */

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

// Use DATABASE_URL from environment
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    : {
        host: 'localhost',
        database: 'winston',
        user: 'winston',
        password: 'winston',
        port: 5432
      }
);

/**
 * POST /webhook
 * Handle Stripe webhook events
 *
 * IMPORTANT: This must use express.raw() middleware, not express.json()
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe] Webhook secret not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe] Webhook received: ${event.type}`);

  // Handle the event
  try {
    switch (event.type) {
      case 'customer.created':
        await handleCustomerCreated(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'payment_method.attached':
        console.log('[Stripe] Payment method attached:', event.data.object.id);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe] Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Webhook event handlers
async function handleCustomerCreated(customer) {
  console.log(`[Stripe] Customer created: ${customer.id} (${customer.email})`);
}

async function handleSubscriptionCreated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  console.log(`[Stripe] Subscription created: ${subscriptionId}`);

  const result = await pool.query(
    'SELECT id FROM tenants WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      'UPDATE tenants SET stripe_subscription_id = $1, updated_at = NOW() WHERE id = $2',
      [subscriptionId, result.rows[0].id]
    );
  }
}

async function handleSubscriptionUpdated(subscription) {
  const subscriptionId = subscription.id;
  const status = subscription.status;

  console.log(`[Stripe] Subscription updated: ${subscriptionId}, status: ${status}`);

  const result = await pool.query(
    'SELECT id FROM tenants WHERE stripe_subscription_id = $1',
    [subscriptionId]
  );

  if (result.rows.length > 0) {
    let tenantStatus = 'active';
    if (status === 'canceled' || status === 'incomplete_expired') {
      tenantStatus = 'suspended';
    } else if (status === 'past_due') {
      tenantStatus = 'past_due';
    }

    await pool.query(
      'UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2',
      [tenantStatus, result.rows[0].id]
    );
  }
}

async function handleSubscriptionDeleted(subscription) {
  const subscriptionId = subscription.id;

  console.log(`[Stripe] Subscription deleted: ${subscriptionId}`);

  const result = await pool.query(
    'SELECT id FROM tenants WHERE stripe_subscription_id = $1',
    [subscriptionId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      'UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2',
      ['suspended', result.rows[0].id]
    );
  }
}

async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;

  console.log(`[Stripe] Payment succeeded`);

  if (!subscriptionId) return;

  const result = await pool.query(
    'SELECT id, credits_monthly_allotment FROM tenants WHERE stripe_subscription_id = $1',
    [subscriptionId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      `UPDATE tenants
       SET credits_remaining = credits_monthly_allotment,
           credits_refresh_date = NOW() + INTERVAL '30 days',
           status = 'active',
           updated_at = NOW()
       WHERE id = $1`,
      [result.rows[0].id]
    );
  }
}

async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;

  console.log(`[Stripe] Payment failed`);

  if (!subscriptionId) return;

  const result = await pool.query(
    'SELECT id FROM tenants WHERE stripe_subscription_id = $1',
    [subscriptionId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      'UPDATE tenants SET status = $1, updated_at = NOW() WHERE id = $2',
      ['past_due', result.rows[0].id]
    );
  }
}

module.exports = router;
