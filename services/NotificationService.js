import nodemailer from 'nodemailer';
import twilio from 'twilio';
import webpush from 'web-push';
import { Notification, NotificationPreference, NotificationTemplate } from '../Models/NotificationModel.js';
import User from '../model/User.js';

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// SMS configuration (Twilio)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Push notification configuration
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@guestpostplatform.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export class NotificationService {
  
  // Create and send notification
  static async createNotification(userId, type, data = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get notification template
      const template = await NotificationTemplate.findOne({ type, isActive: true });
      if (!template) {
        throw new Error(`No template found for notification type: ${type}`);
      }

      // Get user preferences
      let preferences = await NotificationPreference.findOne({ userId });
      if (!preferences) {
        // Create default preferences if none exist
        preferences = new NotificationPreference({ userId });
        await preferences.save();
      }

      // Check if user wants this type of notification
      const category = this.getCategoryForType(type);
      if (!preferences.categories[category]) {
        return null; // User has disabled this category
      }

      // Replace variables in template
      const title = this.replaceVariables(template.subject, data);
      const message = this.replaceVariables(template.content, data);
      
      // Create notification record
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        priority: data.priority || 'medium',
        data,
        actionUrl: data.actionUrl,
        channels: {
          email: { sent: false },
          sms: { sent: false },
          push: { sent: false },
          inApp: { delivered: true }
        }
      });

      await notification.save();

      // Send notifications based on user preferences
      const sendPromises = [];

      // Email notification
      if (preferences.email.enabled && user.email && template.channels.includes('email')) {
        sendPromises.push(this.sendEmailNotification(notification, user, template));
      }

      // SMS notification
      if (preferences.sms.enabled && user.phone && template.channels.includes('sms')) {
        sendPromises.push(this.sendSMSNotification(notification, user, template));
      }

      // Push notification
      if (preferences.push.enabled && user.pushSubscription && template.channels.includes('push')) {
        sendPromises.push(this.sendPushNotification(notification, user, template));
      }

      // Execute all send operations
      await Promise.all(sendPromises);

      return notification;
    } catch (error) {
      console.error('Notification creation error:', error);
      throw error;
    }
  }

  // Send email notification
  static async sendEmailNotification(notification, user, template) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@guestpostplatform.com',
        to: user.email,
        subject: notification.title,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${notification.title}</h2>
            <p style="color: #666; line-height: 1.6;">${notification.message}</p>
            ${
              notification.actionUrl 
                ? `<p><a href="${notification.actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">View Details</a></p>`
                : ''
            }
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">You received this email because you have email notifications enabled. <a href="${process.env.FRONTEND_URL}/settings/notifications" style="color: #007bff;">Manage your notification preferences</a>.</p>
          </div>
        `
      };

      const info = await emailTransporter.sendMail(mailOptions);
      
      // Update notification record
      notification.channels.email.sent = true;
      notification.channels.email.sentAt = new Date();
      notification.channels.email.deliveryStatus = 'sent';
      notification.channels.email.providerResponse = info.messageId;
      notification.sentAt = new Date();
      
      await notification.save();
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email notification error:', error);
      
      // Update notification record with error
      notification.channels.email.deliveryStatus = 'failed';
      notification.channels.email.providerResponse = error.message;
      await notification.save();
      
      return { success: false, error: error.message };
    }
  }

  // Send SMS notification
  static async sendSMSNotification(notification, user, template) {
    try {
      if (!user.phone) {
        throw new Error('User phone number not available');
      }

      const message = `${notification.title}: ${notification.message.substring(0, 160)}`;
      
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone
      });

      // Update notification record
      notification.channels.sms.sent = true;
      notification.channels.sms.sentAt = new Date();
      notification.channels.sms.deliveryStatus = 'sent';
      notification.channels.sms.providerResponse = result.sid;
      notification.sentAt = new Date();
      
      await notification.save();
      
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS notification error:', error);
      
      // Update notification record with error
      notification.channels.sms.deliveryStatus = 'failed';
      notification.channels.sms.providerResponse = error.message;
      await notification.save();
      
      return { success: false, error: error.message };
    }
  }

  // Send push notification
  static async sendPushNotification(notification, user, template) {
    try {
      // Check if web-push is configured
      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn('Web-push not configured. Skipping push notification.');
        return { success: false, error: 'Web-push not configured' };
      }

      if (!user.pushSubscription) {
        throw new Error('User push subscription not available');
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: {
          url: notification.actionUrl || `${process.env.FRONTEND_URL}/notifications`,
          notificationId: notification._id
        }
      });

      const result = await webpush.sendNotification(user.pushSubscription, payload);
      
      // Update notification record
      notification.channels.push.sent = true;
      notification.channels.push.sentAt = new Date();
      notification.channels.push.deliveryStatus = 'sent';
      notification.sentAt = new Date();
      
      await notification.save();
      
      return { success: true };
    } catch (error) {
      console.error('Push notification error:', error);
      
      // Update notification record with error
      notification.channels.push.deliveryStatus = 'failed';
      notification.channels.push.providerResponse = error.message;
      await notification.save();
      
      // If subscription is no longer valid, remove it
      if (error.statusCode === 410) {
        user.pushSubscription = null;
        await user.save();
      }
      
      return { success: false, error: error.message };
    }
  }

  // Replace variables in template
  static replaceVariables(template, data) {
    let result = template;
    
    // Replace common variables
    const commonVariables = {
      '{{userName}}': data.userName || '',
      '{{userEmail}}': data.userEmail || '',
      '{{orderId}}': data.orderId || '',
      '{{websiteUrl}}': data.websiteUrl || '',
      '{{amount}}': data.amount || '',
      '{{date}}': new Date().toLocaleDateString(),
      '{{time}}': new Date().toLocaleTimeString()
    };

    for (const [variable, value] of Object.entries(commonVariables)) {
      result = result.replace(new RegExp(variable, 'g'), value);
    }

    // Replace custom variables
    if (data.customVariables) {
      for (const [variable, value] of Object.entries(data.customVariables)) {
        result = result.replace(new RegExp(`{{${variable}}}`, 'g'), value);
      }
    }

    return result;
  }

  // Get category for notification type
  static getCategoryForType(type) {
    const categoryMap = {
      'order_created': 'orders',
      'order_approved': 'orders',
      'order_rejected': 'orders',
      'order_paid': 'orders',
      'order_submitted': 'orders',
      'order_completed': 'orders',
      'order_disputed': 'orders',
      'payment_received': 'payments',
      'payment_failed': 'payments',
      'escrow_released': 'payments',
      'message_received': 'messages',
      'website_approved': 'websites',
      'website_rejected': 'websites',
      'support_ticket_created': 'support',
      'support_ticket_updated': 'support',
      'user_suspended': 'system',
      'user_verified': 'system',
      'withdrawal_requested': 'payments',
      'withdrawal_processed': 'payments',
      'system_maintenance': 'system',
    };

    return categoryMap[type] || 'system';
  }

  // Get user notification preferences
  static async getUserPreferences(userId) {
    try {
      console.log('Attempting to find preferences for user:', userId);
      let preferences = await NotificationPreference.findOne({ userId });
      console.log('Found preferences:', preferences);
      
      if (!preferences) {
        try {
          // Create default preferences
          console.log('Creating default preferences for user:', userId);
          preferences = new NotificationPreference({ userId });
          await preferences.save();
          console.log('Successfully created default preferences for user:', userId);
        } catch (saveError) {
          console.error('Error creating default preferences for user:', userId, saveError);
          // If there's a duplicate key error, try to fetch again
          if (saveError.code === 11000) {
            console.warn('Duplicate key error when creating preferences, trying to fetch again');
            preferences = await NotificationPreference.findOne({ userId });
            if (!preferences) {
              throw new Error('Failed to create or fetch notification preferences after duplicate key error');
            }
          } else {
            throw saveError;
          }
        }
      }
      
      return preferences;
    } catch (error) {
      console.error('Error getting user preferences for userId:', userId, error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  // Update user notification preferences
  static async updateUserPreferences(userId, preferencesData) {
    const preferences = await NotificationPreference.findOneAndUpdate(
      { userId },
      preferencesData,
      { new: true, upsert: true }
    );
    
    return preferences;
  }

  // Get user notifications
  static async getUserNotifications(userId, options = {}) {
    const { 
      page = 1, 
      limit = 20, 
      status = null, 
      type = null,
      sortBy = 'createdAt',
      sortOrder = -1
    } = options;

    const query = { userId };
    
    if (status) query.status = status;
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments(query);

    return {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { 
        status: 'read',
        readAt: new Date(),
        'channels.inApp.readAt': new Date()
      },
      { new: true }
    );
    
    return notification;
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, status: 'unread' },
      {
        status: 'read',
        readAt: new Date(),
        'channels.inApp.readAt': new Date()
      }
    );
    
    return result;
  }

  // Archive notification
  static async archiveNotification(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      {
        status: 'archived',
        archivedAt: new Date()
      },
      { new: true }
    );
    
    return notification;
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    const result = await Notification.deleteOne({
      _id: notificationId,
      userId
    });
    
    return result.deletedCount > 0;
  }

  // Get unread notification count
  static async getUnreadCount(userId) {
    const count = await Notification.countDocuments({
      userId,
      status: 'unread'
    });
    
    return count;
  }

  // Send bulk notifications
  static async sendBulkNotifications(userIds, type, data = {}) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const notification = await this.createNotification(userId, type, data);
        results.push({ userId, success: true, notification });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  // Schedule notification
  static async scheduleNotification(userId, type, scheduledFor, data = {}) {
    const notification = new Notification({
      userId,
      type,
      scheduledFor,
      data,
      status: 'unread',
      channels: {
        email: { sent: false },
        sms: { sent: false },
        push: { sent: false },
        inApp: { delivered: false }
      }
    });

    await notification.save();
    return notification;
  }

  // Process scheduled notifications
  static async processScheduledNotifications() {
    const now = new Date();
    const scheduledNotifications = await Notification.getPendingScheduled();
    
    const results = [];
    
    for (const notification of scheduledNotifications) {
      try {
        // Get user and template
        const user = await UserModel.findById(notification.userId);
        const template = await NotificationTemplate.findOne({ 
          type: notification.type, 
          isActive: true 
        });
        
        if (user && template) {
          // Send notifications based on user preferences
          const preferences = await this.getUserPreferences(notification.userId);
          const category = this.getCategoryForType(notification.type);
          
          if (preferences.categories[category]) {
            // Send email if enabled
            if (preferences.email.enabled && user.email && template.channels.includes('email')) {
              await this.sendEmailNotification(notification, user, template);
            }
            
            // Send SMS if enabled
            if (preferences.sms.enabled && user.phone && template.channels.includes('sms')) {
              await this.sendSMSNotification(notification, user, template);
            }
            
            // Send push if enabled
            if (preferences.push.enabled && user.pushSubscription && template.channels.includes('push')) {
              await this.sendPushNotification(notification, user, template);
            }
            
            // Mark as delivered in-app
            notification.channels.inApp.delivered = true;
            notification.status = 'unread';
            await notification.save();
          }
        }
        
        results.push({ notificationId: notification._id, success: true });
      } catch (error) {
        console.error('Scheduled notification processing error:', error);
        results.push({ notificationId: notification._id, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

// Schedule periodic processing of scheduled notifications
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    await NotificationService.processScheduledNotifications();
  }, 60 * 1000); // Check every minute
}

export default NotificationService;