import Order from "../model/Order.js";
import Website from "../model/Website.js";
import User from "../model/User.js";
import mongoose from "mongoose";

// Get dashboard data for publisher (Home tab)
export const getPublisherDashboard = async (req, res) => {
  try {
    // For publicly accessible dashboard, provide generic data
    // If user is authenticated, we can show personalized data
    const publisherId = req.user?.id;
    
    let dashboardData;
    
    if (publisherId) {
      // Authenticated user - show personalized data
      const [
        orderRequests,
        approvedRequests,
        completedRequests,
        improvementRequests,
        rejectedRequests,
        totalEarnings,
        thisMonthEarnings
      ] = await Promise.all([
        // Order Requests (pending)
        Order.find({ 
          publisherId, 
          status: 'pending' 
        })
        .populate('advertiserId', 'firstName lastName email')
        .populate('websiteId', 'domain')
        .sort({ createdAt: -1 })
        .limit(10),
        
        // Approved Requests
        Order.find({ 
          publisherId, 
          status: { $in: ['approved', 'in_progress'] }
        })
        .populate('advertiserId', 'firstName lastName email')
        .populate('websiteId', 'domain')
        .sort({ createdAt: -1 })
        .limit(10),
        
        // Completed Requests
        Order.find({ 
          publisherId, 
          status: { $in: ['completed', 'delivered'] }
        })
        .populate('advertiserId', 'firstName lastName email')
        .populate('websiteId', 'domain')
        .sort({ createdAt: -1 })
        .limit(10),
        
        // Improvement Requests (revision requested)
        Order.find({ 
          publisherId, 
          status: 'revision_requested' 
        })
        .populate('advertiserId', 'firstName lastName email')
        .populate('websiteId', 'domain')
        .sort({ createdAt: -1 })
        .limit(10),
        
        // Rejected Requests
        Order.find({ 
          publisherId, 
          status: 'rejected' 
        })
        .populate('advertiserId', 'firstName lastName email')
        .populate('websiteId', 'domain')
        .sort({ createdAt: -1 })
        .limit(10),
        
        // Total earnings
        Order.aggregate([
          { 
            $match: { 
              publisherId: new mongoose.Types.ObjectId(publisherId),
              status: 'delivered',
              paymentStatus: 'released'
            }
          },
          { 
            $group: { 
              _id: null, 
              total: { $sum: '$publisherEarnings' } 
            } 
          }
        ]),
        
        // This month earnings
        Order.aggregate([
          { 
            $match: { 
              publisherId: new mongoose.Types.ObjectId(publisherId),
              status: 'delivered',
              paymentStatus: 'released',
              createdAt: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          },
          { 
            $group: { 
              _id: null, 
              total: { $sum: '$publisherEarnings' } 
            } 
          }
        ])
      ]);

      // Calculate expired orders
      const now = new Date();
      const formatOrderData = (orders) => {
        return orders.map(order => {
          const isExpired = new Date(order.deadline) < now;
          const hoursExpired = isExpired 
            ? Math.floor((now - new Date(order.deadline)) / (1000 * 60 * 60))
            : null;
          
          return {
            orderId: order.orderId,
            website: order.websiteId?.domain || 'N/A',
            advertiser: `${order.advertiserId?.firstName || ''} ${order.advertiserId?.lastName || ''}`.trim(),
            dueDate: order.deadline,
            price: `$${order.totalPrice}`,
            bonus: order.additionalCharges?.premium > 0 ? `+$${order.additionalCharges.premium}` : null,
            expired: isExpired ? `Expired ${hoursExpired} hours` : null,
            status: order.status,
            title: order.title,
            description: order.description,
            createdAt: order.createdAt,
            _id: order._id
          };
        });
      };

      dashboardData = {
        orderRequests: formatOrderData(orderRequests),
        approvedRequests: formatOrderData(approvedRequests),
        completedRequests: formatOrderData(completedRequests),
        improvementRequests: formatOrderData(improvementRequests),
        rejectedRequests: formatOrderData(rejectedRequests),
        totalEarnings: totalEarnings[0]?.total || 0,
        thisMonthEarnings: thisMonthEarnings[0]?.total || 0,
        statistics: {
          totalOrders: orderRequests.length + approvedRequests.length + completedRequests.length,
          pendingOrders: orderRequests.length,
          completedOrders: completedRequests.length,
          successRate: completedRequests.length > 0 
            ? ((completedRequests.length / (completedRequests.length + rejectedRequests.length)) * 100).toFixed(1)
            : 0
        }
      };
    } else {
      // Public dashboard - show generic data
      dashboardData = {
        orderRequests: [],
        approvedRequests: [],
        completedRequests: [],
        improvementRequests: [],
        rejectedRequests: [],
        totalEarnings: 0,
        thisMonthEarnings: 0,
        statistics: {
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          successRate: 0
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
      message: "Failed to fetch dashboard data",
      error: error.message
    });
  }
};

// Get all orders for publisher with pagination and filtering
export const getPublisherOrders = async (req, res) => {
  try {
    const publisherId = req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = { publisherId };
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const orders = await Order.find(filter)
      .populate('advertiserId', 'firstName lastName email')
      .populate('websiteId', 'domain')
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
        total,
        limit: parseInt(limit)
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

// Accept/Approve an order
export const approveOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const publisherId = req.user.id;
    const { estimatedDelivery, additionalNotes } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      publisherId,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found or cannot be approved"
      });
    }

    // Update order status
    order.status = 'approved';
    order._userId = publisherId; // For status history tracking
    order.adminNotes = additionalNotes || '';
    
    if (estimatedDelivery) {
      order.deadline = new Date(estimatedDelivery);
    }

    await order.save();

    res.status(200).json({
      ok: true,
      message: "Order approved successfully",
      data: order
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to approve order",
      error: error.message
    });
  }
};

