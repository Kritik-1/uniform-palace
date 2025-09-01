const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    // Basic Information
    name: {
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
    
    // Contact Preferences
    preferredContact: {
        type: String,
        enum: ['email', 'phone', 'whatsapp'],
        default: 'email'
    },
    preferredTime: {
        type: String,
        enum: ['morning', 'afternoon', 'evening'],
        default: 'morning'
    },
    
    // Customer Status
    status: {
        type: String,
        enum: ['prospect', 'active', 'inactive', 'lead'],
        default: 'prospect'
    },
    source: {
        type: String,
        enum: ['website', 'referral', 'cold-call', 'social-media', 'advertisement', 'other'],
        default: 'website'
    },
    
    // Financial Information
    creditLimit: {
        type: Number,
        default: 0
    },
    paymentTerms: {
        type: String,
        enum: ['immediate', '7-days', '15-days', '30-days', '45-days', '60-days'],
        default: 'immediate'
    },
    
    // Notes and Tags
    notes: [{
        content: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    tags: [String],
    
    // Relationship Management
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastContact: {
        type: Date
    },
    nextFollowUp: {
        type: Date
    },
    
    // Statistics
    totalOrders: {
        type: Number,
        default: 0
    },
    totalRevenue: {
        type: Number,
        default: 0
    },
    lastOrderDate: {
        type: Date
    },
    
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
        nextAction: String
    }]
}, {
    timestamps: true
});

// Virtual for full address
customerSchema.virtual('fullAddress').get(function() {
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

// Virtual for customer value
customerSchema.virtual('customerValue').get(function() {
    return this.totalRevenue;
});

// Method to add note
customerSchema.methods.addNote = function(content, userId) {
    this.notes.push({
        content,
        createdBy: userId,
        createdAt: new Date()
    });
    return this.save();
};

// Method to add communication
customerSchema.methods.addCommunication = function(commData) {
    this.communications.push({
        ...commData,
        date: new Date()
    });
    this.lastContact = new Date();
    return this.save();
};

// Method to update statistics
customerSchema.methods.updateStats = function(orderAmount) {
    this.totalOrders += 1;
    this.totalRevenue += orderAmount;
    this.lastOrderDate = new Date();
    return this.save();
};

// Static method to find by business type
customerSchema.statics.findByBusinessType = function(businessType) {
    return this.find({ businessType, status: { $in: ['active', 'prospect'] } });
};

// Static method to find high-value customers
customerSchema.statics.findHighValue = function(minRevenue = 10000) {
    return this.find({ totalRevenue: { $gte: minRevenue } }).sort({ totalRevenue: -1 });
};

// Static method to find customers needing follow-up
customerSchema.statics.findNeedingFollowUp = function() {
    const today = new Date();
    return this.find({
        $or: [
            { nextFollowUp: { $lte: today } },
            { lastContact: { $exists: false } }
        ],
        status: { $in: ['prospect', 'lead'] }
    });
};

// Indexes for better performance
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ company: 1 });
customerSchema.index({ businessType: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ assignedTo: 1 });
customerSchema.index({ nextFollowUp: 1 });
customerSchema.index({ totalRevenue: -1 });

// Ensure virtual fields are serialized
customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);
