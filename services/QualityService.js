import axios from 'axios';
import { QualityCheck, QualityReviewer, QualityTemplate } from '../Models/QualityModel.js';
import Order from '../model/Order.js';
// ContentModel would be imported here if it existed
import User from '../model/User.js';
// Email and SMS services would be imported here if needed

export class QualityAssuranceService {
  
  // Create quality check for order
  static async createQualityCheck(orderId) {
    try {
      const order = await Order.findById(orderId).populate('website publisher advertiser');
      if (!order) {
        throw new Error('Order not found');
      }

      const qualityCheck = new QualityCheck({
        orderId: order._id,
        websiteId: order.website,
        priority: this.determinePriority(order),
        tags: this.generateTags(order)
      });

      await qualityCheck.save();
      
      // Notify relevant parties
      await this.notifyQualityCheckCreated(qualityCheck, order);
      
      return qualityCheck;
    } catch (error) {
      console.error('Quality check creation error:', error);
      throw error;
    }
  }

  // Run automated checks on content
  static async runAutomatedChecks(qualityCheckId, content) {
    try {
      const qualityCheck = await QualityCheck.findById(qualityCheckId);
      if (!qualityCheck) {
        throw new Error('Quality check not found');
      }

      // Run plagiarism check
      const plagiarismResult = await this.checkPlagiarism(content);
      
      // Run grammar check
      const grammarResult = await this.checkGrammar(content);
      
      // Run SEO check
      const seoResult = await this.checkSEO(content, qualityCheck.orderId);
      
      // Run link check
      const linkResult = await this.checkLinks(content);
      
      // Run content quality check
      const contentQualityResult = await this.checkContentQuality(content);
      
      // Update quality check with results
      qualityCheck.automatedChecks = {
        plagiarism: plagiarismResult,
        grammar: grammarResult,
        seo: seoResult,
        links: linkResult,
        contentQuality: contentQualityResult
      };
      
      // Determine overall status
      const allPassed = this.determineAutomatedCheckStatus(qualityCheck.automatedChecks);
      qualityCheck.status = allPassed ? 'passed' : 'needs_revision';
      
      await qualityCheck.save();
      
      // If all checks pass, notify relevant parties
      if (allPassed) {
        await this.notifyAutomatedChecksPassed(qualityCheck);
      }
      
      return qualityCheck;
    } catch (error) {
      console.error('Automated checks error:', error);
      throw error;
    }
  }

  // Check for plagiarism
  static async checkPlagiarism(content) {
    try {
      // In a real implementation, this would call a plagiarism detection API
      // For now, we'll simulate the check
      
      // Mock plagiarism detection
      const plagiarismScore = Math.floor(Math.random() * 20); // 0-19% for mock
      const sources = plagiarismScore > 5 ? [
        { url: 'https://example.com/article1', similarity: 8 },
        { url: 'https://example.com/article2', similarity: 3 }
      ] : [];
      
      return {
        checked: true,
        score: plagiarismScore,
        sources,
        passed: plagiarismScore < 15
      };
    } catch (error) {
      console.error('Plagiarism check error:', error);
      return {
        checked: true,
        score: 100, // Fail by default on error
        sources: [],
        passed: false,
        error: error.message
      };
    }
  }

  // Check grammar
  static async checkGrammar(content) {
    try {
      // In a real implementation, this would call a grammar checking API
      // For now, we'll simulate the check
      
      // Mock grammar check
      const errors = Math.floor(Math.random() * 5); // 0-4 errors for mock
      const warnings = Math.floor(Math.random() * 3); // 0-2 warnings for mock
      const score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
      
      return {
        checked: true,
        errors,
        warnings,
        score,
        passed: score >= 80
      };
    } catch (error) {
      console.error('Grammar check error:', error);
      return {
        checked: true,
        errors: 10,
        warnings: 5,
        score: 0,
        passed: false,
        error: error.message
      };
    }
  }

