import Chat from "../model/Chat.js";
import Order from "../model/Order.js";
import Website from "../model/Website.js";
import User from "../model/User.js";
import { Notification } from "../Models/NotificationModel.js";
import mongoose from "mongoose";

// Compliance filter for personal contact details
const filterPersonalContactDetails = (content) => {
  // Regex patterns for personal contact information
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const socialMediaRegex = /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|twitter|instagram|linkedin|youtube|tiktok|snapchat|pinterest|reddit)\.com\/[^\s]*/gi;
  
  let filteredContent = content;
  
  // Replace phone numbers
  filteredContent = filteredContent.replace(phoneRegex, '[PHONE NUMBER]');
  
  // Replace email addresses
  filteredContent = filteredContent.replace(emailRegex, '[EMAIL ADDRESS]');
  
  // Replace social media links
  filteredContent = filteredContent.replace(socialMediaRegex, '[SOCIAL MEDIA LINK]');
  
  return filteredContent;
};

// Function to detect if message contains personal contact details
const containsPersonalContactDetails = (content) => {
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const socialMediaRegex = /(?:https?:\/\/)?(?:www\.)?(?:facebook|fb|twitter|instagram|linkedin|youtube|tiktok|snapchat|pinterest|reddit)\.com\/[^\s]*/gi;
  
  return phoneRegex.test(content) || emailRegex.test(content) || socialMediaRegex.test(content);
};

// File validation for uploads
const validateFileUpload = (file) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/zip',
    'application/x-zip-compressed'
  ];
  
  // Max file size (10MB)
  const maxSize = 10 * 1024 * 1024;
  
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'File type not allowed. Only images (JPEG, PNG, GIF) and ZIP files are allowed.'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds limit. Maximum file size is 10MB.'
    };
  }
  
  return { valid: true };
};

// Get User Chats
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      chatType, 
      status = 'active',
      search 
    } = req.query;

    // Build filter
    const filter = {
      'participants.userId': userId,
      status
    };
    
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

    // Mark user's unread messages and add last message
    const chatsWithUnread = chats.map(chat => {
      const userParticipant = chat.participants.find(p => p.userId.toString() === userId);
      const unreadCount = chat.messages.filter(msg => 
        msg.senderId.toString() !== userId && 
        !msg.readBy.some(read => read.userId.toString() === userId)
      ).length;
      
      // Get the last message
      let lastMessage = null;
      if (chat.messages && chat.messages.length > 0) {
        // Sort messages by createdAt to get the most recent one
        const sortedMessages = [...chat.messages].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        lastMessage = sortedMessages[0];
      }

      return {
        ...chat.toObject(),
        unreadCount,
        lastReadAt: userParticipant?.notifications?.lastReadAt,
        lastMessage // Add last message to the chat data
      };
    });

    res.status(200).json({
      ok: true,
      data: chatsWithUnread,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch chats",
      error: error.message
    });
  }
};

// Get Chat Messages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is participant
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId
    }).populate('participants.userId', 'firstName lastName email role');

    if (!chat) {
      return res.status(404).json({
        ok: false,
        message: "Chat not found or access denied"
      });
    }

    // Get messages with pagination
    const totalMessages = chat.messages.length;
    const startIndex = Math.max(0, totalMessages - (page * limit));
    const endIndex = totalMessages - ((page - 1) * limit);
    
    const messages = chat.messages
      .slice(startIndex, endIndex)
      .map(message => {
        // Ensure senderRole is available
        let senderRole = message.senderRole;
        if (!senderRole && message.senderId) {
          // Try to get role from chat participants
          const participant = chat.participants.find(p => 
            p.userId.toString() === message.senderId.toString()
          );
          if (participant && participant.role) {
            senderRole = participant.role;
          } else {
            // Try to get role from populated sender data
            const sender = chat.participants.find(p => p.userId.toString() === message.senderId.toString())?.userId;
            if (sender && sender.role) {
              senderRole = sender.role;
            } else {
              senderRole = 'user'; // Default fallback
            }
          }
        }
        
        return {
          ...message.toObject(),
          sender: chat.participants.find(p => p.userId.toString() === message.senderId.toString())?.userId,
          senderRole: senderRole || 'user'
        };
      });

    // Mark messages as read
    const unreadMessages = chat.messages.filter(msg => 
      msg.senderId.toString() !== userId && 
      !msg.readBy.some(read => read.userId.toString() === userId)
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        if (!msg.readBy.some(read => read.userId.toString() === userId)) {
          msg.readBy.push({
            userId,
            readAt: new Date()
          });
        }
      });
      
      // Update participant's last read time
      const participant = chat.participants.find(p => p.userId._id.toString() === userId);
      if (participant) {
        participant.notifications.lastReadAt = new Date();
      }
      
      await chat.save();
    }

    res.status(200).json({
      ok: true,
      data: {
        chat: {
          _id: chat._id,
          chatId: chat.chatId,
          chatType: chat.chatType,
          title: chat.title,
          description: chat.description,
          participants: chat.participants,
          orderId: chat.orderId,
          websiteId: chat.websiteId,
          status: chat.status,
          priority: chat.priority
        },
        messages,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalMessages / limit),
          total: totalMessages
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch chat messages",
      error: error.message
    });
  }
};

