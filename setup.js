#!/usr/bin/env node

/**
 * Uniform Palace Business Management System Setup Script
 * This script initializes the system with default data and admin user
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const Inquiry = require('./models/Inquiry');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
    console.log(`${colors[color]}${message}${colors.reset}`);
};

const logSuccess = (message) => log(`✅ ${message}`, 'green');
const logError = (message) => log(`❌ ${message}`, 'red');
const logWarning = (message) => log(`⚠️  ${message}`, 'yellow');
const logInfo = (message) => log(`ℹ️  ${message}`, 'blue');
const logHeader = (message) => log(`\n${colors.bright}${message}${colors.reset}`, 'cyan');

// Default admin user data
const defaultAdmin = {
    username: 'admin',
    email: 'admin@uniformpalace.com',
    password: 'admin123',
    fullName: 'System Administrator',
    role: 'admin'
};

// Sample customers data
const sampleCustomers = [
    {
        name: 'Delhi Public School',
        email: 'principal@dpsdelhi.edu.in',
        phone: '+91-11-23456789',
        company: 'Delhi Public School',
        businessType: 'school',
        industry: 'Education',
        employeeCount: 500,
        address: {
            street: 'Mathura Road',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110001',
            country: 'India'
        },
        status: 'active',
        source: 'website',
        tags: ['premium', 'long-term']
    },
    {
        name: 'Taj Palace Hotel',
        email: 'gm@tajpalace.com',
        phone: '+91-11-23456789',
        company: 'Taj Hotels',
        businessType: 'hotel',
        industry: 'Hospitality',
        employeeCount: 200,
        address: {
            street: 'Sardar Patel Marg',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110021',
            country: 'India'
        },
        status: 'active',
        source: 'referral',
        tags: ['luxury', 'corporate']
    },
    {
        name: 'Apollo Hospital',
        email: 'admin@apollohospital.com',
        phone: '+91-44-23456789',
        company: 'Apollo Hospitals',
        businessType: 'hospital',
        industry: 'Healthcare',
        employeeCount: 300,
        address: {
            street: 'Greams Road',
            city: 'Chennai',
            state: 'Tamil Nadu',
            pincode: '600006',
            country: 'India'
        },
        status: 'active',
        source: 'website',
        tags: ['healthcare', 'premium']
    }
];

// Sample products data
const sampleProducts = [
    {
        name: 'School Uniform - Summer',
        code: 'SCH-SU-001',
        description: 'Comfortable cotton summer school uniform for students',
        category: 'educational',
        subcategory: 'school',
        uniformType: 'school',
        material: 'Cotton',
        fabric: '100% Pure Cotton',
        colors: [
            { name: 'Navy Blue', hexCode: '#000080', isAvailable: true },
            { name: 'White', hexCode: '#FFFFFF', isAvailable: true }
        ],
        sizes: [
            { name: 'XS', chest: 28, waist: 24, length: 20, isAvailable: true },
            { name: 'S', chest: 30, waist: 26, length: 22, isAvailable: true },
            { name: 'M', chest: 32, waist: 28, length: 24, isAvailable: true },
            { name: 'L', chest: 34, waist: 30, length: 26, isAvailable: true },
            { name: 'XL', chest: 36, waist: 32, length: 28, isAvailable: true }
        ],
        basePrice: 0,
        stockQuantity: 1000,
        reorderLevel: 100,
        reorderQuantity: 500,
        isCustomizable: true,
        customizationOptions: [
            { name: 'School Logo', type: 'logo', additionalCost: 0, description: 'Embroidered school logo' },
            { name: 'Student Name', type: 'text', additionalCost: 0, description: 'Embroidered student name' }
        ],
        minimumOrderQuantity: 50,
        leadTime: 7,
        tags: ['school', 'summer', 'cotton', 'comfortable'],
        keywords: ['school uniform', 'student uniform', 'summer uniform', 'cotton uniform']
    },
    {
        name: 'Corporate Uniform - Formal',
        code: 'COR-FO-001',
        description: 'Professional corporate uniform for office staff',
        category: 'corporate',
        subcategory: 'office',
        uniformType: 'corporate',
        material: 'Polyester Blend',
        fabric: '65% Polyester, 35% Cotton',
        colors: [
            { name: 'Navy Blue', hexCode: '#000080', isAvailable: true },
            { name: 'Charcoal Grey', hexCode: '#36454F', isAvailable: true },
            { name: 'Black', hexCode: '#000000', isAvailable: true }
        ],
        sizes: [
            { name: 'S', chest: 36, waist: 30, length: 28, isAvailable: true },
            { name: 'M', chest: 38, waist: 32, length: 29, isAvailable: true },
            { name: 'L', chest: 40, waist: 34, length: 30, isAvailable: true },
            { name: 'XL', chest: 42, waist: 36, length: 31, isAvailable: true },
            { name: 'XXL', chest: 44, waist: 38, length: 32, isAvailable: true }
        ],
        basePrice: 0,
        stockQuantity: 500,
        reorderLevel: 50,
        reorderQuantity: 200,
        isCustomizable: true,
        customizationOptions: [
            { name: 'Company Logo', type: 'logo', additionalCost: 0, description: 'Embroidered company logo' },
            { name: 'Employee ID', type: 'text', additionalCost: 0, description: 'Embroidered employee ID' }
        ],
        minimumOrderQuantity: 25,
        leadTime: 10,
        tags: ['corporate', 'formal', 'office', 'professional'],
        keywords: ['corporate uniform', 'office uniform', 'formal uniform', 'business uniform']
    },
    {
        name: 'Hotel Staff Uniform',
        code: 'HOT-ST-001',
        description: 'Elegant uniform for hotel staff and service personnel',
        category: 'hospitality',
        subcategory: 'hotel',
        uniformType: 'hotel',
        material: 'Polyester',
        fabric: '100% Polyester',
        colors: [
            { name: 'Burgundy', hexCode: '#800020', isAvailable: true },
            { name: 'Gold', hexCode: '#FFD700', isAvailable: true },
            { name: 'Navy Blue', hexCode: '#000080', isAvailable: true }
        ],
        sizes: [
            { name: 'XS', chest: 32, waist: 26, length: 24, isAvailable: true },
            { name: 'S', chest: 34, waist: 28, length: 25, isAvailable: true },
            { name: 'M', chest: 36, waist: 30, length: 26, isAvailable: true },
            { name: 'L', chest: 38, waist: 32, length: 27, isAvailable: true },
            { name: 'XL', chest: 40, waist: 34, length: 28, isAvailable: true }
        ],
        basePrice: 0,
        stockQuantity: 800,
        reorderLevel: 80,
        reorderQuantity: 300,
        isCustomizable: true,
        customizationOptions: [
            { name: 'Hotel Logo', type: 'logo', additionalCost: 0, description: 'Embroidered hotel logo' },
            { name: 'Staff Name', type: 'text', additionalCost: 0, description: 'Embroidered staff name' },
            { name: 'Department Badge', type: 'other', additionalCost: 0, description: 'Department identification badge' }
        ],
        minimumOrderQuantity: 30,
        leadTime: 8,
        tags: ['hotel', 'staff', 'elegant', 'service'],
        keywords: ['hotel uniform', 'staff uniform', 'service uniform', 'hospitality uniform']
    }
];

// Sample inquiries data
const sampleInquiries = [
    {
        customerName: 'St. Mary\'s Convent School',
        email: 'principal@stmarys.edu.in',
        phone: '+91-141-2345678',
        company: 'St. Mary\'s Convent School',
        businessType: 'school',
        industry: 'Education',
        employeeCount: 400,
        uniformType: 'school',
        quantity: 800,
        urgency: 'within-month',
        requirements: {
            description: 'Complete school uniform set including shirts, pants, skirts, and sweaters',
            specificNeeds: ['Summer uniforms', 'Winter uniforms', 'Sports uniforms'],
            budget: { min: 0, max: 0, currency: 'INR' }
        },
        source: 'website',
        status: 'new',
        priority: 'normal'
    },
    {
        customerName: 'Radisson Blu Hotel',
        email: 'hr@radissonblu.com',
        phone: '+91-141-3456789',
        company: 'Radisson Blu Hotels',
        businessType: 'hotel',
        industry: 'Hospitality',
        employeeCount: 150,
        uniformType: 'hotel',
        quantity: 200,
        urgency: 'within-quarter',
        requirements: {
            description: 'Professional hotel staff uniforms for front desk, housekeeping, and restaurant staff',
            specificNeeds: ['Front desk uniforms', 'Housekeeping uniforms', 'Restaurant uniforms'],
            budget: { min: 0, max: 0, currency: 'INR' }
        },
        source: 'referral',
        status: 'contacted',
        priority: 'high'
    }
];

async function connectDatabase() {
    try {
        logInfo('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-palace', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        logSuccess('Connected to MongoDB successfully');
    } catch (error) {
        logError(`Failed to connect to MongoDB: ${error.message}`);
        process.exit(1);
    }
}

async function createAdminUser() {
    try {
        logInfo('Creating admin user...');
        
        // Check if admin already exists
        const existingAdmin = await User.findOne({ username: defaultAdmin.username });
        if (existingAdmin) {
            logWarning('Admin user already exists, skipping...');
            return existingAdmin;
        }

        // Create admin user
        const adminUser = await User.createAdmin(defaultAdmin);
        logSuccess(`Admin user created successfully: ${adminUser.username}`);
        return adminUser;
    } catch (error) {
        logError(`Failed to create admin user: ${error.message}`);
        throw error;
    }
}

async function createSampleCustomers(adminUser) {
    try {
        logInfo('Creating sample customers...');
        
        const createdCustomers = [];
        for (const customerData of sampleCustomers) {
            // Check if customer already exists
            const existingCustomer = await Customer.findOne({ email: customerData.email });
            if (existingCustomer) {
                logWarning(`Customer ${customerData.name} already exists, skipping...`);
                continue;
            }

            customerData.createdBy = adminUser._id;
            const customer = new Customer(customerData);
            await customer.save();
            createdCustomers.push(customer);
            logSuccess(`Customer created: ${customer.name}`);
        }

        logSuccess(`Created ${createdCustomers.length} sample customers`);
        return createdCustomers;
    } catch (error) {
        logError(`Failed to create sample customers: ${error.message}`);
        throw error;
    }
}

async function createSampleProducts(adminUser) {
    try {
        logInfo('Creating sample products...');
        
        const createdProducts = [];
        for (const productData of sampleProducts) {
            // Check if product already exists
            const existingProduct = await Product.findOne({ code: productData.code });
            if (existingProduct) {
                logWarning(`Product ${productData.name} already exists, skipping...`);
                continue;
            }

            productData.createdBy = adminUser._id;
            const product = new Product(productData);
            await product.save();
            createdProducts.push(product);
            logSuccess(`Product created: ${product.name}`);
        }

        logSuccess(`Created ${createdProducts.length} sample products`);
        return createdProducts;
    } catch (error) {
        logError(`Failed to create sample products: ${error.message}`);
        throw error;
    }
}

async function createSampleInquiries(adminUser) {
    try {
        logInfo('Creating sample inquiries...');
        
        const createdInquiries = [];
        for (const inquiryData of sampleInquiries) {
            // Check if inquiry already exists
            const existingInquiry = await Inquiry.findOne({ 
                email: inquiryData.email,
                customerName: inquiryData.customerName 
            });
            if (existingInquiry) {
                logWarning(`Inquiry for ${inquiryData.customerName} already exists, skipping...`);
                continue;
            }

            // Generate inquiry number
            inquiryData.inquiryNumber = await Inquiry.generateInquiryNumber();
            inquiryData.createdBy = adminUser._id;
            
            const inquiry = new Inquiry(inquiryData);
            await inquiry.save();
            createdInquiries.push(inquiry);
            logSuccess(`Inquiry created: ${inquiry.customerName}`);
        }

        logSuccess(`Created ${createdInquiries.length} sample inquiries`);
        return createdInquiries;
    } catch (error) {
        logError(`Failed to create sample inquiries: ${error.message}`);
        throw error;
    }
}

async function createDirectories() {
    try {
        logInfo('Creating necessary directories...');
        
        const fs = require('fs');
        const path = require('path');
        
        const directories = [
            './uploads',
            './uploads/products',
            './uploads/customers',
            './logs'
        ];
        
        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logSuccess(`Created directory: ${dir}`);
            } else {
                logWarning(`Directory already exists: ${dir}`);
            }
        }
    } catch (error) {
        logError(`Failed to create directories: ${error.message}`);
        throw error;
    }
}

async function main() {
    try {
        logHeader('🚀 Uniform Palace Business Management System Setup');
        logInfo('Starting system initialization...\n');

        // Connect to database
        await connectDatabase();

        // Create admin user
        const adminUser = await createAdminUser();

        // Create sample data
        await createSampleCustomers(adminUser);
        await createSampleProducts(adminUser);
        await createSampleInquiries(adminUser);

        // Create directories
        await createDirectories();

        logHeader('🎉 Setup Completed Successfully!');
        logSuccess('Your Uniform Palace Business Management System is ready to use!');
        logInfo('\nDefault Admin Credentials:');
        logInfo(`Username: ${defaultAdmin.username}`);
        logInfo(`Password: ${defaultAdmin.password}`);
        logInfo(`Email: ${defaultAdmin.email}`);
        logWarning('\n⚠️  IMPORTANT: Change the default password after first login!');
        
        logInfo('\nNext Steps:');
        logInfo('1. Start the server: npm start');
        logInfo('2. Access admin dashboard: http://localhost:5000/admin');
        logInfo('3. Login with admin credentials');
        logInfo('4. Update business settings and customize the system');
        logInfo('5. Add more users, customers, and products');

        logInfo('\nAPI Endpoints:');
        logInfo('• Health Check: http://localhost:5000/api/health');
        logInfo('• API Base: http://localhost:5000/api');
        logInfo('• Documentation: Check README.md for API details');

    } catch (error) {
        logError(`Setup failed: ${error.message}`);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        logInfo('Database connection closed');
        process.exit(0);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { main };
