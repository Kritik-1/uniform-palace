const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Order Information
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    orderType: {
        type: String,
        enum: ['quote', 'order', 'sample'],
        default: 'quote'
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'confirmed', 'in-production', 'ready', 'delivered', 'cancelled'],
        default: 'draft'
    },
    
    // Customer Information
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    customerCompany: String,
    
    // Order Details
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: String,
        productCode: String,
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0
        },
        customization: {
            text: String,
            logo: String,
            color: String,
            size: String,
            additionalCost: { type: Number, default: 0 }
        },
        notes: String
    }],
    
    // Pricing Information
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    shippingCost: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    
    // Delivery Information
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' }
    },
    deliveryInstructions: String,
    preferredDeliveryDate: Date,
    actualDeliveryDate: Date,
    
    // Production and Timeline
    orderDate: {
        type: Date,
        default: Date.now
    },
    expectedCompletionDate: Date,
    actualCompletionDate: Date,
    productionStartDate: Date,
    
    // Payment Information
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'overdue'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank-transfer', 'cheque', 'online', 'credit'],
        default: 'cash'
    },
    paymentTerms: {
        type: String,
        enum: ['immediate', '7-days', '15-days', '30-days', '45-days', '60-days'],
        default: 'immediate'
    },
    dueDate: Date,
    paidAmount: {
        type: Number,
        default: 0
    },
    
    // Business Logic
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    source: {
        type: String,
        enum: ['website', 'phone', 'email', 'walk-in', 'referral', 'other'],
        default: 'website'
    },
    
    // Communication and Notes
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
    
    // Follow-up and Status Updates
    statusHistory: [{
        status: String,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        notes: String
    }],
    
    // Quality and Inspection
    qualityCheck: {
        isCompleted: { type: Boolean, default: false },
        checkedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        checkedAt: Date,
        notes: String,
        isPassed: Boolean
    },
    
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    tags: [String]
}, {
    timestamps: true
});

// Virtual for order summary
orderSchema.virtual('orderSummary').get(function() {
    return `${this.orderNumber} - ${this.customerName} - ${this.totalAmount} ${this.currency}`;
});

// Virtual for order age
orderSchema.virtual('orderAge').get(function() {
    return Math.floor((Date.now() - this.orderDate) / (1000 * 60 * 60 * 24));
});

// Virtual for delivery status
orderSchema.virtual('deliveryStatus').get(function() {
    if (this.status === 'delivered') return 'delivered';
    if (this.actualDeliveryDate) return 'delivered';
    if (this.preferredDeliveryDate && new Date() > this.preferredDeliveryDate) return 'overdue';
    return 'pending';
});

// Method to add note
orderSchema.methods.addNote = function(content, userId, isInternal = false) {
    if (!this.notes) {
        this.notes = [];
    }
    this.notes.push({
        content,
        createdBy: userId,
        isInternal
    });
    return this.save();
};

// Method to update status
orderSchema.methods.updateStatus = function(newStatus, userId, notes = '') {
    this.status = newStatus;
    if (!this.statusHistory) {
        this.statusHistory = [];
    }
    this.statusHistory.push({
        status: newStatus,
        changedBy: userId,
        notes
    });
    
    // Update relevant dates based on status
    if (newStatus === 'in-production' && !this.productionStartDate) {
        this.productionStartDate = new Date();
    }
    if (newStatus === 'ready' && !this.actualCompletionDate) {
        this.actualCompletionDate = new Date();
    }
    if (newStatus === 'delivered' && !this.actualDeliveryDate) {
        this.actualDeliveryDate = new Date();
    }
    
    return this.save();
};

// Method to calculate totals
orderSchema.methods.calculateTotals = function() {
    if (!this.items || !Array.isArray(this.items)) {
        this.subtotal = 0;
    } else {
        this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }
    this.totalAmount = this.subtotal + (this.tax || 0) + (this.shippingCost || 0) - (this.discount || 0);
    
    return this.save();
};

// Method to add item
orderSchema.methods.addItem = function(itemData) {
    if (!this.items) {
        this.items = [];
    }
    const item = {
        ...itemData,
        totalPrice: itemData.quantity * itemData.unitPrice
    };
    this.items.push(item);
    this.calculateTotals();
    return this.save();
};

// Method to update payment
orderSchema.methods.updatePayment = function(amount) {
    this.paidAmount += amount;
    if (this.paidAmount >= this.totalAmount) {
        this.paymentStatus = 'paid';
    } else if (this.paidAmount > 0) {
        this.paymentStatus = 'partial';
    }
    return this.save();
};

// Static method to generate order number
orderSchema.statics.generateOrderNumber = async function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const count = await this.countDocuments({
        orderDate: {
            $gte: new Date(year, date.getMonth(), 1),
            $lt: new Date(year, date.getMonth() + 1, 1)
        }
    });
    
    return `UP${year}${month}${String(count + 1).padStart(4, '0')}`;
};

// Static method to find pending orders
orderSchema.statics.findPending = function() {
    return this.find({ status: { $in: ['pending', 'confirmed', 'in-production'] } });
};

// Static method to find overdue orders
orderSchema.statics.findOverdue = function() {
    const today = new Date();
    return this.find({
        $or: [
            { preferredDeliveryDate: { $lt: today } },
            { dueDate: { $lt: today } }
        ],
        status: { $nin: ['delivered', 'cancelled'] }
    });
};

// Static method to find orders by customer
orderSchema.statics.findByCustomer = function(customerId) {
    return this.find({ customer: customerId }).sort({ orderDate: -1 });
};

// Static method to get order statistics
orderSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$totalAmount' },
                averageOrderValue: { $avg: '$totalAmount' }
            }
        }
    ]);
    
    return stats[0] || { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0 };
};

// Indexes for better performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ expectedCompletionDate: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ assignedTo: 1 });
orderSchema.index({ 'items.product': 1 });

// Ensure virtual fields are serialized
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
