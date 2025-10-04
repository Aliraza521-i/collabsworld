import Wallet from "../model/Wallet.js";
import Transaction from "../model/Transaction.js";
import Withdrawal from "../model/Withdrawal.js";
import { Notification } from "../Models/NotificationModel.js";
import User from "../model/User.js";
import mongoose from "mongoose";

// Get User Wallet
export const getUserWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let wallet = await Wallet.findOne({ userId });
    
    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ userId });
    }

    // Get recent transactions
    const recentTransactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.find({ 
      userId, 
      status: { $in: ['pending', 'processing'] } 
    });

    res.status(200).json({
      ok: true,
      data: {
        wallet,
        recentTransactions,
        pendingWithdrawals
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch wallet information",
      error: error.message
    });
  }
};

// Add Payment Method
export const addPaymentMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, details, setAsDefault = false } = req.body;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        ok: false,
        message: "Wallet not found"
      });
    }

    // Validate payment method details based on type
    const validatePaymentMethod = (type, details) => {
      switch (type) {
        case 'bank_transfer':
          if (!details.bankName || !details.accountNumber || !details.accountHolderName) {
            throw new Error('Bank name, account number, and account holder name are required');
          }
          break;
        case 'paypal':
          if (!details.paypalEmail) {
            throw new Error('PayPal email is required');
          }
          break;
        case 'jazzcash':
        case 'easypaisa':
          if (!details.phoneNumber) {
            throw new Error('Phone number is required');
          }
          break;
        case 'crypto':
          if (!details.walletAddress || !details.cryptoType) {
            throw new Error('Wallet address and crypto type are required');
          }
          break;
        default:
          throw new Error('Invalid payment method type');
      }
    };

    validatePaymentMethod(type, details);

    // If setting as default, remove default from other methods
    if (setAsDefault) {
      wallet.paymentMethods.forEach(method => {
        method.isDefault = false;
      });
    }

    // Add new payment method
    const newPaymentMethod = {
      type,
      details,
      isDefault: setAsDefault || wallet.paymentMethods.length === 0,
      isVerified: false,
      addedAt: new Date()
    };

    wallet.paymentMethods.push(newPaymentMethod);
    await wallet.save();

    res.status(201).json({
      ok: true,
      message: "Payment method added successfully",
      data: newPaymentMethod
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error.message || "Failed to add payment method"
    });
  }
};

// Add Funds to Wallet
export const addFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Invalid amount"
      });
    }

    // Get user wallet
    let wallet = await Wallet.findOne({ userId });
    
    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ userId });
    }

    // Add funds to wallet
    const oldBalance = wallet.balance;
    wallet.balance += amount;
    await wallet.save();

    // Create transaction record
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      type: 'deposit',
      amount: amount,
      currency: wallet.currency,
      description: `Deposit of $${amount}`,
      balanceBefore: oldBalance,
      balanceAfter: wallet.balance,
      status: 'completed'
    });

    await transaction.save();

    res.status(200).json({
      ok: true,
      message: "Funds added successfully",
      data: {
        wallet,
        transaction
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to add funds",
      error: error.message
    });
  }
};