// Reject an order
export const rejectOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const publisherId = req.user.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        ok: false,
        message: "Rejection reason is required"
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      publisherId,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found or cannot be rejected"
      });
    }

    order.status = 'rejected';
    order._userId = publisherId;
    order.adminNotes = rejectionReason;

    await order.save();

    res.status(200).json({
      ok: true,
      message: "Order rejected successfully",
      data: order
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to reject order",
      error: error.message
    });
  }
};

// Submit completed work
export const submitOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const publisherId = req.user.id;
    const { content, publishedUrl, additionalNotes } = req.body;

    if (!content || !publishedUrl) {
      return res.status(400).json({
        ok: false,
        message: "Content and published URL are required"
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      publisherId,
      status: { $in: ['approved', 'in_progress', 'revision_requested'] }
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found or cannot be submitted"
      });
    }

    order.status = 'completed';
    order._userId = publisherId;
    order.submittedContent = {
      content,
      publishedUrl,
      submittedAt: new Date(),
      submittedBy: publisherId
    };
    order.adminNotes = additionalNotes || '';

    await order.save();

    res.status(200).json({
      ok: true,
      message: "Order submitted successfully. Waiting for advertiser approval.",
      data: order
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to submit order",
      error: error.message
    });
  }
};

// Create a new order (for advertisers)
export const createOrder = async (req, res) => {
  try {
    const advertiserId = req.user.id;
    const {
      websiteId,
      title,
      description,
      contentRequirements,
      deadline,
      rushOrder = false
    } = req.body;

    // Validate website exists and is approved
    const website = await Website.findById(websiteId);
    if (!website || website.status !== 'approved') {
      return res.status(400).json({
        ok: false,
        message: "Website not found or not approved"
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
      copywriting: validContentRequirements.needsCopywriting ? website.copywritingPrice : 0,
      rushOrder: rushOrder ? basePrice * 0.5 : 0, // 50% rush charge
      premium: validContentRequirements.linkType === 'dofollow' ? 0 : basePrice * 0.2
    };

    const totalPrice = basePrice + Object.values(additionalCharges).reduce((a, b) => a + b, 0);
    const platformCommission = totalPrice * 0.1; // 10% platform commission

    // Create the order first
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
      status: 'pending'
    });

    const savedOrder = await order.save();

    // Create a chat for this order
    const Chat = await import('../model/Chat.js').then(module => module.default);
    const User = await import('../model/User.js').then(module => module.default);
    
    // Get user details for participants
    const [advertiser, publisher] = await Promise.all([
      User.findById(advertiserId).select('firstName lastName email role'),
      User.findById(website.userId).select('firstName lastName email role')
    ]);

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
      title: `Order #${savedOrder.orderId}: ${title}`,
      description: `Chat for order "${title}"`,
      status: 'active',
      priority: 'normal'
    });

    const savedChat = await chat.save();

    // Update the order with the chat ID
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

