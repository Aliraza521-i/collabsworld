import { validationResult } from 'express-validator';
import { Payment, Escrow } from '../Models/PaymentModel.js';
import Wallet from '../model/Wallet.js';
import Order from '../model/Order.js';
import User from '../model/User.js';
// Email and SMS services would be imported here if needed
import crypto from 'crypto';

// Payment Processing Controller
export class PaymentController {
  
  // Initialize payment for order
  static async initiatePayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { orderId, paymentMethod, currency = 'USD', returnUrl, webhookUrl } = req.body;
      const userId = req.user.id;

      // Validate order and user ownership
      const order = await Order.findById(orderId).populate('advertiser publisher');
      if (!order || order.advertiser._id.toString() !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Order not found or access denied'
        });
      }

      if (order.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Order must be approved before payment'
        });
      }

      // Get currency conversion rates
      const baseCurrency = await Currency.findOne({ code: 'USD' });
      const targetCurrency = await Currency.findOne({ code: currency });
      
      if (!targetCurrency) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported currency'
        });
      }

      // Calculate amount in target currency
      const baseAmount = order.totalAmount;
      const convertedAmount = currency === 'USD' ? baseAmount : 
        baseAmount * (targetCurrency.exchangeRate / baseCurrency.exchangeRate);

      // Create payment record
      const payment = new Payment({
        orderId: order._id,
        payerId: userId,
        payeeId: order.publisher._id,
        amount: convertedAmount,
        currency: currency,
        originalAmount: baseAmount,
        originalCurrency: 'USD',
        exchangeRate: targetCurrency.exchangeRate,
        paymentMethod: paymentMethod,
        status: 'pending',
        metadata: {
          returnUrl,
          webhookUrl,
          orderDetails: {
            websiteUrl: order.websiteUrl,
            requirements: order.requirements
          }
        }
      });

      await payment.save();

      // Create escrow entry
      const escrow = new Escrow({
        paymentId: payment._id,
        orderId: order._id,
        buyerId: userId,
        sellerId: order.publisher._id,
        amount: convertedAmount,
        currency: currency,
        status: 'pending',
        terms: {
          deliveryDeadline: order.deadline,
          revisionRounds: order.revisionRounds || 2,
          autoReleaseHours: 72
        }
      });

      await escrow.save();

      // Generate payment URL/token based on method
      let paymentData = {};
      
      switch (paymentMethod.toLowerCase()) {
        case 'stripe':
          paymentData = await this.createStripePayment(payment, order);
          break;
        case 'paypal':
          paymentData = await this.createPayPalPayment(payment, order);
          break;
        case 'crypto':
          paymentData = await this.createCryptoPayment(payment, order);
          break;
        case 'wallet':
          paymentData = await this.processWalletPayment(payment, order, userId);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Unsupported payment method'
          });
      }

      // Update payment with provider details
      payment.providerTransactionId = paymentData.transactionId;
      payment.providerData = paymentData.metadata;
      await payment.save();

      // Send notifications
      await this.sendPaymentNotifications(payment, order, 'initiated');

      res.status(201).json({
        success: true,
        message: 'Payment initiated successfully',
        payment: {
          id: payment._id,
          amount: convertedAmount,
          currency: currency,
          status: payment.status,
          paymentUrl: paymentData.paymentUrl,
          transactionId: payment.providerTransactionId
        }
      });

    } catch (error) {
      console.error('Payment initiation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Process wallet payment
  static async processWalletPayment(payment, order, userId) {
    const wallet = await Wallet.findOne({ userId });
    
    if (!wallet || wallet.balance < payment.amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Deduct from wallet
    wallet.balance -= payment.amount;
    wallet.transactions.push({
      type: 'debit',
      amount: payment.amount,
      currency: payment.currency,
      description: `Payment for Order #${order._id.toString().slice(-6)}`,
      reference: payment._id,
      balanceAfter: wallet.balance
    });

    await wallet.save();

    // Update payment status
    payment.status = 'completed';
    payment.paidAt = new Date();
    await payment.save();

    return {
      transactionId: `wallet_${payment._id}`,
      paymentUrl: null,
      metadata: { method: 'wallet', walletBalance: wallet.balance }
    };
  }

  // Stripe payment integration
  static async createStripePayment(payment, order) {
    // Mock Stripe integration - replace with actual Stripe SDK
    const transactionId = `stripe_${crypto.randomUUID()}`;
    
    return {
      transactionId,
      paymentUrl: `https://checkout.stripe.com/pay/${transactionId}`,
      metadata: {
        stripeSessionId: transactionId,
        amount: payment.amount * 100, // Stripe uses cents
        currency: payment.currency.toLowerCase()
      }
    };
  }

  // PayPal payment integration
  static async createPayPalPayment(payment, order) {
    // Mock PayPal integration - replace with actual PayPal SDK
    const transactionId = `paypal_${crypto.randomUUID()}`;
    
    return {
      transactionId,
      paymentUrl: `https://www.paypal.com/checkoutnow?token=${transactionId}`,
      metadata: {
        paypalOrderId: transactionId,
        amount: payment.amount,
        currency: payment.currency
      }
    };
  }

  // Crypto payment integration
  static async createCryptoPayment(payment, order) {
    // Mock crypto payment - replace with actual crypto gateway
    const walletAddress = this.generateCryptoAddress(payment.currency);
    const transactionId = `crypto_${crypto.randomUUID()}`;
    
    return {
      transactionId,
      paymentUrl: null,
      metadata: {
        walletAddress,
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      }
    };
  }

  // Generate crypto wallet address (mock)
  static generateCryptoAddress(currency) {
    const addresses = {
      BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      ETH: '0x742d35Cc6634C0532925a3b8D431c0E1eB5D6', 
      USDT: '0x742d35Cc6634C0532925a3b8D431c0E1eB5D7'
    };
    return addresses[currency] || addresses.BTC;
  }

  // Confirm payment (webhook handler)
  static async confirmPayment(req, res) {
    try {
      const { paymentId, providerTransactionId, status, metadata } = req.body;
      
      const payment = await Payment.findById(paymentId).populate('orderId');
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Update payment status
      payment.status = status;
      payment.paidAt = status === 'completed' ? new Date() : payment.paidAt;
      payment.providerTransactionId = providerTransactionId;
      if (metadata) payment.providerData = { ...payment.providerData, ...metadata };
      
      await payment.save();

      if (status === 'completed') {
        // Move funds to escrow
        const escrow = await Escrow.findOne({ paymentId: payment._id });
        if (escrow) {
          escrow.status = 'funded';
          escrow.fundedAt = new Date();
          await escrow.save();
        }

        // Update order status
        const order = await Order.findById(payment.orderId);
        if (order) {
          order.status = 'paid';
          order.paidAt = new Date();
          await order.save();
        }

        // Send notifications
        await this.sendPaymentNotifications(payment, order, 'completed');
      } else if (status === 'failed') {
        // Handle failed payment
        await this.handleFailedPayment(payment);
      }

      res.json({
        success: true,
        message: 'Payment status updated successfully'
      });

    } catch (error) {
      console.error('Payment confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment'
      });
    }
  }

  // Release escrow funds
  static async releaseEscrow(req, res) {
    try {
      const { escrowId } = req.params;
      const userId = req.user.id;
      
      const escrow = await Escrow.findById(escrowId)
        .populate('orderId paymentId sellerId buyerId');
      
      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      // Check if user can release escrow (buyer or auto-release)
      const canRelease = escrow.buyerId._id.toString() === userId || 
        escrow.status === 'auto_release_eligible';

      if (!canRelease) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to release escrow'
        });
      }

      // Release funds to seller's wallet
      const sellerWallet = await Wallet.findOne({ userId: escrow.sellerId._id });
      if (!sellerWallet) {
        return res.status(404).json({
          success: false,
          message: 'Seller wallet not found'
        });
      }

      // Calculate platform commission
      const commission = escrow.amount * 0.1; // 10% platform fee
      const sellerAmount = escrow.amount - commission;

      // Update seller wallet
      sellerWallet.balance += sellerAmount;
      sellerWallet.transactions.push({
        type: 'credit',
        amount: sellerAmount,
        currency: escrow.currency,
        description: `Escrow release for Order #${escrow.orderId._id.toString().slice(-6)}`,
        reference: escrow._id,
        balanceAfter: sellerWallet.balance
      });

      await sellerWallet.save();

      // Update escrow status
      escrow.status = 'released';
      escrow.releasedAt = new Date();
      escrow.releasedBy = userId;
      escrow.platformCommission = commission;
      
      await escrow.save();

      // Create transaction record
      const transaction = new Transaction({
        escrowId: escrow._id,
        fromUserId: escrow.buyerId._id,
        toUserId: escrow.sellerId._id,
        amount: sellerAmount,
        currency: escrow.currency,
        type: 'escrow_release',
        status: 'completed',
        platformFee: commission
      });

      await transaction.save();

      // Update order status
      await Order.findByIdAndUpdate(escrow.orderId._id, {
        status: 'completed',
        completedAt: new Date()
      });

      // Send notifications
      await this.sendEscrowNotifications(escrow, 'released');

      res.json({
        success: true,
        message: 'Escrow funds released successfully',
        transaction: {
          amount: sellerAmount,
          commission: commission,
          currency: escrow.currency
        }
      });

    } catch (error) {
      console.error('Escrow release error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release escrow funds'
      });
    }
  }

  // Handle payment disputes
  static async createDispute(req, res) {
    try {
      const { escrowId, reason, description, evidence } = req.body;
      const userId = req.user.id;

      const escrow = await Escrow.findById(escrowId).populate('buyerId sellerId');
      
      if (!escrow) {
        return res.status(404).json({
          success: false,
          message: 'Escrow not found'
        });
      }

      // Check if user is involved in the transaction
      const isInvolved = escrow.buyerId._id.toString() === userId || 
        escrow.sellerId._id.toString() === userId;

      if (!isInvolved) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create dispute'
        });
      }

      // Create dispute
      escrow.dispute = {
        status: 'open',
        createdBy: userId,
        reason,
        description,
        evidence: evidence || [],
        createdAt: new Date()
      };

      escrow.status = 'disputed';
      await escrow.save();

      // Send notifications to all parties
      await this.sendDisputeNotifications(escrow, 'created');

      res.json({
        success: true,
        message: 'Dispute created successfully',
        disputeId: escrow.dispute._id
      });

    } catch (error) {
      console.error('Dispute creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create dispute'
      });
    }
  }

  // Send payment notifications
  static async sendPaymentNotifications(payment, order, event) {
    try {
      const buyer = await User.findById(payment.payerId);
      const seller = await User.findById(payment.payeeId);

      const notifications = {
        initiated: {
          buyer: {
            subject: 'Payment Initiated',
            message: `Your payment of ${payment.amount} ${payment.currency} for Order #${order._id.toString().slice(-6)} has been initiated.`
          },
          seller: {
            subject: 'Payment Received',
            message: `Payment of ${payment.amount} ${payment.currency} has been initiated for your order.`
          }
        },
        completed: {
          buyer: {
            subject: 'Payment Successful',
            message: `Your payment of ${payment.amount} ${payment.currency} has been processed successfully.`
          },
          seller: {
            subject: 'Payment Confirmed', 
            message: `Payment of ${payment.amount} ${payment.currency} has been confirmed and moved to escrow.`
          }
        }
      };

      // Send email notifications
      if (buyer.email && notifications[event].buyer) {
        await sendEmail(buyer.email, notifications[event].buyer.subject, notifications[event].buyer.message);
      }

      if (seller.email && notifications[event].seller) {
        await sendEmail(seller.email, notifications[event].seller.subject, notifications[event].seller.message);
      }

    } catch (error) {
      console.error('Notification sending error:', error);
    }
  }

  // Send escrow notifications
  static async sendEscrowNotifications(escrow, event) {
    // Implementation similar to payment notifications
  }

  // Send dispute notifications  
  static async sendDisputeNotifications(escrow, event) {
    // Implementation similar to payment notifications
  }

  // Handle failed payments
  static async handleFailedPayment(payment) {
    // Update order status
    await Order.findByIdAndUpdate(payment.orderId, {
      status: 'payment_failed'
    });

    // Update escrow status
    await Escrow.findOneAndUpdate(
      { paymentId: payment._id },
      { status: 'failed' }
    );
  }
}

export default PaymentController;