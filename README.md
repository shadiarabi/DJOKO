# DJOKO Pro Accounting System
## Setup Guide — GitHub + Supabase + Vercel

---

## STEP 1 — Set up Supabase database

1. Go to **supabase.com** and open your project
2. Click **SQL Editor** in the left menu
3. Click **New query**
4. Open the file `supabase_schema.sql` from this folder
5. Copy ALL the content and paste it into the SQL editor
6. Click **Run** (green button)
7. You should see: "Success. No rows returned"

Now get your keys:
1. Go to **Project Settings** → **API**
2. Copy your **Project URL** (looks like: https://abcdefgh.supabase.co)
3. Copy your **anon public** key (long string starting with eyJ...)
4. Keep these — you need them in Step 3

---

## STEP 2 — Push to GitHub

1. Go to **github.com** → click the **+** button → **New repository**
2. Name it: `djoko-accounting`
3. Set to **Public** (required for free Vercel)
4. Click **Create repository**
5. Upload ALL files from this folder:
   - index.html
   - vercel.json
   - supabase_schema.sql
   - README.md
   - .gitignore
   (Do NOT upload .env file)

OR use Git commands:
```
git init
git add .
git commit -m "DJOKO Accounting System"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/djoko-accounting.git
git push -u origin main
```

---

## STEP 3 — Deploy on Vercel

1. Go to **vercel.com** → click **Add New Project**
2. Click **Import** next to your `djoko-accounting` repository
3. On the configuration page, click **Environment Variables**
4. Add these two variables:

   | Name | Value |
   |------|-------|
   | VITE_SUPABASE_URL | https://YOUR_PROJECT_ID.supabase.co |
   | VITE_SUPABASE_ANON_KEY | your-anon-key-here |

5. Click **Deploy**
6. Wait ~1 minute
7. Vercel gives you a URL like: `https://djoko-accounting.vercel.app`

---

## STEP 4 — Share with your team

Send the Vercel URL to everyone in your company.
- All users see the **same data** in real time
- Works on any browser, any device, any computer
- No installation needed

---

## Notes

- Data is stored safely in Supabase (PostgreSQL database)
- Vercel re-deploys automatically when you push changes to GitHub
- Free tier: Supabase = 500MB, Vercel = unlimited requests
- To update the app: edit index.html → push to GitHub → Vercel auto-deploys

---

## Files in this project

| File | Purpose |
|------|---------|
| index.html | The complete app (all HTML, CSS, JS) |
| supabase_schema.sql | Run this in Supabase to create all tables |
| vercel.json | Vercel routing config |
| .gitignore | Prevents .env from being uploaded |
| .env.example | Template for environment variables |
| README.md | This guide |
