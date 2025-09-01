const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    // Basic Information
    inquiryNumber: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['new', 'contacted', 'quoted', 'converted', 'lost', 'closed'],
        default: 'new'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    
    // Customer Information
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        trim: true
    },
    company: {
        type: String,
        trim: true
    },
    
    // Address Information
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: {
            type: String,
            default: 'India'
        }
    },
    
    // Business Information
    businessType: {
        type: String,
        enum: ['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'individual', 'other'],
        required: true
    },
    industry: {
        type: String,
        trim: true
    },
    employeeCount: {
        type: Number,
        min: 1
    },
    
    // Inquiry Details
    uniformType: {
        type: String,
        enum: ['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'security', 'fashion', 'other'],
        required: true
    },
    quantity: {
        type: Number,
        min: 1
    },
    preferredDeliveryDate: Date,
    urgency: {
        type: String,
        enum: ['not-urgent', 'within-week', 'within-month', 'within-quarter'],
        default: 'not-urgent'
    },
    
    // Requirements
    requirements: {
        description: String,
        specificNeeds: [String],
        customization: {
            text: String,
            logo: String,
            colors: [String],
            sizes: [String]
        },
        budget: {
            min: Number,
            max: Number,
            currency: { type: String, default: 'INR' }
        }
    },
    
    // Source and Attribution
    source: {
        type: String,
        enum: ['website', 'phone', 'email', 'walk-in', 'referral', 'social-media', 'advertisement', 'other'],
        default: 'website'
    },
    campaign: String,
    referrer: String,
    
    // Communication History
    communications: [{
        type: {
            type: String,
            enum: ['email', 'phone', 'meeting', 'whatsapp', 'other']
        },
        subject: String,
        content: String,
        direction: {
            type: String,
            enum: ['inbound', 'outbound']
        },
        date: {
            type: Date,
            default: Date.now
        },
        outcome: String,
        nextAction: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    
    // Follow-up Management
    lastContact: {
        type: Date
    },
    nextFollowUp: {
        type: Date
    },
    followUpNotes: String,
    
    // Assignment and Management
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    assignedDate: Date,
    
    // Conversion Tracking
    convertedTo: {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer'
        },
        conversionDate: Date,
        conversionValue: Number
    },
    
    // Notes and Internal Comments
    notes: [{
        content: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        isInternal: { type: Boolean, default: false }
    }],
    
    // Tags and Classification
    tags: [String],
    category: {
        type: String,
        enum: ['hot-lead', 'warm-lead', 'cold-lead'],
        default: 'warm-lead'
    },
    
    // Timestamps
    inquiryDate: {
        type: Date,
        default: Date.now
    },
    firstResponseTime: Date,
    resolutionTime: Date
}, {
    timestamps: true
});

// Virtual for inquiry age
inquirySchema.virtual('inquiryAge').get(function() {
    return Math.floor((Date.now() - this.inquiryDate) / (1000 * 60 * 60 * 24));
});

// Virtual for response time
inquirySchema.virtual('responseTime').get(function() {
    if (!this.firstResponseTime) return null;
    return Math.floor((this.firstResponseTime - this.inquiryDate) / (1000 * 60 * 60 * 24));
});

// Virtual for full address
inquirySchema.virtual('fullAddress').get(function() {
    const addr = this.address;
    if (!addr) return '';
    
    return [
        addr.street,
        addr.city,
        addr.state,
        addr.pincode,
        addr.country
    ].filter(Boolean).join(', ');
});

// Method to add communication
inquirySchema.methods.addCommunication = function(commData, userId) {
    const communication = {
        ...commData,
        date: new Date(),
        createdBy: userId
    };
    
    this.communications.push(communication);
    this.lastContact = new Date();
    
    // Update first response time if this is the first outbound communication
    if (commData.direction === 'outbound' && !this.firstResponseTime) {
        this.firstResponseTime = new Date();
    }
    
    return this.save();
};

// Method to add note
inquirySchema.methods.addNote = function(content, userId, isInternal = false) {
    this.notes.push({
        content,
        createdBy: userId,
        isInternal,
        createdAt: new Date()
    });
    return this.save();
};

// Method to update status
inquirySchema.methods.updateStatus = function(newStatus, userId, notes = '') {
    this.status = newStatus;
    
    // Update relevant dates
    if (newStatus === 'converted' && !this.convertedTo.conversionDate) {
        this.convertedTo.conversionDate = new Date();
        this.resolutionTime = new Date();
    }
    
    // Add note about status change
    if (notes) {
        this.addNote(`Status changed to ${newStatus}: ${notes}`, userId, true);
    }
    
    return this.save();
};

// Method to assign to user
inquirySchema.methods.assignTo = function(userId, notes = '') {
    this.assignedTo = userId;
    this.assignedDate = new Date();
    
    if (notes) {
        this.addNote(`Assigned to user: ${notes}`, userId, true);
    }
    
    return this.save();
};

// Method to schedule follow-up
inquirySchema.methods.scheduleFollowUp = function(date, notes = '') {
    this.nextFollowUp = date;
    this.followUpNotes = notes;
    return this.save();
};

// Method to convert to customer
inquirySchema.methods.convertToCustomer = function(customerId, orderId = null, conversionValue = 0) {
    this.status = 'converted';
    this.convertedTo = {
        customer: customerId,
        order: orderId,
        conversionDate: new Date(),
        conversionValue
    };
    this.resolutionTime = new Date();
    return this.save();
};

// Static method to generate inquiry number
inquirySchema.statics.generateInquiryNumber = async function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const count = await this.countDocuments({
        inquiryDate: {
            $gte: new Date(year, date.getMonth(), 1),
            $lt: new Date(year, date.getMonth() + 1, 1)
        }
    });
    
    return `INQ${year}${month}${String(count + 1).padStart(4, '0')}`;
};

// Static method to find new inquiries
inquirySchema.statics.findNew = function() {
    return this.find({ status: 'new' }).sort({ inquiryDate: -1 });
};

// Static method to find inquiries needing follow-up
inquirySchema.statics.findNeedingFollowUp = function() {
    const today = new Date();
    return this.find({
        $or: [
            { nextFollowUp: { $lte: today } },
            { lastContact: { $exists: false } }
        ],
        status: { $in: ['new', 'contacted', 'quoted'] }
    });
};

// Static method to find high-priority inquiries
inquirySchema.statics.findHighPriority = function() {
    return this.find({
        priority: { $in: ['high', 'urgent'] },
        status: { $nin: ['converted', 'lost', 'closed'] }
    });
};

// Static method to get inquiry statistics
inquirySchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    
    const result = {};
    stats.forEach(stat => {
        result[stat._id] = stat.count;
    });
    
    return result;
};

// Indexes for better performance
inquirySchema.index({ inquiryNumber: 1 });
inquirySchema.index({ email: 1 });
inquirySchema.index({ phone: 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ priority: 1 });
inquirySchema.index({ inquiryDate: -1 });
inquirySchema.index({ nextFollowUp: 1 });
inquirySchema.index({ assignedTo: 1 });
inquirySchema.index({ businessType: 1 });
inquirySchema.index({ uniformType: 1 });
inquirySchema.index({ source: 1 });

// Ensure virtual fields are serialized
inquirySchema.set('toJSON', { virtuals: true });
inquirySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inquiry', inquirySchema);
