# 🚀 GD App Deployment Guide

This guide walks you through deploying the GD (Group Discussion) app using:
- **Render** for the backend (Node.js server)
- **Vercel** for the frontend (static HTML)

---

## 📋 Pre-Deployment Checklist

- [x] `server.js` updated with environment variable support
- [x] `index.html` updated with configurable API_BASE
- [x] `render.yaml` created for Render
- [x] `vercel.json` created for Vercel
- [ ] Push code to GitHub
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Test the live application

---

## Step 1: Generate Base64 Credentials

Your GCP service account credentials need to be base64 encoded for cloud deployment.

### Run this command in your project directory:

```bash
base64 -i credentials.json | tr -d '\n' | pbcopy
```

This copies the base64 string to your clipboard. **Save this somewhere safe** - you'll need it for Render.

> ⚠️ **Security Note**: Never commit `credentials.json` to GitHub! Add it to `.gitignore`.

---

## Step 2: Prepare for GitHub

### 2.1 Update `.gitignore`

Make sure these are in your `.gitignore`:

```
node_modules/
credentials.json
.env
logs/
.DS_Store
```

### 2.2 Initialize Git (if not already done)

```bash
cd "/Users/rudrapatole/Desktop/GD AI agent/gd agent"
git init
git add .
git commit -m "Prepare for cloud deployment"
```

### 2.3 Push to GitHub

1. Create a new repository on [GitHub](https://github.com/new)
2. Name it something like `gd-app` or `gd-practice`
3. **Don't** initialize with README (you already have files)
4. Run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/gd-app.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy Backend to Render

### 3.1 Create Render Account
Go to [render.com](https://render.com) and sign up (free tier available).

### 3.2 Create New Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub account
3. Select your `gd-app` repository
4. Configure:
   - **Name**: `gd-backend` (or any name)
   - **Region**: `Oregon (US West)` (closest to us-central1)
   - **Branch**: `main`
   - **Root Directory**: leave empty
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free` (for testing)

### 3.3 Set Environment Variables

Click **Environment** and add these variables:

| Key | Value |
|-----|-------|
| `GCP_PROJECT_ID` | `gd-agent-482514` |
| `GCP_REGION` | `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | *(paste your base64 credentials from Step 1)* |
| `FRONTEND_URL` | `*` (update this after Vercel deployment) |

### 3.4 Deploy

Click **Create Web Service**. Render will build and deploy your backend.

Once deployed, you'll get a URL like:
```
https://gd-backend-xxxx.onrender.com
```

**Copy this URL** - you'll need it for the frontend!

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Update index.html with Backend URL

Before deploying, add this line to `public/index.html` **right after the opening `<body>` tag**:

```html
<body>
    <!-- Configure backend URL for production -->
    <script>
        window.API_BASE_URL = 'https://gd-backend-xxxx.onrender.com';  // Replace with your Render URL
    </script>
    
    <!-- Full-screen GD Background -->
    ...
```

Commit this change:
```bash
git add public/index.html
git commit -m "Add production backend URL"
git push
```

### 4.2 Create Vercel Account
Go to [vercel.com](https://vercel.com) and sign up (free tier available).

### 4.3 Deploy to Vercel

**Option A: Via Vercel CLI (Recommended)**

```bash
npm install -g vercel
cd "/Users/rudrapatole/Desktop/GD AI agent/gd agent/public"
vercel
```

Follow the prompts to deploy.

**Option B: Via Vercel Dashboard**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:
   - **Root Directory**: `public`
   - **Framework Preset**: Other
4. Click **Deploy**

### 4.4 Get Your Vercel URL

After deployment, you'll get a URL like:
```
https://gd-app.vercel.app
```

---

## Step 5: Update CORS (Final Step)

Go back to Render and update the `FRONTEND_URL` environment variable:

| Key | Value |
|-----|-------|
| `FRONTEND_URL` | `https://gd-app.vercel.app` *(your actual Vercel URL)* |

Render will automatically redeploy with the updated CORS configuration.

---

## ✅ Testing Your Deployment

1. Open your Vercel URL in a browser
2. Enter your name and select a genre
3. Start a GD session
4. Check browser console for any errors

### Common Issues:

| Issue | Solution |
|-------|----------|
| CORS errors | Make sure `FRONTEND_URL` in Render matches your Vercel URL exactly |
| 500 errors | Check Render logs for credential issues |
| WebSocket fails | Render free tier supports WebSockets, but check logs |
| Audio not playing | Make sure browser has permission for microphone/audio |

---

## 📊 Architecture Overview

```
┌─────────────────────┐     HTTPS      ┌─────────────────────┐
│                     │ ◄───────────► │                     │
│   Vercel (Frontend) │               │  Render (Backend)   │
│   - index.html      │    WSS        │  - server.js        │
│   - background.png  │ ◄───────────► │  - GCP APIs         │
│                     │               │                     │
└─────────────────────┘               └─────────────────────┘
                                              │
                                              ▼
                                      ┌───────────────┐
                                      │  Google Cloud │
                                      │  - Vertex AI  │
                                      │  - Speech API │
                                      │  - TTS API    │
                                      └───────────────┘
```

---

## 🔧 Local Development

For local development, you don't need to change anything:

```bash
npm start
```

Open `http://localhost:3000` - the app automatically uses local endpoints.

---

## 💡 Tips

1. **Free Tier Limits**: 
   - Render free tier spins down after 15 mins of inactivity
   - First request after spindown takes ~30-60 seconds

2. **Upgrade for Production**:
   - Render: Starter ($7/mo) for always-on
   - Consider adding a health check endpoint

3. **Monitoring**:
   - Check Render logs for backend issues
   - Use browser DevTools for frontend debugging

---

## 🎉 You're Done!

Your GD Practice app is now live! Share the Vercel URL with anyone who wants to practice group discussions.

**Need help?** Check the Render and Vercel documentation or open an issue on your GitHub repo.
