import Website from '../model/Website.js';
import Order from '../model/Order.js';
import User from '../model/User.js';
import mongoose from 'mongoose';

class SearchService {
  // Get recommended websites based on advertiser preferences and history
  static async getRecommendedWebsites(advertiserId, limit = 12) {
    try {
      // Get advertiser's order history to understand preferences
      const orderHistory = await Order.find({ advertiserId })
        .populate('websiteId')
        .sort({ createdAt: -1 })
        .limit(20);
      
      // Extract preferences from order history
      const preferences = this.extractPreferencesFromHistory(orderHistory);
      
      // Build recommendation query based on preferences
      const query = {
        status: 'approved',
        _id: { $nin: orderHistory.map(order => order.websiteId?._id) } // Exclude already ordered websites
      };
      
      // Apply category preferences
      if (preferences.categories.length > 0) {
        query.category = { $in: preferences.categories };
      }
      
      // Apply domain authority preferences
      if (preferences.minDA || preferences.maxDA) {
        query['metrics.domainAuthority'] = {};
        if (preferences.minDA) query['metrics.domainAuthority'].$gte = preferences.minDA;
        if (preferences.maxDA) query['metrics.domainAuthority'].$lte = preferences.maxDA;
      }
      
      // Apply price range preferences
      if (preferences.minPrice || preferences.maxPrice) {
        query.publishingPrice = {};
        if (preferences.minPrice) query.publishingPrice.$gte = preferences.minPrice;
        if (preferences.maxPrice) query.publishingPrice.$lte = preferences.maxPrice;
      }
      
      // Apply language preferences
      if (preferences.languages.length > 0) {
        query.mainLanguage = { $in: preferences.languages };
      }
      
      // Apply country preferences
      if (preferences.countries.length > 0) {
        query.country = { $in: preferences.countries };
      }
      
      // Get recommended websites
      const recommendedWebsites = await Website.find(query)
        .populate('userId', 'firstName lastName')
        .sort({ 'metrics.domainAuthority': -1, publishingPrice: 1 }) // Sort by DA (desc) and price (asc)
        .limit(limit);
      
      // Enrich with stats
      const websitesWithStats = await Promise.all(
        recommendedWebsites.map(async (website) => {
          const stats = await this.getWebsiteStats(website._id);
          return {
            ...website.toObject(),
            stats
          };
        })
      );
      
      return websitesWithStats;
    } catch (error) {
      throw new Error(`Failed to get recommended websites: ${error.message}`);
    }
  }
  
  // Extract preferences from order history
  static extractPreferencesFromHistory(orderHistory) {
    const categories = {};
    const languages = {};
    const countries = {};
    let totalPrice = 0;
    let domainAuthoritySum = 0;
    let validOrders = 0;
    
    orderHistory.forEach(order => {
      if (order.websiteId) {
        // Category preferences
        if (order.websiteId.category) {
          categories[order.websiteId.category] = (categories[order.websiteId.category] || 0) + 1;
        }
        
        // Language preferences
        if (order.websiteId.mainLanguage) {
          languages[order.websiteId.mainLanguage] = (languages[order.websiteId.mainLanguage] || 0) + 1;
        }
        
        // Country preferences
        if (order.websiteId.country) {
          countries[order.websiteId.country] = (countries[order.websiteId.country] || 0) + 1;
        }
        
        // Price range
        totalPrice += order.totalPrice;
        
        // Domain authority
        if (order.websiteId.metrics && order.websiteId.metrics.domainAuthority) {
          domainAuthoritySum += order.websiteId.metrics.domainAuthority;
          validOrders++;
        }
      }
    });
    
    // Get top preferences
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);
      
