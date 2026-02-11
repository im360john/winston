/**
 * Stripe customer and subscription endpoints
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
 * POST /api/stripe/create-customer
 * Create a Stripe customer with payment method
 */
router.post('/create-customer', async (req, res, next) => {
  try {
    const { email, paymentMethodId, name } = req.body;

    if (!email || !paymentMethodId) {
      return res.status(400).json({
        error: 'Email and payment method are required'
      });
    }

    // Create customer
    const customer = await stripe.customers.create({
      email,
      name: name || email.split('@')[0],
      payment_method: paymentMethodId,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log(`[Stripe] Created customer: ${customer.id} (${email})`);

    res.json({
      customerId: customer.id,
      customer,
    });
  } catch (error) {
    console.error('[Stripe] Create customer error:', error);
    next(error);
  }
});

/**
 * POST /api/stripe/create-subscription
 * Create a subscription for a customer
 */
router.post('/create-subscription', async (req, res, next) => {
  try {
    const { customerId, priceId, tenantId } = req.body;

    if (!customerId || !priceId) {
      return res.status(400).json({
        error: 'Customer ID and price ID are required'
      });
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: {
        tenantId: tenantId || '',
      },
    });

    console.log(`[Stripe] Created subscription: ${subscription.id} for customer ${customerId}`);

    res.json({
      subscriptionId: subscription.id,
      subscription,
    });
  } catch (error) {
    console.error('[Stripe] Create subscription error:', error);
    next(error);
  }
});

module.exports = router;
