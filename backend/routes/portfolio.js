const express = require('express');
const { body, validationResult } = require('express-validator');
const Portfolio = require('../models/Portfolio');
const MarketData = require('../models/MarketData');

const router = express.Router();

// @route   GET /api/portfolio
// @desc    Get all portfolios for user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ 
      userId: req.user.id, 
      isActive: true 
    }).sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: { portfolios },
      count: portfolios.length
    });
  } catch (error) {
    console.error('Get portfolios error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch portfolios'
    });
  }
});

// @route   GET /api/portfolio/:id
// @desc    Get specific portfolio
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!portfolio) {
      return res.status(404).json({
        status: 'error',
        message: 'Portfolio not found'
      });
    }

    res.json({
      status: 'success',
      data: { portfolio }
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch portfolio'
    });
  }
});

// @route   POST /api/portfolio
// @desc    Create new portfolio
// @access  Private
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('type').optional().isIn(['equity', 'mutual_fund', 'mixed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, type } = req.body;

    const portfolio = new Portfolio({
      userId: req.user.id,
      name,
      description,
      type: type || 'equity'
    });

    await portfolio.save();

    res.status(201).json({
      status: 'success',
      message: 'Portfolio created successfully',
      data: { portfolio }
    });
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create portfolio'
    });
  }
});

// @route   PUT /api/portfolio/:id
// @desc    Update portfolio
// @access  Private
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('type').optional().isIn(['equity', 'mutual_fund', 'mixed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, isActive: true },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!portfolio) {
      return res.status(404).json({
        status: 'error',
        message: 'Portfolio not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Portfolio updated successfully',
      data: { portfolio }
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update portfolio'
    });
  }
});

// @route   DELETE /api/portfolio/:id
// @desc    Delete portfolio
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!portfolio) {
      return res.status(404).json({
        status: 'error',
        message: 'Portfolio not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Portfolio deleted successfully'
    });
  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete portfolio'
    });
  }
});

// @route   POST /api/portfolio/:id/position
// @desc    Add position to portfolio
// @access  Private
router.post('/:id/position', [
  body('symbol').trim().isLength({ min: 1 }).toUpperCase(),
  body('quantity').isFloat({ min: 0.01 }),
  body('averagePrice').isFloat({ min: 0.01 }),
  body('exchange').optional().isIn(['NSE', 'BSE'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { symbol, quantity, averagePrice, exchange } = req.body;
    
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!portfolio) {
      return res.status(404).json({
        status: 'error',
        message: 'Portfolio not found'
      });
    }

    // Check if position already exists
    const existingPosition = portfolio.positions.find(pos => pos.symbol === symbol);
    
    if (existingPosition) {
      // Update existing position (average down/up)
      const totalQuantity = existingPosition.quantity + quantity;
      const totalInvested = existingPosition.investedAmount + (quantity * averagePrice);
      
      existingPosition.quantity = totalQuantity;
      existingPosition.averagePrice = totalInvested / totalQuantity;
      existingPosition.investedAmount = totalInvested;
      existingPosition.lastUpdated = new Date();
    } else {
      // Add new position
      const newPosition = {
        symbol,
        quantity,
        averagePrice,
        investedAmount: quantity * averagePrice,
        exchange: exchange || 'NSE'
      };
      
      portfolio.positions.push(newPosition);
    }

    await portfolio.save();

    res.status(201).json({
      status: 'success',
      message: 'Position added successfully',
      data: { portfolio }
    });
  } catch (error) {
    console.error('Add position error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add position'
    });
  }
});

// @route   PUT /api/portfolio/:id/position/:positionId
// @desc    Update position in portfolio
// @access  Private
router.put('/:id/position/:positionId', [
  body('quantity').optional().isFloat({ min: 0.01 }),
  body('averagePrice').optional().isFloat({ min: 0.01 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!portfolio) {
      return res.status(404).json({
        status: 'error',
        message: 'Portfolio not found'
      });
    }

    const position = portfolio.positions.id(req.params.positionId);
    if (!position) {
      return res.status(404).json({
        status: 'error',
        message: 'Position not found'
      });
    }

    // Update position
    if (req.body.quantity !== undefined) {
      position.quantity = req.body.quantity;
    }
    if (req.body.averagePrice !== undefined) {
      position.averagePrice = req.body.averagePrice;
    }
    
    position.investedAmount = position.quantity * position.averagePrice;
    position.lastUpdated = new Date();

    await portfolio.save();

    res.json({
      status: 'success',
      message: 'Position updated successfully',
      data: { portfolio }
    });
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update position'
    });
  }
});

