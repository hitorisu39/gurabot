server {
    listen 80;
    server_name auth.gurabot.com;

    root /var/www/your-discord-bot/public; 

    location / {
        try_files $uri $uri/ =404;
    }

    location /callback/osu {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}