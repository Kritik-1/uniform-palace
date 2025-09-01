const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { authenticateToken, checkPermission, canAccessResource } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const customerValidation = [
    body('name').trim().isLength({ min: 2 }).withMessage('Customer name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('company').optional().trim(),
    body('businessType').isIn(['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'individual', 'other']).withMessage('Valid business type is required'),
    body('employeeCount').optional().isInt({ min: 1 }).withMessage('Employee count must be at least 1'),
    body('address.street').optional().trim(),
    body('address.city').optional().trim(),
    body('address.state').optional().trim(),
    body('address.pincode').optional().trim()
];

// @route   GET /api/customers
// @desc    Get all customers with filtering and pagination
// @access  Private
router.get('/', authenticateToken, checkPermission('customers'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            businessType,
            status,
            assignedTo,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } }
            ];
        }
        if (businessType) filter.businessType = businessType;
        if (status) filter.status = status;
        if (assignedTo) filter.assignedTo = assignedTo;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get customers with pagination
        const customers = await Customer.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('assignedTo', 'username fullName');

        // Get total count
        const total = await Customer.countDocuments(filter);

        res.json({
            success: true,
            customers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalCustomers: total,
                hasNextPage: skip + customers.length < total,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting customers'
        });
    }
});

// @route   GET /api/customers/:id
// @desc    Get customer by ID
// @access  Private
router.get('/:id', authenticateToken, checkPermission('customers'), canAccessResource('customer'), async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id)
            .populate('assignedTo', 'username fullName');

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.json({
            success: true,
            customer
        });

    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting customer'
        });
    }
});

// @route   POST /api/customers
// @desc    Create new customer
// @access  Private
router.post('/', authenticateToken, checkPermission('customers'), customerValidation, async (req, res) => {
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

        const customerData = {
            ...req.body,
            createdBy: req.user._id
        };

        // Check if customer with same email already exists
        const existingCustomer = await Customer.findOne({ email: customerData.email });
        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Customer with this email already exists'
            });
        }

        const newCustomer = new Customer(customerData);
        await newCustomer.save();

        // Populate references
        await newCustomer.populate('assignedTo', 'username fullName');

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            customer: newCustomer
        });

    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating customer'
        });
    }
});

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put('/:id', authenticateToken, checkPermission('customers'), canAccessResource('customer'), customerValidation, async (req, res) => {
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

        const updateData = {
            ...req.body,
            lastModifiedBy: req.user._id
        };

        // Check if email is being changed and if it already exists
        if (req.body.email) {
            const existingCustomer = await Customer.findOne({ 
                email: req.body.email, 
                _id: { $ne: req.params.id } 
            });
            if (existingCustomer) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer with this email already exists'
                });
            }
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'username fullName');

        if (!updatedCustomer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.json({
            success: true,
            message: 'Customer updated successfully',
            customer: updatedCustomer
        });

    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating customer'
        });
    }
});

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private
router.delete('/:id', authenticateToken, checkPermission('customers'), canAccessResource('customer'), async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Check if customer has orders
        const Order = require('../models/Order');
        const hasOrders = await Order.exists({ customer: req.params.id });
        
        if (hasOrders) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete customer with existing orders'
            });
        }

        await Customer.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });

    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting customer'
        });
    }
});

// @route   POST /api/customers/:id/notes
// @desc    Add note to customer
// @access  Private
router.post('/:id/notes', authenticateToken, checkPermission('customers'), canAccessResource('customer'), [
    body('content').trim().isLength({ min: 1 }).withMessage('Note content is required')
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

        const { content } = req.body;

        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        await customer.addNote(content, req.user._id);

        res.json({
            success: true,
            message: 'Note added successfully',
            customer
        });

    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding note'
        });
    }
});

// @route   POST /api/customers/:id/communications
// @desc    Add communication to customer
// @access  Private
router.post('/:id/communications', authenticateToken, checkPermission('customers'), canAccessResource('customer'), [
    body('type').isIn(['email', 'phone', 'meeting', 'whatsapp', 'other']).withMessage('Valid communication type is required'),
    body('subject').optional().trim(),
    body('content').trim().isLength({ min: 1 }).withMessage('Communication content is required'),
    body('direction').isIn(['inbound', 'outbound']).withMessage('Valid direction is required'),
    body('outcome').optional().trim(),
    body('nextAction').optional().trim()
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

        const {
            type,
            subject,
            content,
            direction,
            outcome,
            nextAction
        } = req.body;

        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        await customer.addCommunication({
            type,
            subject,
            content,
            direction,
            outcome,
            nextAction
        });

        res.json({
            success: true,
            message: 'Communication added successfully',
            customer
        });

    } catch (error) {
        console.error('Add communication error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding communication'
        });
    }
});

// @route   POST /api/customers/:id/assign
// @desc    Assign customer to user
// @access  Private
router.post('/:id/assign', authenticateToken, checkPermission('customers'), canAccessResource('customer'), [
    body('assignedTo').isMongoId().withMessage('Valid user ID is required'),
    body('notes').optional().trim()
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

        const { assignedTo, notes } = req.body;

        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        customer.assignedTo = assignedTo;
        if (notes) {
            await customer.addNote(`Assigned to user: ${notes}`, req.user._id);
        }
        await customer.save();

        res.json({
            success: true,
            message: 'Customer assigned successfully',
            customer
        });

    } catch (error) {
        console.error('Assign customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error assigning customer'
        });
    }
});

// @route   GET /api/customers/stats/overview
// @desc    Get customer statistics overview
// @access  Private
router.get('/stats/overview', authenticateToken, checkPermission('customers'), async (req, res) => {
    try {
        // Get total customers
        const totalCustomers = await Customer.countDocuments();
        
        // Get customers by status
        const statusStats = await Customer.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        // Get customers by business type
        const businessTypeStats = await Customer.aggregate([
            { $group: { _id: '$businessType', count: { $sum: 1 } } }
        ]);
        
        // Get high-value customers
        const highValueCustomers = await Customer.findHighValue(10000).countDocuments();
        
        // Get customers needing follow-up
        const followUpCustomers = await Customer.findNeedingFollowUp().countDocuments();

        const stats = {
            totalCustomers,
            statusStats: statusStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            businessTypeStats: businessTypeStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            highValueCustomers,
            followUpCustomers
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Get customer stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting customer statistics'
        });
    }
});

// @route   GET /api/customers/dashboard/summary
// @desc    Get customer dashboard summary
// @access  Private
router.get('/dashboard/summary', authenticateToken, checkPermission('customers'), async (req, res) => {
    try {
        // Get recent customers
        const recentCustomers = await Customer.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name company status businessType createdAt');

        // Get customers needing follow-up
        const followUpCustomers = await Customer.findNeedingFollowUp()
            .sort({ nextFollowUp: 1 })
            .limit(5)
            .select('name company status nextFollowUp');

        // Get high-value customers
        const highValueCustomers = await Customer.findHighValue(10000)
            .sort({ totalRevenue: -1 })
            .limit(5)
            .select('name company totalRevenue totalOrders');

        res.json({
            success: true,
            summary: {
                recentCustomers,
                followUpCustomers,
                highValueCustomers
            }
        });

    } catch (error) {
        console.error('Get customer dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting customer dashboard'
        });
    }
});

module.exports = router;
