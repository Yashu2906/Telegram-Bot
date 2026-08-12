# Telegram Ad-Link Generator Mini App

A lightweight private Telegram Mini App for generating monetized Telegram deep links.

Version 1 does not use a database, backend, Node.js, bundler, or paid hosting. It stores the destination URL inside the Telegram `startapp` parameter as URL-safe Base64.

## Features

- Static HTML, CSS, and vanilla JavaScript only
- Generator mode for creating Telegram ad links
- Visitor mode for links opened with a `startapp` parameter
- URL-safe Base64 encoding with UTF-8 support
- HTTP/HTTPS-only redirect validation
- Telegram Mini App SDK initialization
- Browser fallback for local testing
- Monetag Rewarded Interstitial integration placeholder
- No fake ads, fake impressions, timers, or redirects without Monetag success

## Architecture

The app is intentionally not a traditional shortener.

Instead of creating short database-backed links like `https://example.com/a8K29`, it creates Telegram Mini App links like:

```text
https://t.me/YOUR_BOT_USERNAME?startapp=ENCODED_DESTINATION
```

When the Mini App opens with a start parameter, it decodes the destination, validates it, stores it in `sessionStorage`, shows a minimal visitor loading screen, and automatically starts the Monetag ad. The redirect happens only after the official Monetag SDK Promise resolves successfully.

## Folder Structure

