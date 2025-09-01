const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Inquiry = require('../models/Inquiry');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin privileges
router.use(authenticateToken, requireAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard overview
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
    try {
        // Get counts
        const totalCustomers = await Customer.countDocuments();
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalInquiries = await Inquiry.countDocuments();
        const totalUsers = await User.countDocuments();

        // Get recent activity
        const recentCustomers = await Customer.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name company status createdAt');

        const recentOrders = await Order.find()
            .sort({ orderDate: -1 })
            .limit(5)
            .select('orderNumber customerName status totalAmount orderDate');

        const recentInquiries = await Inquiry.find()
            .sort({ inquiryDate: -1 })
            .limit(5)
            .select('inquiryNumber customerName status priority inquiryDate');

        // Get pending items
        const pendingOrders = await Order.countDocuments({ 
            status: { $in: ['pending', 'confirmed', 'in-production'] } 
        });
        const newInquiries = await Inquiry.countDocuments({ status: 'new' });
        const lowStockProducts = await Product.findLowStock().countDocuments();

        // Get revenue stats
        const orderStats = await Order.getStats();
        const customerStats = await Customer.aggregate([
            { $group: { _id: null, totalRevenue: { $sum: '$totalRevenue' } } }
        ]);

        const dashboardData = {
            overview: {
                totalCustomers,
                totalProducts,
                totalOrders,
                totalInquiries,
                totalUsers
            },
            activity: {
                recentCustomers,
                recentOrders,
                recentInquiries
            },
            pending: {
                pendingOrders,
                newInquiries,
                lowStockProducts
            },
            revenue: {
                totalRevenue: orderStats.totalRevenue || 0,
                averageOrderValue: orderStats.averageOrderValue || 0,
                customerRevenue: customerStats[0]?.totalRevenue || 0
            }
        };

        res.json({
            success: true,
            dashboard: dashboardData
        });

    } catch (error) {
        console.error('Get admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting admin dashboard'
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            role,
            isActive,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { fullName: { $regex: search, $options: 'i' } }
            ];
        }
        if (role) filter.role = role;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get users with pagination
        const users = await User.find(filter)
            .select('-password')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalUsers: total,
                hasNextPage: skip + users.length < total,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting users'
        });
    }
});

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Private (Admin only)
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting user'
        });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private (Admin only)
router.put('/users/:id', [
    body('fullName').optional().trim().isLength({ min: 2 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'manager', 'staff']),
    body('isActive').optional().isBoolean(),
    body('permissions').optional().isObject()
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { fullName, email, role, isActive, permissions } = req.body;

        // Check if email is being changed and if it already exists
        if (email) {
            const existingUser = await User.findOne({ 
                email, 
                _id: { $ne: req.params.id } 
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Prevent admin from deactivating themselves
        if (req.params.id === req.user._id.toString() && isActive === false) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if (email) updateData.email = email;
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (permissions) updateData.permissions = permissions;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating user'
        });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/users/:id', async (req, res) => {
    try {
        // Prevent admin from deleting themselves
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has assigned resources
        const hasAssignedCustomers = await Customer.exists({ assignedTo: req.params.id });
        const hasAssignedOrders = await Order.exists({ assignedTo: req.params.id });
        const hasAssignedInquiries = await Inquiry.exists({ assignedTo: req.params.id });

        if (hasAssignedCustomers || hasAssignedOrders || hasAssignedInquiries) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete user with assigned resources. Please reassign resources first.'
            });
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting user'
        });
    }
});

// @route   POST /api/admin/users/:id/reset-password
// @desc    Reset user password
// @access  Private (Admin only)
router.post('/users/:id/reset-password', [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { newPassword } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error resetting password'
        });
    }
});

// @route   GET /api/admin/reports/sales
// @desc    Get sales report
// @access  Private (Admin only)
router.get('/reports/sales', async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'month' } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        // Aggregate sales data
        const pipeline = [
            { $match: { status: 'delivered' } }
        ];

        if (Object.keys(dateFilter).length > 0) {
            pipeline.push({ $match: { orderDate: dateFilter } });
        }

        if (groupBy === 'month') {
            pipeline.push({
                $group: {
                    _id: {
                        year: { $year: '$orderDate' },
                        month: { $month: '$orderDate' }
                    },
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    averageOrderValue: { $avg: '$totalAmount' }
                }
            });
            pipeline.push({ $sort: { '_id.year': 1, '_id.month': 1 } });
        } else if (groupBy === 'customer') {
            pipeline.push({
                $group: {
                    _id: '$customer',
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    averageOrderValue: { $avg: '$totalAmount' }
                }
            });
            pipeline.push({ $sort: { totalRevenue: -1 } });
        }

        const salesData = await Order.aggregate(pipeline);

        // Get summary statistics
        const summary = await Order.aggregate([
            { $match: { status: 'delivered' } },
            ...(Object.keys(dateFilter).length > 0 ? [{ $match: { orderDate: dateFilter } }] : []),
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    averageOrderValue: { $avg: '$totalAmount' },
                    minOrderValue: { $min: '$totalAmount' },
                    maxOrderValue: { $max: '$totalAmount' }
                }
            }
        ]);

        res.json({
            success: true,
            report: {
                salesData,
                summary: summary[0] || {},
                filters: { startDate, endDate, groupBy }
            }
        });

    } catch (error) {
        console.error('Get sales report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting sales report'
        });
    }
});

