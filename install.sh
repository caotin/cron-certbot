#!/bin/bash

# install.sh - Install Nginx, Certbot, Certbot-Nginx plugin and Node.js 20
# This script supports Amazon Linux 2/2023 and Ubuntu systems
# Usage: sudo ./install.sh

# Check if script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo." >&2
    exit 1
fi

# Function to detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
        echo "Detected OS: $OS $VERSION"
    else
        echo "Unable to detect OS, exiting."
        exit 1
    fi
}

# Function to install Nginx, Certbot, and Node.js 20 on Amazon Linux
install_amazon_linux() {
    echo "Installing on Amazon Linux..."
    
    # Update system
    echo "Updating system packages..."
    yum update -y
    
    # Install Nginx
    echo "Installing Nginx..."
    amazon-linux-extras enable nginx1 >/dev/null 2>&1 || true  # For Amazon Linux 2
    yum install nginx -y
    
    # Install required dependencies
    echo "Installing dependencies..."
    yum install augeas-libs -y
    
    # Install EPEL repository (required for Certbot)
    echo "Installing EPEL repository..."
    amazon-linux-extras install epel -y >/dev/null 2>&1 || true  # For Amazon Linux 2
    if [ -z "$(command -v dnf)" ]; then
        # Amazon Linux 2
        yum install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
    else
        # Amazon Linux 2023
        dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
    fi
    
    # Install Certbot and Nginx plugin
    echo "Installing Certbot and Nginx plugin..."
    if [ -z "$(command -v dnf)" ]; then
        # Amazon Linux 2
        yum install certbot python-certbot-nginx -y
    else
        # Amazon Linux 2023
        dnf install certbot python3-certbot-nginx -y
    fi
    
    # Set up directories for Nginx if they don't exist
    echo "Setting up Nginx directory structure..."
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    
    # Configure Nginx to use sites-enabled directory if not already configured
    if ! grep -q "include /etc/nginx/sites-enabled/\*" /etc/nginx/nginx.conf; then
        echo "Updating Nginx configuration to use sites-enabled directory..."
        sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    fi
    
    # Install Node.js 20.x
    echo "Installing Node.js 20.x..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
    
    # Start and enable Nginx
    echo "Starting and enabling Nginx..."
    systemctl start nginx
    systemctl enable nginx
}

# Function to install Nginx, Certbot, and Node.js 20 on Ubuntu
install_ubuntu() {
    echo "Installing on Ubuntu..."
    
    # Update system
    echo "Updating system packages..."
    apt update && apt upgrade -y
    
    # Install Nginx
    echo "Installing Nginx..."
    apt install -y nginx
    
    # Install Certbot and Nginx plugin
    echo "Installing Certbot and Nginx plugin..."
    apt install -y certbot python3-certbot-nginx
    
    # Install Node.js 20.x
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Start and enable Nginx
    echo "Starting and enabling Nginx..."
    systemctl start nginx
    systemctl enable nginx
}

# Main installation function
main() {
    echo "Starting installation of Nginx, Certbot, and Node.js 20..."
    
    # Detect OS
    detect_os
    
    # Install based on OS
    case $OS in
        amzn)
            install_amazon_linux
            ;;
        ubuntu)
            install_ubuntu
            ;;
        *)
            echo "This script supports only Amazon Linux and Ubuntu."
            echo "Detected OS: $OS"
            exit 1
            ;;
    esac
    
    # Verify installations
    echo "Verifying installations..."
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx installed and running successfully."
    else
        echo "⚠️ Nginx installation may have issues. Please check manually."
    fi
    
    # Check Certbot
    if command -v certbot >/dev/null 2>&1; then
        echo "✅ Certbot installed successfully."
        echo "   Version: $(certbot --version)"
    else
        echo "⚠️ Certbot installation may have issues. Please check manually."
    fi
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        echo "✅ Node.js installed successfully."
        echo "   Version: $(node --version)"
    else
        echo "⚠️ Node.js installation may have issues. Please check manually."
    fi
    
    # Print success message
    echo ""
    echo "==============================================================="
    echo "Installation complete!"
    echo "Nginx, Certbot, and Node.js 20 have been installed on your system."
    echo ""
    echo "Next steps:"
    echo "1. Create an Nginx configuration for your site"
    echo "2. Use certbot to obtain SSL certificates"
    echo "3. Start developing with Node.js"
    echo ""
    echo "You can use the cron-certbot tool to manage your SSL certificates."
    echo "==============================================================="
}

# Run the main function
main