// Request Withdrawal
export const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, paymentMethodId, notes } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Invalid withdrawal amount"
      });
    }

    // Get user wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        ok: false,
        message: "Wallet not found"
      });
    }

    // Check if user has sufficient balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        ok: false,
        message: "Insufficient balance"
      });
    }

    // Check minimum withdrawal amount
    if (amount < wallet.withdrawalSettings.minimumAmount) {
      return res.status(400).json({
        ok: false,
        message: `Minimum withdrawal amount is $${wallet.withdrawalSettings.minimumAmount}`
      });
    }

    // Get payment method
    const paymentMethod = wallet.paymentMethods.id(paymentMethodId);
    if (!paymentMethod) {
      return res.status(404).json({
        ok: false,
        message: "Payment method not found"
      });
    }

    if (!paymentMethod.isVerified) {
      return res.status(400).json({
        ok: false,
        message: "Payment method is not verified"
      });
    }

    // Calculate fees
    const platformFee = amount * 0.02; // 2% platform fee
    const paymentProcessingFee = calculateProcessingFee(paymentMethod.type, amount);
    const totalFees = platformFee + paymentProcessingFee;
    const netAmount = amount - totalFees;

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      userId,
      walletId: wallet._id,
      requestedAmount: amount,
      fees: {
        platformFee,
        paymentProcessingFee,
        totalFees
      },
      netAmount,
      currency: wallet.currency,
      paymentMethod: {
        type: paymentMethod.type,
        details: paymentMethod.details
      },
      status: 'pending',
      notes: notes || '',
      verification: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await withdrawal.save();

    // Update wallet flags
    wallet.flags.hasPendingWithdrawal = true;
    await wallet.save();

    // Send notification to user
    await Notification.create({
      userId,
      userRole: req.user.role,
      type: 'withdrawal_requested',
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal request for $${amount} has been submitted and is pending review.`,
      channels: {
        inApp: { delivered: true },
        email: { sent: true }
      }
    });

    res.status(201).json({
      ok: true,
      message: "Withdrawal request submitted successfully",
      data: withdrawal
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to process withdrawal request",
      error: error.message
    });
  }
};

// Get Transaction History
export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = { userId };
    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.status = status;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const transactions = await Transaction.find(filter)
      .populate('orderId', 'orderId title')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    // Get summary statistics
    const summary = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.status(200).json({
      ok: true,
      data: transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      summary
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch transaction history",
      error: error.message
    });
  }
};

// Get Withdrawal History
export const getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { userId };
    if (status && status !== 'all') filter.status = status;

    const withdrawals = await Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Withdrawal.countDocuments(filter);

    // Get summary
    const summary = await Withdrawal.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$requestedAmount' }
        }
      }
    ]);

    res.status(200).json({
      ok: true,
      data: withdrawals,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      summary
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch withdrawal history",
      error: error.message
    });
  }
};

// Update Withdrawal Settings
export const updateWithdrawalSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { minimumAmount, autoWithdrawal } = req.body;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        ok: false,
        message: "Wallet not found"
      });
    }

    // Update settings
    if (minimumAmount !== undefined) {
      wallet.withdrawalSettings.minimumAmount = minimumAmount;
    }
    
    if (autoWithdrawal !== undefined) {
      wallet.withdrawalSettings.autoWithdrawal = autoWithdrawal;
    }

    await wallet.save();

    res.status(200).json({
      ok: true,
      message: "Withdrawal settings updated successfully",
      data: wallet.withdrawalSettings
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to update withdrawal settings",
      error: error.message
    });
  }
};

// Get Earnings Analytics
export const getEarningsAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7d':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30d':
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case '90d':
        dateFilter = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case '1y':
        dateFilter = { $gte: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) };
        break;
    }

    const [
      earningsTrend,
      earningsByType,
      monthlyBreakdown,
      topPerformers
    ] = await Promise.all([
      // Daily earnings trend
      Transaction.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            type: 'earning', 
            status: 'completed',
            createdAt: dateFilter 
          } 
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            earnings: { $sum: '$amount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Earnings by transaction type
      Transaction.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            status: 'completed',
            createdAt: dateFilter 
          } 
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Monthly breakdown
      Transaction.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            type: 'earning', 
            status: 'completed' 
          } 
        },
        {
          $group: {
            _id: { 
              month: { $month: '$createdAt' },
              year: { $year: '$createdAt' }
            },
            earnings: { $sum: '$amount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]),
      
      // Top performing orders (if publisher)
      req.user.role === 'publisher' ? Transaction.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(userId), 
            type: 'earning', 
            status: 'completed',
            orderId: { $exists: true },
            createdAt: dateFilter 
          } 
        },
        { $sort: { amount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order'
          }
        }
      ]) : []
    ]);

    const analytics = {
      earningsTrend,
      earningsByType,
      monthlyBreakdown: monthlyBreakdown.reverse(),
      topPerformers: topPerformers.map(item => ({
        orderId: item.order[0]?.orderId,
        title: item.order[0]?.title,
        amount: item.amount,
        date: item.createdAt
      })),
      summary: {
        totalEarnings: earningsByType.find(t => t._id === 'earning')?.total || 0,
        totalWithdrawals: earningsByType.find(t => t._id === 'withdrawal')?.total || 0,
        totalOrders: earningsByType.find(t => t._id === 'earning')?.count || 0
      }
    };

    res.status(200).json({
      ok: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch earnings analytics",
      error: error.message
    });
  }
};

// Helper function to calculate processing fees
const calculateProcessingFee = (paymentType, amount) => {
  switch (paymentType) {
    case 'paypal':
      return amount * 0.029 + 0.30; // PayPal standard rate
    case 'stripe':
      return amount * 0.029 + 0.30; // Stripe standard rate
    case 'bank_transfer':
      return Math.min(amount * 0.01, 25); // 1% capped at $25
    case 'jazzcash':
    case 'easypaisa':
      return amount * 0.015; // 1.5% for mobile payments
    case 'crypto':
      return 5; // Flat $5 for crypto
    default:
      return 0;
  }
};

// Deduct funds from wallet for order placement
export const deductFundsForOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, orderId, description } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Invalid amount"
      });
    }

    // Get user wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        ok: false,
        message: "Wallet not found"
      });
    }

    // Check if user has sufficient balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        ok: false,
        message: "Insufficient balance"
      });
    }

    // Deduct funds from wallet
    const oldBalance = wallet.balance;
    wallet.balance -= amount;
    wallet.totalEarnings += amount; // This might need adjustment based on business logic
    await wallet.save();

    // Create transaction record
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      type: 'deposit',
      amount: -amount, // Negative because it's a deduction
      currency: wallet.currency,
      balanceBefore: oldBalance,
      balanceAfter: wallet.balance,
      orderId: orderId || null,
      description: description || `Payment for order`,
      status: 'completed'
    });

    await transaction.save();

    res.status(200).json({
      ok: true,
      message: "Funds deducted successfully",
      data: {
        wallet,
        transaction
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to deduct funds",
      error: error.message
    });
  }
};

export default {
  getUserWallet,
  addPaymentMethod,
  requestWithdrawal,
  getTransactionHistory,
  getWithdrawalHistory,
  updateWithdrawalSettings,
  getEarningsAnalytics,
  addFunds,
  deductFundsForOrder
};