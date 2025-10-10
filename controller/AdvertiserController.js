import User from "../model/User.js";
import Website from "../model/Website.js";
import Order from "../model/Order.js";
import Transaction from "../model/Transaction.js";
import Wallet from "../model/Wallet.js";
import Chat from "../model/Chat.js";
import { Notification } from "../Models/NotificationModel.js";
import mongoose from "mongoose";
import SearchService from "../services/SearchService.js";

// Advertiser Dashboard
export const getAdvertiserDashboard = async (req, res) => {
  try {
    // For publicly accessible dashboard, provide generic data
    // If user is authenticated, we can show personalized data
    const advertiserId = req.user?.id;
    
    let dashboardData;
    
    if (advertiserId) {
      // Authenticated user - show personalized data
      const [
        activeOrders,
        completedOrders,
        totalSpent,
        availableWebsites,
        recentOrders,
        walletBalance,
        campaignPerformance
      ] = await Promise.all([
        // Active orders
        Order.countDocuments({ 
          advertiserId, 
          status: { $in: ['pending', 'approved', 'in_progress'] }
        }),
        
        // Completed orders
        Order.countDocuments({ 
          advertiserId, 
          status: 'delivered' 
        }),
        
        // Total spent
        Order.aggregate([
          { $match: { advertiserId: new mongoose.Types.ObjectId(advertiserId), paymentStatus: 'paid' } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]),
        
        // Available websites count
        Website.countDocuments({ status: 'approved' }),
        
        // Recent orders
        Order.find({ advertiserId })
          .populate('publisherId', 'firstName lastName')
          .populate('websiteId', 'domain category')
          .sort({ createdAt: -1 })
          .limit(10),
        
        // Wallet balance
        Wallet.findOne({ userId: advertiserId }),
        
        // Campaign performance metrics
        Order.aggregate([
          { $match: { advertiserId: new mongoose.Types.ObjectId(advertiserId), status: 'delivered' } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              orders: { $sum: 1 },
              spent: { $sum: '$totalPrice' },
              avgPrice: { $avg: '$totalPrice' }
            }
          },
          { $sort: { _id: 1 } },
          { $limit: 6 }
        ])
      ]);

      dashboardData = {
        summary: {
          activeOrders,
          completedOrders,
          totalSpent: totalSpent[0]?.total || 0,
          availableWebsites,
          walletBalance: walletBalance?.balance || 0
        },
        recentOrders: recentOrders.map(order => ({
          orderId: order.orderId,
          website: order.websiteId?.domain,
          publisher: `${order.publisherId?.firstName} ${order.publisherId?.lastName}`,
          status: order.status,
          amount: order.totalPrice,
          deadline: order.deadline,
          createdAt: order.createdAt
        })),
        campaignPerformance,
        quickStats: {
          successRate: completedOrders > 0 ? 
            ((completedOrders / (completedOrders + activeOrders)) * 100).toFixed(1) : 0,
          averageOrderValue: totalSpent[0]?.total && completedOrders > 0 ? 
            (totalSpent[0].total / completedOrders).toFixed(2) : 0
        }
      };
    } else {
      // Public dashboard - show generic data
      const [
        availableWebsites,
        totalOrders
      ] = await Promise.all([
        Website.countDocuments({ status: 'approved' }),
        Order.countDocuments()
      ]);
      
      dashboardData = {
        summary: {
          activeOrders: 0,
          completedOrders: 0,
          totalSpent: 0,
          availableWebsites,
          walletBalance: 0
        },
        recentOrders: [],
        campaignPerformance: [],
        quickStats: {
          successRate: 0,
          averageOrderValue: 0
        }
      };
    }

    res.status(200).json({
      ok: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch advertiser dashboard",
      error: error.message
    });
  }
};

