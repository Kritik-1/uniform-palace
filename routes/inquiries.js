const express = require('express');
const { body, validationResult } = require('express-validator');
const Inquiry = require('../models/Inquiry');
const { authenticateToken, checkPermission } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

// Validation rules for inquiry submission
const inquiryValidation = [
    body('customerName').trim().isLength({ min: 2 }).withMessage('Customer name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('company').optional().trim(),
    body('businessType').isIn(['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'individual', 'other']).withMessage('Valid business type is required'),
    body('uniformType').isIn(['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'security', 'fashion', 'other']).withMessage('Valid uniform type is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('requirements.description').optional().trim(),
    body('requirements.budget.min').optional().isFloat({ min: 0 }),
    body('requirements.budget.max').optional().isFloat({ min: 0 })
];

// @route   POST /api/inquiries
// @desc    Submit a new customer inquiry (Public)
// @access  Public
router.post('/', inquiryValidation, async (req, res) => {
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
            customerName,
            email,
            phone,
            company,
            businessType,
            industry,
            employeeCount,
            uniformType,
            quantity,
            preferredDeliveryDate,
            urgency,
            requirements,
            source = 'website',
            campaign,
            referrer
        } = req.body;

        // Generate inquiry number
        const inquiryNumber = await Inquiry.generateInquiryNumber();

        // Create new inquiry
        const inquiryData = {
            inquiryNumber,
            customerName,
            email,
            phone,
            company,
            businessType,
            industry,
            employeeCount,
            uniformType,
            quantity,
            preferredDeliveryDate,
            urgency,
            requirements,
            source,
            campaign,
            referrer,
            address: req.body.address || {}
        };

        const newInquiry = new Inquiry(inquiryData);
        await newInquiry.save();

        // Send email notifications
        try {
            await emailService.sendNewInquiryNotification(newInquiry);
            await emailService.sendCustomerConfirmation(newInquiry);
        } catch (emailError) {
            console.error('Email notification error:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Inquiry submitted successfully',
            inquiry: {
                inquiryNumber: newInquiry.inquiryNumber,
                status: newInquiry.status,
                message: 'We will contact you within 24 hours to discuss your requirements.'
            }
        });

    } catch (error) {
        console.error('Inquiry submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error submitting inquiry'
        });
    }
});

// @route   GET /api/inquiries
// @desc    Get all inquiries (Admin/Staff)
// @access  Private
router.get('/', authenticateToken, checkPermission('inquiries'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            priority,
            businessType,
            uniformType,
            source,
            assignedTo,
            sortBy = 'inquiryDate',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (businessType) filter.businessType = businessType;
        if (uniformType) filter.uniformType = uniformType;
        if (source) filter.source = source;
        if (assignedTo) filter.assignedTo = assignedTo;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get inquiries with pagination
        const inquiries = await Inquiry.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('assignedTo', 'username fullName')
            .populate('convertedTo.customer', 'name company')
            .populate('convertedTo.order', 'orderNumber totalAmount');

        // Get total count
        const total = await Inquiry.countDocuments(filter);

        res.json({
            success: true,
            inquiries,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalInquiries: total,
                hasNextPage: skip + inquiries.length < total,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Get inquiries error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting inquiries'
        });
    }
});

// @route   GET /api/inquiries/:id
// @desc    Get inquiry by ID
// @access  Private
router.get('/:id', authenticateToken, checkPermission('inquiries'), async (req, res) => {
    try {
        const inquiry = await Inquiry.findById(req.params.id)
            .populate('assignedTo', 'username fullName')
            .populate('convertedTo.customer', 'name company')
            .populate('convertedTo.order', 'orderNumber totalAmount');

        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        res.json({
            success: true,
            inquiry
        });

    } catch (error) {
        console.error('Get inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting inquiry'
        });
    }
});

// @route   PUT /api/inquiries/:id
// @desc    Update inquiry
// @access  Private
router.put('/:id', authenticateToken, checkPermission('inquiries'), async (req, res) => {
    try {
        const {
            status,
            priority,
            assignedTo,
            nextFollowUp,
            followUpNotes,
            tags,
            category
        } = req.body;

        const updateData = {};
        if (status) updateData.status = status;
        if (priority) updateData.priority = priority;
        if (assignedTo) updateData.assignedTo = assignedTo;
        if (nextFollowUp) updateData.nextFollowUp = nextFollowUp;
        if (followUpNotes) updateData.followUpNotes = followUpNotes;
        if (tags) updateData.tags = tags;
        if (category) updateData.category = category;

        const updatedInquiry = await Inquiry.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'username fullName');

        if (!updatedInquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Add note about the update
        if (Object.keys(updateData).length > 0) {
            const updateNotes = Object.entries(updateData)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            await updatedInquiry.addNote(`Inquiry updated: ${updateNotes}`, req.user._id, true);
        }

        res.json({
            success: true,
            message: 'Inquiry updated successfully',
            inquiry: updatedInquiry
        });

    } catch (error) {
        console.error('Update inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating inquiry'
        });
    }
});

