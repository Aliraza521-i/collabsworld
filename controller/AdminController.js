import User from "../model/User.js";
import Website from "../model/Website.js";
import Order from "../model/Order.js";
import Transaction from "../model/Transaction.js";
import Withdrawal from "../model/Withdrawal.js";
import { Notification } from "../Models/NotificationModel.js";
import Wallet from "../model/Wallet.js";
import Chat from "../model/Chat.js";
import mongoose from "mongoose";

// Admin Dashboard Overview
export const getAdminDashboard = async (req, res) => {
  try {
    console.log('Admin dashboard request received');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get key metrics in parallel
    const [
      totalUsers,
      totalPublishers,
      totalAdvertisers,
      totalWebsites,
      pendingWebsites,
      activeOrders,
      completedOrders,
      totalRevenue,
      monthlyRevenue,
      todayRevenue,
      pendingWithdrawals,
      recentUsers,
      recentOrders,
      recentSupport
    ] = await Promise.all([
      // User metrics
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'publisher' }),
      User.countDocuments({ role: 'advertiser' }),
      
      // Website metrics
      Website.countDocuments({}),
      Website.countDocuments({ status: 'submitted', verificationStatus: 'verified' }),
      
      // Order metrics
      Order.countDocuments({ status: { $in: ['pending', 'approved', 'in_progress'] } }),
      Order.countDocuments({ status: 'delivered' }),
      
      // Revenue metrics
      Transaction.aggregate([
        { $match: { type: 'commission', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).option({ maxTimeMS: 5000 }),
      Transaction.aggregate([
        { 
          $match: { 
            type: 'commission', 
            status: 'completed',
            createdAt: { $gte: startOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).option({ maxTimeMS: 5000 }),
      Transaction.aggregate([
        { 
          $match: { 
            type: 'commission', 
            status: 'completed',
            createdAt: { $gte: startOfDay }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).option({ maxTimeMS: 5000 }),
      
      // Withdrawal metrics
      Withdrawal.countDocuments({ status: 'pending' }),
      
      // Recent activity
      User.find({ role: { $ne: 'admin' } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email role createdAt'),
      
      Order.find({})
        .populate('publisherId', 'firstName lastName')
        .populate('advertiserId', 'firstName lastName')
        .populate('websiteId', 'domain')
        .sort({ createdAt: -1 })
        .limit(10)
        .maxTimeMS(5000), // Add timeout to prevent long queries
      
      Chat.find({ chatType: 'support', status: 'active' })
        .populate('participants.userId', 'firstName lastName')
        .sort({ 'stats.lastActivityAt': -1 })
        .limit(5)
        .maxTimeMS(5000) // Add timeout to prevent long queries
    ]);

    // Calculate growth rates
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const [
      lastMonthUsers,
      lastMonthRevenue,
      lastMonthOrders
    ] = await Promise.all([
      User.countDocuments({
        role: { $ne: 'admin' },
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
      }).maxTimeMS(5000),
      Transaction.aggregate([
        { 
          $match: { 
            type: 'commission', 
            status: 'completed',
            createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).option({ maxTimeMS: 5000 }),
      Order.countDocuments({
        status: 'delivered',
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
      }).maxTimeMS(5000)
    ]);

    // Calculate metrics
    const dashboardData = {
      keyMetrics: {
        totalUsers: {
          value: totalUsers,
          publishers: totalPublishers,
          advertisers: totalAdvertisers,
          growth: lastMonthUsers > 0 ? ((totalUsers - lastMonthUsers) / lastMonthUsers * 100).toFixed(1) : 0
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          monthly: monthlyRevenue[0]?.total || 0,
          today: todayRevenue[0]?.total || 0,
          growth: lastMonthRevenue[0]?.total > 0 ? 
            ((monthlyRevenue[0]?.total - lastMonthRevenue[0]?.total) / lastMonthRevenue[0]?.total * 100).toFixed(1) : 0
        },
        orders: {
          active: activeOrders,
          completed: completedOrders,
          growth: lastMonthOrders > 0 ? ((completedOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1) : 0
        },
        websites: {
          total: totalWebsites,
          pending: pendingWebsites,
          approved: totalWebsites - pendingWebsites
        },
        pendingActions: {
          websiteApprovals: pendingWebsites,
          withdrawalRequests: pendingWithdrawals,
          supportTickets: recentSupport.length
        }
      },
      recentActivity: {
        newUsers: recentUsers,
        recentOrders: recentOrders.map(order => ({
          orderId: order.orderId,
          publisher: `${order.publisherId?.firstName} ${order.publisherId?.lastName}`,
          advertiser: `${order.advertiserId?.firstName} ${order.advertiserId?.lastName}`,
          website: order.websiteId?.domain,
          status: order.status,
          amount: order.totalPrice,
          createdAt: order.createdAt
        })),
        supportTickets: recentSupport.map(chat => ({
          chatId: chat.chatId,
          participants: chat.participants.map(p => `${p.userId?.firstName} ${p.userId?.lastName}`),
          lastActivity: chat.stats.lastActivityAt,
          priority: chat.priority
        }))
      },
      systemHealth: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date()
      }
    };

    console.log('Admin dashboard data fetched successfully');
    res.status(200).json({
      ok: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch admin dashboard",
      error: error.message
    });
  }
};

// User Management
export const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role, 
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc' 
    } = req.query;

    // Build filter
    const filter = { role: { $ne: 'admin' } };
    if (role && role !== 'all') filter.role = role;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get users with pagination
    const users = await User.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password');

    const total = await User.countDocuments(filter);

    // Optimize: Get all stats in bulk instead of per-user queries
    const userIds = users.map(user => user._id);
    
    // Get website counts for all users in one query
    const websiteCounts = await Website.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);
    
    // Get order counts for all users in one query
    const orderCounts = await Order.aggregate([
      {
        $match: {
          $or: [
            { publisherId: { $in: userIds } },
            { advertiserId: { $in: userIds } }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $in: ['$publisherId', userIds] },
              '$publisherId',
              '$advertiserId'
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get wallet data for all users in one query
    const wallets = await Wallet.find({ userId: { $in: userIds } });

    // Create lookup maps for quick access
    const websiteCountMap = {};
    websiteCounts.forEach(item => {
      websiteCountMap[item._id.toString()] = item.count;
    });
    
    const orderCountMap = {};
    orderCounts.forEach(item => {
      orderCountMap[item._id.toString()] = item.count;
    });
    
    const walletMap = {};
    wallets.forEach(wallet => {
      walletMap[wallet.userId.toString()] = wallet;
    });

    // Add stats to users
    const usersWithStats = users.map(user => {
      const userId = user._id.toString();
      const wallet = walletMap[userId];
      
      return {
        ...user.toObject(),
        stats: {
          websites: websiteCountMap[userId] || 0,
          orders: orderCountMap[userId] || 0,
          balance: wallet?.balance || 0,
          totalEarnings: wallet?.totalEarnings || 0
        }
      };
    });

    res.status(200).json({
      ok: true,
      data: usersWithStats,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

// Website Management
export const getPendingWebsites = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, sortBy = 'createdAt' } = req.query;

    const filter = { 
      status: 'submitted',
      verificationStatus: 'verified'
    };
    
    if (category && category !== 'all') {
      filter.category = category;
    }

    const websites = await Website.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort({ [sortBy]: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Website.countDocuments(filter);

    res.status(200).json({
      ok: true,
      data: websites,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch pending websites",
      error: error.message
    });
  }
};

// Add new function to get all websites with different statuses
export const getAllWebsites = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      category, 
      search, 
      sortBy = 'createdAt',
      sortOrder = 'desc' 
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { domain: { $regex: search, $options: 'i' } },
        { siteDescription: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const websites = await Website.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Website.countDocuments(filter);

    res.status(200).json({
      ok: true,
      data: websites,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch websites",
      error: error.message
    });
  }
};

// Update website verification method settings
export const updateWebsiteVerificationSettings = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const {
      disableGoogleAnalytics,
      disableGoogleSearchConsole,
      disableHtmlFile
    } = req.body;

    const website = await Website.findById(websiteId);
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found"
      });
    }

    // Update verification method settings
    if (disableGoogleAnalytics !== undefined) {
      website.disableGoogleAnalytics = disableGoogleAnalytics;
    }
    
    if (disableGoogleSearchConsole !== undefined) {
      website.disableGoogleSearchConsole = disableGoogleSearchConsole;
    }
    
    if (disableHtmlFile !== undefined) {
      website.disableHtmlFile = disableHtmlFile;
    }

    await website.save();

    res.status(200).json({
      ok: true,
      message: "Website verification settings updated successfully",
      data: website
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to update website verification settings",
      error: error.message
    });
  }
};

// Approve/Reject Website
export const reviewWebsite = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { 
      action, // 'approve', 'reject', 'request_info'
      reason,
      notes,
      modifiedPricing,
      modifiedCategory
    } = req.body;

    const website = await Website.findById(websiteId);
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found"
      });
    }

    // Store the current status as previousStatus before updating (if not already set)
    if (!website.previousStatus) {
      website.previousStatus = website.status;
    }

    // Update website based on action
    switch (action) {
      case 'approve':
        website.status = 'approved';
        if (modifiedPricing) {
          website.publishingPrice = modifiedPricing.publishingPrice;
          website.copywritingPrice = modifiedPricing.copywritingPrice;
        }
        if (modifiedCategory) {
          website.category = modifiedCategory;
        }
        website.reviewedBy = req.user.id;
        website.reviewedAt = new Date();
        website.reviewNotes = notes;
        
        // Disable all verification methods for approved websites
        website.disableGoogleAnalytics = true;
        website.disableGoogleSearchConsole = true;
        website.disableHtmlFile = true;
        break;
        
      case 'reject':
        website.status = 'rejected';
        website.reviewedBy = req.user.id;
        website.reviewedAt = new Date();
        website.reviewNotes = reason;
        break;
        
      case 'request_info':
        website.status = 'under_review';
        website.reviewedBy = req.user.id;
        website.reviewedAt = new Date();
        website.reviewNotes = reason;
        break;
        
      case 'delete':
        // Soft delete the website
        website.status = 'deleted';
        website.reviewedBy = req.user.id;
        website.reviewedAt = new Date();
        website.reviewNotes = reason || 'Deleted by admin';
        break;
    }

    await website.save();

    // Send notification to user
    await Notification.create({
      userId: website.userId,
      userRole: 'publisher',
      type: action === 'approve' ? 'website_approved' : action === 'reject' ? 'website_rejected' : 'custom',
      title: `Website ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : action === 'delete' ? 'Deleted' : 'Under Review'}`,
      message: `Your website ${website.domain} has been ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'delete' ? 'deleted' : 'marked for review'}. ${notes || reason || ''}`,
      data: {
        websiteId: website._id,
        domain: website.domain
      },
      channels: {
        email: { sent: true },
        inApp: { delivered: true }
      }
    });

    res.status(200).json({
      ok: true,
      message: `Website ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'delete' ? 'deleted' : 'marked for review'} successfully`,
      data: website
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to review website",
      error: error.message
    });
  }
};

// Order Management
export const getAllOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const orders = await Order.find(filter)
      .populate('publisherId', 'firstName lastName email')
      .populate('advertiserId', 'firstName lastName email')
      .populate('websiteId', 'domain category')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      ok: true,
      data: orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch orders",
      error: error.message
    });
  }
};

// Financial Management
export const getFinancialOverview = async (req, res) => {
  try {
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
      totalRevenue,
      totalCommissions,
      totalWithdrawals,
      pendingWithdrawals,
      revenueByDay,
      topEarners
    ] = await Promise.all([
      // Total platform revenue
      Transaction.aggregate([
        { $match: { type: 'commission', status: 'completed', createdAt: dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // Commission breakdown
      Transaction.aggregate([
        { $match: { type: 'commission', status: 'completed', createdAt: dateFilter } },
        { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      
      // Withdrawal stats
      Withdrawal.aggregate([
        { $match: { status: 'completed', createdAt: dateFilter } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } }
      ]),
      
      // Pending withdrawals
      Withdrawal.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$requestedAmount' }, count: { $sum: 1 } } }
      ]),
      
      // Daily revenue trend
      Transaction.aggregate([
        { $match: { type: 'commission', status: 'completed', createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: '$amount' },
            transactions: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Top earning publishers
      Transaction.aggregate([
        { $match: { type: 'earning', status: 'completed', createdAt: dateFilter } },
        {
          $group: {
            _id: '$userId',
            totalEarnings: { $sum: '$amount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { totalEarnings: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        }
      ])
    ]);

    const financialData = {
      overview: {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
        pendingWithdrawals: {
          amount: pendingWithdrawals[0]?.total || 0,
          count: pendingWithdrawals[0]?.count || 0
        },
        netProfit: (totalRevenue[0]?.total || 0) - (totalWithdrawals[0]?.total || 0)
      },
      commissionBreakdown: totalCommissions,
      revenueChart: revenueByDay,
      topEarners: topEarners.map(item => ({
        user: item.user[0] ? `${item.user[0].firstName} ${item.user[0].lastName}` : 'Unknown',
        email: item.user[0]?.email,
        totalEarnings: item.totalEarnings,
        orders: item.orders
      }))
    };

    res.status(200).json({
      ok: true,
      data: financialData
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch financial overview",
      error: error.message
    });
  }
};

// Analytics Dashboard
export const getAnalytics = async (req, res) => {
  try {
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
    }

    const [
      userGrowth,
      orderMetrics,
      conversionRates,
      platformHealth
    ] = await Promise.all([
      // User growth over time
      User.aggregate([
        { $match: { role: { $ne: 'admin' }, createdAt: dateFilter } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              role: '$role'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]),
      
      // Order completion metrics
      Order.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgValue: { $avg: '$totalPrice' }
          }
        }
      ]),
      
      // Conversion rates
      Order.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
            }
          }
        },
        {
          $addFields: {
            conversionRate: {
              $multiply: [{ $divide: ['$completed', '$total'] }, 100]
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Platform health metrics
      {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        activeConnections: 0, // This would come from your WebSocket server
        responseTime: 0, // This would come from your monitoring system
      }
    ]);

    res.status(200).json({
      ok: true,
      data: {
        userGrowth,
        orderMetrics,
        conversionRates,
        platformHealth
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch analytics",
      error: error.message
    });
  }
};

// User Account Management
export const manageUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body; // 'suspend', 'activate', 'delete', 'verify'

    const user = await User.findById(userId);
    if (!user || user.role === 'admin') {
      return res.status(404).json({
        ok: false,
        message: "User not found or cannot be modified"
      });
    }

    switch (action) {
      case 'suspend':
        user.isSuspended = true;
        await user.save();
        await Notification.create({
          userId: user._id,
          userRole: user.role,
          type: 'user_suspended',
          title: 'Account Suspended',
          message: `Your account has been suspended. Reason: ${reason}`,
          channels: {
            email: { sent: true },
            inApp: { delivered: true }
          }
        });
        break;
        
      case 'activate':
        user.isSuspended = false;
        await user.save();
        await Notification.create({
          userId: user._id,
          userRole: user.role,
          type: 'user_suspended', // Using existing type
          title: 'Account Activated',
          message: 'Your account has been reactivated.',
          channels: {
            email: { sent: true },
            inApp: { delivered: true }
          }
        });
        break;
        
      case 'delete':
        // Soft delete user account
        user.deletedAt = new Date();
        user.isDeleted = true;
        await user.save();
        break;
        
      case 'verify':
        user.isEmailVerified = true;
        await user.save();
        await Notification.create({
          userId: user._id,
          userRole: user.role,
          type: 'user_verified',
          title: 'Account Verified',
          message: 'Your account has been verified by admin.',
          channels: {
            email: { sent: true },
            inApp: { delivered: true }
          }
        });
        break;
        
      default:
        return res.status(400).json({
          ok: false,
          message: "Invalid action specified"
        });
    }

    res.status(200).json({
      ok: true,
      message: `User account ${action}d successfully`
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to manage user account",
      error: error.message
    });
  }
};

// Get all chats for admin (with participant details)
export const getAllChats = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      chatType, 
      status = 'active',
      search 
    } = req.query;

    // Build filter
    const filter = { status };
    
    if (chatType && chatType !== 'all') {
      filter.chatType = chatType;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const chats = await Chat.find(filter)
      .populate('participants.userId', 'firstName lastName email role')
      .populate('orderId', 'orderId title status')
      .populate('websiteId', 'domain')
      .sort({ 'stats.lastActivityAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Chat.countDocuments(filter);

    // Add additional information for admin view
    const chatsWithDetails = chats.map(chat => {
      const participantsInfo = chat.participants
        .filter(p => p.userId) // Filter out participants with null userId
        .map(p => ({
          userId: p.userId._id,
          name: `${p.userId.firstName} ${p.userId.lastName}`,
          email: p.userId.email,
          role: p.role
        }));

      return {
        ...chat.toObject(),
        participantsInfo
      };
    });

    res.status(200).json({
      ok: true,
      data: chatsWithDetails,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error in getAllChats:', error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch chats",
      error: error.message
    });
  }
};

// Export the functions
export default {
  getAdminDashboard,
  getAllUsers,
  getPendingWebsites,
  reviewWebsite,
  getAllOrders,
  getFinancialOverview,
  getAnalytics,
  manageUserAccount,
  updateWebsiteVerificationSettings,
  getAllChats
};
















