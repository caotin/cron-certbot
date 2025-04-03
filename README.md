# Automatic Certbot Certificate Renewal

This Node.js application automatically monitors and renews Let's Encrypt SSL certificates using Certbot.

## Features

- Scheduled checking of SSL certificate expiration dates
- Automatic renewal of certificates nearing expiration
- Automatic Nginx restart after certificate renewal
- Email notifications for successful renewals and failures
- Configurable settings via environment variables
- Detailed logging
- Nginx configuration generator with SSL setup

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Certbot installed on your system
- OpenSSL installed on your system
- Let's Encrypt certificates already set up with Certbot
- Sudo privileges for running certbot and restarting nginx

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/cron-certbot.git
   cd cron-certbot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file by copying the example:
   ```
   cp .env.example .env
   ```

4. Edit the `.env` file with your preferred settings

## Configuration

All settings can be configured via environment variables:

### Email Notifications

- `EMAIL_NOTIFICATIONS`: Enable/disable email notifications (`true` or `false`)
- `EMAIL_FROM`: Sender email address
- `EMAIL_TO`: Recipient email address
- `EMAIL_SMTP_HOST`: SMTP server hostname
- `EMAIL_SMTP_PORT`: SMTP server port
- `EMAIL_SMTP_USER`: SMTP username
- `EMAIL_SMTP_PASS`: SMTP password

### Certificate Renewal Settings

- `CERT_CHECK_SCHEDULE`: Cron schedule for certificate checks (default: `0 0 * * *` - daily at midnight)
- `CERTBOT_COMMAND`: Command to execute for renewal (default: `sudo certbot renew --non-interactive`)
- `DAYS_BEFORE_EXPIRY`: Number of days before expiry to trigger renewal (default: `30`)
- `CERT_DIRECTORY`: Directory where certificates are stored (default: `/etc/letsencrypt/live`)
- `LOG_FILE`: Path to log file (default: `certbot-renewal.log`)

### Nginx Settings

- `RESTART_NGINX`: Enable/disable Nginx restart after renewal (`true` or `false`)
- `NGINX_RESTART_COMMAND`: Command to restart Nginx (default: `sudo systemctl restart nginx`)

## Usage

Start the application:

```
npm start
```

For production use, it's recommended to use a process manager like PM2:

```
npm install -g pm2
pm2 start index.js --name cron-certbot
pm2 save
pm2 startup
```

## Nginx Config Generator

This project includes a script to automatically generate Nginx configuration files with proxy pass settings and SSL setup.

### Using the Nginx Config Generator

The `create.js` script generates an Nginx configuration that proxies traffic to a local port, and sets up SSL with Let's Encrypt certificates.

#### Basic Usage

```bash
sudo node create.js --domain your-domain.com --port 8080
```

This will:
1. Create an Nginx config file in `/etc/nginx/sites-available/your-domain.com`
2. Create a symlink in `/etc/nginx/sites-enabled/your-domain.com`
3. Reload Nginx to apply the changes
4. Set up SSL using certbot

#### Command Line Options

- `--domain`, `-d`: The domain name to configure (required)
- `--port`, `-p`: The local port to proxy to (required)
- `--ssl`: Whether to set up SSL with certbot (defaults to true)
- `--email`: Email address for Let's Encrypt notifications (optional)

#### Examples

Generate config with SSL:
```bash
sudo node create.js --domain example.com --port 3000 --email admin@example.com
```

Generate config without SSL:
```bash
sudo node create.js --domain example.com --port 3000 --ssl false
```

#### Running with npm

You can also use the npm script:

```bash
sudo npm run create-nginx-config -- --domain example.com --port 8080
```

#### Requirements

- Script must be run with sudo permissions
- Nginx must be installed and configured with sites-available/sites-enabled structure
- For SSL setup, certbot must be installed
- Domain DNS must be configured to point to your server

## Logs

Check the log file (default: `certbot-renewal.log`) for detailed information about certificate checks and renewals.

## Running as a Service

To run this as a system service, you can create a systemd service file:

```bash
sudo nano /etc/systemd/system/cron-certbot.service
```

Add the following content:

```
[Unit]
Description=Automatic Certbot Certificate Renewal
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/cron-certbot
ExecStart=/usr/bin/node /path/to/cron-certbot/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=cron-certbot

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable cron-certbot
sudo systemctl start cron-certbot
```

## Sudo Configuration

Since this script needs to run commands with sudo, you might need to configure your sudoers file to allow running certbot and nginx restart commands without a password prompt:

```bash
sudo visudo
```

Add the following line (replace `username` with the user running the script):

```
username ALL=(ALL) NOPASSWD: /usr/bin/certbot, /bin/systemctl restart nginx
```

## License

MIT