const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files
    }
});

// Process and save images
const processAndSaveImages = async (files, productId) => {
    const savedImages = [];
    const uploadDir = path.join(__dirname, '../uploads/products', productId);
    
    // Create directory if it doesn't exist
    await fs.mkdir(uploadDir, { recursive: true });
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPrimary = i === 0; // First image is primary
        
        try {
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const originalName = path.parse(file.originalname).name;
            const filename = `${originalName}_${timestamp}_${randomString}.webp`;
            
            // Process image with sharp
            const processedImage = await sharp(file.buffer)
                .resize(800, 800, { 
                    fit: 'inside', 
                    withoutEnlargement: true 
                })
                .webp({ quality: 80 })
                .toBuffer();
            
            // Save processed image
            const filepath = path.join(uploadDir, filename);
            await fs.writeFile(filepath, processedImage);
            
            // Create thumbnail
            const thumbnail = await sharp(file.buffer)
                .resize(200, 200, { 
                    fit: 'cover' 
                })
                .webp({ quality: 70 })
                .toBuffer();
            
            const thumbnailFilename = `thumb_${filename}`;
            const thumbnailPath = path.join(uploadDir, thumbnailFilename);
            await fs.writeFile(thumbnailPath, thumbnail);
            
            // Add to saved images array
            savedImages.push({
                filename: filename,
                thumbnail: thumbnailFilename,
                originalName: file.originalname,
                mimetype: 'image/webp',
                size: processedImage.length,
                isPrimary: isPrimary,
                url: `/uploads/products/${productId}/${filename}`,
                thumbnailUrl: `/uploads/products/${productId}/${thumbnailFilename}`
            });
            
        } catch (error) {
            console.error(`Error processing image ${file.originalname}:`, error);
            throw new Error(`Failed to process image: ${file.originalname}`);
        }
    }
    
    return savedImages;
};

// Delete product images
const deleteProductImages = async (productId) => {
    try {
        const uploadDir = path.join(__dirname, '../uploads/products', productId);
        await fs.rm(uploadDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Error deleting product images:', error);
    }
};

// Delete specific image
const deleteImage = async (productId, filename) => {
    try {
        const filepath = path.join(__dirname, '../uploads/products', productId, filename);
        await fs.unlink(filepath);
        
        // Also delete thumbnail if it exists
        const thumbnailPath = path.join(__dirname, '../uploads/products', productId, `thumb_${filename}`);
        try {
            await fs.unlink(thumbnailPath);
        } catch (thumbError) {
            // Thumbnail might not exist, ignore error
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
};

// Update primary image
const updatePrimaryImage = async (productId, filename) => {
    try {
        const uploadDir = path.join(__dirname, '../uploads/products', productId);
        const files = await fs.readdir(uploadDir);
        
        // Remove 'thumb_' prefix from thumbnail files
        const imageFiles = files.filter(file => !file.startsWith('thumb_'));
        
        for (const file of imageFiles) {
            const filepath = path.join(uploadDir, file);
            const stats = await fs.stat(filepath);
            
            if (file === filename) {
                // Set this file as primary (you might want to add metadata or rename)
                console.log(`Set ${file} as primary image`);
            }
        }
    } catch (error) {
        console.error('Error updating primary image:', error);
        throw error;
    }
};

module.exports = {
    upload,
    processAndSaveImages,
    deleteProductImages,
    deleteImage,
    updatePrimaryImage
};
