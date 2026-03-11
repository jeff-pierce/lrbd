# LRBD Tracker

Simple React + Vite dashboard for tracking daily and weekly LRBD outreach metrics, synced with Supabase.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Start dev server:

```bash
npm run dev
```

## Build

```bash
npm run build
```

The production output is generated in `dist`.

## Deploy To Netlify

Use these settings when creating the site:

- Build command: `npm run build`
- Publish directory: `dist`

Add these environment variables in Netlify (Site settings -> Environment variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After setting variables, trigger a deploy.