// @route   POST /api/inquiries/:id/notes
// @desc    Add note to inquiry
// @access  Private
router.post('/:id/notes', authenticateToken, checkPermission('inquiries'), [
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

        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        await inquiry.addNote(content, req.user._id, isInternal);

        res.json({
            success: true,
            message: 'Note added successfully',
            inquiry
        });

    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding note'
        });
    }
});

// @route   POST /api/inquiries/:id/communications
// @desc    Add communication to inquiry
// @access  Private
router.post('/:id/communications', authenticateToken, checkPermission('inquiries'), [
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

        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        await inquiry.addCommunication({
            type,
            subject,
            content,
            direction,
            outcome,
            nextAction
        }, req.user._id);

        res.json({
            success: true,
            message: 'Communication added successfully',
            inquiry
        });

    } catch (error) {
        console.error('Add communication error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding communication'
        });
    }
});

// @route   POST /api/inquiries/:id/assign
// @desc    Assign inquiry to user
// @access  Private
router.post('/:id/assign', authenticateToken, checkPermission('inquiries'), [
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

        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        await inquiry.assignTo(assignedTo, notes);

        res.json({
            success: true,
            message: 'Inquiry assigned successfully',
            inquiry
        });

    } catch (error) {
        console.error('Assign inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error assigning inquiry'
        });
    }
});

// @route   POST /api/inquiries/:id/follow-up
// @desc    Schedule follow-up for inquiry
// @access  Private
router.post('/:id/follow-up', authenticateToken, checkPermission('inquiries'), [
    body('nextFollowUp').isISO8601().withMessage('Valid date is required'),
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

        const { nextFollowUp, notes } = req.body;

        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        await inquiry.scheduleFollowUp(new Date(nextFollowUp), notes);

        // Send follow-up reminder email
        try {
            await emailService.sendFollowUpReminder(inquiry, nextFollowUp);
        } catch (emailError) {
            console.error('Follow-up email error:', emailError);
        }

        res.json({
            success: true,
            message: 'Follow-up scheduled successfully',
            inquiry
        });

    } catch (error) {
        console.error('Schedule follow-up error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error scheduling follow-up'
        });
    }
});

// @route   GET /api/inquiries/stats/overview
// @desc    Get inquiry statistics overview
// @access  Private
router.get('/stats/overview', authenticateToken, checkPermission('inquiries'), async (req, res) => {
    try {
        const stats = await Inquiry.getStats();
        
        // Get additional statistics
        const totalInquiries = await Inquiry.countDocuments();
        const newInquiries = await Inquiry.countDocuments({ status: 'new' });
        const urgentInquiries = await Inquiry.countDocuments({ priority: 'urgent' });
        const needingFollowUp = await Inquiry.countDocuments({
            $or: [
                { nextFollowUp: { $lte: new Date() } },
                { lastContact: { $exists: false } }
            ],
            status: { $in: ['new', 'contacted', 'quoted'] }
        });

        res.json({
            success: true,
            stats: {
                ...stats,
                totalInquiries,
                newInquiries,
                urgentInquiries,
                needingFollowUp
            }
        });

    } catch (error) {
        console.error('Get inquiry stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting inquiry statistics'
        });
    }
});

