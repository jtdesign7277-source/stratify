# Signup UI sandbox

**Approximate** standalone preview of the Stratify sign-up layout (no auth, no Supabase).  
It is **not** the exact sign-up page and is **not** kept in sync when you edit the real page.

## Source of truth

- **Real sign-up page:** `src/components/auth/SignUpPage.jsx`
- **What gets deployed when you push:** The main app, which uses that component at `/auth`.

When you edit `SignUpPage.jsx` and push/commit, only the main app (and production) update. This sandbox does **not** auto-update — it’s a static snapshot for quick local preview without running the full app.

## When to use what

| Goal | Use |
|------|-----|
| See the **exact** sign-up page (what you’ll deploy) | Run the main app and open `/auth`: `npm run dev` → http://localhost:5173/auth |
| Quick layout check without starting the app | This sandbox (approximate only) |

## Run the sandbox

```bash
cd signup-sandbox
python3 -m http.server 5177
```

Then open http://localhost:5177 (or Cursor: **Cmd+Shift+P** → "Simple Browser: Show" → that URL).

## Sign in on localhost

The sandbox only redirects to the real app; it does not sign you in. To sign in locally:

1. Run the **main app**: from the project root run `npm run dev`, then open **http://localhost:5173/auth**.
2. Ensure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so the app can reach Supabase.
3. If you see "Can't reach the server", check your connection and that the main app is running on 5173.
