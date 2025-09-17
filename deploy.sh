#!/bin/bash

echo "🚀 Building Next.js application for production..."

# Clean previous build
rm -rf out .next

# Build the application
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"

# Create fallback files for client-side routing
echo "🔧 Setting up client-side routing fallbacks..."

# Create _redirects file for Netlify
echo "/*    /index.html   200" > out/_redirects

# Create .htaccess file for Apache servers
cat > out/.htaccess << 'EOF'
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QR,L]
EOF

# Create nginx.conf snippet for nginx servers
cat > out/nginx.conf << 'EOF'
location / {
    try_files $uri $uri/ /index.html;
}
EOF

# Create vercel.json for Vercel deployment
cat > out/vercel.json << 'EOF'
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
EOF

echo "📁 Static files are ready in the 'out' directory"
echo ""
echo "🌐 Deployment Instructions:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Upload the 'out' directory contents to your web server"
echo "2. Configure your web server to:"
echo "   • Serve files from the 'out' directory"
echo "   • Fallback to index.html for all routes (SPA behavior)"
echo ""
echo "📋 Server Configuration Examples:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "• Apache: Use the generated .htaccess file"
echo "• Nginx: Use the configuration in nginx.conf"
echo "• Netlify: Use the _redirects file (automatically detected)"
echo "• Vercel: Use the vercel.json file"
echo ""
echo "✨ Build complete! Your application is ready for deployment."
