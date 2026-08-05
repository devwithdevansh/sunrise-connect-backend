// src/services/RazorpayService.js
import Razorpay from 'razorpay';
import crypto from 'crypto';
import env from '../config/env.js';

class RazorpayService {
  constructor() {
    this.instance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Create a new Razorpay Order
   * @param {Object} params - Order parameters
   * @param {number} params.amount - Amount in INR (will be converted to paisa automatically)
   * @param {string} params.receipt - Unique receipt ID (e.g., ledger ID or batch ID)
   * @param {Object} [params.notes] - Optional key-value pairs for additional info
   * @returns {Promise<Object>} The Razorpay order object
   */
  async createOrder({ amount, receipt, notes = {} }) {
    const options = {
      amount: Math.round(amount * 100), // Amount is in currency subunits (paisa).
      currency: 'INR',
      receipt,
      notes,
    };
    return await this.instance.orders.create(options);
  }

  /**
   * Verify the Razorpay payment signature
   * @param {Object} params - Verification parameters
   * @param {string} params.orderId - The razorpay_order_id returned to the frontend
   * @param {string} params.paymentId - The razorpay_payment_id returned to the frontend
   * @param {string} params.signature - The razorpay_signature returned to the frontend
   * @returns {boolean} True if signature is valid, false otherwise
   */
  verifySignature({ orderId, paymentId, signature }) {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');
    
    return expectedSignature === signature;
  }
}

export default new RazorpayService();
