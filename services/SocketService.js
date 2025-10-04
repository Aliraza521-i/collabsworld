import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Chat from '../model/Chat.js';
import User from '../model/User.js';
import { Notification } from '../Models/NotificationModel.js';

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

class SocketService {
  constructor() {
    this.io = null;
    this.users = new Map(); // Store user socket connections
    this.rooms = new Map(); // Store room participants
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: ['http://localhost:5000', 'http://localhost:8080', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('🔗 Socket.IO server initialized');
  }

  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Log for debugging
      console.log('Socket authentication - Decoded token:', decoded);
      
      // Special case for our admin user (colabworld@gmail.com)
      // This user doesn't exist in the database but should still have access
      if (decoded.email === 'colabworld@gmail.com' && decoded.role === 'admin') {
        socket.userId = 'special-admin-id'; // Mock ID for this special user
        socket.userRole = decoded.role;
        socket.userName = `${decoded.firstName || 'Admin'} ${decoded.lastName || 'User'}`;
        console.log('Authenticated special admin user:', socket.userId, socket.userRole);
        return next();
      }
      
      // Also handle the existing special admin user
      if (decoded.email === 'admin@gmail.com' && decoded.role === 'admin') {
        socket.userId = 'special-admin-id-2'; // Mock ID for this special user
        socket.userRole = decoded.role;
        socket.userName = 'Admin User';
        console.log('Authenticated special admin user 2:', socket.userId, socket.userRole);
        return next();
      }
      
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.log('Authentication error: User not found for ID:', decoded.id);
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userName = `${user.firstName} ${user.lastName}`;
      
      console.log('Authenticated user:', socket.userId, socket.userRole, socket.userName);
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  }

  handleConnection(socket) {
    console.log(`👤 User connected: ${socket.userName} (${socket.userId})`);
    
    // Store user connection
    this.users.set(socket.userId, {
      socketId: socket.id,
      socket: socket,
      userId: socket.userId,
      role: socket.userRole,
      name: socket.userName,
      status: 'online',
      lastSeen: new Date()
    });

    // Emit user online status
    this.broadcastUserStatus(socket.userId, 'online');

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle events
    socket.on('join_chat', this.handleJoinChat.bind(this, socket));
    socket.on('leave_chat', this.handleLeaveChat.bind(this, socket));
    socket.on('send_message', this.handleSendMessage.bind(this, socket));
    socket.on('typing_start', this.handleTypingStart.bind(this, socket));
    socket.on('typing_stop', this.handleTypingStop.bind(this, socket));
    socket.on('mark_as_read', this.handleMarkAsRead.bind(this, socket));
    socket.on('file_upload_progress', this.handleFileUploadProgress.bind(this, socket));
    socket.on('get_online_users', this.handleGetOnlineUsers.bind(this, socket));

    socket.on('disconnect', this.handleDisconnect.bind(this, socket));
  }

