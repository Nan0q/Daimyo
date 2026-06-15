# Deploying Daimyo to daimyo.gg

Daimyo is a Node.js + Socket.io game. It needs an **always-on Node server with
WebSocket support** — NOT a static/serverless host (no Netlify, GitHub Pages, or
plain Vercel). Pick ONE of the two paths below.

---

## Option A — Easiest: Railway or Render (managed, git-based)

Great for getting live in ~15 minutes with automatic HTTPS.

1. Push this project to a **GitHub** repo.
   ```bash
   git init && git add . && git commit -m "Daimyo"
   git branch -M main
   git remote add origin https://github.com/<you>/daimyo.git
   git push -u origin main
   ```
2. Create a **Web Service** on https://railway.app or https://render.com and point
   it at the repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - It auto-detects the port from `process.env.PORT`.
3. Add your domain:
   - In the service settings → **Custom Domains** → add `daimyo.gg` (and `www.daimyo.gg`).
   - The platform shows a DNS target. At your domain registrar (where you bought
     daimyo.gg) add:
     - `CNAME  www   → <target>.up.railway.app` (or render's target)
     - For the root `daimyo.gg`, use the registrar's **ALIAS/ANAME** record to the
       same target (or an `A` record to the IP they give you).
4. SSL is issued automatically. Done.

> ⚠️ **Persistence note:** on Render's free tier (and similar) the filesystem is
> wiped on each deploy, so `users.json` / `seen.json` reset. For permanent player
> names + stats, attach a **persistent disk/volume** (Render "Disk", Railway
> "Volume") mounted at `/app/server`, or move that data to a database later.
> Also run a **single instance** — Socket.io with multiple instances needs a
> Redis adapter, which we don't have yet.

---

## Option B — Most control: a VPS (DigitalOcean, Hetzner, Linode ~$5/mo)

Full control, real persistence, cheap. Steps on a fresh **Ubuntu 22.04** box.

1. **DNS first.** At your registrar point daimyo.gg at the server's IP:
   - `A   @    → <server-ip>`
   - `A   www  → <server-ip>`

2. **Install Node + Nginx + PM2** on the server:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx
   sudo npm install -g pm2
   ```

3. **Get the code & run it** with PM2 (keeps it alive + restarts on reboot):
   ```bash
   git clone https://github.com/<you>/daimyo.git
   cd daimyo
   npm install --omit=dev
   PORT=3000 pm2 start server/index.js --name daimyo
   pm2 save && pm2 startup    # run the command it prints
   ```

4. **Nginx reverse proxy with WebSocket upgrade** — create
   `/etc/nginx/sites-available/daimyo`:
   ```nginx
   server {
     listen 80;
     server_name daimyo.gg www.daimyo.gg;

     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;        # <-- required for Socket.io
       proxy_set_header Connection "upgrade";         # <-- required for Socket.io
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_read_timeout 86400;
     }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/daimyo /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Free SSL** with Let's Encrypt:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d daimyo.gg -d www.daimyo.gg
   ```
   Certbot edits the Nginx config for HTTPS and auto-renews.

6. **Updating later:**
   ```bash
   cd daimyo && git pull && npm install --omit=dev && pm2 restart daimyo
   ```

Here `users.json` / `seen.json` live on the server's real disk, so player names
and the monthly count persist across restarts. ✅

---

## Or with Docker (any of the above, containerized)

A `Dockerfile` is included. Build & run:
```bash
docker build -t daimyo .
docker run -d -p 3000:3000 -v $(pwd)/server:/app/server --name daimyo daimyo
```
Mounting `-v .../server:/app/server` keeps `users.json` / `seen.json` on the host.

---

## Why HTTPS matters here
- The wallet gate uses MetaMask + a Base RPC; browsers require a **secure origin**
  for full wallet behavior, and Socket.io upgrades to **wss://** under HTTPS.
- All three options above give you HTTPS, so the wallet flow and live multiplayer
  work on `https://daimyo.gg`.

## Checklist
- [ ] App reachable on a Node host (Railway/Render/VPS), single instance
- [ ] daimyo.gg + www.daimyo.gg DNS pointed at it
- [ ] HTTPS issued (auto on PaaS / Certbot on VPS)
- [ ] WebSocket upgrade headers present (PaaS handles it; Nginx config above)
- [ ] `server/users.json` + `server/seen.json` on persistent storage
