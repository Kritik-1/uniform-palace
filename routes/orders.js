const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { authenticateToken, checkPermission, canAccessResource } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// Validation rules
const orderValidation = [
    body('customer').isMongoId().withMessage('Valid customer ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('deliveryAddress.street').optional().trim(),
    body('deliveryAddress.city').optional().trim(),
    body('deliveryAddress.state').optional().trim(),
    body('deliveryAddress.pincode').optional().trim(),
    body('preferredDeliveryDate').optional().isISO8601().withMessage('Valid delivery date is required'),
    body('paymentTerms').optional().isIn(['immediate', '7-days', '15-days', '30-days', '45-days', '60-days']),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent'])
];

// @route   GET /api/orders
// @desc    Get all orders with filtering and pagination
// @access  Private
router.get('/', authenticateToken, checkPermission('orders'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            status,
            orderType,
            customer,
            assignedTo,
            paymentStatus,
            priority,
            sortBy = 'orderDate',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (search) {
            filter.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerCompany: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) filter.status = status;
        if (orderType) filter.orderType = orderType;
        if (customer) filter.customer = customer;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (priority) filter.priority = priority;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get orders with pagination
        const orders = await Order.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('customer', 'name company email')
            .populate('assignedTo', 'username fullName')
            .populate('createdBy', 'username fullName')
            .populate('items.product', 'name code');

        // Get total count
        const total = await Order.countDocuments(filter);

        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalOrders: total,
                hasNextPage: skip + orders.length < total,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting orders'
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', authenticateToken, checkPermission('orders'), canAccessResource('order'), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'name company email phone address')
            .populate('assignedTo', 'username fullName')
            .populate('createdBy', 'username fullName')
            .populate('items.product', 'name code description images');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting order'
        });
    }
});

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', authenticateToken, checkPermission('orders'), orderValidation, async (req, res) => {
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
            customer,
            items,
            deliveryAddress,
            preferredDeliveryDate,
            paymentTerms,
            priority,
            source,
            notes
        } = req.body;

        // Get customer details
        const customerDoc = await Customer.findById(customer);
        if (!customerDoc) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Generate order number
        const orderNumber = await Order.generateOrderNumber();

        // Calculate totals
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product ${item.product} not found`
                });
            }

            // Check stock availability
            if (product.stockQuantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}`
                });
            }

            const totalPrice = item.quantity * item.unitPrice;
            subtotal += totalPrice;

            orderItems.push({
                product: item.product,
                productName: product.name,
                productCode: product.code,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice,
                customization: item.customization || {},
                notes: item.notes
            });
        }

        const totalAmount = subtotal; // Add tax, shipping, discount logic here

        // Create order
        const orderData = {
            orderNumber,
            customer,
            customerName: customerDoc.name,
            customerEmail: customerDoc.email,
            customerPhone: customerDoc.phone,
            customerCompany: customerDoc.company,
            items: orderItems,
            subtotal,
            totalAmount,
            deliveryAddress,
            preferredDeliveryDate,
            paymentTerms,
            priority,
            source,
            createdBy: req.user._id
        };

        const newOrder = new Order(orderData);
        await newOrder.save();

        // Update customer statistics
        await customerDoc.updateStats(totalAmount);

        // Update product stock
        for (const item of orderItems) {
            const product = await Product.findById(item.product);
            await product.updateStock(item.quantity, 'decrease');
        }

        // Populate references
        await newOrder.populate('customer', 'name company email');
        await newOrder.populate('createdBy', 'username fullName');

        // Send new order notification email
        try {
            await emailService.sendNewOrderNotification(newOrder);
        } catch (emailError) {
            console.error('Order notification email error:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: newOrder
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating order'
        });
    }
});

// @route   PUT /api/orders/:id
// @desc    Update order
// @access  Private
router.put('/:id', authenticateToken, checkPermission('orders'), canAccessResource('order'), async (req, res) => {
    try {
        const {
            status,
            assignedTo,
            expectedCompletionDate,
            deliveryAddress,
            preferredDeliveryDate,
            paymentTerms,
            priority,
            notes
        } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        if (assignedTo) updateData.assignedTo = assignedTo;
        if (expectedCompletionDate) updateData.expectedCompletionDate = expectedCompletionDate;
        if (deliveryAddress) updateData.deliveryAddress = deliveryAddress;
        if (preferredDeliveryDate) updateData.preferredDeliveryDate = preferredDeliveryDate;
        if (paymentTerms) updateData.paymentTerms = paymentTerms;
        if (priority) updateData.priority = priority;

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('customer', 'name company email')
         .populate('assignedTo', 'username fullName')
         .populate('createdBy', 'username fullName');

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Add note about the update
        if (Object.keys(updateData).length > 0) {
            const updateNotes = Object.entries(updateData)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            await updatedOrder.addNote(`Order updated: ${updateNotes}`, req.user._id, true);
        }

        res.json({
            success: true,
            message: 'Order updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating order'
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order
// @access  Private
router.delete('/:id', authenticateToken, checkPermission('orders'), canAccessResource('order'), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Only allow deletion of draft orders
        if (order.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft orders can be deleted'
            });
        }

        // Restore product stock
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                await product.updateStock(item.quantity, 'increase');
            }
        }

        await Order.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Order deleted successfully'
        });

    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting order'
        });
    }
});