  // Check SEO
  static async checkSEO(content, orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Extract keywords from order requirements
      const keywords = order.requirements?.keywords || [];
      
      // Mock SEO analysis
      const keywordAnalysis = keywords.map(keyword => ({
        keyword,
        density: Math.random() * 5, // 0-5% density
        found: Math.random() > 0.2 // 80% chance of being found
      }));
      
      // Meta title and description analysis
      const metaTitle = {
        length: Math.floor(Math.random() * 40) + 30, // 30-70 characters
        hasKeyword: Math.random() > 0.3 // 70% chance of containing keyword
      };
      
      const metaDescription = {
        length: Math.floor(Math.random() * 120) + 100, // 100-220 characters
        hasKeyword: Math.random() > 0.4 // 60% chance of containing keyword
      };
      
      // Heading structure
      const headings = {
        h1Count: Math.random() > 0.1 ? 1 : 2, // Usually 1 H1
        h2Count: Math.floor(Math.random() * 10) + 5, // 5-15 H2s
        structureScore: Math.floor(Math.random() * 30) + 70 // 70-100 structure score
      };
      
      // Readability score
      const readability = {
        score: Math.floor(Math.random() * 30) + 60, // 60-90 readability
        gradeLevel: ['6th', '7th', '8th', '9th', '10th'][Math.floor(Math.random() * 5)]
      };
      
      // Calculate overall SEO score
      const seoScore = Math.floor(
        (keywordAnalysis.filter(k => k.found).length / Math.max(1, keywords.length) * 30) +
        (metaTitle.hasKeyword ? 15 : 0) +
        (metaDescription.hasKeyword ? 15 : 0) +
        (headings.structureScore * 0.3) +
        (readability.score * 0.1)
      );
      
      return {
        checked: true,
        keywords: keywordAnalysis,
        metaTitle,
        metaDescription,
        headings,
        readability,
        passed: seoScore >= 70
      };
    } catch (error) {
      console.error('SEO check error:', error);
      return {
        checked: true,
        keywords: [],
        metaTitle: { length: 0, hasKeyword: false },
        metaDescription: { length: 0, hasKeyword: false },
        headings: { h1Count: 0, h2Count: 0, structureScore: 0 },
        readability: { score: 0, gradeLevel: 'N/A' },
        passed: false,
        error: error.message
      };
    }
  }

  // Check links
  static async checkLinks(content) {
    try {
      // Extract links from content (simplified regex)
      const linkRegex = /https?:\/\/[^\s"]+/g;
      const links = content.match(linkRegex) || [];
      
      // Mock link checking
      const internalLinks = links.filter(link => link.includes('guestpostplatform.com')).length;
      const externalLinks = links.length - internalLinks;
      
      // Simulate broken link checking
      const brokenLinks = [];
      for (let i = 0; i < Math.min(3, externalLinks); i++) {
        if (Math.random() > 0.8) { // 20% chance of being broken
          brokenLinks.push({
            url: links[Math.floor(Math.random() * links.length)],
            statusCode: 404
          });
        }
      }
      
      const dofollowRatio = Math.random(); // 0-1 ratio
      
      return {
        checked: true,
        internalLinks,
        externalLinks,
        brokenLinks,
        dofollowRatio,
        passed: brokenLinks.length === 0 && externalLinks >= 2
      };
    } catch (error) {
      console.error('Link check error:', error);
      return {
        checked: true,
        internalLinks: 0,
        externalLinks: 0,
        brokenLinks: [],
        dofollowRatio: 0,
        passed: false,
        error: error.message
      };
    }
  }

  // Check content quality
  static async checkContentQuality(content) {
    try {
      // Basic content analysis
      const words = content.split(/\s+/).filter(word => word.length > 0);
      const wordCount = words.length;
      
      // Unique words (simplified)
      const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
      const uniquenessRatio = uniqueWords / Math.max(1, wordCount);
      
      // Sentence variety (simplified)
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgSentenceLength = wordCount / Math.max(1, sentences.length);
      const sentenceVariety = avgSentenceLength > 10 && avgSentenceLength < 25 ? 1 : 0.5;
      
      // Paragraph structure
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const avgParagraphLength = wordCount / Math.max(1, paragraphs.length);
      const paragraphScore = avgParagraphLength > 50 && avgParagraphLength < 200 ? 1 : 0.5;
      
      // Overall content quality score
      const qualityScore = Math.floor(
        (uniquenessRatio * 40) +
        (sentenceVariety * 30) +
        (paragraphScore * 30)
      );
      
      return {
        checked: true,
        wordCount,
        uniqueWords,
        sentenceVariety: sentenceVariety * 100,
        paragraphStructure: paragraphScore * 100,
        passed: qualityScore >= 70 && wordCount >= 500
      };
    } catch (error) {
      console.error('Content quality check error:', error);
      return {
        checked: true,
        wordCount: 0,
        uniqueWords: 0,
        sentenceVariety: 0,
        paragraphStructure: 0,
        passed: false,
        error: error.message
      };
    }
  }

  // Determine priority based on order
  static determinePriority(order) {
    // High priority for urgent orders, medium for standard, low for others
    if (order.deadline && new Date(order.deadline) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) {
      return 'high';
    }
    return 'medium';
  }

  // Generate tags for quality check
  static generateTags(order) {
    const tags = [];
    
    if (order.category) tags.push(order.category);
    if (order.websiteUrl) {
      const domain = new URL(order.websiteUrl).hostname;
      tags.push(domain);
    }
    
    return tags;
  }

  // Determine if all automated checks passed
  static determineAutomatedCheckStatus(checks) {
    return checks.plagiarism.passed &&
           checks.grammar.passed &&
           checks.seo.passed &&
           checks.links.passed &&
           checks.contentQuality.passed;
  }

  // Assign quality check to reviewer
  static async assignReviewer(qualityCheckId) {
    try {
      const qualityCheck = await QualityCheck.findById(qualityCheckId);
      if (!qualityCheck) {
        throw new Error('Quality check not found');
      }

      // Find available reviewers
      const availableReviewers = await QualityReviewer.find({
        'availability.status': 'available'
      }).sort({ 'performance.averageScore': -1 });

      if (availableReviewers.length === 0) {
        // No reviewers available, keep in pending
        return qualityCheck;
      }

      // Assign to highest performing available reviewer
      const assignedReviewer = availableReviewers[0];
      
      // Update quality check
      qualityCheck.assignedTo = assignedReviewer.userId;
      qualityCheck.reviewerId = assignedReviewer.userId;
      qualityCheck.status = 'in_progress';
      qualityCheck.manualReview.reviewerAssigned = true;
      
      await qualityCheck.save();
      
      // Update reviewer assignment
      await assignedReviewer.assignCheck(qualityCheckId, qualityCheck.deadline);
      
      // Notify reviewer
      await this.notifyReviewerAssigned(qualityCheck, assignedReviewer);
      
      return qualityCheck;
    } catch (error) {
      console.error('Reviewer assignment error:', error);
      throw error;
    }
  }

  // Complete manual review
  static async completeManualReview(qualityCheckId, reviewerId, verdict, comments) {
    try {
      const qualityCheck = await QualityCheck.findById(qualityCheckId);
      if (!qualityCheck) {
        throw new Error('Quality check not found');
      }

      if (qualityCheck.reviewerId.toString() !== reviewerId) {
        throw new Error('Not authorized to review this quality check');
      }

      // Complete the review
      qualityCheck.manualReview.finalVerdict = verdict;
      qualityCheck.manualReview.finalComments = comments;
      qualityCheck.manualReview.reviewCompletedAt = new Date();
      
      switch (verdict) {
        case 'approved':
          qualityCheck.status = 'passed';
          break;
        case 'rejected':
          qualityCheck.status = 'failed';
          break;
        case 'needs_revision':
          qualityCheck.status = 'needs_revision';
          qualityCheck.manualReview.revisionsRequested = true;
          break;
      }
      
      await qualityCheck.save();
      
      // Update reviewer performance
      const reviewer = await QualityReviewer.findOne({ userId: reviewerId });
      if (reviewer) {
        const onTime = qualityCheck.deadline && new Date() <= qualityCheck.deadline;
        const revisionRequested = verdict === 'needs_revision';
        await reviewer.updatePerformance(qualityCheck.manualReview.finalVerdict === 'approved' ? 100 : 80, onTime, revisionRequested);
        await reviewer.completeCheck(qualityCheckId);
      }
      
      // Notify relevant parties
      await this.notifyReviewCompleted(qualityCheck);
      
      return qualityCheck;
    } catch (error) {
      console.error('Manual review completion error:', error);
      throw error;
    }
  }

  // Add comment to quality check
  static async addComment(qualityCheckId, reviewerId, text) {
    try {
      const qualityCheck = await QualityCheck.findById(qualityCheckId);
      if (!qualityCheck) {
        throw new Error('Quality check not found');
      }

      qualityCheck.manualReview.comments.push({
        reviewerId,
        text,
        createdAt: new Date()
      });
      
      await qualityCheck.save();
      
      return qualityCheck;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  // Submit revision for quality check
  static async submitRevision(qualityCheckId, userId, changes) {
    try {
      const qualityCheck = await QualityCheck.findById(qualityCheckId);
      if (!qualityCheck) {
        throw new Error('Quality check not found');
      }

      const revisionNumber = (qualityCheck.revisionHistory.length || 0) + 1;
      
      qualityCheck.revisionHistory.push({
        revisionNumber,
        submittedAt: new Date(),
        submittedBy: userId,
        changes,
        status: 'submitted'
      });
      
      qualityCheck.status = 'in_progress';
      qualityCheck.manualReview.revisionsRequested = false;
      
      await qualityCheck.save();
      
      // Notify relevant parties
      await this.notifyRevisionSubmitted(qualityCheck);
      
      return qualityCheck;
    } catch (error) {
      console.error('Submit revision error:', error);
      throw error;
    }
  }

  // Notify functions
  static async notifyQualityCheckCreated(qualityCheck, order) {
    try {
      // Notify publisher and advertiser
      const publisher = await UserModel.findById(order.publisher);
      const advertiser = await UserModel.findById(order.advertiser);
      
      if (publisher?.email) {
        await sendEmail(
          publisher.email,
          'Quality Check Initiated',
          `A quality check has been initiated for your order #${order._id.toString().slice(-6)}.`
        );
      }
      
      if (advertiser?.email) {
        await sendEmail(
          advertiser.email,
          'Content Quality Check Started',
          `Your content for order #${order._id.toString().slice(-6)} is being quality checked.`
        );
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  static async notifyAutomatedChecksPassed(qualityCheck) {
    try {
      const order = await OrderModel.findById(qualityCheck.orderId).populate('publisher advertiser');
      if (!order) return;
      
      // Notify that automated checks passed
      if (order.publisher?.email) {
        await sendEmail(
          order.publisher.email,
          'Automated Quality Checks Passed',
          `All automated quality checks have passed for order #${order._id.toString().slice(-6)}.`
        );
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  static async notifyReviewerAssigned(qualityCheck, reviewer) {
    try {
      const reviewerUser = await UserModel.findById(reviewer.userId);
      const order = await OrderModel.findById(qualityCheck.orderId);
      
      if (reviewerUser?.email) {
        await sendEmail(
          reviewerUser.email,
          'New Quality Check Assigned',
          `You have been assigned a new quality check for order #${order?._id.toString().slice(-6) || 'N/A'}.`
        );
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  static async notifyReviewCompleted(qualityCheck) {
    try {
      const order = await OrderModel.findById(qualityCheck.orderId).populate('publisher advertiser');
      if (!order) return;
      
      // Notify publisher and advertiser based on verdict
      if (qualityCheck.manualReview.finalVerdict === 'approved') {
        if (order.publisher?.email) {
          await sendEmail(
            order.publisher.email,
            'Content Approved',
            `Your content for order #${order._id.toString().slice(-6)} has been approved.`
          );
        }
        
        if (order.advertiser?.email) {
          await sendEmail(
            order.advertiser.email,
            'Content Approved',
            `The content for your order #${order._id.toString().slice(-6)} has been approved.`
          );
        }
      } else if (qualityCheck.manualReview.finalVerdict === 'needs_revision') {
        if (order.publisher?.email) {
          await sendEmail(
            order.publisher.email,
            'Content Revision Required',
            `Revisions are required for your content in order #${order._id.toString().slice(-6)}.`
          );
        }
      } else if (qualityCheck.manualReview.finalVerdict === 'rejected') {
        if (order.publisher?.email) {
          await sendEmail(
            order.publisher.email,
            'Content Rejected',
            `Your content for order #${order._id.toString().slice(-6)} has been rejected.`
          );
        }
        
        if (order.advertiser?.email) {
          await sendEmail(
            order.advertiser.email,
            'Content Rejected',
            `The content for your order #${order._id.toString().slice(-6)} has been rejected.`
          );
        }
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  static async notifyRevisionSubmitted(qualityCheck) {
    try {
      const order = await OrderModel.findById(qualityCheck.orderId).populate('publisher advertiser');
      if (!order) return;
      
      if (order.advertiser?.email) {
        await sendEmail(
          order.advertiser.email,
          'Content Revision Submitted',
          `A revision has been submitted for order #${order._id.toString().slice(-6)}.`
        );
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  // Get quality checks by status
  static async getQualityChecksByStatus(status, limit = 50) {
    return QualityCheck.getByStatus(status, limit);
  }

  // Get quality checks by priority
  static async getQualityChecksByPriority(priority, limit = 50) {
    return QualityCheck.getByPriority(priority, limit);
  }

  // Get overdue quality checks
  static async getOverdueQualityChecks() {
    return QualityCheck.getOverdue();
  }

  // Get quality checks by reviewer
  static async getQualityChecksByReviewer(reviewerId, status = null) {
    return QualityCheck.getByReviewer(reviewerId, status);
  }

  // Create quality reviewer
  static async createQualityReviewer(userId, data) {
    const reviewer = new QualityReviewer({
      userId,
      ...data
    });
    
    await reviewer.save();
    return reviewer;
  }

  // Update quality reviewer
  static async updateQualityReviewer(userId, data) {
    const reviewer = await QualityReviewer.findOneAndUpdate(
      { userId },
      data,
      { new: true }
    );
    
    return reviewer;
  }

  // Get quality reviewer
  static async getQualityReviewer(userId) {
    return QualityReviewer.findOne({ userId });
  }

  // Create quality template
  static async createQualityTemplate(data) {
    const template = new QualityTemplate(data);
    await template.save();
    return template;
  }

  // Get quality templates
  static async getQualityTemplates(category = null) {
    const query = category ? { category, isActive: true } : { isActive: true };
    return QualityTemplate.find(query).sort({ createdAt: -1 });
  }

  // Update quality template
  static async updateQualityTemplate(templateId, data) {
    const template = await QualityTemplate.findByIdAndUpdate(
      templateId,
      data,
      { new: true }
    );
    
    return template;
  }

  // Delete quality template
  static async deleteQualityTemplate(templateId) {
    const template = await QualityTemplate.findByIdAndDelete(templateId);
    return template;
  }
}

export default QualityAssuranceService;