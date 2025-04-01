require('dotenv').config();
const cron = require('node-cron');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Environment variables with defaults
const EMAIL_NOTIFICATIONS = process.env.EMAIL_NOTIFICATIONS === 'true';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const EMAIL_TO = process.env.EMAIL_TO || '';
const EMAIL_SMTP_HOST = process.env.EMAIL_SMTP_HOST || '';
const EMAIL_SMTP_PORT = process.env.EMAIL_SMTP_PORT || 587;
const EMAIL_SMTP_USER = process.env.EMAIL_SMTP_USER || '';
const EMAIL_SMTP_PASS = process.env.EMAIL_SMTP_PASS || '';
const CERT_CHECK_SCHEDULE = process.env.CERT_CHECK_SCHEDULE || '0 0 * * *'; // Daily at midnight by default
const CERTBOT_COMMAND = process.env.CERTBOT_COMMAND || 'sudo certbot renew --non-interactive';
const DAYS_BEFORE_EXPIRY = parseInt(process.env.DAYS_BEFORE_EXPIRY || '30', 10);
const CERT_DIRECTORY = process.env.CERT_DIRECTORY || '/etc/letsencrypt/live';
const LOG_FILE = process.env.LOG_FILE || 'certbot-renewal.log';
const RESTART_NGINX = process.env.RESTART_NGINX === 'true';
const NGINX_RESTART_COMMAND = process.env.NGINX_RESTART_COMMAND || 'sudo systemctl restart nginx';

// Configure email transporter if notifications are enabled
let transporter = null;
if (EMAIL_NOTIFICATIONS) {
  transporter = nodemailer.createTransport({
    host: EMAIL_SMTP_HOST,
    port: EMAIL_SMTP_PORT,
    secure: EMAIL_SMTP_PORT === 465,
    auth: {
      user: EMAIL_SMTP_USER,
      pass: EMAIL_SMTP_PASS
    }
  });
}

// Function to log messages
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  
  console.log(message);
  
  fs.appendFile(LOG_FILE, logEntry, (err) => {
    if (err) console.error('Error writing to log file:', err);
  });
}

// Function to send email notifications
async function sendNotification(subject, message) {
  if (!EMAIL_NOTIFICATIONS || !transporter) return;
  
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: subject,
      text: message
    });
    logMessage(`Notification email sent: ${subject}`);
  } catch (error) {
    logMessage(`Failed to send email notification: ${error.message}`);
  }
}

// Function to check certificate expiration
function checkCertificateExpiration() {
  fs.readdir(CERT_DIRECTORY, (err, domains) => {
    if (err) {
      logMessage(`Error reading certificate directory: ${err.message}`);
      return;
    }

    domains.forEach(domain => {
      // Skip files (we only want directories)
      const domainPath = path.join(CERT_DIRECTORY, domain);
      if (!fs.statSync(domainPath).isDirectory()) return;
      
      const certPath = path.join(domainPath, 'cert.pem');
      
      // Check if certificate file exists
      if (!fs.existsSync(certPath)) {
        logMessage(`Certificate file not found for domain: ${domain}`);
        return;
      }
      
      // Use OpenSSL to check certificate expiration
      exec(`openssl x509 -enddate -noout -in ${certPath}`, (error, stdout, stderr) => {
        if (error) {
          logMessage(`Error checking certificate for ${domain}: ${error.message}`);
          return;
        }
        
        // Parse the expiry date
        const match = stdout.match(/notAfter=(.+)/);
        if (!match) {
          logMessage(`Failed to parse expiry date for ${domain}`);
          return;
        }
        
        const expiryDate = new Date(match[1]);
        const now = new Date();
        const daysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        logMessage(`Certificate for ${domain} expires in ${daysRemaining} days (${expiryDate.toISOString()})`);
        
        // Check if certificate is nearing expiration
        if (daysRemaining <= DAYS_BEFORE_EXPIRY) {
          logMessage(`Certificate for ${domain} is expiring soon. Triggering renewal.`);
          renewCertificates();
          
        }
      });
    });
  });
}

// Function to renew certificates
function renewCertificates() {
  logMessage('Starting certificate renewal process');
  
  exec(CERTBOT_COMMAND, (error, stdout, stderr) => {
    if (error) {
      const errorMessage = `Certificate renewal failed: ${error.message}\n${stderr}`;
      logMessage(errorMessage);
      sendNotification('Certificate Renewal Failed', errorMessage);
      return;
    }
    
    const successMessage = `Certificate renewal completed successfully\n${stdout}`;
    logMessage(successMessage);
    
    // Restart Nginx if enabled
    if (RESTART_NGINX) {
      logMessage('Restarting Nginx server');
      
      exec(NGINX_RESTART_COMMAND, (nginxError, nginxStdout, nginxStderr) => {
        if (nginxError) {
          const nginxErrorMessage = `Nginx restart failed: ${nginxError.message}\n${nginxStderr}`;
          logMessage(nginxErrorMessage);
          sendNotification('Certificate Renewal Successful, but Nginx Restart Failed', 
            `${successMessage}\n\n${nginxErrorMessage}`);
        } else {
          const completeMessage = `${successMessage}\n\nNginx restarted successfully`;
          logMessage('Nginx restarted successfully');
          sendNotification('Certificate Renewal and Nginx Restart Successful', completeMessage);
        }
      });
    } else {
      sendNotification('Certificate Renewal Successful', successMessage);
    }
  });
}

// Start the cron job
logMessage(`Starting certificate renewal service with schedule: ${CERT_CHECK_SCHEDULE}`);
cron.schedule(CERT_CHECK_SCHEDULE, () => {
  logMessage('Running scheduled certificate check');
  checkCertificateExpiration();
});

// Run an initial check when starting
logMessage('Running initial certificate check');
checkCertificateExpiration(); 