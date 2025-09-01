# 🚀 Quick Setup Guide - Uniform Palace Business System

## 📋 Prerequisites
- **Node.js** (v16 or higher) - Download from [nodejs.org](https://nodejs.org/)
- **MongoDB** - Local installation or MongoDB Atlas account
- **Git** (optional) - For version control

## ⚡ Quick Start (Windows)

### Option 1: Double-click to start
1. **Double-click** `start.bat` file
2. The system will automatically:
   - Install dependencies
   - Create necessary folders
   - Start the server
3. Open your browser to `http://localhost:5000`

### Option 2: PowerShell (Recommended)
1. **Right-click** `start.ps1` → "Run with PowerShell"
2. Follow the on-screen instructions
3. Open your browser to `http://localhost:5000`

## ⚡ Quick Start (Mac/Linux)
```bash
# Make script executable
chmod +x start.sh

# Run the script
./start.sh
```

## 🔧 Manual Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Environment File
```bash
# Copy the example config
cp config.env.example .env

# Edit .env with your settings
# Most important: MONGODB_URI and JWT_SECRET
```

### 3. Create Directories
```bash
mkdir uploads
mkdir logs
```

### 4. Start the System
```bash
npm start
```

## 🌐 Access Your System

- **Website**: http://localhost:5000
- **Admin API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 👤 First Login

After starting the system, you'll have a default admin account:
- **Username**: `admin`
- **Password**: `admin123`
- **Email**: `admin@uniformpalace.com`

⚠️ **Important**: Change the default password immediately!

## 🗄️ Database Setup

### Local MongoDB
1. Install MongoDB Community Edition
2. Start MongoDB service
3. Update `.env` with: `MONGODB_URI=mongodb://localhost:27017/uniform-palace`

### MongoDB Atlas (Cloud)
1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a cluster
3. Get connection string
4. Update `.env` with your Atlas connection string

## 📧 Email Setup (Optional)

To enable email notifications:
1. Get Gmail app password
2. Update `.env` with your email credentials
3. Test email functionality

## 🚀 Production Deployment

### 1. Update Environment
```bash
NODE_ENV=production
PORT=80
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-super-secure-secret
```

### 2. Use PM2 for Process Management
```bash
npm install -g pm2
pm2 start server.js --name "uniform-palace"
pm2 startup
pm2 save
```

## 🔍 Troubleshooting

### Common Issues

**Port already in use**
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <process-id> /F
```

**MongoDB connection failed**
- Check if MongoDB is running
- Verify connection string in `.env`
- Check firewall settings

**Module not found errors**
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Check System Status
```bash
# Check if server is running
curl http://localhost:5000/api/health

# Check logs
tail -f logs/app.log
```

## 📞 Need Help?

1. **Check the logs** in `logs/app.log`
2. **Verify your `.env` configuration**
3. **Ensure MongoDB is running**
4. **Check browser console for frontend errors**

## 🎯 Next Steps

1. ✅ **System is running** - You're here!
2. 🔐 **Login to admin panel** - Change default password
3. 👥 **Add your team members** - Create user accounts
4. 📊 **Import your data** - Add customers, products, orders
5. 🎨 **Customize the website** - Update branding and content
6. 🚀 **Go live** - Share with your customers

---

**🎉 Congratulations! Your Uniform Palace Business System is now running!**

*Transform your uniform business from traditional to digital with this comprehensive management system.*