// Browse Available Websites
export const browseWebsites = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      minPrice,
      maxPrice,
      country,
      language,
      minDA,
      maxDA,
      minDR,
      maxDR,
      minPA,
      maxPA,
      minSS,
      maxSS,
      minAS,
      maxAS,
      minTF,
      maxTF,
      minCF,
      maxCF,
      minUR,
      maxUR,
      minDomainAge,
      maxDomainAge,
      minAhrefsTraffic,
      maxAhrefsTraffic,
      minSemrushTraffic,
      maxSemrushTraffic,
      minMonthlyTraffic,
      maxMonthlyTraffic,
      minAhrefsKeywords,
      maxAhrefsKeywords,
      minSemrushKeywords,
      maxSemrushKeywords,
      minAhrefsReferringDomains,
      maxAhrefsReferringDomains,
      minSemrushReferringDomains,
      maxSemrushReferringDomains,
      linkType,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Log the filters for debugging
    console.log('Browse websites filters:', req.query);

    // Build filter for approved websites
    const filter = { status: 'approved' };
    
    // Apply filters
    if (category && category !== 'all') {
      filter.category = { $regex: category, $options: 'i' };
    }
    
    if (minPrice || maxPrice) {
      filter.publishingPrice = {};
      if (minPrice) filter.publishingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.publishingPrice.$lte = parseFloat(maxPrice);
    }
    
    if (country && country !== 'all') {
      filter.country = country;
    }
    
    if (language && language !== 'all') {
      filter.mainLanguage = language;
    }
    
    if (linkType && linkType !== 'all') {
      filter.linkType = linkType;
    }
    
    // Domain Authority (DA) filter - 0 to 100
    if (minDA || maxDA) {
      filter['metrics.domainAuthority'] = {};
      if (minDA) filter['metrics.domainAuthority'].$gte = Math.max(0, Math.min(100, parseFloat(minDA)));
      if (maxDA) filter['metrics.domainAuthority'].$lte = Math.max(0, Math.min(100, parseFloat(maxDA)));
    }
    
    // Domain Rating (DR) filter - 0 to 100
    if (minDR || maxDR) {
      filter['metrics.dr'] = {};
      if (minDR) filter['metrics.dr'].$gte = Math.max(0, Math.min(100, parseFloat(minDR)));
      if (maxDR) filter['metrics.dr'].$lte = Math.max(0, Math.min(100, parseFloat(maxDR)));
    }
    
    // Page Authority (PA) filter - 0 to 100
    if (minPA || maxPA) {
      filter['metrics.pa'] = {};
      if (minPA) filter['metrics.pa'].$gte = Math.max(0, Math.min(100, parseFloat(minPA)));
      if (maxPA) filter['metrics.pa'].$lte = Math.max(0, Math.min(100, parseFloat(maxPA)));
    }
    
    // Spam Score (SS) filter - 0 to 100
    if (minSS || maxSS) {
      filter['metrics.ss'] = {};
      if (minSS) filter['metrics.ss'].$gte = Math.max(0, Math.min(100, parseFloat(minSS)));
      if (maxSS) filter['metrics.ss'].$lte = Math.max(0, Math.min(100, parseFloat(maxSS)));
    }
    
    // Alexa Score (AS) filter - 0 to 100
    if (minAS || maxAS) {
      filter['metrics.as'] = {};
      if (minAS) filter['metrics.as'].$gte = Math.max(0, Math.min(100, parseFloat(minAS)));
      if (maxAS) filter['metrics.as'].$lte = Math.max(0, Math.min(100, parseFloat(maxAS)));
    }
    
    // Trust Flow (TF) filter - 0 to 100
    if (minTF || maxTF) {
      filter['metrics.tf'] = {};
      if (minTF) filter['metrics.tf'].$gte = Math.max(0, Math.min(100, parseFloat(minTF)));
      if (maxTF) filter['metrics.tf'].$lte = Math.max(0, Math.min(100, parseFloat(maxTF)));
    }
    
    // Citation Flow (CF) filter - 0 to 100
    if (minCF || maxCF) {
      filter['metrics.cf'] = {};
      if (minCF) filter['metrics.cf'].$gte = Math.max(0, Math.min(100, parseFloat(minCF)));
      if (maxCF) filter['metrics.cf'].$lte = Math.max(0, Math.min(100, parseFloat(maxCF)));
    }
    
    // URL Rating (UR) filter - 0 to 100
    if (minUR || maxUR) {
      filter['metrics.ur'] = {};
      if (minUR) filter['metrics.ur'].$gte = Math.max(0, Math.min(100, parseFloat(minUR)));
      if (maxUR) filter['metrics.ur'].$lte = Math.max(0, Math.min(100, parseFloat(maxUR)));
    }
    
    // Domain Age filter - 0 to 100 years
    if (minDomainAge || maxDomainAge) {
      filter['metrics.domainAge'] = {};
      if (minDomainAge) filter['metrics.domainAge'].$gte = Math.max(0, Math.min(100, parseFloat(minDomainAge)));
      if (maxDomainAge) filter['metrics.domainAge'].$lte = Math.max(0, Math.min(100, parseFloat(maxDomainAge)));
    }
    
    // Ahrefs Traffic filter
    if (minAhrefsTraffic || maxAhrefsTraffic) {
      filter['metrics.ahrefsTraffic'] = {};
      if (minAhrefsTraffic) filter['metrics.ahrefsTraffic'].$gte = Math.max(0, parseFloat(minAhrefsTraffic));
      if (maxAhrefsTraffic) filter['metrics.ahrefsTraffic'].$lte = Math.max(0, parseFloat(maxAhrefsTraffic));
    }
    
    // SEMrush Traffic filter
    if (minSemrushTraffic || maxSemrushTraffic) {
      filter['metrics.semrushTraffic'] = {};
      if (minSemrushTraffic) filter['metrics.semrushTraffic'].$gte = Math.max(0, parseFloat(minSemrushTraffic));
      if (maxSemrushTraffic) filter['metrics.semrushTraffic'].$lte = Math.max(0, parseFloat(maxSemrushTraffic));
    }
    
    // Monthly Traffic filter
    if (minMonthlyTraffic || maxMonthlyTraffic) {
      filter['metrics.monthlyTraffic'] = {};
      if (minMonthlyTraffic) filter['metrics.monthlyTraffic'].$gte = Math.max(0, parseFloat(minMonthlyTraffic));
      if (maxMonthlyTraffic) filter['metrics.monthlyTraffic'].$lte = Math.max(0, parseFloat(maxMonthlyTraffic));
    }
    
    // Ahrefs Keywords filter
    if (minAhrefsKeywords || maxAhrefsKeywords) {
      filter['metrics.ahrefsKeywords'] = {};
      if (minAhrefsKeywords) filter['metrics.ahrefsKeywords'].$gte = Math.max(0, parseFloat(minAhrefsKeywords));
      if (maxAhrefsKeywords) filter['metrics.ahrefsKeywords'].$lte = Math.max(0, parseFloat(maxAhrefsKeywords));
    }
    
    // SEMrush Keywords filter
    if (minSemrushKeywords || maxSemrushKeywords) {
      filter['metrics.semrushKeywords'] = {};
      if (minSemrushKeywords) filter['metrics.semrushKeywords'].$gte = Math.max(0, parseFloat(minSemrushKeywords));
      if (maxSemrushKeywords) filter['metrics.semrushKeywords'].$lte = Math.max(0, parseFloat(maxSemrushKeywords));
    }
    
    // Ahrefs Referring Domains filter
    if (minAhrefsReferringDomains || maxAhrefsReferringDomains) {
      filter['metrics.ahrefsReferringDomains'] = {};
      if (minAhrefsReferringDomains) filter['metrics.ahrefsReferringDomains'].$gte = Math.max(0, parseFloat(minAhrefsReferringDomains));
      if (maxAhrefsReferringDomains) filter['metrics.ahrefsReferringDomains'].$lte = Math.max(0, parseFloat(maxAhrefsReferringDomains));
    }
    
    // SEMrush Referring Domains filter
    if (minSemrushReferringDomains || maxSemrushReferringDomains) {
      filter['metrics.semrushReferringDomains'] = {};
      if (minSemrushReferringDomains) filter['metrics.semrushReferringDomains'].$gte = Math.max(0, parseFloat(minSemrushReferringDomains));
      if (maxSemrushReferringDomains) filter['metrics.semrushReferringDomains'].$lte = Math.max(0, parseFloat(maxSemrushReferringDomains));
    }
    
    if (search) {
      filter.$or = [
        { domain: { $regex: search, $options: 'i' } },
        { siteDescription: { $regex: search, $options: 'i' } },
        { keywords: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    // Validate sortBy parameter and include all new SEO metrics
    const validSortFields = [
      'createdAt', 
      'domain', 
      'publishingPrice', 
      'metrics.domainAuthority',
      'metrics.dr',
      'metrics.pa',
      'metrics.ss',
      'metrics.as',
      'metrics.tf',
      'metrics.cf',
      'metrics.ur',
      'metrics.domainAge',
      'metrics.ahrefsTraffic',
      'metrics.semrushTraffic',
      'metrics.monthlyTraffic'
    ];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sort[validSortBy] = sortOrder === 'desc' ? -1 : 1;

    const websites = await Website.find(filter)
      .populate('userId', 'firstName lastName')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Website.countDocuments(filter);

    // Check if there are no websites
    if (total === 0) {
      // Get filter options even when no websites match
      const [categories, countries, languages] = await Promise.all([
        Website.distinct('category', { status: 'approved' }),
        Website.distinct('country', { status: 'approved' }),
        Website.distinct('mainLanguage', { status: 'approved' })
      ]);

      return res.status(200).json({
        ok: true,
        data: [],
        pagination: {
          current: parseInt(page),
          pages: 0,
          total: 0,
          limit: parseInt(limit)
        },
        filters: {
          categories: categories.sort(),
          countries: countries.sort(),
          languages: languages.sort()
        }
      });
    }

    // Get additional stats for each website
    const websitesWithStats = await Promise.all(
      websites.map(async (website) => {
        const [completedOrders, avgResponseTime, ratings] = await Promise.all([
          Order.countDocuments({ 
            websiteId: website._id, 
            status: 'delivered' 
          }),
          Order.aggregate([
            { $match: { websiteId: website._id, publisherResponseTime: { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$publisherResponseTime' } } }
          ]),
          Order.aggregate([
            { $match: { websiteId: website._id, 'review.rating': { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$review.rating' }, count: { $sum: 1 } } }
          ])
        ]);

        return {
          ...website.toObject(),
          stats: {
            completedOrders,
            avgResponseTime: avgResponseTime[0]?.avg || 0,
            rating: ratings[0]?.avg || 0,
            reviewCount: ratings[0]?.count || 0
          }
        };
      })
    );

    // Get filter options for frontend
    const [categories, countries, languages] = await Promise.all([
      Website.distinct('category', { status: 'approved' }),
      Website.distinct('country', { status: 'approved' }),
      Website.distinct('mainLanguage', { status: 'approved' })
    ]);

    res.status(200).json({
      ok: true,
      data: websitesWithStats,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      },
      filters: {
        categories: categories.sort(),
        countries: countries.sort(),
        languages: languages.sort()
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to browse websites",
      error: error.message
    });
  }
};

// Get Website Details
export const getWebsiteDetails = async (req, res) => {
  try {
    const { websiteId } = req.params;
    
    const website = await Website.findOne({
      _id: websiteId,
      status: 'approved'
    }).populate('userId', 'firstName lastName email');

    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or not available"
      });
    }

    // Get website statistics
    const [
      totalOrders,
      completedOrders,
      avgRating,
      recentReviews,
      avgResponseTime,
      sampleContent
    ] = await Promise.all([
      Order.countDocuments({ websiteId: website._id }),
      Order.countDocuments({ websiteId: website._id, status: 'delivered' }),
      Order.aggregate([
        { $match: { websiteId: website._id, 'review.rating': { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$review.rating' } } }
      ]),
      Order.find({ 
        websiteId: website._id, 
        'review.rating': { $exists: true } 
      })
      .populate('advertiserId', 'firstName lastName')
      .sort({ 'review.reviewedAt': -1 })
      .limit(5)
      .select('review orderId'),
      Order.aggregate([
        { $match: { websiteId: website._id, publisherResponseTime: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$publisherResponseTime' } } }
      ]),
      // Mock sample content - in real app, you'd have this stored
      []
    ]);

    const websiteDetails = {
      ...website.toObject(),
      // Combine main category with additional categories for display
      allCategories: website.category 
        ? [website.category, ...(website.additionalCategories || [])] 
        : (website.additionalCategories || []),
      statistics: {
        totalOrders,
        completedOrders,
        successRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0,
        avgRating: avgRating[0]?.avg || 0,
        avgResponseTime: avgResponseTime[0]?.avg || 0,
        publisherName: `${website.userId.firstName} ${website.userId.lastName}`
      },
      recentReviews: recentReviews.map(order => ({
        orderId: order.orderId,
        rating: order.review.rating,
        comment: order.review.comment,
        reviewedAt: order.review.reviewedAt,
        advertiserName: `${order.advertiserId.firstName} ${order.advertiserId.lastName}`
      })),
      sampleContent,
      pricing: {
        basePrice: website.publishingPrice,
        homepagePrice: website.homepageAnnouncementPrice,
        sensitiveTopicPrice: website.sensitiveContentExtraCharge,
        rushOrderSurcharge: website.publishingPrice * 0.5, // 50% surcharge
        bulkDiscounts: [
          { minOrders: 5, discount: 5 },
          { minOrders: 10, discount: 10 },
          { minOrders: 20, discount: 15 }
        ]
      }
    };

    res.status(200).json({
      ok: true,
      data: websiteDetails
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch website details",
      error: error.message
    });
  }
};

// Get Recommended Websites (AI-powered recommendations)
export const getRecommendedWebsites = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const { limit = 12 } = req.query;
    
    const recommendedWebsites = await SearchService.getRecommendedWebsites(advertiserId, parseInt(limit));
    
    res.status(200).json({
      ok: true,
      data: recommendedWebsites,
      message: "Recommended websites fetched successfully"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch recommended websites",
      error: error.message
    });
  }
};

// Create Order (Enhanced)
export const createOrder = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const {
      websiteId,
      title,
      description,
      contentRequirements,
      deadline,
      rushOrder = false,
      bulkOrder = false,
      additionalServices = {}
    } = req.body;

    // Validate website
    const website = await Website.findOne({
      _id: websiteId,
      status: 'approved'
    });

    if (!website) {
      return res.status(400).json({
        ok: false,
        message: "Website not found or not available"
      });
    }

    // Ensure contentRequirements is properly structured
    const validContentRequirements = {
      wordCount: contentRequirements?.wordCount || 800,
      keywords: contentRequirements?.keywords || [],
      targetUrl: contentRequirements?.targetUrl || '',
      anchorText: contentRequirements?.anchorText || '',
      linkType: contentRequirements?.linkType || 'dofollow',
      needsCopywriting: contentRequirements?.needsCopywriting || false,
      contentType: contentRequirements?.contentType || 'article',
      bulkQuantity: additionalServices?.bulkQuantity || 1
    };

    // Calculate pricing
    let basePrice = website.publishingPrice;
    const additionalCharges = {
      copywriting: additionalServices.needsCopywriting ? website.copywritingPrice : 0,
      rushOrder: rushOrder ? basePrice * 0.5 : 0,
      homepageAnnouncement: additionalServices.homepageAnnouncement ? website.homepageAnnouncementPrice : 0,
      premium: validContentRequirements.linkType === 'dofollow' ? 0 : basePrice * 0.1
    };

    // Apply bulk discounts
    let discount = 0;
    if (bulkOrder && validContentRequirements.bulkQuantity) {
      if (validContentRequirements.bulkQuantity >= 20) discount = 0.15;
      else if (validContentRequirements.bulkQuantity >= 10) discount = 0.10;
      else if (validContentRequirements.bulkQuantity >= 5) discount = 0.05;
    }

    const subtotal = basePrice + Object.values(additionalCharges).reduce((a, b) => a + b, 0);
    const discountAmount = subtotal * discount;
    const totalPrice = subtotal - discountAmount;
    const platformCommission = totalPrice * 0.1; // 10% platform commission

    // Check advertiser wallet balance
    const wallet = await Wallet.findOne({ userId: advertiserId });
    if (!wallet || wallet.balance < totalPrice) {
      return res.status(400).json({
        ok: false,
        message: "Insufficient wallet balance. Please top up your account."
      });
    }

    // Create order
    const order = new Order({
      publisherId: website.userId,
      advertiserId,
      websiteId,
      title,
      description,
      contentRequirements: validContentRequirements,
      basePrice,
      additionalCharges,
      totalPrice,
      platformCommission,
      deadline: new Date(deadline),
      rushOrder,
      status: 'pending',
      paymentStatus: 'pending'
    });

    const savedOrder = await order.save();

    // Deduct amount from advertiser wallet (hold in escrow)
    wallet.balance -= totalPrice;
    wallet.pendingBalance += totalPrice;
    await wallet.save();

    // Create transaction record
    const transaction = await Transaction.create({
      userId: advertiserId,
      walletId: wallet._id,
      type: 'deposit',
      amount: -totalPrice,
      description: `Order payment for ${savedOrder.orderId}`,
      orderId: savedOrder._id,
      status: 'completed'
    });

    // Create notification for publisher
    await Notification.create({
      userId: website.userId,
      userRole: 'publisher',
      type: 'order_status',
      title: 'New Order Received',
      message: `You have received a new order for ${website.domain}`,
      orderId: savedOrder._id,
      websiteId: websiteId,
      channels: {
        inApp: true,
        email: true
      }
    });

    // Create order chat
    const Chat = await import('../model/Chat.js').then(module => module.default);
    const chat = new Chat({
      chatType: 'order',
      participants: [
        { 
          userId: advertiserId, 
          role: 'advertiser',
          joinedAt: new Date(),
          isActive: true,
          notifications: {
            enabled: true
          }
        },
        { 
          userId: website.userId, 
          role: 'publisher',
          joinedAt: new Date(),
          isActive: true,
          notifications: {
            enabled: true
          }
        }
      ],
      orderId: savedOrder._id,
      title: `Order Discussion - ${savedOrder.orderId}`,
      description: `Chat for order: ${title}`
    });

    const savedChat = await chat.save();

    // Update order with chat ID
    savedOrder.chatId = savedChat._id;
    await savedOrder.save();

    // Populate for response
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain');

    res.status(201).json({
      ok: true,
      message: "Order created successfully",
      data: populatedOrder
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to create order",
      error: error.message
    });
  }
};

// Create Bulk Orders
export const createBulkOrders = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const {
      orders, // Array of order objects
      staggeredSchedule = false,
      scheduleInterval = 'daily'
    } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Orders array is required and cannot be empty"
      });
    }

    // Validate that we have enough wallet balance for all orders
    const wallet = await Wallet.findOne({ userId: advertiserId });
    if (!wallet) {
      return res.status(400).json({
        ok: false,
        message: "Wallet not found"
      });
    }

    // Calculate total cost for all orders
    let totalCost = 0;
    const orderDetails = [];

    for (const orderData of orders) {
      const {
        websiteId,
        title,
        description,
        contentRequirements,
        deadline,
        rushOrder = false,
        additionalServices = {}
      } = orderData;

      // Validate website
      const website = await Website.findOne({
        _id: websiteId,
        status: 'approved'
      });

      if (!website) {
        return res.status(400).json({
          ok: false,
          message: `Website ${websiteId} not found or not available`
        });
      }

      // Ensure contentRequirements is properly structured
      const validContentRequirements = {
        wordCount: contentRequirements?.wordCount || 800,
        keywords: contentRequirements?.keywords || [],
        targetUrl: contentRequirements?.targetUrl || '',
        anchorText: contentRequirements?.anchorText || '',
        linkType: contentRequirements?.linkType || 'dofollow',
        needsCopywriting: contentRequirements?.needsCopywriting || false,
        contentType: contentRequirements?.contentType || 'article'
      };

      // Calculate pricing
      let basePrice = website.publishingPrice;
      const additionalCharges = {
        copywriting: additionalServices.needsCopywriting ? website.copywritingPrice : 0,
        rushOrder: rushOrder ? basePrice * 0.5 : 0,
        homepageAnnouncement: additionalServices.homepageAnnouncement ? website.homepageAnnouncementPrice : 0,
        premium: validContentRequirements.linkType === 'dofollow' ? 0 : basePrice * 0.1
      };

      // Apply bulk discounts (based on total number of orders)
      let discount = 0;
      if (orders.length >= 20) discount = 0.15;
      else if (orders.length >= 10) discount = 0.10;
      else if (orders.length >= 5) discount = 0.05;

      const subtotal = basePrice + Object.values(additionalCharges).reduce((a, b) => a + b, 0);
      const discountAmount = subtotal * discount;
      const totalPrice = subtotal - discountAmount;
      const platformCommission = totalPrice * 0.1; // 10% platform commission

      totalCost += totalPrice;

      orderDetails.push({
        website,
        basePrice,
        additionalCharges,
        totalPrice,
        platformCommission,
        discountAmount,
        contentRequirements: validContentRequirements
      });
    }

    // Check if advertiser has enough balance
    if (wallet.balance < totalCost) {
      return res.status(400).json({
        ok: false,
        message: `Insufficient wallet balance. You need ${totalCost.toFixed(2)} but have ${wallet.balance.toFixed(2)}. Please top up your account.`
      });
    }

    // Create all orders
    const createdOrders = [];
    const failedOrders = [];
    const transactionRecords = [];
    const notificationRecords = [];
    const chatRecords = [];

    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];
      const {
        websiteId,
        title,
        description,
        deadline,
        rushOrder = false,
        additionalServices = {}
      } = orderData;

      const orderDetail = orderDetails[i];
      const validContentRequirements = orderDetail.contentRequirements;

      try {
        // Apply staggered scheduling if requested
        let orderDeadline = new Date(deadline);
        if (staggeredSchedule && i > 0) {
          const intervalMs = scheduleInterval === 'daily' ? 24 * 60 * 60 * 1000 : 
                            scheduleInterval === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 
                            30 * 24 * 60 * 60 * 1000; // monthly default
          orderDeadline = new Date(orderDeadline.getTime() + (i * intervalMs));
        }

        // Create order
        const order = new Order({
          publisherId: orderDetail.website.userId,
          advertiserId,
          websiteId,
          title,
          description,
          contentRequirements: validContentRequirements,
          basePrice: orderDetail.basePrice,
          additionalCharges: orderDetail.additionalCharges,
          totalPrice: orderDetail.totalPrice,
          platformCommission: orderDetail.platformCommission,
          deadline: orderDeadline,
          rushOrder,
          discount: {
            percentage: (orderDetail.discountAmount / (orderDetail.basePrice + Object.values(orderDetail.additionalCharges).reduce((a, b) => a + b, 0))) * 100,
            amount: orderDetail.discountAmount
          },
          status: 'pending',
          paymentStatus: 'pending'
        });

        await order.save();
        createdOrders.push(order);

        // Create notification for publisher
        notificationRecords.push({
          userId: orderDetail.website.userId,
          userRole: 'publisher',
          type: 'order_status',
          title: 'New Order Received',
          message: `You have received a new order for ${orderDetail.website.domain}`,
          orderId: order._id,
          websiteId: websiteId,
          channels: {
            inApp: true,
            email: true
          }
        });

        // Create order chat
        chatRecords.push({
          chatType: 'order',
          participants: [
            { userId: advertiserId, role: 'advertiser' },
            { userId: orderDetail.website.userId._id, role: 'publisher' }
          ],
          orderId: order._id,
          title: `Order Discussion - ${order.orderId}`,
          description: `Chat for order: ${title}`
        });
      } catch (error) {
        failedOrders.push({
          index: i,
          websiteId,
          error: error.message
        });
      }
    }

    // Process notifications and chats in bulk
    if (notificationRecords.length > 0) {
      await Notification.insertMany(notificationRecords);
    }

    if (chatRecords.length > 0) {
      await Chat.insertMany(chatRecords);
    }

    // Deduct total amount from advertiser wallet (hold in escrow)
    wallet.balance -= totalCost;
    wallet.pendingBalance += totalCost;
    await wallet.save();

    // Create transaction record for the bulk order
    const transaction = await Transaction.create({
      userId: advertiserId,
      walletId: wallet._id,
      type: 'deposit',
      amount: -totalCost,
      currency: wallet.currency,
      balanceBefore: wallet.balance + totalCost,
      balanceAfter: wallet.balance,
      status: 'completed',
      description: `Payment for bulk order of ${orders.length} orders`,
      paymentMethod: 'internal'
    });

    // Populate created orders with website and publisher info
    const populatedOrders = await Order.find({
      _id: { $in: createdOrders.map(order => order._id) }
    }).populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain category');

    res.status(201).json({
      ok: true,
      message: `Bulk order created successfully. ${createdOrders.length} orders created, ${failedOrders.length} failed.`,
      data: {
        orders: populatedOrders,
        failedOrders,
        transaction
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to create bulk orders",
      error: error.message
    });
  }
};