// @route   POST /api/inquiries/:id/convert-to-customer
// @desc    Convert inquiry to customer
// @access  Private
router.post('/:id/convert-to-customer', authenticateToken, checkPermission('inquiries'), [
    body('additionalNotes').optional().trim(),
    body('assignTo').optional().isMongoId().withMessage('Valid user ID required for assignment'),
    body('customerStatus').optional().isIn(['prospect', 'active', 'inactive', 'lead']).withMessage('Valid customer status required')
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

        const { additionalNotes, assignTo, customerStatus = 'prospect' } = req.body;

        // Get the inquiry
        const inquiry = await Inquiry.findById(req.params.id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Check if already converted
        if (inquiry.status === 'converted' && inquiry.convertedTo.customer) {
            return res.status(400).json({
                success: false,
                message: 'Inquiry has already been converted to a customer'
            });
        }

        // Check if customer with same email already exists
        const Customer = require('../models/Customer');
        const existingCustomer = await Customer.findOne({ email: inquiry.email });
        
        let customer;
        let isNewCustomer = false;

        if (existingCustomer) {
            // Update existing customer with inquiry data
            customer = existingCustomer;
            
            // Merge data from inquiry
            if (inquiry.company && !customer.company) customer.company = inquiry.company;
            if (inquiry.phone && !customer.phone) customer.phone = inquiry.phone;
            if (inquiry.businessType) customer.businessType = inquiry.businessType;
            if (inquiry.industry && !customer.industry) customer.industry = inquiry.industry;
            if (inquiry.employeeCount && !customer.employeeCount) customer.employeeCount = inquiry.employeeCount;
            
            // Update address if inquiry has more complete address data
            if (inquiry.address) {
                if (!customer.address) customer.address = {};
                if (inquiry.address.street && !customer.address.street) customer.address.street = inquiry.address.street;
                if (inquiry.address.city && !customer.address.city) customer.address.city = inquiry.address.city;
                if (inquiry.address.state && !customer.address.state) customer.address.state = inquiry.address.state;
                if (inquiry.address.pincode && !customer.address.pincode) customer.address.pincode = inquiry.address.pincode;
                if (inquiry.address.country && !customer.address.country) customer.address.country = inquiry.address.country;
            }

            // Update assignment if provided
            if (assignTo) customer.assignedTo = assignTo;
            
            // Update status
            customer.status = customerStatus;
            customer.lastContact = new Date();

            // Add note about the conversion
            const conversionNote = `Converted from inquiry ${inquiry.inquiryNumber}${additionalNotes ? ': ' + additionalNotes : ''}`;
            await customer.addNote(conversionNote, req.user._id);

            await customer.save();
            
        } else {
            // Create new customer from inquiry data
            isNewCustomer = true;
            
            const customerData = {
                name: inquiry.customerName,
                email: inquiry.email,
                phone: inquiry.phone || '',
                company: inquiry.company || '',
                businessType: inquiry.businessType,
                industry: inquiry.industry || '',
                employeeCount: inquiry.employeeCount || undefined,
                address: inquiry.address || {},
                status: customerStatus,
                source: inquiry.source || 'website',
                assignedTo: assignTo || inquiry.assignedTo || req.user._id,
                lastContact: new Date(),
                tags: [`converted-from-${inquiry.uniformType}`, 'inquiry-conversion']
            };

            customer = new Customer(customerData);
            await customer.save();

            // Add initial note
            const conversionNote = `Customer created from inquiry ${inquiry.inquiryNumber}. Original requirements: ${inquiry.requirements?.description || 'No specific requirements noted'}${additionalNotes ? '. Additional notes: ' + additionalNotes : ''}`;
            await customer.addNote(conversionNote, req.user._id);
        }

        // Update inquiry with conversion information
        await inquiry.convertToCustomer(customer._id);

        // Add communication record to inquiry
        await inquiry.addCommunication({
            type: 'other',
            subject: 'Converted to Customer',
            content: `Inquiry converted to ${isNewCustomer ? 'new' : 'existing'} customer record. Customer ID: ${customer._id}`,
            direction: 'outbound',
            outcome: 'Converted to customer',
            nextAction: 'Follow up on customer requirements'
        }, req.user._id);

        // Populate customer data for response
        await customer.populate('assignedTo', 'username fullName');

        res.json({
            success: true,
            message: `Inquiry successfully converted to ${isNewCustomer ? 'new' : 'existing'} customer`,
            customer,
            inquiry: {
                id: inquiry._id,
                inquiryNumber: inquiry.inquiryNumber,
                status: inquiry.status,
                convertedTo: inquiry.convertedTo
            },
            isNewCustomer
        });

    } catch (error) {
        console.error('Convert to customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error converting inquiry to customer'
        });
    }
});

// @route   DELETE /api/inquiries/:id
// @desc    Delete inquiry
// @access  Private
router.delete('/:id', authenticateToken, checkPermission('inquiries'), async (req, res) => {
    try {
        const inquiry = await Inquiry.findById(req.params.id);
        
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Check if inquiry has been converted - don't allow deletion of converted inquiries
        if (inquiry.status === 'converted' && inquiry.convertedTo.customer) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete converted inquiries. Please archive instead.'
            });
        }

        await Inquiry.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Inquiry deleted successfully'
        });

    } catch (error) {
        console.error('Delete inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting inquiry'
        });
    }
});

// @route   GET /api/inquiries/dashboard/summary
// @desc    Get inquiry dashboard summary
// @access  Private
router.get('/dashboard/summary', authenticateToken, checkPermission('inquiries'), async (req, res) => {
    try {
        // Get recent inquiries
        const recentInquiries = await Inquiry.find()
            .sort({ inquiryDate: -1 })
            .limit(5)
            .select('inquiryNumber customerName status priority inquiryDate');

        // Get inquiries needing follow-up
        const followUpInquiries = await Inquiry.find({
            $or: [
                { nextFollowUp: { $lte: new Date() } },
                { lastContact: { $exists: false } }
            ],
            status: { $in: ['new', 'contacted', 'quoted'] }
        })
        .sort({ nextFollowUp: 1 })
        .limit(5)
        .select('inquiryNumber customerName status priority nextFollowUp');

        // Get high-priority inquiries
        const highPriorityInquiries = await Inquiry.find({
            priority: { $in: ['high', 'urgent'] },
            status: { $nin: ['converted', 'lost', 'closed'] }
        })
        .sort({ inquiryDate: -1 })
        .limit(5)
        .select('inquiryNumber customerName status priority inquiryDate');

        res.json({
            success: true,
            summary: {
                recentInquiries,
                followUpInquiries,
                highPriorityInquiries
            }
        });

    } catch (error) {
        console.error('Get inquiry dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting inquiry dashboard'
        });
    }
});

module.exports = router;
