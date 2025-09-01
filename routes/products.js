const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { authenticateToken, checkPermission, canAccessResource } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { upload, processAndSaveImages, deleteProductImages, deleteImage } = require('../middleware/upload');

const router = express.Router();

// Validation rules
const productValidation = [
    body('name').trim().isLength({ min: 2 }).withMessage('Product name is required'),
    body('code').trim().isLength({ min: 3 }).withMessage('Product code is required'),
    body('description').optional().trim(),
    body('category').isIn(['educational', 'corporate', 'hospitality', 'medical', 'industrial', 'fashion']).withMessage('Valid category is required'),
    body('uniformType').isIn(['school', 'college', 'hotel', 'hospital', 'corporate', 'industrial', 'security', 'other']).withMessage('Valid uniform type is required'),
    body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
    body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
    body('reorderLevel').optional().isInt({ min: 0 }).withMessage('Reorder level must be a non-negative integer'),
    body('minimumOrderQuantity').optional().isInt({ min: 1 }).withMessage('Minimum order quantity must be at least 1'),
    body('leadTime').optional().isInt({ min: 1 }).withMessage('Lead time must be at least 1 day')
];

// @route   GET /api/products
// @desc    Get all products with filtering and pagination
// @access  Private
router.get('/', authenticateToken, checkPermission('products'), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            category,
            uniformType,
            isActive,
            stockStatus,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};
        if (search) {
            filter.$text = { $search: search };
        }
        if (category) filter.category = category;
        if (uniformType) filter.uniformType = uniformType;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (stockStatus) {
            if (stockStatus === 'out-of-stock') filter.stockQuantity = 0;
            else if (stockStatus === 'low-stock') {
                filter.$expr = { $lte: ['$stockQuantity', '$reorderLevel'] };
            }
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get products with pagination
        let products;
        if (search) {
            // Use text search with score
            products = await Product.find(filter, { score: { $meta: 'textScore' } })
                .sort({ score: { $meta: 'textScore' } })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('createdBy', 'username fullName')
                .populate('lastModifiedBy', 'username fullName');
        } else {
            products = await Product.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('createdBy', 'username fullName')
                .populate('lastModifiedBy', 'username fullName');
        }

        // Get total count
        const total = await Product.countDocuments(filter);

        res.json({
            success: true,
            products,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalProducts: total,
                hasNextPage: skip + products.length < total,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting products'
        });
    }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Private
router.get('/:id', authenticateToken, checkPermission('products'), canAccessResource('product'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('createdBy', 'username fullName')
            .populate('lastModifiedBy', 'username fullName');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            product
        });

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting product'
        });
    }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private
router.post('/', authenticateToken, checkPermission('products'), productValidation, async (req, res) => {
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

        const productData = {
            ...req.body,
            createdBy: req.user._id
        };

        // Check if product with same code already exists
        const existingProduct = await Product.findOne({ code: productData.code });
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: 'Product with this code already exists'
            });
        }

        const newProduct = new Product(productData);
        await newProduct.save();

        // Populate references
        await newProduct.populate('createdBy', 'username fullName');

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product: newProduct
        });

    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating product'
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/:id', authenticateToken, checkPermission('products'), canAccessResource('product'), productValidation, async (req, res) => {
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

        // Check if code is being changed and if it already exists
        if (req.body.code) {
            const existingProduct = await Product.findOne({ 
                code: req.body.code, 
                _id: { $ne: req.params.id } 
            });
            if (existingProduct) {
                return res.status(400).json({
                    success: false,
                    message: 'Product with this code already exists'
                });
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'username fullName')
         .populate('lastModifiedBy', 'username fullName');

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check for low stock and send alert
        if (updatedProduct.stockQuantity <= updatedProduct.reorderLevel && updatedProduct.stockQuantity > 0) {
            try {
                await emailService.sendLowStockAlert(updatedProduct);
            } catch (emailError) {
                console.error('Low stock alert email error:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating product'
        });
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private
router.delete('/:id', authenticateToken, checkPermission('products'), canAccessResource('product'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if product has orders
        const Order = require('../models/Order');
        const hasOrders = await Order.exists({ 'items.product': req.params.id });
        
        if (hasOrders) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete product with existing orders'
            });
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting product'
        });
    }
});

// @route   PUT /api/products/:id/stock
// @desc    Update product stock
// @access  Private
router.put('/:id/stock', authenticateToken, checkPermission('products'), canAccessResource('product'), [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('operation').isIn(['increase', 'decrease']).withMessage('Operation must be increase or decrease')
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

        const { quantity, operation } = req.body;

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        await product.updateStock(quantity, operation);

        res.json({
            success: true,
            message: `Stock ${operation}d successfully`,
            product
        });

    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating stock'
        });
    }
});

