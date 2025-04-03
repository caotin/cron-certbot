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
const NGINX_CONFIG_PATH = '/etc/nginx/sites-available';
const NGINX_ENABLED_PATH = '/etc/nginx/sites-enabled';

// Create Nginx configuration
function createNginxConfig() {
  const { domain, port } = argv;
  const configPath = path.join(NGINX_CONFIG_PATH, domain);

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
    fs.writeFileSync(configPath, configTemplate);
    console.log(`✅ Nginx configuration created at: ${configPath}`);
    return true;
  } catch (err) {
    console.error(`❌ Error creating Nginx config: ${err.message}`);
    console.error('You might need to run this script with sudo privileges');
    return false;
  }
}

// Create symlink in sites-enabled
function enableNginxConfig() {
  const { domain } = argv;
  const configPath = path.join(NGINX_CONFIG_PATH, domain);
  const symlinkPath = path.join(NGINX_ENABLED_PATH, domain);
  
  console.log('Enabling Nginx configuration...');
  
  try {
    // Remove existing symlink if it exists
    if (fs.existsSync(symlinkPath)) {
      fs.unlinkSync(symlinkPath);
    }
    
    fs.symlinkSync(configPath, symlinkPath);
    console.log(`✅ Nginx configuration enabled with symlink: ${symlinkPath}`);
    return true;
  } catch (err) {
    console.error(`❌ Error enabling Nginx config: ${err.message}`);
    console.error('You might need to run this script with sudo privileges');
    return false;
  }
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