    const topLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([language]) => language);
      
    const topCountries = Object.entries(countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country]) => country);
    
    const avgPrice = orderHistory.length > 0 ? totalPrice / orderHistory.length : 0;
    const avgDA = validOrders > 0 ? domainAuthoritySum / validOrders : 0;
    
    return {
      categories: topCategories,
      languages: topLanguages,
      countries: topCountries,
      minPrice: Math.max(0, avgPrice * 0.7), // 70% of average
      maxPrice: avgPrice * 1.3, // 130% of average
      minDA: Math.max(0, avgDA * 0.8), // 80% of average
      maxDA: avgDA * 1.2 // 120% of average
    };
  }
  
  // Advanced website search with filters
  static async searchWebsites(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 12,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      // Build filter query
      const query = { status: 'approved' };
      
      // Apply text search
      if (filters.search) {
        query.$or = [
          { domain: { $regex: filters.search, $options: 'i' } },
          { siteDescription: { $regex: filters.search, $options: 'i' } },
          { keywords: { $in: [new RegExp(filters.search, 'i')] } }
        ];
      }
      
      // Apply category filter
      if (filters.category && filters.category !== 'all') {
        query.category = { $regex: filters.category, $options: 'i' };
      }
      
      // Apply price range filter
      if (filters.minPrice || filters.maxPrice) {
        query.publishingPrice = {};
        if (filters.minPrice) query.publishingPrice.$gte = parseFloat(filters.minPrice);
        if (filters.maxPrice) query.publishingPrice.$lte = parseFloat(filters.maxPrice);
      }
      
      // Apply country filter
      if (filters.country && filters.country !== 'all') {
        query.country = filters.country;
      }
      
      // Apply language filter
      if (filters.language && filters.language !== 'all') {
        query.mainLanguage = filters.language;
      }
      
      // Apply domain authority filter
      if (filters.minDA || filters.maxDA) {
        query['metrics.domainAuthority'] = {};
        if (filters.minDA) query['metrics.domainAuthority'].$gte = parseInt(filters.minDA);
        if (filters.maxDA) query['metrics.domainAuthority'].$lte = parseInt(filters.maxDA);
      }
      
      // Apply link type filter
      if (filters.linkType && filters.linkType !== 'all') {
        query.linkType = filters.linkType;
      }
      
      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // Execute query
      const websites = await Website.find(query)
        .populate('userId', 'firstName lastName')
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await Website.countDocuments(query);
      
      // Enrich with stats
      const websitesWithStats = await Promise.all(
        websites.map(async (website) => {
          const stats = await this.getWebsiteStats(website._id);
          return {
            ...website.toObject(),
            stats
          };
        })
      );
      
      // Get filter options for frontend
      const [categories, countries, languages] = await Promise.all([
        Website.distinct('category', { status: 'approved' }),
        Website.distinct('country', { status: 'approved' }),
        Website.distinct('mainLanguage', { status: 'approved' })
      ]);
      
      return {
        websites: websitesWithStats,
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
      };
    } catch (error) {
      throw new Error(`Failed to search websites: ${error.message}`);
    }
  }
  
  // Get website statistics
  static async getWebsiteStats(websiteId) {
    try {
      const [completedOrders, avgResponseTime, ratings] = await Promise.all([
        Order.countDocuments({ 
          websiteId: new mongoose.Types.ObjectId(websiteId), 
          status: 'delivered' 
        }),
        Order.aggregate([
          { $match: { 
              websiteId: new mongoose.Types.ObjectId(websiteId), 
              publisherResponseTime: { $exists: true } 
          }},
          { $group: { _id: null, avg: { $avg: '$publisherResponseTime' } } }
        ]),
        Order.aggregate([
          { $match: { 
              websiteId: new mongoose.Types.ObjectId(websiteId), 
              'review.rating': { $exists: true } 
          }},
          { $group: { _id: null, avg: { $avg: '$review.rating' }, count: { $sum: 1 } } }
        ])
      ]);
      
      return {
        completedOrders,
        avgResponseTime: avgResponseTime[0]?.avg || 0,
        rating: ratings[0]?.avg || 0,
        reviewCount: ratings[0]?.count || 0
      };
    } catch (error) {
      console.error('Failed to get website stats:', error);
      return {
        completedOrders: 0,
        avgResponseTime: 0,
        rating: 0,
        reviewCount: 0
      };
    }
  }
  
  // Get search suggestions
  static async getSearchSuggestions(query, limit = 10) {
    try {
      if (!query || query.length < 2) {
        return [];
      }
      
      const suggestions = await Website.aggregate([
        {
          $match: {
            status: 'approved',
            $or: [
              { domain: { $regex: query, $options: 'i' } },
              { category: { $regex: query, $options: 'i' } },
              { keywords: { $in: [new RegExp(query, 'i')] } }
            ]
          }
        },
        {
          $project: {
            domain: 1,
            category: 1,
            score: {
              $add: [
                { $cond: [{ $regexMatch: { input: '$domain', regex: query, options: 'i' } }, 3, 0] },
                { $cond: [{ $regexMatch: { input: '$category', regex: query, options: 'i' } }, 2, 0] },
                { $cond: [{ $in: [query, '$keywords'] }, 1, 0] }
              ]
            }
          }
        },
        { $sort: { score: -1 } },
        { $limit: limit }
      ]);
      
      return suggestions.map(suggestion => ({
        domain: suggestion.domain,
        category: suggestion.category
      }));
    } catch (error) {
      throw new Error(`Failed to get search suggestions: ${error.message}`);
    }
  }
}

export default SearchService;