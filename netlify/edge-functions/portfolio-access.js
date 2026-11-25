const COOKIE_NAME = "yvn-portfolio-session";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64Url(new Uint8Array(signature));
}

function sameSignature(left, right) {
  if (!left || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function responseHeaders() {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, private",
    "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff",
  };
}

function gatePage({ error = false, status = 200, message = "Enter the portfolio PIN to continue." } = {}) {
  const errorMessage = error ? '<p class="error" role="alert">' + message + "</p>" : "";
  const html = '<!doctype html><html lang="en"><head><meta charset="UTF-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    '<meta name="robots" content="noindex, nofollow" /><title>Private Portfolio | House of YVN</title>' +
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />' +
    '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Italiana&display=swap" rel="stylesheet" />' +
    '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#211914;color:#f3eee5;font-family:"DM Sans",sans-serif;font-weight:300}.gate{width:min(100%,520px);padding:clamp(32px,7vw,72px);border:1px solid rgba(184,154,101,.4);background:linear-gradient(145deg,rgba(184,154,101,.08),transparent 58%)}.brand{margin:0 0 52px;font-family:Italiana,serif;font-size:20px;letter-spacing:.16em}.brand i{color:#b89a65}.eyebrow{margin:0 0 20px;color:#b89a65;font-size:9px;font-weight:500;letter-spacing:.25em;text-transform:uppercase}.eyebrow:before{content:"";display:inline-block;width:28px;height:1px;margin:0 12px 3px 0;background:#b89a65}h1{margin:0;font-family:Italiana,serif;font-size:clamp(44px,10vw,70px);font-weight:400;line-height:.98}h1 em{color:#b89a65;font-weight:400}.intro{margin:24px 0 36px;color:rgba(243,238,229,.72);font-size:14px}.field-label{display:block;margin-bottom:10px;font-size:9px;letter-spacing:.18em;text-transform:uppercase}input{width:100%;height:52px;padding:0 15px;border:1px solid rgba(243,238,229,.35);border-radius:0;background:rgba(255,255,255,.04);color:#f3eee5;font:inherit;font-size:18px;letter-spacing:.3em}input:focus{outline:2px solid #b89a65;outline-offset:3px}.submit{width:100%;margin-top:15px;padding:15px;border:1px solid #b89a65;background:#b89a65;color:#211914;font:inherit;font-size:10px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}.submit:hover{background:#d2bb8f}.error{margin:0 0 16px;color:#f1b8b3;font-size:13px}.back{display:inline-block;margin-top:30px;color:rgba(243,238,229,.65);font-size:9px;letter-spacing:.16em;text-decoration:none;text-transform:uppercase}.back:hover{color:#f3eee5}</style>' +
    '</head><body><main class="gate"><p class="brand">HOUSE <i>of</i> YVN</p>' +
    '<p class="eyebrow">Private client portfolio</p><h1>The YVN case<br /><em>files.</em></h1>' +
    '<p class="intro">' + message + '</p>' + errorMessage +
    '<form method="post" action="/portfolio/"><label class="field-label" for="portfolio-pin">Portfolio PIN</label>' +
    '<input id="portfolio-pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" pattern="[0-9]{4}" maxlength="4" required autofocus aria-describedby="pin-help" />' +
    '<span id="pin-help" class="sr-only">Enter the four-digit portfolio PIN.</span>' +
    '<button class="submit" type="submit">View the case files <span aria-hidden="true">↗</span></button></form>' +
    '<a class="back" href="/">Return to House of YVN</a></main></body></html>';
  return new Response(html, { status, headers: responseHeaders() });
}

function readCookie(request, name) {
  const prefix = name + "=";
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : "";
}

async function hasValidSession(request, secret) {
  const parts = readCookie(request, COOKIE_NAME).split(".");
  if (parts.length !== 2) return false;
  const expiresAtText = parts[0];
  const signature = parts[1];
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return sameSignature(signature, await sign(expiresAtText, secret));
}

function redirectWithCookie(request, cookie) {
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/portfolio/", request.url).toString(),
      "cache-control": "no-store, private",
      "set-cookie": cookie,
    },
  });
}

export default async (request, context) => {
  const pin = Netlify.env.get("YVN_PORTFOLIO_PIN");
  const sessionSecret = Netlify.env.get("YVN_PORTFOLIO_SESSION_SECRET");
  if (!pin || !sessionSecret) {
    return gatePage({ error: true, status: 503, message: "Portfolio access is temporarily unavailable. Please try again later." });
  }

  if (request.method === "POST") {
    const form = new URLSearchParams(await request.text());
    if (form.get("action") === "lock") {
      return redirectWithCookie(request, COOKIE_NAME + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict");
    }

    if (form.get("pin") !== pin) {
      return gatePage({ error: true, status: 401, message: "That PIN didn’t match. Please try again." });
    }

    const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
    const signature = await sign(expiresAt, sessionSecret);
    const sessionCookie = COOKIE_NAME + "=" + expiresAt + "." + signature + "; Path=/; Max-Age=" + SESSION_SECONDS + "; Secure; HttpOnly; SameSite=Strict";
    return redirectWithCookie(request, sessionCookie);
  }

  if (!(await hasValidSession(request, sessionSecret))) {
    const isPortfolioAsset = new URL(request.url).pathname.startsWith("/assets/portfolio/");
    if (isPortfolioAsset) return Response.redirect(new URL("/portfolio/", request.url).toString(), 303);
    return gatePage();
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
