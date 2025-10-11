import Stripe from 'stripe';
import config from '../config/env.js';

// Initialize Stripe with the API key
const stripe = new Stripe(config.stripe.secretKey);

/**
 * Create a payment method with Stripe
 * @param {Object} paymentData - Payment method data
 * @returns {Promise<Object>} - Stripe setup intent with client secret
 */
const createSetupIntent = async () => {
  try {
    // Create a SetupIntent instead of directly handling card details
    // This is the secure approach recommended by Stripe
    const setupIntent = await stripe.setupIntents.create({
      usage: 'off_session', // Allow the payment method to be used for future payments
    });
    
    return {
      clientSecret: setupIntent.client_secret,
      id: setupIntent.id
    };
  } catch (error) {
    // Handle Stripe-specific errors
    const customError = new Error(error.message || 'Failed to create setup intent');
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

/**
 * Retrieve a payment method
 * @param {string} paymentMethodId - The ID of the payment method to retrieve
 * @returns {Promise<Object>} - Payment method details
 */
const retrievePaymentMethod = async (paymentMethodId) => {
  try {
    if (!paymentMethodId) {
      const error = new Error('Payment method ID is required');
      error.statusCode = 400;
      throw error;
    }
    
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    return {
      id: paymentMethod.id,
      card: paymentMethod.card ? {
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
      } : null
    };
  } catch (error) {
    // Handle Stripe-specific errors
    const customError = new Error(error.message || 'Failed to retrieve payment method');
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

/**
 * Process a payment with Stripe using Payment Intents
 * @param {Object} paymentData - Payment data
 * @param {number} paymentData.amount - Amount in cents
 * @param {string} paymentData.currency - Currency code (e.g., 'usd')
 * @param {string} paymentData.payment_method - Payment method ID
 * @param {string} paymentData.description - Payment description
 * @param {string} paymentData.customer_email - Customer email or reference
 * @returns {Promise<Object>} - Stripe payment intent object
 */
const processPayment = async (paymentData) => {
  try {
    const { amount, currency, payment_method, description, customer_email } = paymentData;
    
    // Create a payment intent and confirm it immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method,
      description,
      confirm: true, // Confirm the payment immediately
      receipt_email: customer_email,
      return_url: 'https://woowsocial.com/order/success', // URL to redirect after payment
      off_session: true, // Since we're charging without customer action
      confirm_method: 'automatic',
      payment_method_types: ['card'],
      capture_method: 'automatic',
    });
    
    return {
      id: paymentIntent.id,
      balance_transaction: paymentIntent.latest_charge,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  } catch (error) {
    // Add custom error handling for Stripe errors
    const customError = new Error(error.message || 'Payment processing failed');
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

/**
 * Create a refund for a charge
 * @param {string} chargeId - The ID of the charge to refund
 * @param {number} amount - Amount to refund in cents (optional, refunds entire charge if not specified)
 * @returns {Promise<Object>} - Stripe refund object
 */
const createRefund = async (chargeId, amount = null) => {
  try {
    const refundData = {
      charge: chargeId,
    };
    
    // If amount is specified, add it to refund data
    if (amount) {
      refundData.amount = amount;
    }
    
    const refund = await stripe.refunds.create(refundData);
    return refund;
  } catch (error) {
    const customError = new Error(error.message || 'Refund processing failed');
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

const stripeService = {
  createSetupIntent,
  retrievePaymentMethod,
  processPayment,
  createRefund,
};

export default stripeService;
