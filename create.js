#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('domain', {
    alias: 'd',
    description: 'Domain name for the Nginx config',
    type: 'string',
    demandOption: true
  })
  .option('port', {
    alias: 'p',
    description: 'Local port to proxy to',
    type: 'number',
    demandOption: true
  })
  .option('ssl', {
    description: 'Generate SSL certificate with certbot',
    type: 'boolean',
    default: true
  })
  .option('email', {
    description: 'Email for Let\'s Encrypt notifications',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Settings
const NGINX_CONFIG_PATH = '/etc/nginx/conf.d';
const NGINX_ENABLED_PATH = '';

// Create Nginx configuration
function createNginxConfig() {
  const { domain, port } = argv;
  const configPath = path.join(NGINX_CONFIG_PATH, `${domain}.conf`);

  // Basic configuration template
  const configTemplate = `server {
    listen 80;
    server_name ${domain};
    
    location / {
        proxy_pass http://localhost:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;

  console.log(`Creating Nginx configuration for ${domain} -> localhost:${port}`);
  
  try {
    // Check if file exists and notify about override
    if (fs.existsSync(configPath)) {
      console.log(`Config file already exists at ${configPath}. Overriding...`);
    }
    
    fs.writeFileSync(configPath, configTemplate);
    console.log(`✅ Nginx configuration created at: ${configPath}`);
    return true;
  } catch (err) {
    console.error(`❌ Error creating Nginx config: ${err.message}`);
    console.error('You might need to run this script with sudo privileges');
    return false;
  }
}

// Create symlink in sites-enabled (simplified for Amazon Linux/RHEL setup)
function enableNginxConfig() {
  // In Amazon Linux/RHEL Nginx setup, we don't need symlinks
  // The .conf files in /etc/nginx/conf.d/ are automatically loaded
  console.log('Nginx configuration is automatically loaded from conf.d directory');
  return true;
}

// Reload Nginx to apply changes
function reloadNginx() {
  console.log('Reloading Nginx...');
  
  try {
    execSync('nginx -t', { stdio: 'inherit' });
    execSync('systemctl reload nginx', { stdio: 'inherit' });
    console.log('✅ Nginx reloaded successfully');
    return true;
  } catch (err) {
    console.error('❌ Error reloading Nginx');
    return false;
  }
}

// Set up SSL with certbot
function setupSSL() {
  const { domain, email } = argv;
  const emailFlag = email ? `--email ${email}` : '--register-unsafely-without-email';
  
  console.log(`Setting up SSL certificate for ${domain}...`);
  
  try {
    const certbotCommand = `certbot --nginx -d ${domain} ${emailFlag} --agree-tos --redirect --non-interactive`;
    execSync(certbotCommand, { stdio: 'inherit' });
    console.log(`✅ SSL certificate successfully installed for ${domain}`);
    return true;
  } catch (err) {
    console.error('❌ Error setting up SSL certificate');
    return false;
  }
}

// Check if running as root
function checkRoot() {
  try {
    return process.getuid && process.getuid() === 0;
  } catch (e) {
    // If getuid is not available, we're probably on Windows
    return false;
  }
}

// Main function
function main() {
  if (!checkRoot()) {
    console.warn('⚠️  Warning: This script may require root privileges to modify Nginx configurations.');
    console.warn('Consider running with: sudo node create.js --domain example.com --port 8080');
  }

  const configCreated = createNginxConfig();
  
  if (configCreated) {
    const configEnabled = enableNginxConfig();
    
    if (configEnabled) {
      reloadNginx();
      
      // Set up SSL if enabled
      if (argv.ssl) {
        setupSSL();
      } else {
        console.log('SSL setup skipped');
      }
    }
  }
}

// Run the script
main();