// Get Advertiser Orders
export const getAdvertiserOrders = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      status,
      search,
      dateRange,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = { advertiserId };
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add date range filtering
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let dateFilter = {};
      
      switch (dateRange) {
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
      
      filter.createdAt = dateFilter;
    }

    // Build sort
    const sort = {};
    
    // Handle different sort options
    if (sortBy === 'createdAt') {
      sort.createdAt = sortOrder === 'desc' ? -1 : 1; // -1 for desc, 1 for asc
    } else if (sortBy === 'deadline') {
      sort.deadline = sortOrder === 'asc' ? 1 : -1; // 1 for asc (soonest first), -1 for desc
    } else if (sortBy === 'totalPrice') {
      sort.totalPrice = sortOrder === 'asc' ? 1 : -1; // 1 for asc, -1 for desc
    } else {
      // Default sort
      sort.createdAt = -1;
    }

    const orders = await Order.find(filter)
      .populate('publisherId', 'firstName lastName email')
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

// Approve/Reject Submitted Work
export const reviewSubmittedWork = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, rating, review, revisionRequest } = req.body;
    const advertiserId = req.user.id;

    const order = await Order.findOne({
      _id: orderId,
      advertiserId,
      status: 'completed'
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found or not ready for review"
      });
    }

    if (action === 'approve') {
      // Approve and complete order
      order.status = 'delivered';
      order.paymentStatus = 'released';
      order.review = {
        rating,
        comment: review,
        reviewedBy: advertiserId,
        reviewedAt: new Date()
      };

      // Release payment to publisher
      const [advertiserWallet, publisherWallet] = await Promise.all([
        Wallet.findOne({ userId: advertiserId }),
        Wallet.findOne({ userId: order.publisherId })
      ]);

      // Update wallets
      advertiserWallet.pendingBalance -= order.totalPrice;
      publisherWallet.balance += order.publisherEarnings;
      publisherWallet.totalEarnings += order.publisherEarnings;

      await Promise.all([
        advertiserWallet.save(),
        publisherWallet.save()
      ]);

      // Create transaction records
      await Promise.all([
        Transaction.create({
          userId: order.publisherId,
          walletId: publisherWallet._id,
          type: 'earning',
          amount: order.publisherEarnings,
          currency: publisherWallet.currency,
          balanceBefore: publisherWallet.balance - order.publisherEarnings,
          balanceAfter: publisherWallet.balance,
          status: 'completed',
          orderId: order._id,
          description: `Earnings from order ${order.orderId}`
        }),
        Transaction.create({
          userId: 'platform',
          type: 'commission',
          amount: order.platformCommission,
          currency: 'USD',
          status: 'completed',
          orderId: order._id,
          description: `Platform commission from order ${order.orderId}`
        })
      ]);

      // Send notification to publisher
      await Notification.create({
        userId: order.publisherId,
        userRole: 'publisher',
        type: 'order_approved',
        title: 'Order Approved & Payment Released',
        message: `Your work has been approved for order ${order.orderId}. Payment has been released to your account.`,
        orderId: order._id,
        channels: {
          inApp: { delivered: true },
          email: { sent: true }
        }
      });

    } else if (action === 'revision') {
      // Request revision
      order.status = 'revision_requested';
      order.revisions.push({
        requestedAt: new Date(),
        requestedBy: advertiserId,
        reason: revisionRequest,
        status: 'pending'
      });

      // Send notification to publisher
      await Notification.create({
        userId: order.publisherId,
        userRole: 'publisher',
        type: 'order_status',
        title: 'Revision Requested',
        message: `Revision has been requested for order ${order.orderId}`,
        orderId: order._id,
        channels: {
          inApp: { delivered: true },
          email: { sent: true }
        }
      });
    }

    await order.save();

    res.status(200).json({
      ok: true,
      message: `Order ${action === 'approve' ? 'approved' : 'revision requested'} successfully`,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to review submitted work",
      error: error.message
    });
  }
};

