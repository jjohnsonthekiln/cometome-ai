# ComeToMe.ai — Deployment Guide

## File Structure

```
/
├── index.html              ← Frontend chat interface
└── functions/
    └── api/
        └── chat.js         ← Cloudflare Pages Function (secure API proxy)
```

## Deploy to Cloudflare Pages

### Step 1 — Push to GitHub
Create a new GitHub repository and push these files:
```bash
git init
git add .
git commit -m "Initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/cometome-ai
git push -u origin main
```

### Step 2 — Create Cloudflare Pages Project
1. Go to Cloudflare Dashboard → **Pages** → **Create a project**
2. Connect your GitHub account and select your repository
3. Build settings:
   - **Framework preset**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/` *(root)*
4. Click **Save and Deploy**

### Step 3 — Add Your Anthropic API Key
1. In your Pages project → **Settings** → **Environment variables**
2. Add a variable:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: your Anthropic API key (from console.anthropic.com)
   - **Environment**: Production
3. Click **Save** and **trigger a new deployment** (Deployments → Retry)

### Step 4 — Connect cometome.ai
1. In your Pages project → **Custom domains** → **Set up a custom domain**
2. Enter `cometome.ai`
3. Since your DNS is already in Cloudflare, it will configure automatically

## That's it

The `/api/chat` endpoint is handled automatically by the Pages Function.
Your Anthropic API key never touches the browser — it lives only in the Worker.

## Notes

- The app works on any device. Mobile-first, tested on iPhone Safari.
- The opening message is hardcoded in `index.html` for instant load — no spinner.
- Conversation history is held in memory per session. Refreshing starts fresh.
- To change the model, edit `chat.js` line: `model: 'claude-sonnet-4-6'`
  Options: `claude-opus-4-6` (best quality), `claude-sonnet-4-6` (fast + good)