// @route   POST /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.post('/:id/status', authenticateToken, checkPermission('orders'), canAccessResource('order'), [
    body('status').isIn(['draft', 'pending', 'confirmed', 'in-production', 'ready', 'delivered', 'cancelled']).withMessage('Valid status is required'),
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

        const { status, notes } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        await order.updateStatus(status, req.user._id, notes);

        // Send order status update notification
        try {
            await emailService.sendOrderStatusUpdate(order, status);
        } catch (emailError) {
            console.error('Order status update email error:', emailError);
        }

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order
        });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating order status'
        });
    }
});

// @route   POST /api/orders/:id/items
// @desc    Add item to order
// @access  Private
router.post('/:id/items', authenticateToken, checkPermission('orders'), canAccessResource('order'), [
    body('product').isMongoId().withMessage('Valid product ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('customization').optional().isObject(),
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

        const { product, quantity, unitPrice, customization, notes } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be modified
        if (order.status !== 'draft' && order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be modified in current status'
            });
        }

        // Get product details
        const productDoc = await Product.findById(product);
        if (!productDoc) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check stock availability
        if (productDoc.stockQuantity < quantity) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock for product ${productDoc.name}. Available: ${productDoc.stockQuantity}`
            });
        }

        const itemData = {
            product,
            productName: productDoc.name,
            productCode: productDoc.code,
            quantity,
            unitPrice,
            customization,
            notes
        };

        await order.addItem(itemData);

        // Update product stock
        await productDoc.updateStock(quantity, 'decrease');

        res.json({
            success: true,
            message: 'Item added to order successfully',
            order
        });

    } catch (error) {
        console.error('Add item to order error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding item to order'
        });
    }
});

// @route   POST /api/orders/:id/payment
// @desc    Update order payment
// @access  Private
router.post('/:id/payment', authenticateToken, checkPermission('orders'), canAccessResource('order'), [
    body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
    body('paymentMethod').optional().isIn(['cash', 'bank-transfer', 'cheque', 'online', 'credit'])
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

        const { amount, paymentMethod } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Update payment method if provided
        if (paymentMethod) {
            order.paymentMethod = paymentMethod;
        }

        await order.updatePayment(amount);

        res.json({
            success: true,
            message: 'Payment updated successfully',
            order
        });

    } catch (error) {
        console.error('Update order payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating order payment'
        });
    }
});

// @route   POST /api/orders/:id/notes
// @desc    Add note to order
// @access  Private
router.post('/:id/notes', authenticateToken, checkPermission('orders'), canAccessResource('order'), [
    body('content').trim().isLength({ min: 1 }).withMessage('Note content is required'),
    body('isInternal').optional().isBoolean()
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

        const { content, isInternal = false } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        await order.addNote(content, req.user._id, isInternal);

        res.json({
            success: true,
            message: 'Note added successfully',
            order
        });

    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding note'
        });
    }
});

// @route   GET /api/orders/stats/overview
// @desc    Get order statistics overview
// @access  Private
router.get('/stats/overview', authenticateToken, checkPermission('orders'), async (req, res) => {
    try {
        const stats = await Order.getStats();
        
        // Get additional statistics
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'in-production'] } });
        const overdueOrders = await Order.findOverdue().countDocuments();
        const completedOrders = await Order.countDocuments({ status: 'delivered' });

        const fullStats = {
            ...stats,
            totalOrders,
            pendingOrders,
            overdueOrders,
            completedOrders
        };

        res.json({
            success: true,
            stats: fullStats
        });

    } catch (error) {
        console.error('Get order stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting order statistics'
        });
    }
});

// @route   GET /api/orders/dashboard/summary
// @desc    Get order dashboard summary
// @access  Private
router.get('/dashboard/summary', authenticateToken, checkPermission('orders'), async (req, res) => {
    try {
        // Get recent orders
        const recentOrders = await Order.find()
            .sort({ orderDate: -1 })
            .limit(5)
            .select('orderNumber customerName status totalAmount orderDate');

        // Get pending orders
        const pendingOrders = await Order.findPending()
            .sort({ orderDate: 1 })
            .limit(5)
            .select('orderNumber customerName status expectedCompletionDate');

        // Get overdue orders
        const overdueOrders = await Order.findOverdue()
            .sort({ preferredDeliveryDate: 1 })
            .limit(5)
            .select('orderNumber customerName status preferredDeliveryDate');

        res.json({
            success: true,
            summary: {
                recentOrders,
                pendingOrders,
                overdueOrders
            }
        });

    } catch (error) {
        console.error('Get order dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting order dashboard'
        });
    }
});

module.exports = router;
