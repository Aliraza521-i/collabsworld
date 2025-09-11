import Stripe from 'stripe';
import axios from 'axios';
import crypto from 'crypto';
import { Currency } from '../Models/PaymentModel.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export class PaymentService {
  
  // Stripe Integration
  static async createStripePaymentIntent(amount, currency, metadata) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: metadata,
        capture_method: 'automatic'
      });

      return {
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status
        }
      };
    } catch (error) {
      console.error('Stripe Payment Intent Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async createStripeCustomer(email, name, metadata = {}) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata
      });

      return {
        success: true,
        data: {
          customerId: customer.id,
          email: customer.email
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async attachPaymentMethodToCustomer(customerId, paymentMethodId) {
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async confirmStripePayment(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      
      return {
        success: true,
        data: {
          status: paymentIntent.status,
          paymentMethod: paymentIntent.payment_method
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // PayPal Integration
  static async createPayPalOrder(amount, currency, orderId) {
    try {
      const accessToken = await this.getPayPalAccessToken();
      
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2)
          }
        }],
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
        }
      };

      const response = await axios.post(
        `${process.env.PAYPAL_API_BASE}/v2/checkout/orders`,
        orderData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: {
          orderId: response.data.id,
          approvalUrl: response.data.links.find(link => link.rel === 'approve').href
        }
      };
    } catch (error) {
      console.error('PayPal Order Creation Error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  static async capturePayPalOrder(orderId) {
    try {
      const accessToken = await this.getPayPalAccessToken();
      
      const response = await axios.post(
        `${process.env.PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: {
          status: response.data.status,
          captureId: response.data.purchase_units[0].payments.captures[0].id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  static async getPayPalAccessToken() {
    try {
      const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
      
      const response = await axios.post(
        `${process.env.PAYPAL_API_BASE}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      throw new Error('Failed to get PayPal access token');
    }
  }

  // Cryptocurrency Integration (Mock - Replace with actual crypto gateway)
  static async createCryptoPayment(amount, currency, walletAddress) {
    try {
      // Mock crypto payment creation
      const paymentId = crypto.randomUUID();
      const qrCodeData = `${currency}:${walletAddress}?amount=${amount}`;
      
      return {
        success: true,
        data: {
          paymentId,
          walletAddress,
          amount,
          currency,
          qrCode: qrCodeData,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          confirmationsRequired: currency === 'BTC' ? 6 : 12
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async verifyBlockchainTransaction(txHash, expectedAmount, currency) {
    try {
      // Mock verification - Replace with actual blockchain API calls
      // For Bitcoin: use BlockCypher, Blockchain.info, etc.
      // For Ethereum: use Infura, Alchemy, etc.
      
      const mockTransaction = {
        hash: txHash,
        amount: expectedAmount,
        confirmations: 6,
        status: 'confirmed'
      };

      return {
        success: true,
        data: mockTransaction
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Currency Exchange Service
  static async updateExchangeRates() {
    try {
      // Use a free API like ExchangeRate-API or CurrencyAPI
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/USD`);
      const rates = response.data.rates;

      // Update rates in database
      for (const [code, rate] of Object.entries(rates)) {
        await Currency.findOneAndUpdate(
          { code },
          { 
            exchangeRate: rate,
            lastUpdated: new Date()
          },
          { upsert: true }
        );
      }

      // Add cryptocurrency rates (mock data - replace with actual crypto API)
      const cryptoRates = {
        BTC: 45000,  // Bitcoin price in USD
        ETH: 3000,   // Ethereum price in USD
        USDT: 1      // Tether price in USD
      };

      for (const [code, rate] of Object.entries(cryptoRates)) {
        await Currency.findOneAndUpdate(
          { code },
          { 
            exchangeRate: 1 / rate, // Rate against USD
            lastUpdated: new Date(),
            isCryptocurrency: true
          },
          { upsert: true }
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Exchange rate update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async convertCurrency(amount, fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return { success: true, data: { convertedAmount: amount, rate: 1 } };
      }

      const fromCurrencyDoc = await Currency.findOne({ code: fromCurrency });
      const toCurrencyDoc = await Currency.findOne({ code: toCurrency });

      if (!fromCurrencyDoc || !toCurrencyDoc) {
        throw new Error('Currency not supported');
      }

      // Convert to USD first, then to target currency
      const usdAmount = amount / fromCurrencyDoc.exchangeRate;
      const convertedAmount = usdAmount * toCurrencyDoc.exchangeRate;
      const rate = toCurrencyDoc.exchangeRate / fromCurrencyDoc.exchangeRate;

      return {
        success: true,
        data: {
          convertedAmount: Number(convertedAmount.toFixed(toCurrencyDoc.decimals)),
          rate: Number(rate.toFixed(6)),
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Refund Processing
  static async processRefund(paymentId, amount, reason = 'Customer request') {
    try {
      // This would integrate with the original payment processor
      // For now, we'll create a mock refund
      
      const refundId = crypto.randomUUID();
      
      return {
        success: true,
        data: {
          refundId,
          amount,
          status: 'pending',
          reason,
          estimatedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Risk Assessment
  static async assessPaymentRisk(paymentData) {
    try {
      let riskScore = 0;
      const riskFactors = [];

      // Amount-based risk
      if (paymentData.amount > 10000) {
        riskScore += 30;
        riskFactors.push('High transaction amount');
      }

      // New customer risk
      if (paymentData.isNewCustomer) {
        riskScore += 20;
        riskFactors.push('New customer');
      }

      // Currency risk
      if (paymentData.currency !== 'USD') {
        riskScore += 10;
        riskFactors.push('Foreign currency');
      }

      // IP location risk (mock)
      if (paymentData.ipCountry && paymentData.ipCountry !== paymentData.billingCountry) {
        riskScore += 25;
        riskFactors.push('IP and billing country mismatch');
      }

      let riskLevel = 'low';
      if (riskScore > 70) riskLevel = 'high';
      else if (riskScore > 40) riskLevel = 'medium';

      return {
        success: true,
        data: {
          riskScore,
          riskLevel,
          riskFactors,
          recommended: riskLevel === 'high' ? 'manual_review' : 'auto_approve'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Webhook Verification
  static verifyStripeWebhook(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return { success: true, data: event };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static verifyPayPalWebhook(headers, payload) {
    try {
      // PayPal webhook verification logic
      // This would involve verifying the webhook signature
      return { success: true, data: payload };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Schedule exchange rate updates every hour
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    await PaymentService.updateExchangeRates();
  }, 60 * 60 * 1000); // 1 hour
}

export default PaymentService;