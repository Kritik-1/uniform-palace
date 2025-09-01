const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

// Email templates
const emailTemplates = {
    newInquiry: (inquiry) => ({
        subject: 'New Inquiry Received - Uniform Palace',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 20px; text-align: center;">
                    <h1>UNIFORM PALACE</h1>
                    <p>New Inquiry Received</p>
                </div>
                
                <div style="padding: 20px; background: #f8f9fa;">
                    <h2>Inquiry Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Customer Name:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.customerName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.phone || 'Not provided'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Business Type:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.businessType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Uniform Type:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.uniformType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Quantity:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.quantity}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Requirements:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${inquiry.requirements}</td>
                        </tr>
                    </table>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/admin/inquiries" 
                           style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                            View Inquiry in Dashboard
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
                    <p>© 2024 Uniform Palace. All rights reserved.</p>
                    <p>691, Barkat Nagar, Tonk Phatak, Jaipur, Rajasthan - 302015</p>
                </div>
            </div>
        `
    }),

    inquiryFollowUp: (inquiry, followUpDate) => ({
        subject: 'Follow-up Reminder - Uniform Palace',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; text-align: center;">
                    <h1>UNIFORM PALACE</h1>
                    <p>Follow-up Reminder</p>
                </div>
                
                <div style="padding: 20px; background: #f8f9fa;">
                    <h2>Follow-up Scheduled</h2>
                    <p><strong>Customer:</strong> ${inquiry.customerName}</p>
                    <p><strong>Follow-up Date:</strong> ${new Date(followUpDate).toLocaleDateString()}</p>
                    <p><strong>Inquiry Type:</strong> ${inquiry.uniformType}</p>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>Action Required:</h3>
                        <ul>
                            <li>Contact the customer</li>
                            <li>Provide quote if requested</li>
                            <li>Update inquiry status</li>
                        </ul>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/admin/inquiries" 
                           style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                            View in Dashboard
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
                    <p>© 2024 Uniform Palace. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    newOrder: (order) => ({
        subject: `New Order #${order.orderNumber} - Uniform Palace`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 20px; text-align: center;">
                    <h1>UNIFORM PALACE</h1>
                    <p>New Order Received</p>
                </div>
                
                <div style="padding: 20px; background: #f8f9fa;">
                    <h2>Order Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Order Number:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${order.orderNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Customer:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${order.customer.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total Amount:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${order.totalAmount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Status:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${order.status}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Delivery Date:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(order.preferredDeliveryDate).toLocaleDateString()}</td>
                        </tr>
                    </table>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/admin/orders" 
                           style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                            View Order in Dashboard
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
                    <p>© 2024 Uniform Palace. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    orderStatusUpdate: (order, newStatus) => ({
        subject: `Order #${order.orderNumber} Status Updated - Uniform Palace`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; text-align: center;">
                    <h1>UNIFORM PALACE</h1>
                    <p>Order Status Updated</p>
                </div>
                
                <div style="padding: 20px; background: #f8f9fa;">
                    <h2>Order Status Update</h2>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Customer:</strong> ${order.customer.name}</p>
                    <p><strong>New Status:</strong> <span style="color: #059669; font-weight: bold;">${newStatus}</span></p>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/admin/orders" 
                           style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                            View Order Details
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
                    <p>© 2024 Uniform Palace. All rights reserved.</p>
                </div>
            </div>
        `
    }),

    lowStockAlert: (product) => ({
        subject: `Low Stock Alert - ${product.name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center;">
                    <h1>UNIFORM PALACE</h1>
                    <p>Low Stock Alert</p>
                </div>
                
                <div style="padding: 20px; background: #f8f9fa;">
                    <h2>Product Stock Alert</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Product:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${product.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Product Code:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${product.code}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Current Stock:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #dc2626; font-weight: bold;">${product.stockQuantity}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Reorder Level:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${product.reorderLevel}</td>
                        </tr>
                    </table>
                    
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>Action Required:</h3>
                        <p>Please reorder this product to maintain stock levels.</p>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/admin/products" 
                           style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                            Manage Products
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
                    <p>© 2024 Uniform Palace. All rights reserved.</p>
                </div>
            </div>
        `
    })
};

// Email service functions
const emailService = {
    // Send new inquiry notification
    async sendNewInquiryNotification(inquiry) {
        try {
            const transporter = createTransporter();
            const template = emailTemplates.newInquiry(inquiry);
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: template.subject,
                html: template.html
            });
            
            console.log('New inquiry notification sent successfully');
        } catch (error) {
            console.error('Error sending new inquiry notification:', error);
        }
    },

    // Send follow-up reminder
    async sendFollowUpReminder(inquiry, followUpDate) {
        try {
            const transporter = createTransporter();
            const template = emailTemplates.inquiryFollowUp(inquiry, followUpDate);
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: template.subject,
                html: template.html
            });
            
            console.log('Follow-up reminder sent successfully');
        } catch (error) {
            console.error('Error sending follow-up reminder:', error);
        }
    },

    // Send new order notification
    async sendNewOrderNotification(order) {
        try {
            const transporter = createTransporter();
            const template = emailTemplates.newOrder(order);
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: template.subject,
                html: template.html
            });
            
            console.log('New order notification sent successfully');
        } catch (error) {
            console.error('Error sending new order notification:', error);
        }
    },

    // Send order status update notification
    async sendOrderStatusUpdate(order, newStatus) {
        try {
            const transporter = createTransporter();
            const template = emailTemplates.orderStatusUpdate(order, newStatus);
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: template.subject,
                html: template.html
            });
            
            console.log('Order status update notification sent successfully');
        } catch (error) {
            console.error('Error sending order status update notification:', error);
        }
    },

    // Send low stock alert
    async sendLowStockAlert(product) {
        try {
            const transporter = createTransporter();
            const template = emailTemplates.lowStockAlert(product);
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: template.subject,
                html: template.html
            });
            
            console.log('Low stock alert sent successfully');
        } catch (error) {
            console.error('Error sending low stock alert:', error);
        }
    },

    // Send customer confirmation email
    async sendCustomerConfirmation(inquiry) {
        try {
            const transporter = createTransporter();
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: inquiry.email,
                subject: 'Thank you for your inquiry - Uniform Palace',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 20px; text-align: center;">
                            <h1>UNIFORM PALACE</h1>
                            <p>Thank you for your inquiry!</p>
                        </div>
                        
                        <div style="padding: 20px; background: #f8f9fa;">
                            <h2>Dear ${inquiry.customerName},</h2>
                            <p>Thank you for contacting Uniform Palace. We have received your inquiry and our team will get back to you within 24 hours.</p>
                            
                            <h3>Your Inquiry Details:</h3>
                            <ul>
                                <li><strong>Business Type:</strong> ${inquiry.businessType}</li>
                                <li><strong>Uniform Type:</strong> ${inquiry.uniformType}</li>
                                <li><strong>Quantity:</strong> ${inquiry.quantity}</li>
                            </ul>
                            
                            <p>If you have any urgent requirements, please call us at <strong>+91-9414606273</strong>.</p>
                            
                            <p>Best regards,<br>Team Uniform Palace</p>
                        </div>
                        
                        <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
                            <p>© 2024 Uniform Palace. All rights reserved.</p>
                            <p>691, Barkat Nagar, Tonk Phatak, Jaipur, Rajasthan - 302015</p>
                        </div>
                    </div>
                `
            });
            
            console.log('Customer confirmation email sent successfully');
        } catch (error) {
            console.error('Error sending customer confirmation email:', error);
        }
    }
};

module.exports = emailService;
