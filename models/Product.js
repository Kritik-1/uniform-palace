const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    description: {
        type: String,
        trim: true
    },
    
    // Category and Classification
    category: {
        type: String,
        enum: ['educational', 'corporate', 'hospitality', 'medical', 'industrial', 'fashion'],
        required: true
    },
    subcategory: {
        type: String,
        trim: true
    },
    uniformType: {
        type: String,
        enum: ['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'security', 'other'],
        required: true
    },
    
    // Product Details
    material: {
        type: String,
        trim: true
    },
    fabric: {
        type: String,
        trim: true
    },
    colors: [{
        name: String,
        hexCode: String,
        isAvailable: { type: Boolean, default: true }
    }],
    sizes: [{
        name: String,
        chest: Number,
        waist: Number,
        length: Number,
        isAvailable: { type: Boolean, default: true }
    }],
    
    // Pricing Information
    basePrice: {
        type: Number,
        required: true,
        min: 0
    },
    bulkPricing: [{
        minQuantity: Number,
        maxQuantity: Number,
        pricePerUnit: Number,
        discount: Number
    }],
    specialPricing: {
        type: Number
    },
    currency: {
        type: String,
        default: 'INR'
    },
    
    // Inventory Management
    stockQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    reorderLevel: {
        type: Number,
        default: 10
    },
    reorderQuantity: {
        type: Number,
        default: 50
    },
    supplier: {
        name: String,
        contact: String,
        leadTime: Number // in days
    },
    
    // Product Status
    isActive: {
        type: Boolean,
        default: true
    },
    isCustomizable: {
        type: Boolean,
        default: false
    },
    customizationOptions: [{
        name: String,
        type: {
            type: String,
            enum: ['text', 'logo', 'color', 'size', 'other']
        },
        additionalCost: Number,
        description: String
    }],
    
    // Images and Media
    images: [{
        url: String,
        alt: String,
        isPrimary: { type: Boolean, default: false }
    }],
    specifications: [{
        name: String,
        value: String
    }],
    
    // Business Logic
    minimumOrderQuantity: {
        type: Number,
        default: 1
    },
    leadTime: {
        type: Number,
        default: 7 // in days
    },
    isSeasonal: {
        type: Boolean,
        default: false
    },
    season: {
        type: String,
        enum: ['spring', 'summer', 'autumn', 'winter', 'all-year']
    },
    
    // Tags and Search
    tags: [String],
    keywords: [String],
    
    // Statistics
    totalSold: {
        type: Number,
        default: 0
    },
    totalRevenue: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Virtual for primary image
productSchema.virtual('primaryImage').get(function() {
    if (!this.images || !Array.isArray(this.images)) return null;
    const primary = this.images.find(img => img.isPrimary);
    return primary ? primary.url : (this.images[0] ? this.images[0].url : null);
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
    if (this.stockQuantity === 0) return 'out-of-stock';
    if (this.stockQuantity <= this.reorderLevel) return 'low-stock';
    return 'in-stock';
});

// Virtual for effective price
productSchema.virtual('effectivePrice').get(function() {
    return this.specialPricing || this.basePrice;
});

// Method to update stock
productSchema.methods.updateStock = function(quantity, operation = 'decrease') {
    if (operation === 'decrease') {
        this.stockQuantity = Math.max(0, this.stockQuantity - quantity);
    } else if (operation === 'increase') {
        this.stockQuantity += quantity;
    }
    return this.save();
};

// Method to calculate bulk price
productSchema.methods.getBulkPrice = function(quantity) {
    if (quantity < this.minimumOrderQuantity) {
        return this.effectivePrice * quantity;
    }
    
    if (!this.bulkPricing || !Array.isArray(this.bulkPricing)) {
        return this.effectivePrice * quantity;
    }
    
    const bulkPrice = this.bulkPricing.find(bp => 
        quantity >= bp.minQuantity && quantity <= bp.maxQuantity
    );
    
    if (bulkPrice) {
        return bulkPrice.pricePerUnit * quantity;
    }
    
    return this.effectivePrice * quantity;
};

// Method to add image
productSchema.methods.addImage = function(imageData) {
    if (!this.images) {
        this.images = [];
    }
    if (imageData.isPrimary) {
        // Remove primary from other images
        this.images.forEach(img => img.isPrimary = false);
    }
    this.images.push(imageData);
    return this.save();
};

// Method to update sales statistics
productSchema.methods.updateSalesStats = function(quantity, revenue) {
    this.totalSold += quantity;
    this.totalRevenue += revenue;
    return this.save();
};

// Static method to find by category
productSchema.statics.findByCategory = function(category) {
    return this.find({ category, isActive: true });
};

// Static method to find low stock products
productSchema.statics.findLowStock = function() {
    return this.find({
        $expr: { $lte: ['$stockQuantity', '$reorderLevel'] },
        isActive: true
    });
};

// Static method to find out of stock products
productSchema.statics.findOutOfStock = function() {
    return this.find({ stockQuantity: 0, isActive: true });
};

// Static method to search products
productSchema.statics.search = function(query) {
    const searchRegex = new RegExp(query, 'i');
    return this.find({
        $or: [
            { name: searchRegex },
            { description: searchRegex },
            { tags: searchRegex },
            { keywords: searchRegex }
        ],
        isActive: true
    });
};

// Indexes for better performance
productSchema.index({ code: 1 });
productSchema.index({ category: 1 });
productSchema.index({ uniformType: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ stockQuantity: 1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ 'colors.name': 1 });
productSchema.index({ 'sizes.name': 1 });

// Text index for search
productSchema.index({
    name: 'text',
    description: 'text',
    tags: 'text',
    keywords: 'text'
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