// Get order details
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate order ID
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid order ID"
      });
    }

    // Find order and populate related data
    const order = await Order.findById(orderId)
      .populate('advertiserId', 'firstName lastName email')
      .populate('publisherId', 'firstName lastName email')
      .populate('websiteId', 'domain siteDescription category publishingPrice copywritingPrice')
      .populate('chatId', 'chatId title description');

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found"
      });
    }

    // Check if user has permission to view this order
    if (userRole === 'publisher' && order.publisherId._id.toString() !== userId) {
      return res.status(403).json({
        ok: false,
        message: "You don't have permission to view this order"
      });
    }

    if (userRole === 'advertiser' && order.advertiserId._id.toString() !== userId) {
      return res.status(403).json({
        ok: false,
        message: "You don't have permission to view this order"
      });
    }

    res.status(200).json({
      ok: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch order details",
      error: error.message
    });
  }
};

// Add message to order
export const addOrderMessage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const { message, attachments = [] } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        ok: false,
        message: "Message content is required"
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      $or: [
        { publisherId: userId },
        { advertiserId: userId }
      ]
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found or access denied"
      });
    }

    order.messages.push({
      senderId: userId,
      message: message.trim(),
      attachments,
      sentAt: new Date()
    });

    await order.save();

    res.status(200).json({
      ok: true,
      message: "Message sent successfully",
      data: order.messages[order.messages.length - 1]
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to send message",
      error: error.message
    });
  }
};

// Create chat for order
export const createOrderChat = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Find order and check if user has permission
    const order = await Order.findOne({
      _id: orderId,
      $or: [
        { publisherId: userId },
        { advertiserId: userId }
      ]
    }).populate('advertiserId', 'firstName lastName email role')
      .populate('publisherId', 'firstName lastName email role');

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "Order not found or access denied"
      });
    }

    // Check if chat already exists for this order
    if (order.chatId) {
      return res.status(200).json({
        ok: true,
        message: "Chat already exists for this order",
        data: order.chatId
      });
    }

    // Import Chat model
    const Chat = await import('../model/Chat.js').then(module => module.default);
    
    // Create chat for this order
    const chat = new Chat({
      chatType: 'order',
      participants: [
        {
          userId: order.advertiserId._id,
          role: 'advertiser',
          joinedAt: new Date(),
          isActive: true,
          notifications: {
            enabled: true
          }
        },
        {
          userId: order.publisherId._id,
          role: 'publisher',
          joinedAt: new Date(),
          isActive: true,
          notifications: {
            enabled: true
          }
        }
      ],
      orderId: order._id,
      title: `Order #${order.orderId}: ${order.title}`,
      description: `Chat for order "${order.title}"`,
      status: 'active',
      priority: 'normal'
    });

    const savedChat = await chat.save();

    // Update the order with the chat ID
    order.chatId = savedChat._id;
    await order.save();

    res.status(201).json({
      ok: true,
      message: "Chat created successfully",
      data: savedChat
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to create chat",
      error: error.message
    });
  }
};

export default {
  getPublisherDashboard,
  getPublisherOrders,
  approveOrder,
  rejectOrder,
  submitOrder,
  createOrder,
  getOrderDetails,
  addOrderMessage,
  createOrderChat
};