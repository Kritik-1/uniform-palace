#!/bin/bash

# 🚀 Uniform Palace Deployment Script
echo "🚀 Starting Uniform Palace Deployment..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Uniform Palace Business System"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Please create .env file with your configuration"
    echo "💡 You can copy from production.env as a template"
else
    echo "✅ Environment file found"
fi

# Check if images folder exists
if [ ! -d "images" ]; then
    echo "⚠️  Warning: images folder not found!"
    echo "📁 Please create images folder and add your images"
else
    echo "✅ Images folder found"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Push to GitHub: git remote add origin <your-repo-url>"
echo "2. Deploy to Railway: https://railway.app"
echo "3. Configure your domain: uniformpalace.com"
echo ""
echo "📚 See DEPLOYMENT_GUIDE.md for detailed instructions"
echo "✅ Deployment script completed!"