// @route   POST /api/products/:id/images
// @desc    Add image to product
// @access  Private
router.post('/:id/images', authenticateToken, checkPermission('products'), canAccessResource('product'), [
    body('url').isURL().withMessage('Valid image URL is required'),
    body('alt').optional().trim(),
    body('isPrimary').optional().isBoolean()
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

        const { url, alt, isPrimary = false } = req.body;

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        await product.addImage({ url, alt, isPrimary });

        res.json({
            success: true,
            message: 'Image added successfully',
            product
        });

    } catch (error) {
        console.error('Add image error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding image'
        });
    }
});

// @route   DELETE /api/products/:id/images/:imageId
// @desc    Remove image from product
// @access  Private
router.delete('/:id/images/:imageId', authenticateToken, checkPermission('products'), canAccessResource('product'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Remove image by index (assuming imageId is the index)
        const imageIndex = parseInt(req.params.imageId);
        if (imageIndex < 0 || imageIndex >= product.images.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image ID'
            });
        }

        product.images.splice(imageIndex, 1);
        await product.save();

        res.json({
            success: true,
            message: 'Image removed successfully',
            product
        });

    } catch (error) {
        console.error('Remove image error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error removing image'
        });
    }
});

// @route   GET /api/products/search/quick
// @desc    Quick search products
// @access  Private
router.get('/search/quick', authenticateToken, checkPermission('products'), async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        const products = await Product.search(q.trim())
            .limit(parseInt(limit))
            .select('name code category uniformType basePrice stockQuantity primaryImage');

        res.json({
            success: true,
            products
        });

    } catch (error) {
        console.error('Quick search error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during search'
        });
    }
});

// @route   GET /api/products/stats/overview
// @desc    Get product statistics overview
// @access  Private
router.get('/stats/overview', authenticateToken, checkPermission('products'), async (req, res) => {
    try {
        // Get total products
        const totalProducts = await Product.countDocuments();
        
        // Get active products
        const activeProducts = await Product.countDocuments({ isActive: true });
        
        // Get products by category
        const categoryStats = await Product.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);
        
        // Get products by uniform type
        const uniformTypeStats = await Product.aggregate([
            { $group: { _id: '$uniformType', count: { $sum: 1 } } }
        ]);
        
        // Get low stock products
        const lowStockProducts = await Product.findLowStock().countDocuments();
        
        // Get out of stock products
        const outOfStockProducts = await Product.findOutOfStock().countDocuments();

        const stats = {
            totalProducts,
            activeProducts,
            categoryStats: categoryStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            uniformTypeStats: uniformTypeStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            lowStockProducts,
            outOfStockProducts
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Get product stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting product statistics'
        });
    }
});

// @route   GET /api/products/dashboard/summary
// @desc    Get product dashboard summary
// @access  Private
router.get('/dashboard/summary', authenticateToken, checkPermission('products'), async (req, res) => {
    try {
        // Get recent products
        const recentProducts = await Product.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name code category uniformType basePrice stockQuantity');

        // Get low stock products
        const lowStockProducts = await Product.findLowStock()
            .sort({ stockQuantity: 1 })
            .limit(5)
            .select('name code category stockQuantity reorderLevel');

        // Get top selling products
        const topSellingProducts = await Product.find({ isActive: true })
            .sort({ totalSold: -1 })
            .limit(5)
            .select('name code totalSold totalRevenue');

        res.json({
            success: true,
            summary: {
                recentProducts,
                lowStockProducts,
                topSellingProducts
            }
        });

    } catch (error) {
        console.error('Get product dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error getting product dashboard'
        });
    }
});

// @route   POST /api/products/:id/images
// @desc    Upload product images
// @access  Private
router.post('/:id/images', authenticateToken, checkPermission('products'), canAccessResource('product'), upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No images uploaded'
            });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Process and save images
        const savedImages = await processAndSaveImages(req.files, req.params.id);
        
        // Add images to product
        for (const image of savedImages) {
            await product.addImage(image);
        }

        res.json({
            success: true,
            message: 'Images uploaded successfully',
            images: savedImages,
            product: product
        });

    } catch (error) {
        console.error('Upload images error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error uploading images'
        });
    }
});

// @route   DELETE /api/products/:id/images/:imageId
// @desc    Delete product image
// @access  Private
router.delete('/:id/images/:imageId', authenticateToken, checkPermission('products'), canAccessResource('product'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Find the image
        const image = product.images.id(req.params.imageId);
        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        // Delete file from filesystem
        await deleteImage(req.params.id, image.filename);

        // Remove image from product
        product.images.pull(req.params.imageId);
        await product.save();

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting image'
        });
    }
});

// @route   PUT /api/products/:id/images/:imageId/primary
// @desc    Set image as primary
// @access  Private
router.put('/:id/images/:imageId/primary', authenticateToken, checkPermission('products'), canAccessResource('product'), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Set all images as non-primary
        product.images.forEach(img => img.isPrimary = false);

        // Set the specified image as primary
        const image = product.images.id(req.params.imageId);
        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        image.isPrimary = true;
        await product.save();

        res.json({
            success: true,
            message: 'Primary image updated successfully',
            product: product
        });

    } catch (error) {
        console.error('Update primary image error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating primary image'
        });
    }
});

module.exports = router;
