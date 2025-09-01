# 🚀 Deployment Guide for Uniform Palace

## **Connect Your Website to uniformpalace.com**

### **Option 1: Railway (Recommended - Easiest)**

#### **Step 1: Prepare Your Code**
1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/uniform-palace.git
   git push -u origin main
   ```

#### **Step 2: Deploy to Railway**
1. **Go to [railway.app](https://railway.app)**
2. **Sign up/Login with GitHub**
3. **Click "New Project" → "Deploy from GitHub repo"**
4. **Select your uniform-palace repository**
5. **Wait for deployment to complete**

#### **Step 3: Configure Environment Variables**
In Railway dashboard, add these variables:
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uniformpalace
JWT_SECRET=your-super-secure-jwt-secret-key-here
FRONTEND_URL=https://uniformpalace.com
EMAIL_USER=your-email@uniformpalace.com
EMAIL_PASSWORD=your-email-password
ADMIN_EMAIL=admin@uniformpalace.com
```

#### **Step 4: Connect Domain**
1. **In Railway dashboard, go to "Settings" → "Domains"**
2. **Add custom domain: `uniformpalace.com`**
3. **Railway will provide DNS records to add**

---

### **Option 2: VPS Deployment (More Control)**

#### **Step 1: Set Up VPS**
1. **Create VPS on DigitalOcean/AWS ($5-10/month)**
2. **SSH into your server**
3. **Install Node.js, MongoDB, Nginx**

#### **Step 2: Deploy Code**
```bash
# Clone your repository
git clone https://github.com/yourusername/uniform-palace.git
cd uniform-palace

# Install dependencies
npm install

# Set up environment variables
cp production.env .env
nano .env  # Edit with your actual values

# Install PM2 for process management
npm install -g pm2

# Start your application
pm2 start server.js --name "uniform-palace"
pm2 startup
pm2 save
```

#### **Step 3: Configure Nginx**
```nginx
server {
    listen 80;
    server_name uniformpalace.com www.uniformpalace.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### **Step 4: Install SSL Certificate**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d uniformpalace.com -d www.uniformpalace.com
```

---

### **Option 3: Shared Hosting (Budget Option)**

#### **Step 1: Choose Hosting Provider**
- **Hostinger**: $3-5/month
- **Bluehost**: $3-7/month
- **A2 Hosting**: $3-8/month

#### **Step 2: Upload Files**
1. **Upload all your files via FTP/cPanel**
2. **Set up Node.js hosting (if supported)**
3. **Configure MongoDB connection**

---

## **DNS Configuration**

### **For Railway/VPS:**
```
Type    Name    Value
A       @       [Your server IP or Railway IP]
CNAME   www     uniformpalace.com
```

### **For Shared Hosting:**
```
Type    Name    Value
A       @       [Hosting provider IP]
CNAME   www     uniformpalace.com
```

---

## **MongoDB Atlas Setup (Recommended for Production)**

### **Step 1: Create MongoDB Atlas Account**
1. **Go to [mongodb.com/atlas](https://mongodb.com/atlas)**
2. **Create free account**
3. **Create new cluster**

### **Step 2: Configure Database**
1. **Create database user**
2. **Whitelist your IP (or 0.0.0.0/0 for all)**
3. **Get connection string**

### **Step 3: Update Environment Variables**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uniformpalace
```

---

## **Post-Deployment Checklist**

- [ ] Website loads at `https://uniformpalace.com`
- [ ] Admin panel accessible at `https://uniformpalace.com/admin-login.html`
- [ ] Contact form submits successfully
- [ ] Images display correctly
- [ ] MongoDB connection working
- [ ] SSL certificate installed
- [ ] Email notifications working
- [ ] Mobile responsive design working

---

## **Cost Breakdown**

| Service | Cost | Description |
|---------|------|-------------|
| Domain | $10-15/year | Already purchased |
| Railway | $5/month | Hosting (after free tier) |
| MongoDB Atlas | Free | Database (up to 512MB) |
| **Total** | **$70-75/year** | Complete hosting solution |

---

## **Need Help?**

1. **Railway Issues**: Check Railway documentation
2. **DNS Problems**: Contact your domain registrar
3. **MongoDB Issues**: Check MongoDB Atlas status
4. **Code Problems**: Check server logs in Railway dashboard

---

## **Quick Start (Recommended)**

1. **Use Railway** - It's the fastest way to get live
2. **Use MongoDB Atlas** - Free, reliable database
3. **Follow the step-by-step guide above**
4. **Test everything** before going live

Your Uniform Palace website will be live at `https://uniformpalace.com` in no time! 🎉