  async handleJoinChat(socket, data) {
    try {
      const { chatId } = data;
      
      console.log('User attempting to join chat:', socket.userId, socket.userRole, socket.userName);
      console.log('Chat ID:', chatId);
      
      // Check if user is admin
      const isAdmin = socket.userRole === 'admin';
      
      console.log('Is user admin?', isAdmin);
      
      // For admin users, allow access to any chat without checking participation
      if (isAdmin) {
        console.log('Admin user accessing chat - bypassing participant check');
        
        // Get the chat (populate for proper data)
        const chat = await Chat.findById(chatId)
          .populate('participants.userId', 'firstName lastName email role')
          .populate({
            path: 'messages.senderId',
            select: 'firstName lastName email role'
          });
          
        if (!chat) {
          console.log('Chat not found:', chatId);
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Join the chat room
        socket.join(`chat_${chatId}`);
        
        // Log room membership for debugging
        const rooms = Array.from(socket.rooms);
        console.log('Socket rooms after joining:', rooms);
        
        // Add to room participants
        if (!this.rooms.has(chatId)) {
          this.rooms.set(chatId, new Set());
        }
        this.rooms.get(chatId).add(socket.userId);

        // Notify others in the chat
        socket.to(`chat_${chatId}`).emit('user_joined_chat', {
          userId: socket.userId,
          userName: socket.userName,
          timestamp: new Date()
        });

        // Send chat history
        const messages = await this.getChatMessages(chatId, socket.userId);
        socket.emit('chat_history', { chatId, messages });

        // Send participant list
        const onlineParticipants = this.getOnlineParticipants(chatId);
        socket.emit('participants_status', { chatId, participants: onlineParticipants });

        console.log(`📝 Admin user ${socket.userName} joined chat ${chatId}`);
        return;
      }
      
      // For non-admin users, verify they are a participant in the chat
      // Don't populate initially to get raw participant data
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        console.log('Chat not found:', chatId);
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      console.log('Found chat:', chat._id);
      console.log('Chat participants:', chat.participants);
      console.log('Socket user ID:', socket.userId);
      console.log('Socket user ID type:', typeof socket.userId);

      // Check if user is a participant in the chat
      const isParticipant = chat.participants.some(p => {
        console.log('Checking participant:', p.userId);
        console.log('Participant user ID type:', typeof p.userId);
        
        // Handle both populated and non-populated user references
        const participantUserId = p.userId.toString();
        const socketUserId = socket.userId.toString();
        
        console.log('Comparing:', participantUserId, 'with', socketUserId);
        console.log('Match result:', participantUserId === socketUserId);
        
        return participantUserId === socketUserId;
      });
      
      console.log('Is user participant?', isParticipant);
      
      // Allow access if user is participant
      if (!isParticipant) {
        console.log('Access denied - User is not participant');
        socket.emit('error', { message: 'Access denied to this chat' });
        return;
      }

      // Join the chat room
      socket.join(`chat_${chatId}`);
      
      // Log room membership for debugging
      const rooms = Array.from(socket.rooms);
      console.log('Socket rooms after joining:', rooms);
      
      // Add to room participants
      if (!this.rooms.has(chatId)) {
        this.rooms.set(chatId, new Set());
      }
      this.rooms.get(chatId).add(socket.userId);

      // Notify others in the chat
      socket.to(`chat_${chatId}`).emit('user_joined_chat', {
        userId: socket.userId,
        userName: socket.userName,
        timestamp: new Date()
      });

      // Send chat history (populate messages with sender info)
      const messages = await this.getChatMessages(chatId, socket.userId);
      socket.emit('chat_history', { chatId, messages });

      // Send participant list
      const onlineParticipants = this.getOnlineParticipants(chatId);
      socket.emit('participants_status', { chatId, participants: onlineParticipants });

      console.log(`📝 User ${socket.userName} joined chat ${chatId}`);
    } catch (error) {
      console.error('Error joining chat:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  }

  handleLeaveChat(socket, data) {
    const { chatId } = data;
    
    socket.leave(`chat_${chatId}`);
    
    // Remove from room participants
    if (this.rooms.has(chatId)) {
      this.rooms.get(chatId).delete(socket.userId);
      
      if (this.rooms.get(chatId).size === 0) {
        this.rooms.delete(chatId);
      }
    }

    // Notify others
    socket.to(`chat_${chatId}`).emit('user_left_chat', {
      userId: socket.userId,
      userName: socket.userName,
      timestamp: new Date()
    });

    console.log(`📝 User ${socket.userName} left chat ${chatId}`);
  }

  async handleSendMessage(socket, data) {
    try {
      const { chatId, content, type = 'text', replyTo = null, attachments = [] } = data;
      
      console.log('User attempting to send message:', socket.userId, socket.userRole, socket.userName);
      console.log('Chat ID:', chatId);
      
      // Verify chat access
      const chat = await Chat.findById(chatId);
      if (!chat) {
        console.log('Chat not found for message sending:', chatId);
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Check if user is a participant in the chat
      const isParticipant = chat.participants.some(p => {
        console.log('Checking participant for message sending:', p.userId);
        console.log('Participant user ID type for message sending:', typeof p.userId);
        
        // Handle both populated and non-populated user references
        const participantUserId = p.userId.toString();
        const socketUserId = socket.userId.toString();
        
        console.log('Comparing for message sending:', participantUserId, 'with', socketUserId);
        console.log('Match result for message sending:', participantUserId === socketUserId);
        
        return participantUserId === socketUserId;
      });
      
      console.log('Is user participant for message sending?', isParticipant);
      console.log('User role for message sending:', socket.userRole);
      
      // Allow sending if user is participant or admin
      if (!isParticipant && socket.userRole !== 'admin') {
        console.log('Access denied for message sending - User is not participant and not admin');
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Create message
      const message = {
        _id: new Date().getTime().toString(), // Temporary ID
        sender: socket.userId,
        senderName: socket.userName,
        content,
        type,
        replyTo,
        attachments,
        isRead: [socket.userId], // Sender has read it
        editedAt: null,
        reactions: []
      };

      // Save to database
      const savedMessage = await this.saveMessage(chatId, message);
      
      // Update chat's last message
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: savedMessage._id,
        lastActivity: new Date(),
        $inc: { messageCount: 1 }
      });

      // Emit to all participants in the chat
      console.log('Emitting new_message to room:', `chat_${chatId}`);
      console.log('Message data:', { chatId, message: savedMessage });
      
      // Ensure the message has all required fields for the frontend
      const messageForFrontend = {
        ...savedMessage,
        senderId: socket.userId,
        senderName: socket.userName,
        createdAt: new Date()
      };
      
      this.io.to(`chat_${chatId}`).emit('new_message', {
        chatId,
        message: messageForFrontend
      });

      // Send push notifications to offline users
      await this.sendNotificationsToOfflineUsers(chat, messageForFrontend);

      console.log(`💬 Message sent in chat ${chatId} by ${socket.userName}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  handleTypingStart(socket, data) {
    const { chatId } = data;
    socket.to(`chat_${chatId}`).emit('user_typing', {
      userId: socket.userId,
      userName: socket.userName,
      chatId
    });
  }

  handleTypingStop(socket, data) {
    const { chatId } = data;
    socket.to(`chat_${chatId}`).emit('user_stopped_typing', {
      userId: socket.userId,
      userName: socket.userName,
      chatId
    });
  }

  async handleMarkAsRead(socket, data) {
    try {
      const { chatId, messageIds } = data;
      
      // Update message read status in database
      await this.markMessagesAsRead(chatId, messageIds, socket.userId);
      
      // Emit read receipt to other participants
      socket.to(`chat_${chatId}`).emit('messages_read', {
        chatId,
        messageIds,
        readBy: socket.userId,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  handleFileUploadProgress(socket, data) {
    const { chatId, fileName, progress } = data;
    socket.to(`chat_${chatId}`).emit('file_upload_progress', {
      userId: socket.userId,
      fileName,
      progress
    });
  }

  handleGetOnlineUsers(socket) {
    const onlineUsers = Array.from(this.users.values()).map(user => ({
      userId: user.userId,
      name: user.name,
      role: user.role,
      status: user.status,
      lastSeen: user.lastSeen
    }));
    
    socket.emit('online_users', onlineUsers);
  }

  handleDisconnect(socket) {
    console.log(`👤 User disconnected: ${socket.userName} (${socket.userId})`);
    
    // Update user status
    if (this.users.has(socket.userId)) {
      const user = this.users.get(socket.userId);
      user.status = 'offline';
      user.lastSeen = new Date();
    }

    // Broadcast user offline status
    this.broadcastUserStatus(socket.userId, 'offline');

    // Remove from all chat rooms
    for (const [chatId, participants] of this.rooms.entries()) {
      if (participants.has(socket.userId)) {
        participants.delete(socket.userId);
        socket.to(`chat_${chatId}`).emit('user_left_chat', {
          userId: socket.userId,
          userName: socket.userName,
          timestamp: new Date()
        });
      }
    }

    // Remove user connection after a delay (in case of reconnection)
    setTimeout(() => {
      this.users.delete(socket.userId);
    }, 30000); // 30 seconds
  }

  broadcastUserStatus(userId, status) {
    this.io.emit('user_status_changed', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  getOnlineParticipants(chatId) {
    const participants = this.rooms.get(chatId) || new Set();
    return Array.from(participants).map(userId => {
      const user = this.users.get(userId);
      return user ? {
        userId: user.userId,
        name: user.name,
        status: user.status,
        lastSeen: user.lastSeen
      } : null;
    }).filter(Boolean);
  }

  async getChatMessages(chatId, userId, limit = 50) {
    try {
      const chat = await Chat.findById(chatId)
        .populate({
          path: 'messages',
          options: { 
            sort: { createdAt: 1 }, 
            limit: limit 
          },
          populate: {
            path: 'senderId',
            select: 'firstName lastName role'
          }
        });

      // Ensure each message has senderRole populated
      const messages = chat?.messages || [];
      return messages.map(message => {
        // If senderRole is not set, try to determine it from participant data
        let senderRole = message.senderRole;
        if (!senderRole && message.senderId) {
          // Try to get role from populated senderId
          if (message.senderId.role) {
            senderRole = message.senderId.role;
          } else {
            // Try to get role from chat participants
            const participant = chat.participants.find(p => 
              p.userId.toString() === message.senderId.toString()
            );
            if (participant && participant.role) {
              senderRole = participant.role;
            } else {
              senderRole = 'user'; // Default fallback
            }
          }
        }
        
        return {
          ...message.toObject(),
          senderRole: senderRole || 'user'
        };
      });
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  }

  async saveMessage(chatId, messageData) {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) throw new Error('Chat not found');

      // Find the participant to get their role
      const participant = chat.participants.find(p => p.userId.toString() === messageData.sender);
      const senderRole = participant && participant.role ? participant.role : 'user';

      // Check if message contains personal contact details
      const hasPersonalDetails = containsPersonalContactDetails(messageData.content);
      
      // Apply compliance filter to content
      const filteredContent = filterPersonalContactDetails(messageData.content);

      // Create message object with correct field names
      const message = {
        senderId: messageData.sender,  // Changed from 'sender' to 'senderId'
        senderRole: senderRole,  // Add sender role
        content: filteredContent,
        messageType: messageData.type,  // Changed from 'type' to 'messageType'
        replyTo: messageData.replyTo,
        attachments: messageData.attachments,
        isRead: messageData.isRead,
        reactions: [],
        flags: {
          containsPersonalDetails: hasPersonalDetails
        }
      };

      // Add message to chat
      chat.messages.push(message);
      const updatedChat = await chat.save();

      // Get the saved message with proper ID
      const savedMessage = updatedChat.messages[updatedChat.messages.length - 1];
      
      // If message contains personal details, send notification to admins
      if (hasPersonalDetails) {
        try {
          // Find all admin users
          const admins = await User.find({ role: 'admin' }).select('_id');
          
          console.log(`Found ${admins.length} admin users for notification`);
          
          // Create notification for each admin
          for (const admin of admins) {
            const notification = new Notification({
              userId: admin._id,
              type: 'illegal_activity_detected',
              title: 'Illegal Activity Detected in Chat',
              message: `${messageData.senderName} shared personal contact details in chat. Message: ${messageData.content.substring(0, 100)}${messageData.content.length > 100 ? '...' : ''}`,
              data: {
                chatId: chat._id
              },
              actionUrl: `/admin/chats/${chat._id}`,
              channels: {
                inApp: { delivered: true },
                email: { sent: false }, // Don't mark as sent until actually sent
                push: { sent: false }   // Don't mark as sent until actually sent
              },
              priority: 'high'
            });

            await notification.save();
            console.log('Saved illegal activity notification for admin:', admin._id);

            // Send to admin's personal room
            this.io.to(`user_${admin._id}`).emit('new_notification', notification);
            console.log('Emitted new_notification to admin:', admin._id);
          }
        } catch (notificationError) {
          console.error('Error creating or sending illegal activity notifications:', notificationError);
        }
      }

      // Return the saved message with all required fields
      return {
        _id: savedMessage._id,
        senderId: messageData.sender,
        senderName: messageData.senderName,
        senderRole: senderRole,
        content: filteredContent,
        messageType: messageData.type,
        replyTo: messageData.replyTo,
        attachments: messageData.attachments || [],
        isRead: messageData.isRead || [],
        reactions: [],
        flags: {
          containsPersonalDetails: hasPersonalDetails
        },
        createdAt: savedMessage.createdAt,
        updatedAt: savedMessage.updatedAt
      };
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async markMessagesAsRead(chatId, messageIds, userId) {
    try {
      await Chat.updateOne(
        { _id: chatId },
        {
          $addToSet: {
            'messages.$[message].isRead': userId
          }
        },
        {
          arrayFilters: [
            { 'message._id': { $in: messageIds } }
          ]
        }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  async sendNotificationsToOfflineUsers(chat, message) {
    try {
      const offlineParticipants = chat.participants.filter(participant => {
        const participantId = participant.userId.toString();
        const user = this.users.get(participantId);
        return !user || user.status === 'offline';
      });

      for (const participant of offlineParticipants) {
        const participantId = participant.userId.toString();
        if (participantId === message.senderId) continue; // Don't notify sender

        const notification = new Notification({
          userId: participantId,
          title: 'New Message',
          message: `${message.senderName}: ${message.content.substring(0, 100)}...`,
          type: 'message_received',  // Changed from 'chat_message' to 'message_received'
          data: {
            chatId: chat._id,
            messageId: message._id
          },
          channels: {
            inApp: { delivered: true },
            push: { sent: true }
          },
          priority: 'medium'  // Changed from 'normal' to 'medium'
        });

        await notification.save();

        // Send to user's personal room (if they reconnect)
        this.io.to(`user_${participantId}`).emit('new_notification', notification);
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  // Public methods for external use
  sendToUser(userId, event, data) {
    const user = this.users.get(userId);
    if (user && user.socket) {
      user.socket.emit(event, data);
      return true;
    }
    return false;
  }

  sendToChat(chatId, event, data) {
    this.io.to(`chat_${chatId}`).emit(event, data);
  }

  getUserOnlineStatus(userId) {
    const user = this.users.get(userId);
    return user ? user.status : 'offline';
  }

  getOnlineUsersCount() {
    return this.users.size;
  }

  getChatParticipantsCount(chatId) {
    return this.rooms.get(chatId)?.size || 0;
  }
}

export default new SocketService();