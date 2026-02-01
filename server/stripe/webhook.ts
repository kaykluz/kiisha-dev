/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for payment processing,
 * invoice payments, and subscription management.
 */

import Stripe from 'stripe';
import { Request, Response } from 'express';
import * as db from '../db';
import { ENV } from '../_core/env';

// Lazy-initialize Stripe so the app can start without STRIPE_SECRET_KEY
let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!_stripe && ENV.stripeSecretKey) {
    _stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: '2025-12-15.clover' });
  }
  return _stripe;
}

/**
 * Verify and handle Stripe webhook events
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = ENV.stripeWebhookSecret;
  
  if (!webhookSecret) {
    console.error('[Stripe Webhook] No webhook secret configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  let event: Stripe.Event;
  
  try {
    const stripeClient = getStripe();
    if (!stripeClient) {
      console.error('[Stripe Webhook] Stripe not configured');
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  // Handle test events
  if (event.id.startsWith('evt_test_')) {
    console.log('[Stripe Webhook] Test event detected, returning verification response');
    return res.json({ verified: true });
  }
  
  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
        
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;
        
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Stripe] Checkout completed: ${session.id}`);
  
  const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
  const invoiceId = session.metadata?.invoice_id ? parseInt(session.metadata.invoice_id) : null;
  const customerId = session.metadata?.customer_id ? parseInt(session.metadata.customer_id) : null;
  
  // Update customer with Stripe customer ID if new
  if (customerId && session.customer) {
    await db.updateCustomerStripeId(customerId, session.customer as string);
  }
  
  // Record payment if linked to an invoice
  if (invoiceId && session.amount_total) {
    await db.recordInvoicePayment({
      invoiceId,
      amount: session.amount_total / 100, // Convert from cents
      paymentMethod: 'stripe',
      stripePaymentIntentId: session.payment_intent as string || null,
      stripeSessionId: session.id,
      status: 'completed',
      paidAt: new Date(),
      paidBy: userId || undefined,
    });
    
    // Update invoice status
    await db.updateInvoicePaymentStatus(invoiceId);
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe] Payment succeeded: ${paymentIntent.id}`);
  
  const invoiceId = paymentIntent.metadata?.invoice_id 
    ? parseInt(paymentIntent.metadata.invoice_id) 
    : null;
  
  if (invoiceId) {
    // Update any pending payment records
    await db.updatePaymentByStripeId(paymentIntent.id, {
      status: 'completed',
      paidAt: new Date(),
    });
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe] Payment failed: ${paymentIntent.id}`);
  
  const invoiceId = paymentIntent.metadata?.invoice_id 
    ? parseInt(paymentIntent.metadata.invoice_id) 
    : null;
  
  if (invoiceId) {
    await db.updatePaymentByStripeId(paymentIntent.id, {
      status: 'failed',
    });
  }
}

/**
 * Handle paid Stripe invoice (for subscriptions)
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log(`[Stripe] Invoice paid: ${invoice.id}`);
  
  // This is for Stripe-generated invoices (subscriptions)
  // Our internal invoices are handled via checkout.session.completed
}

/**
 * Handle failed Stripe invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[Stripe] Invoice payment failed: ${invoice.id}`);
}

/**
 * Handle new Stripe customer created
 */
async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log(`[Stripe] Customer created: ${customer.id}`);
  
  // If we have metadata linking to our customer, update the record
  const customerId = customer.metadata?.customer_id 
    ? parseInt(customer.metadata.customer_id) 
    : null;
  
  if (customerId) {
    await db.updateCustomerStripeId(customerId, customer.id);
  }
}

/**
 * Create a checkout session for invoice payment
 */
export async function createInvoiceCheckoutSession(
  invoiceId: number,
  customerId: number,
  userId: number | null,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  // Get invoice details
  const invoice = await db.getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }
  
  // Get customer details
  const customer = await db.getCustomerById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  // Get or create Stripe customer
  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  let stripeCustomerId = customer.stripeCustomerId;
  if (!stripeCustomerId) {
    const stripeCustomer = await stripeClient.customers.create({
      email: customer.email || undefined,
      name: customer.name || undefined,
      metadata: {
        customer_id: customerId.toString(),
      },
    });
    stripeCustomerId = stripeCustomer.id;
    await db.updateCustomerStripeId(customerId, stripeCustomerId);
  }
  
  // Get invoice line items
  const lineItems = await db.getInvoiceLineItems(invoiceId);
  
  // Create Stripe line items
  const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lineItems.map(item => ({
    price_data: {
      currency: invoice.currency || 'usd',
      product_data: {
        name: item.description || 'Invoice Item',
      },
      unit_amount: Math.round((item.unitPrice || 0) * 100), // Convert to cents
    },
    quantity: item.quantity || 1,
  }));
  
  // If no line items, create a single line item for the total
  if (stripeLineItems.length === 0) {
    stripeLineItems.push({
      price_data: {
        currency: invoice.currency || 'usd',
        product_data: {
          name: `Invoice #${invoice.invoiceNumber || invoiceId}`,
        },
        unit_amount: Math.round((invoice.totalAmount || 0) * 100),
      },
      quantity: 1,
    });
  }
  
  // Create checkout session
  const session = await stripeClient.checkout.sessions.create({
    customer: stripeCustomerId,
    client_reference_id: userId?.toString() || customerId.toString(),
    line_items: stripeLineItems,
    mode: 'payment',
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      invoice_id: invoiceId.toString(),
      customer_id: customerId.toString(),
      user_id: userId?.toString() || '',
      customer_email: customer.email || '',
      customer_name: customer.name || '',
    },
  });
  
  return {
    url: session.url || '',
    sessionId: session.id,
  };
}

/**
 * Get payment status from Stripe
 */
export async function getPaymentStatus(sessionId: string): Promise<{
  status: 'complete' | 'expired' | 'open';
  paymentStatus: string | null;
  amountTotal: number | null;
}> {
  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }
  const session = await stripeClient.checkout.sessions.retrieve(sessionId);
  
  return {
    status: session.status || 'open',
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total ? session.amount_total / 100 : null,
  };
}