// Send Message
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { content, messageType = 'text', attachments = [] } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        ok: false,
        message: "Message content is required"
      });
    }

    // Verify user is participant
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId,
      'participants.isActive': true
    });

    if (!chat) {
      return res.status(404).json({
        ok: false,
        message: "Chat not found or access denied"
      });
    }

    // Find the participant to get their role
    const participant = chat.participants.find(p => p.userId.toString() === userId);
    const senderRole = participant && participant.role ? participant.role : 'user';

    // Check if message contains personal contact details
    const hasPersonalDetails = containsPersonalContactDetails(content.trim());
    
    // Apply compliance filter to content
    const filteredContent = filterPersonalContactDetails(content.trim());

    // Create new message
    const newMessage = {
      senderId: userId,
      senderRole: senderRole,
      content: filteredContent,
      messageType,
      attachments,
      readBy: [{ userId, readAt: new Date() }], // Sender has read it
      flags: {
        containsPersonalDetails: hasPersonalDetails
      }
    };

    chat.messages.push(newMessage);
    
    // Update chat statistics
    chat.stats.totalMessages = chat.messages.length;
    chat.stats.lastMessageAt = new Date();
    chat.stats.lastActivityAt = new Date();
    chat.flags.hasUnreadMessages = true;

    await chat.save();

    // Get the saved message with sender info
    const savedMessage = chat.messages[chat.messages.length - 1];
    const sender = await User.findById(userId).select('firstName lastName email role');

    // If message contains personal details, send notification to admins
    if (hasPersonalDetails) {
      // Find all admin users
      const admins = await User.find({ role: 'admin' }).select('_id');
      
      // Create notification for each admin
      const adminNotificationPromises = admins.map(admin => 
        Notification.create({
          userId: admin._id,
          type: 'illegal_activity_detected',
          title: 'Illegal Activity Detected in Chat',
          message: `${sender.firstName} ${sender.lastName} shared personal contact details in chat. Message: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          data: {
            chatId: chat._id,
            messageId: savedMessage._id
          },
          actionUrl: `/admin/chats/${chat._id}`,
          channels: {
            inApp: { delivered: true },
            email: { sent: false }, // Don't mark as sent until actually sent
            push: { sent: false }   // Don't mark as sent until actually sent
          },
          priority: 'high'
        })
      );
      
      await Promise.all(adminNotificationPromises);
    }

    // Send notifications to other participants
    const otherParticipants = chat.participants.filter(p => 
      p.userId.toString() !== userId && p.isActive && p.notifications.enabled
    );

    const notificationPromises = otherParticipants.map(participant => 
      Notification.create({
        userId: participant.userId,
        userRole: participant.role,
        type: chat.chatType === 'support' ? 'support_ticket_created' : 'message_received',
        title: `New message in ${chat.title || 'Chat'}`,
        message: `${sender.firstName} ${sender.lastName}: ${filteredContent.substring(0, 100)}${filteredContent.length > 100 ? '...' : ''}`,
        orderId: chat.orderId,
        actionUrl: `/chat/${chat._id}`,
        data: {
          chatId: chat._id
        },
        actionLabel: 'View Message',
        channels: {
          inApp: { delivered: true },
          email: { sent: participant.notifications.enabled },
          push: { sent: true }
        }
      })
    );

    await Promise.all(notificationPromises);

    // Emit real-time event (for WebSocket implementation)
    // req.io?.to(chatId).emit('new_message', {
    //   chatId: chat.chatId,
    //   message: { ...savedMessage.toObject(), sender }
    // });

    res.status(201).json({
      ok: true,
      message: "Message sent successfully",
      data: {
        ...savedMessage.toObject(),
        sender
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to send message",
      error: error.message
    });
  }
};

// Create Chat
export const createChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      chatType, 
      participantIds, 
      orderId, 
      websiteId, 
      title, 
      description 
    } = req.body;

    // Validate chat type
    if (!['order', 'support', 'general'].includes(chatType)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid chat type"
      });
    }

    // For order chats, verify the order exists and user is involved
    if (chatType === 'order' && orderId) {
      const order = await Order.findOne({
        _id: orderId,
        $or: [{ publisherId: userId }, { advertiserId: userId }]
      });

      if (!order) {
        return res.status(404).json({
          ok: false,
          message: "Order not found or access denied"
        });
      }
    }

    // Build participants array
    const participants = [
      { userId, role: req.user.role, joinedAt: new Date(), isActive: true }
    ];

    // Add other participants
    if (participantIds && participantIds.length > 0) {
      const otherUsers = await User.find({ 
        _id: { $in: participantIds },
        _id: { $ne: userId }
      }).select('_id role');

      otherUsers.forEach(user => {
        participants.push({
          userId: user._id,
          role: user.role,
          joinedAt: new Date(),
          isActive: true
        });
      });
    }

    // Create chat
    const chat = new Chat({
      chatType,
      participants,
      orderId,
      websiteId,
      title: title || `${chatType.charAt(0).toUpperCase() + chatType.slice(1)} Chat`,
      description,
      status: 'active',
      priority: chatType === 'support' ? 'high' : 'normal'
    });

    await chat.save();

    // Populate the chat
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants.userId', 'firstName lastName email role')
      .populate('orderId', 'orderId title')
      .populate('websiteId', 'domain');

    res.status(201).json({
      ok: true,
      message: "Chat created successfully",
      data: populatedChat
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to create chat",
      error: error.message
    });
  }
};

// Update Chat Settings
export const updateChatSettings = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { notifications, title, description } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId
    });

    if (!chat) {
      return res.status(404).json({
        ok: false,
        message: "Chat not found or access denied"
      });
    }

    // Update participant notifications
    if (notifications !== undefined) {
      const participant = chat.participants.find(p => p.userId.toString() === userId);
      if (participant) {
        participant.notifications.enabled = notifications;
      }
    }

    // Update chat details (only for admins or chat creators)
    if (req.user.role === 'admin' || chat.participants.some(p => p.userId.toString() === userId && p.role === 'advertiser')) {
      if (title) chat.title = title;
      if (description) chat.description = description;
    }

    await chat.save();

    res.status(200).json({
      ok: true,
      message: "Chat settings updated successfully",
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to update chat settings",
      error: error.message
    });
  }
};

// Archive Chat
export const archiveChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId
    });

    if (!chat) {
      return res.status(404).json({
        ok: false,
        message: "Chat not found or access denied"
      });
    }

    // Only allow archiving by admins or if all participants agree
    if (req.user.role !== 'admin') {
      const participant = chat.participants.find(p => p.userId.toString() === userId);
      if (participant) {
        participant.isActive = false;
        participant.leftAt = new Date();
      }
    } else {
      chat.status = 'archived';
    }

    await chat.save();

    res.status(200).json({
      ok: true,
      message: "Chat archived successfully"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to archive chat",
      error: error.message
    });
  }
};

// Search Messages
export const searchMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, chatId, startDate, endDate, page = 1, limit = 20 } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        ok: false,
        message: "Search query is required"
      });
    }

    // Build aggregation pipeline
    const pipeline = [
      // Match chats where user is participant
      {
        $match: {
          'participants.userId': new mongoose.Types.ObjectId(userId)
        }
      },
      // Unwind messages
      { $unwind: '$messages' },
      // Match message criteria
      {
        $match: {
          'messages.content': { $regex: query, $options: 'i' },
          'messages.isDeleted': { $ne: true }
        }
      }
    ];

    // Add chat filter if specified
    if (chatId) {
      pipeline[0].$match._id = new mongoose.Types.ObjectId(chatId);
    }

    // Add date filter if specified
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      pipeline[2].$match['messages.createdAt'] = dateFilter;
    }

    // Add sorting and pagination
    pipeline.push(
      { $sort: { 'messages.createdAt': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    // Lookup sender information
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'messages.senderId',
          foreignField: '_id',
          as: 'sender'
        }
      }
    );

    const results = await Chat.aggregate(pipeline);

    const searchResults = results.map(result => ({
      chatId: result.chatId,
      chatTitle: result.title,
      message: {
        ...result.messages,
        sender: result.sender[0]
      }
    }));

    res.status(200).json({
      ok: true,
      data: searchResults,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: searchResults.length
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to search messages",
      error: error.message
    });
  }
};

// Get Chat Analytics (for admins)
export const getChatAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: "Access denied. Admin role required."
      });
    }

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
      chatsByType,
      messageVolume,
      responseTimeStats,
      activeChats
    ] = await Promise.all([
      // Chats by type
      Chat.aggregate([
        { $match: { createdAt: dateFilter } },
        { $group: { _id: '$chatType', count: { $sum: 1 } } }
      ]),
      
      // Message volume over time
      Chat.aggregate([
        { $match: { createdAt: dateFilter } },
        { $unwind: '$messages' },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$messages.createdAt" } },
            messageCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Response time statistics
      Chat.aggregate([
        { $match: { chatType: 'support', createdAt: dateFilter } },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$stats.averageResponseTime' },
            totalChats: { $sum: 1 }
          }
        }
      ]),
      
      // Currently active chats
      Chat.countDocuments({ status: 'active' })
    ]);

    const analytics = {
      overview: {
        totalActiveChats: activeChats,
        avgResponseTime: responseTimeStats[0]?.avgResponseTime || 0
      },
      chatsByType,
      messageVolume,
      supportMetrics: {
        avgResponseTime: responseTimeStats[0]?.avgResponseTime || 0,
        totalSupportChats: responseTimeStats[0]?.totalChats || 0
      }
    };

    res.status(200).json({
      ok: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch chat analytics",
      error: error.message
    });
  }
};

export default {
  getUserChats,
  getChatMessages,
  sendMessage,
  createChat,
  updateChatSettings,
  archiveChat,
  searchMessages,
  getChatAnalytics
};