// @route   GET /api/admin/reports/customers
// @desc    Get customer report
// @access  Private (Admin only)
router.get('/reports/customers', async (req, res) => {
    try {
        const { businessType, status, sortBy = 'totalRevenue', sortOrder = 'desc' } = req.query;

        // Build filter object
        const filter = {};
        if (businessType) filter.businessType = businessType;
        if (status) filter.status = status;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get customer data
        const customers = await Customer.find(filter)
            .sort(sort)
            .select('name company businessType status totalOrders totalRevenue lastOrderDate');

        // Get summary statistics
        const summary = await Customer.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalCustomers: { $sum: 1 },
                    totalRevenue: { $sum: '$totalRevenue' },
                    averageCustomerValue: { $avg: '$totalRevenue' },
                    activeCustomers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    prospectCustomers: { $sum: { $cond: [{ $eq: ['$status', 'prospect'] }, 1, 0] } }
                }
            }
        ]);

        // Get customers by business type
        const businessTypeStats = await Customer.aggregate([
            { $match: filter },
            { $group: { _id: '$businessType', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            report: {
                customers,
                summary: summary[0] || {},
                businessTypeStats,
                filters: { businessType, status, sortBy, sortOrder }
            }
        });

    } catch (error) {
        console.error('Get customer report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting customer report'
        });
    }
});

// @route   GET /api/admin/reports/products
// @desc    Get product report
// @access  Private (Admin only)
router.get('/reports/products', async (req, res) => {
    try {
        const { category, uniformType, stockStatus, sortBy = 'totalSold', sortOrder = 'desc' } = req.query;

        // Build filter object
        const filter = {};
        if (category) filter.category = category;
        if (uniformType) filter.uniformType = uniformType;
        if (stockStatus) {
            if (stockStatus === 'out-of-stock') filter.stockQuantity = 0;
            else if (stockStatus === 'low-stock') {
                filter.$expr = { $lte: ['$stockQuantity', '$reorderLevel'] };
            }
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get product data
        const products = await Product.find(filter)
            .sort(sort)
            .select('name code category uniformType basePrice stockQuantity totalSold totalRevenue');

        // Get summary statistics
        const summary = await Product.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    totalRevenue: { $sum: '$totalRevenue' },
                    averagePrice: { $avg: '$basePrice' },
                    activeProducts: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
                    lowStockProducts: { $sum: { $cond: [{ $expr: { $lte: ['$stockQuantity', '$reorderLevel'] } }, 1, 0] } }
                }
            }
        ]);

        // Get products by category
        const categoryStats = await Product.aggregate([
            { $match: filter },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            report: {
                products,
                summary: summary[0] || {},
                categoryStats,
                filters: { category, uniformType, stockStatus, sortBy, sortOrder }
            }
        });

    } catch (error) {
        console.error('Get product report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting product report'
        });
    }
});

// @route   GET /api/admin/system/health
// @desc    Get system health information
// @access  Private (Admin only)
router.get('/system/health', async (req, res) => {
    try {
        // Get database stats
        const dbStats = await Promise.all([
            Customer.countDocuments(),
            Product.countDocuments(),
            Order.countDocuments(),
            Inquiry.countDocuments(),
            User.countDocuments()
        ]);

        // Get system info
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        };

        // Get pending tasks
        const pendingTasks = {
            pendingOrders: await Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'in-production'] } }),
            newInquiries: await Inquiry.countDocuments({ status: 'new' }),
            lowStockProducts: await Product.findLowStock().countDocuments(),
            overdueOrders: await Order.findOverdue().countDocuments()
        };

        const healthData = {
            database: {
                customers: dbStats[0],
                products: dbStats[1],
                orders: dbStats[2],
                inquiries: dbStats[3],
                users: dbStats[4]
            },
            system: systemInfo,
            pendingTasks
        };

        res.json({
            success: true,
            health: healthData
        });

    } catch (error) {
        console.error('Get system health error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting system health'
        });
    }
});

// @route   POST /api/admin/system/backup
// @desc    Trigger system backup
// @access  Private (Admin only)
router.post('/system/backup', async (req, res) => {
    try {
        // This is a placeholder for backup functionality
        // In a real system, you would implement actual backup logic here
        
        res.json({
            success: true,
            message: 'Backup initiated successfully',
            backupId: `backup_${Date.now()}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('System backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error initiating backup'
        });
    }
});

module.exports = router;
