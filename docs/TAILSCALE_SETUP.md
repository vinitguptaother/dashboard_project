# Remote Phone Access via Tailscale

**One-time setup to use the dashboard from your phone when you're away from home.**

Phase 6 deliverable #6. MASTER_PLAN §9 "Localhost hosting playbook".

---

## What is Tailscale?

Tailscale is a free, zero-config mesh VPN. It puts your desktop and your phone on a
private network only *you* can see. No public port forwarding, no router tweaks,
no custom domain.

- **Free personal plan** — up to 100 devices.
- **End-to-end encrypted** over WireGuard.
- **No traffic leaves your devices** except the direct phone ⇄ desktop path.
- **External traffic is blocked by default.**
- Install once, forget about it.

> The alternative (exposing `localhost:3000` to the public internet via ngrok /
> Cloudflare Tunnel) is a security risk: your Upstox token + MongoDB could be
> probed by strangers. Tailscale keeps it strictly private.

---

## Step-by-step

### 1. Sign up

1. Go to **https://tailscale.com**.
2. Click **Get started for free**.
3. Sign in with Google / Microsoft / Apple / GitHub.

### 2. Install on the desktop (Windows)

1. Download the Windows installer from https://tailscale.com/download/windows.
2. Run the installer; accept defaults.
3. A green Tailscale icon appears in the system tray.
4. Click it → **Log in**. Sign in with the same account as step 1.
5. Tailscale assigns this machine a name like `vinit-desktop` and a private IP
   (e.g. `100.xx.xx.xx`).

Leave Tailscale running in the tray — it auto-starts with Windows.

### 3. Install on the phone

#### iPhone
1. App Store → search **Tailscale** → Install.
2. Open it → Log in with the same account.

#### Android
1. Play Store → search **Tailscale** → Install.
2. Open it → Log in with the same account.

Both devices now belong to your "tailnet" and can see each other.

### 4. Find your desktop's Tailscale name

- Tailscale tray → **Admin console** (opens browser)
- OR go to https://login.tailscale.com/admin/machines
- You'll see a list. Note the **Machine** column: it's something like
  `vinit-desktop`.

Tailscale's **MagicDNS** means you can use this name instead of the IP — no
number-memorizing needed.

### 5. Access the dashboard from your phone

- Make sure the backend + frontend are running on your desktop (`npm run dev` +
  `npm run backend:dev`).
- On your phone, open Safari / Chrome.
- Go to **`http://vinit-desktop:3000`**
  (replace `vinit-desktop` with whatever name step 4 showed).

You should see the dashboard. Login, holdings, everything works just like home.

### 6. Install the PWA (Phase 6)

While viewing the dashboard on your phone:

- **iPhone**: Tap the **Share** icon → **Add to Home Screen**.
- **Android**: Tap the **⋮ menu** → **Add to Home Screen** / **Install App**.

An "AI Dashboard" icon appears on your home screen. Tapping it opens the
dashboard full-screen, no browser chrome.

---

## Troubleshooting

### "Can't reach the site"

1. Confirm backend + frontend are running on desktop (`localhost:3000` works on
   desktop itself).
2. Tailscale tray → ensure it says **Connected**.
3. On phone, Tailscale app → confirm it's **On**.
4. Try the raw IP first: `http://100.x.x.x:3000` (copy from admin console).
5. If raw IP works but MagicDNS doesn't, enable MagicDNS in admin console
   → DNS tab.

### "Connection refused on port 3000"

- Windows Firewall may be blocking. Open **Windows Defender Firewall → Allow an
  app** → Allow **Node.js** on **Private networks**.

### "Token expired" when phone connects

- This is just the Upstox market data token — reconnect from Settings as usual.
  Tailscale itself doesn't expire.

---

## Security notes

- Only devices logged into YOUR Tailscale account can reach the dashboard.
- If you lose your phone, go to the Tailscale admin console → Machines → remove
  the phone. It can no longer reach your desktop.
- Tailscale does NOT make your dashboard publicly accessible. It's only a
  private link between your own devices.
- Upstox tokens and MongoDB stay on the desktop — phone just renders the
  webpage.

---

## Why not a public URL?

A public URL (via ngrok, Cloudflare Tunnel, port forwarding, etc.) would work
but comes with real downsides:

| Concern | Public URL | Tailscale |
|---|---|---|
| Random internet scanners | Can probe it | Cannot see it |
| SEBI compliance | More exposure | Only your devices |
| Setup effort | Domain + TLS cert | 5 min, no config |
| Cost | $0–$10/mo | Free personal |
| Risk if Upstox token leaks | Anyone can query | Only your tailnet |

For a single-user personal dashboard, Tailscale is the right choice.

---

## FAQ

**Q: Does my phone need to be on the same Wi-Fi?**
No. The whole point is remote access — works on cellular data too.

**Q: Does the desktop need to be awake?**
Yes. Tailscale can't wake a sleeping machine. Use Windows Power settings to
keep the desktop awake while you're at work.

**Q: Can my family use the dashboard?**
Not without adding them to your Tailnet (Tailscale → Users → Invite). Even
then, they only see your dashboard, no other network resources.

**Q: Does Tailscale see my trades?**
No. Tailscale is just the network transport — same as Wi-Fi. They don't decrypt
traffic, and we send no analytics to them.