// Get Order Analytics
export const getOrderAnalytics = async (req, res) => {
  try {
    const advertiserId = req.user.id;
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
      ordersByStatus,
      spendingTrend,
      performanceByWebsite,
      avgMetrics
    ] = await Promise.all([
      // Orders by status
      Order.aggregate([
        { $match: { advertiserId: new mongoose.Types.ObjectId(advertiserId), createdAt: dateFilter } },
        { $group: { _id: '$status', count: { $sum: 1 }, totalSpent: { $sum: '$totalPrice' } } }
      ]),
      
      // Spending trend over time
      Order.aggregate([
        { $match: { advertiserId: new mongoose.Types.ObjectId(advertiserId), createdAt: dateFilter } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            orders: { $sum: 1 },
            spent: { $sum: '$totalPrice' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Performance by website
      Order.aggregate([
        { $match: { advertiserId: new mongoose.Types.ObjectId(advertiserId), createdAt: dateFilter } },
        {
          $group: {
            _id: '$websiteId',
            orders: { $sum: 1 },
            totalSpent: { $sum: '$totalPrice' },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            avgRating: { $avg: '$review.rating' }
          }
        },
        { $sort: { orders: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'websites',
            localField: '_id',
            foreignField: '_id',
            as: 'website'
          }
        }
      ]),
      
      // Average metrics
      Order.aggregate([
        { $match: { advertiserId: new mongoose.Types.ObjectId(advertiserId), createdAt: dateFilter } },
        {
          $group: {
            _id: null,
            avgOrderValue: { $avg: '$totalPrice' },
            avgCompletionTime: { $avg: '$completionTime' },
            totalOrders: { $sum: 1 },
            completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const analytics = {
      ordersByStatus,
      spendingTrend,
      performanceByWebsite: performanceByWebsite.map(item => ({
        website: item.website[0]?.domain || 'Unknown',
        orders: item.orders,
        totalSpent: item.totalSpent,
        successRate: item.orders > 0 ? ((item.completed / item.orders) * 100).toFixed(1) : 0,
        avgRating: item.avgRating || 0
      })),
      summary: {
        avgOrderValue: avgMetrics[0]?.avgOrderValue || 0,
        avgCompletionTime: avgMetrics[0]?.avgCompletionTime || 0,
        successRate: avgMetrics[0]?.totalOrders > 0 ? 
          ((avgMetrics[0].completedOrders / avgMetrics[0].totalOrders) * 100).toFixed(1) : 0,
        totalOrders: avgMetrics[0]?.totalOrders || 0
      }
    };

    res.status(200).json({
      ok: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch order analytics",
      error: error.message
    });
  }
};

// Create chat between advertiser and publisher for a website
export const createWebsiteChat = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const { websiteId } = req.body;

    console.log('Creating chat for advertiser:', advertiserId);
    console.log('Received websiteId:', websiteId);
    console.log('Type of websiteId:', typeof websiteId);

    // Validate website ID
    if (!websiteId) {
      return res.status(400).json({
        ok: false,
        message: "Website ID is required"
      });
    }

    // Check if websiteId is a valid ObjectId string
    if (typeof websiteId !== 'string' || websiteId.length !== 24) {
      return res.status(400).json({
        ok: false,
        message: "Invalid website ID format. Expected a 24-character hexadecimal string."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid website ID format"
      });
    }

    // Validate website and get publisher information
    const website = await Website.findOne({
      _id: websiteId
    }).populate('userId', 'firstName lastName email role');

    console.log('Found website:', website);

    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found"
      });
    }

    // Check if website is approved or submitted (for pending approval)
    if (website.status !== 'approved' && website.status !== 'submitted') {
      return res.status(400).json({
        ok: false,
        message: `Website not available. Current status: ${website.status}. Only submitted or approved websites can have chats.`
      });
    }

    const publisherId = website.userId._id;

    console.log('Publisher ID:', publisherId);

    // Check if a chat already exists between this advertiser and publisher for this website
    let existingChat = await Chat.findOne({
      chatType: 'general',
      websiteId: websiteId,
      'participants.userId': { $all: [advertiserId, publisherId] }
    });

    if (existingChat) {
      return res.status(200).json({
        ok: true,
        message: "Chat room already exists",
        data: existingChat
      });
    }

    // Generate chat ID
    const count = await Chat.countDocuments();
    const chatId = `CHAT-${Date.now()}-${String(count + 1).padStart(5, '0')}`;

    // Create new chat room
    const chat = new Chat({
      chatId: chatId,
      chatType: 'general',
      participants: [
        { 
          userId: advertiserId, 
          role: 'advertiser', 
          joinedAt: new Date(), 
          isActive: true 
        },
        { 
          userId: publisherId, 
          role: 'publisher', 
          joinedAt: new Date(), 
          isActive: true 
        }
      ],
      websiteId: websiteId,
      title: `Chat about ${website.domain}`,
      description: `Discussion about website ${website.domain} between advertiser and publisher`,
      status: 'active',
      priority: 'normal'
    });

    await chat.save();

    // Populate the chat with user details
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.userId', 'firstName lastName email role')
      .populate('websiteId', 'domain');

    res.status(201).json({
      ok: true,
      message: "Chat room created successfully",
      data: populatedChat
    });
  } catch (error) {
    console.error('Error creating website chat:', error);
    res.status(500).json({
      ok: false,
      message: "Failed to create chat room",
      error: error.message
    });
  }
};

// Favorites Management
export const getFavoriteWebsites = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    
    // Get user's favorite websites
    const user = await User.findById(advertiserId).populate({
      path: 'favorites',
      match: { status: 'approved' },
      populate: {
        path: 'userId',
        select: 'firstName lastName'
      }
    });
    
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found"
      });
    }
    
    // Get additional stats for each favorite website
    const favoritesWithStats = await Promise.all(
      (user.favorites || []).map(async (website) => {
        const [completedOrders, avgResponseTime, ratings] = await Promise.all([
          Order.countDocuments({ 
            websiteId: website._id, 
            status: 'delivered' 
          }),
          Order.aggregate([
            { $match: { websiteId: website._id, publisherResponseTime: { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$publisherResponseTime' } } }
          ]),
          Order.aggregate([
            { $match: { websiteId: website._id, 'review.rating': { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$review.rating' }, count: { $sum: 1 } } }
          ])
        ]);

        return {
          ...website.toObject(),
          stats: {
            completedOrders,
            avgResponseTime: avgResponseTime[0]?.avg || 0,
            rating: ratings[0]?.avg || 0,
            reviewCount: ratings[0]?.count || 0
          }
        };
      })
    );

    res.status(200).json({
      ok: true,
      favorites: favoritesWithStats
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch favorite websites",
      error: error.message
    });
  }
};

export const addToFavorites = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const advertiserId = req.user.id;
    
    // Validate website ID
    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid website ID"
      });
    }
    
    // Check if website exists and is approved
    const website = await Website.findOne({
      _id: websiteId,
      status: 'approved'
    });
    
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or not available"
      });
    }
    
    // Add to user's favorites
    const user = await User.findByIdAndUpdate(
      advertiserId,
      { $addToSet: { favorites: websiteId } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found"
      });
    }
    
    res.status(200).json({
      ok: true,
      message: "Website added to favorites"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to add website to favorites",
      error: error.message
    });
  }
};

export const removeFromFavorites = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const advertiserId = req.user.id;
    
    // Validate website ID
    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid website ID"
      });
    }
    
    // Remove from user's favorites
    const user = await User.findByIdAndUpdate(
      advertiserId,
      { $pull: { favorites: websiteId } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found"
      });
    }
    
    res.status(200).json({
      ok: true,
      message: "Website removed from favorites"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to remove website from favorites",
      error: error.message
    });
  }
};

export default {
  getAdvertiserDashboard,
  browseWebsites,
  getWebsiteDetails,
  getRecommendedWebsites,
  createOrder,
  createBulkOrders,
  getAdvertiserOrders,
  reviewSubmittedWork,
  getOrderAnalytics,
  createWebsiteChat,
  getFavoriteWebsites,
  addToFavorites,
  removeFromFavorites
};