```text
telegram-ad-link/
|-- index.html
|-- style.css
|-- app.js
|-- README.md
`-- .gitignore
```

No `worker/worker.js` is included in Version 1 because a Cloudflare Worker is not required for the static generator and visitor flow.

## Local Development

You can open `index.html` directly in a browser.

For a local server, run one of these from the project folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

No `npm install` is needed.

## Configuration

Open `app.js` and update:

```js
const CONFIG = {
  botUsername: "YOUR_BOT_USERNAME",
  monetagEnabled: false,
  monetagSdkFunctionName: "YOUR_MONETAG_FUNCTION",
  interstitialAdCount: 2,
  requestVarPrefix: "ad_link",
  inAppInterstitialEnabled: false
};
```

Replace `YOUR_BOT_USERNAME` with your bot username without `@`.

Example:

```js
botUsername: "MyAdLinkBot"
```

Do not put your Telegram bot token in this project.

## Telegram Bot Creation

1. Open Telegram.
2. Search for `@BotFather`.
3. Send `/newbot`.
4. Follow BotFather's prompts.
5. Copy the bot username.
6. Paste that username into `CONFIG.botUsername` in `app.js`.

Never paste the BotFather token into frontend JavaScript.

## Telegram Mini App Setup

1. Deploy the static files to Cloudflare Pages.
2. Copy your Cloudflare Pages URL, for example:

```text
https://telegram-ad-link.pages.dev
```

3. Open `@BotFather`.
4. Use `/mybots`.
5. Select your bot.
6. Go to Bot Settings.
7. Configure the Mini App or menu button.
8. Set the Mini App URL to your Cloudflare Pages URL.

Telegram direct Mini App links with a non-empty `startapp` value pass that value to the Mini App as `Telegram.WebApp.initDataUnsafe.start_param` and as the `tgWebAppStartParam` URL parameter.

## Cloudflare Pages Deployment

1. Create a free Cloudflare account.
2. Go to Workers & Pages.
3. Create a Pages project.
4. Upload this folder or connect a Git repository.
5. Use these settings:

```text
Build command: none
Build output directory: /
```

6. Deploy.
7. Use the generated Pages URL as your Telegram Mini App URL.

## Monetag Setup

1. Create or open your Monetag publisher account.
2. Add your Telegram Mini App according to Monetag's current instructions.
3. Create the Telegram Mini App SDK ad zone.
4. Copy the official SDK script tag generated in your Monetag dashboard.
5. Paste that script tag into `index.html` in the `MONETAG SDK TAG` section.
6. Copy the generated SDK function name, such as `show_123456`.
7. Paste it into `CONFIG.monetagSdkFunctionName`.
8. Set `CONFIG.monetagEnabled` to `true`.

Example shape:

```js
const CONFIG = {
  botUsername: "MyAdLinkBot",
  monetagEnabled: true,
  monetagSdkFunctionName: "show_123456",
  interstitialAdCount: 2,
  requestVarPrefix: "ad_link",
  inAppInterstitialEnabled: false
};
```

Use your real function name from Monetag. Do not use `show_123456` unless Monetag actually generated that exact name for you.

## Monetag SDK Integration

The app calls the Monetag SDK automatically after a valid visitor link is detected. `interstitialAdCount: 2` means it requires two successful Monetag calls before redirecting. Each call gets a unique `ymid` and `requestVar`:

```js
await showAd({
  type: "end",
  ymid: "unique-event-id",
  requestVar: "ad_link_1"
});
```

The redirect happens only after both Promises resolve. If the SDK is missing, disabled, unavailable, skipped, has no feed, or rejects, the user stays inside the Mini App and sees an error.

There is no fake ad, countdown, repeated refresh, automatic click, or simulated ad completion. If the ad fails, the app shows a legitimate retry button that calls the real Monetag SDK again.

## Optional In-App Interstitial

Monetag's Telegram Mini Apps SDK documents Rewarded Interstitial, Rewarded Popup, and In-App Interstitial formats. It does not create a normal inline HTML banner from an empty `<div>`.

If your Monetag account supports In-App Interstitial and you want to enable that official format, set:

```js
inAppInterstitialEnabled: true
```

Keep it `false` for the simplest flow: two rewarded interstitial ads, then redirect.

## Testing

### Test 1

Open `index.html`.

Expected: Generator appears.

### Test 2

Enter:

```text
https://example.com
```

Expected: A valid Telegram link is generated after `CONFIG.botUsername` is set.

### Test 3

Enter:

```text
hello
```

Expected: Invalid URL error.

### Test 4

Enter:

```text
javascript:alert(1)
```

Expected: Rejected.

### Test 5

Open a generated link inside Telegram.

Expected: Visitor loading screen appears, the generator does not appear, and Monetag starts automatically when configured.

### Test 6

Start parameter missing.

Expected: Generator screen appears.

### Test 7

Open:

```text
index.html?tgWebAppStartParam=invalid
```

Expected: Invalid-link screen.

### Test 8

Keep `monetagEnabled: false`.

Expected: No fake ad and no automatic redirect.

### Test 9

Set Monetag up with the real SDK tag and function name.

Expected: Real Monetag ad opens automatically inside Telegram after the link is decoded.

### Test 10

Complete the Monetag ad.

Expected: Original URL opens.

### Test 11

Force Monetag failure or use an unavailable ad.

Expected: User remains in the Mini App, sees an error, and can press Try Again.

## Browser Visitor Testing

After generating a link, copy only the value after `startapp=`.

Open:

```text
http://localhost:8000?tgWebAppStartParam=PASTE_ENCODED_VALUE_HERE
```

Expected: Visitor mode appears.

## Troubleshooting

If link generation says the bot username is not configured, replace `YOUR_BOT_USERNAME` in `app.js`.

If Telegram opens the generator instead of visitor mode, confirm the link has a non-empty `startapp` parameter.

If Monetag says it is not configured, paste the official Monetag SDK tag into `index.html`, set `monetagEnabled: true`, and set the exact generated function name in `app.js`.

If the ad fails, test inside the real Telegram mobile app and confirm your Monetag zone ID and SDK function name match the dashboard.

If copy does not work in a direct file browser, use a local server or manually select the generated link. Some browsers restrict clipboard access outside secure contexts.

## Security Notes

- This frontend contains no Telegram bot token.
- This frontend contains no private Monetag keys.
- The redirect destination is validated before storage and again before redirecting.
- Only `http:` and `https:` URLs are allowed.
- Client-side Telegram user IDs are useful for UI decisions, but they are not strong authentication.
- For secure owner-only generator access, add a tiny Cloudflare Worker later to validate Telegram `initData` with the official Telegram validation procedure. Keep the bot token only in Worker environment variables.

## Limitations

- Generated links can become long because the destination URL is encoded inside `startapp`.
- There is no database or link history.
- There is no strong owner authentication in Version 1.
- Browser testing cannot fully reproduce Telegram WebView or Monetag ad behavior.

## Future Improvements

- Optional Cloudflare Worker for secure owner-only generator access
- Optional short-code storage if you later want links like `https://yourdomain.com/a8K29`
- Optional postback handling for deeper Monetag event verification
- Optional owner allowlist after secure Telegram init data validation
