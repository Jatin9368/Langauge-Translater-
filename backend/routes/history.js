const express = require('express');
const router = express.Router();
const History = require('../models/History');

// GET /api/history?page=1&limit=20
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      History.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      History.countDocuments(),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + items.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/history/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await History.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'History item not found' });
    }

    return res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/history — clear all
router.delete('/', async (req, res, next) => {
  try {
    await History.deleteMany({});
    return res.json({ success: true, message: 'All history cleared' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