// @route   DELETE /api/portfolio/:id/position/:positionId
// @desc    Remove position from portfolio
// @access  Private
router.delete('/:id/position/:positionId', async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!portfolio) {
      return res.status(404).json({
        status: 'error',
        message: 'Portfolio not found'
      });
    }

    const position = portfolio.positions.id(req.params.positionId);
    if (!position) {
      return res.status(404).json({
        status: 'error',
        message: 'Position not found'
      });
    }

    position.remove();
    await portfolio.save();

    res.json({
      status: 'success',
      message: 'Position removed successfully',
      data: { portfolio }
    });
  } catch (error) {
    console.error('Remove position error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove position'
    });
  }
});

// @route   POST /api/portfolio/update-prices
// @desc    Update current prices for all positions
// @access  Private
router.post('/update-prices', async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ 
      userId: req.user.id, 
      isActive: true 
    });

    if (portfolios.length === 0) {
      return res.json({
        status: 'success',
        message: 'No portfolios found',
        data: { updated: 0 }
      });
    }

    // Collect all unique symbols
    const symbols = new Set();
    portfolios.forEach(portfolio => {
      portfolio.positions.forEach(position => {
        symbols.add(position.symbol);
      });
    });

    if (symbols.size === 0) {
      return res.json({
        status: 'success',
        message: 'No positions found',
        data: { updated: 0 }
      });
    }

    // Get latest market data for all symbols
    const marketData = await MarketData.getMultiple(Array.from(symbols));
    const priceMap = {};
    
    marketData.forEach(data => {
      priceMap[data.symbol] = data.price;
    });

    let updatedCount = 0;

    // Update positions with current prices
    for (const portfolio of portfolios) {
      let portfolioUpdated = false;
      
      portfolio.positions.forEach(position => {
        if (priceMap[position.symbol]) {
          position.currentPrice = priceMap[position.symbol];
          position.currentValue = position.quantity * position.currentPrice;
          position.pnl = position.currentValue - position.investedAmount;
          position.pnlPercent = (position.pnl / position.investedAmount) * 100;
          position.lastUpdated = new Date();
          portfolioUpdated = true;
        }
      });

      if (portfolioUpdated) {
        await portfolio.save();
        updatedCount++;
      }
    }

    res.json({
      status: 'success',
      message: 'Prices updated successfully',
      data: { 
        updated: updatedCount,
        symbols: Array.from(symbols).length
      }
    });
  } catch (error) {
    console.error('Update prices error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update prices'
    });
  }
});

// @route   GET /api/portfolio/summary
// @desc    Get portfolio summary for user
// @access  Private
router.get('/summary', async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ 
      userId: req.user.id, 
      isActive: true 
    });

    const summary = {
      totalPortfolios: portfolios.length,
      totalInvested: 0,
      currentValue: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      totalPositions: 0,
      topGainers: [],
      topLosers: []
    };

    const allPositions = [];

    portfolios.forEach(portfolio => {
      summary.totalInvested += portfolio.totalInvested;
      summary.currentValue += portfolio.currentValue;
      summary.totalPnL += portfolio.totalPnL;
      summary.totalPositions += portfolio.positions.length;
      
      portfolio.positions.forEach(position => {
        allPositions.push({
          ...position.toObject(),
          portfolioName: portfolio.name
        });
      });
    });

    summary.totalPnLPercent = summary.totalInvested > 0 ? 
      (summary.totalPnL / summary.totalInvested) * 100 : 0;

    // Get top gainers and losers
    const sortedPositions = allPositions.sort((a, b) => b.pnlPercent - a.pnlPercent);
    summary.topGainers = sortedPositions.slice(0, 5);
    summary.topLosers = sortedPositions.slice(-5).reverse();

    res.json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    console.error('Portfolio summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch portfolio summary'
    });
  }
});

module.exports = router;