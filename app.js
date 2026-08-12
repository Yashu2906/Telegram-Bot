"use strict";

/* =========================================================
   CONFIGURATION
========================================================= */

const CONFIG = {
  /*
    Telegram bot username.

    IMPORTANT:
    Do NOT include @

    Correct:
    MyAd_Link_Bot

    Incorrect:
    @MyAd_Link_Bot
  */

  botUsername: "MyAd_Link_Bot",

  /*
    Monetag
  */

  monetagEnabled: true,

  /*
    This MUST match:

    data-sdk="show_11551467"

    in index.html
  */

  monetagSdkFunctionName: "show_11551467",

  /*
    Maximum time to wait for Monetag SDK
    to create the show_11551467 function.
  */

  monetagSdkTimeoutMs: 15000,
};

/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEYS = {
  destination: "telegram_ad_destination",
};

/* =========================================================
   DOM ELEMENTS
========================================================= */

const elements = {
  generatorView: document.querySelector("#generatorView"),

  visitorView: document.querySelector("#visitorView"),

  invalidView: document.querySelector("#invalidView"),

  generatorForm: document.querySelector("#generatorForm"),

  urlInput: document.querySelector("#urlInput"),

  generatedLink: document.querySelector("#generatedLink"),

  copyButton: document.querySelector("#copyButton"),

  generatorMessage: document.querySelector("#generatorMessage"),

  visitorTitle: document.querySelector("#visitorTitle"),

  visitorSubtitle: document.querySelector("#visitorSubtitle"),

  retryAdButton: document.querySelector("#retryAdButton"),

  visitorMessage: document.querySelector("#visitorMessage"),

  invalidMessage: document.querySelector("#invalidMessage"),
};

/* =========================================================
   STATE
========================================================= */

let adRunning = false;

/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener("DOMContentLoaded", init);

function init() {
  console.log("[APP] Starting application...");

  initializeTelegram();

  bindEvents();

  const startParam = getStartParam();

  console.log("[APP] startParam:", startParam);

  /*
    No start parameter
    =
    OWNER / GENERATOR MODE
  */

  if (!startParam) {
    console.log("[APP] Generator mode");

    showView("generator");

    return;
  }

  /*
    start parameter exists
    =
    VISITOR MODE
  */

  console.log("[APP] Visitor mode");

  handleVisitor(startParam);
}

/* =========================================================
   TELEGRAM INITIALIZATION
========================================================= */

function initializeTelegram() {
  const telegram = getTelegramWebApp();

  if (!telegram) {
    console.log("[TELEGRAM] Telegram SDK not detected.");

    return;
  }

  try {
    telegram.ready();

    telegram.expand();

    console.log("[TELEGRAM] WebApp initialized.");
  } catch (error) {
    console.error("[TELEGRAM] Initialization error:", error);
  }
}

/* =========================================================
   GET TELEGRAM WEB APP
========================================================= */

function getTelegramWebApp() {
  if (window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }

  return null;
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  /*
    Generator
  */

  elements.generatorForm.addEventListener("submit", handleGenerateLink);

  /*
    Copy
  */

  elements.copyButton.addEventListener("click", handleCopyLink);

  /*
    Watch ad
  */

  elements.retryAdButton.addEventListener("click", handleAdButton);
}

/* =========================================================
   GENERATE TELEGRAM LINK
========================================================= */

function handleGenerateLink(event) {
  event.preventDefault();

  clearMessage(elements.generatorMessage);

  const input = elements.urlInput.value.trim();

  if (!input) {
    showMessage(elements.generatorMessage, "Please enter a URL.", "error");

    return;
  }

  const validation = validateHttpUrl(input);

  if (!validation.valid) {
    showMessage(elements.generatorMessage, validation.message, "error");

    return;
  }

  if (!isValidBotUsername(CONFIG.botUsername)) {
    showMessage(
      elements.generatorMessage,
      "Please configure your Telegram bot username in app.js.",
      "error",
    );

    return;
  }

  try {
    const encodedDestination = encodeUrlSafeBase64(validation.url);

    const telegramLink = createTelegramLink(encodedDestination);

    elements.generatedLink.value = telegramLink;

    elements.copyButton.disabled = false;

    showMessage(
      elements.generatorMessage,
      "Link generated successfully.",
      "success",
    );

    console.log("[GENERATOR] Generated link:", telegramLink);
  } catch (error) {
    console.error("[GENERATOR] Error:", error);

    showMessage(
      elements.generatorMessage,
      "Could not generate the link.",
      "error",
    );
  }
}

/* =========================================================
   COPY LINK
========================================================= */

async function handleCopyLink() {
  const link = elements.generatedLink.value.trim();

  if (!link) {
    return;
  }

  try {
    await copyText(link);

    showMessage(
      elements.generatorMessage,
      "Link copied successfully.",
      "success",
    );
  } catch (error) {
    console.error("[COPY] Error:", error);

    showMessage(
      elements.generatorMessage,
      "Copy failed. Please copy the link manually.",
      "error",
    );
  }
}

/* =========================================================
   VISITOR
========================================================= */

function handleVisitor(startParam) {
  try {
    /*
      Decode destination
    */

    const destination = decodeUrlSafeBase64(startParam);

    console.log("[VISITOR] Destination:", destination);

    /*
      Validate destination
    */

    const validation = validateHttpUrl(destination);

    if (!validation.valid) {
      throw new Error("Invalid destination URL");
    }

    /*
      Store destination
    */

    sessionStorage.setItem(STORAGE_KEYS.destination, validation.url);

    /*
      Show visitor page
    */

    showView("visitor");

    setVisitorState("ready");

    console.log("[VISITOR] Destination accepted.");
  } catch (error) {
    console.error("[VISITOR] Invalid link:", error);

    sessionStorage.removeItem(STORAGE_KEYS.destination);

    showView("invalid");
  }
}

/* =========================================================
   MONETAG BUTTON
========================================================= */

async function handleAdButton() {
  /*
    Prevent double clicks
  */

  if (adRunning) {
    return;
  }

  adRunning = true;

  elements.retryAdButton.disabled = true;

  setVisitorState("loading");

  clearMessage(elements.visitorMessage);

  try {
    /*
      Get destination
    */

    const destination = sessionStorage.getItem(STORAGE_KEYS.destination);

    const validation = validateHttpUrl(destination || "");

    if (!validation.valid) {
      throw new Error("Destination is invalid.");
    }

    /*
      Check Monetag enabled
    */

    if (!CONFIG.monetagEnabled) {
      throw new Error("Monetag is disabled.");
    }

    /*
      Wait for SDK
    */

    console.log("[MONETAG] Waiting for SDK...");

    const showAd = await waitForMonetag();

    if (!showAd) {
      throw new Error("Monetag SDK function was not found.");
    }

    console.log("[MONETAG] SDK ready:", CONFIG.monetagSdkFunctionName);

    /*
      Unique event ID
    */

    const ymid = createYmid();

    console.log("[MONETAG] Starting Rewarded Interstitial...");

    console.log("[MONETAG] ymid:", ymid);

    /*
      START MONETAG AD

      Monetag documentation:

      show_XXX({
        ymid: "..."
      }).then(...)
    */

    await showAd({
      ymid: ymid,

      requestVar: "telegram_redirect",
    });

    /*
      IMPORTANT

      If Promise resolves,
      Monetag reports that the
      Rewarded Interstitial completed.
    */

    console.log("[MONETAG] Advertisement completed.");

    setVisitorState("completed");

    showMessage(
      elements.visitorMessage,
      "Advertisement completed. Opening content...",
      "success",
    );

    /*
      Small UI transition.
    */

    await wait(500);

    /*
      Get destination again
    */

    const finalDestination = sessionStorage.getItem(STORAGE_KEYS.destination);

    const finalValidation = validateHttpUrl(finalDestination || "");

    if (!finalValidation.valid) {
      throw new Error("Destination is invalid.");
    }

    /*
      REDIRECT
    */

    console.log("[REDIRECT]", finalValidation.url);

    window.location.replace(finalValidation.url);
  } catch (error) {
    console.error("[MONETAG] Advertisement failed:", error);

    adRunning = false;

    elements.retryAdButton.disabled = false;

    setVisitorState("error");

    showMessage(
      elements.visitorMessage,
      "Advertisement could not be loaded. Please try again.",
      "error",
    );
  }
}

/* =========================================================
   WAIT FOR MONETAG SDK
========================================================= */

function waitForMonetag() {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const interval = window.setInterval(() => {
      const functionName = CONFIG.monetagSdkFunctionName;

      const sdkFunction = window[functionName];

      /*
              SDK loaded
            */

      if (typeof sdkFunction === "function") {
        window.clearInterval(interval);

        resolve(sdkFunction);

        return;
      }

      /*
              Timeout
            */

      if (Date.now() - startTime >= CONFIG.monetagSdkTimeoutMs) {
        window.clearInterval(interval);

        resolve(null);
      }
    }, 100);
  });
}

/* =========================================================
   CREATE UNIQUE MONETAG EVENT ID
========================================================= */

function createYmid() {
  const telegram = getTelegramWebApp();

  let telegramUserId = "anonymous";

  if (telegram && telegram.initDataUnsafe && telegram.initDataUnsafe.user) {
    telegramUserId = String(telegram.initDataUnsafe.user.id);
  }

  const random = Math.random().toString(36).substring(2, 10);

  return ["telegram", telegramUserId, Date.now(), random].join("_");
}

/* =========================================================
   TELEGRAM START PARAMETER
========================================================= */

function getStartParam() {
  const telegram = getTelegramWebApp();

  /*
    Telegram's official
    Mini App parameter
  */

  if (telegram && telegram.initDataUnsafe) {
    const value = telegram.initDataUnsafe.start_param;

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  /*
    Browser testing
  */

  const searchParams = new URLSearchParams(window.location.search);

  const searchKeys = ["tgWebAppStartParam", "startapp", "start_param"];

  for (const key of searchKeys) {
    const value = searchParams.get(key);

    if (value && value.trim()) {
      return value.trim();
    }
  }

  /*
    Hash fallback
  */

  const hash = window.location.hash.replace(/^#/, "");

  if (hash) {
    const hashParams = new URLSearchParams(hash);

    for (const key of searchKeys) {
      const value = hashParams.get(key);

      if (value && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

/* =========================================================
   URL VALIDATION
========================================================= */

function validateHttpUrl(value) {
  try {
    const url = new URL(value);

    /*
      Only HTTP / HTTPS
    */

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        valid: false,

        message: "Only HTTP and HTTPS URLs are allowed.",
      };
    }

    return {
      valid: true,

      url: url.href,
    };
  } catch {
    return {
      valid: false,

      message: "Please enter a valid URL.",
    };
  }
}

/* =========================================================
   BASE64 ENCODING
========================================================= */

function encodeUrlSafeBase64(value) {
  const bytes = new TextEncoder().encode(value);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")

    .replace(/\//g, "_")

    .replace(/=+$/, "");
}

/* =========================================================
   BASE64 DECODING
========================================================= */

function decodeUrlSafeBase64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");

  const padding = (4 - (normalized.length % 4)) % 4;

  const padded = normalized + "=".repeat(padding);

  const binary = atob(padded);

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

/* =========================================================
   CREATE TELEGRAM LINK
========================================================= */

function createTelegramLink(encodedDestination) {
  return (
    "https://t.me/" + CONFIG.botUsername + "?startapp=" + encodedDestination
  );
}

/* =========================================================
   COPY TEXT
========================================================= */

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);

    return;
  }

  elements.generatedLink.focus();

  elements.generatedLink.select();

  const success = document.execCommand("copy");

  if (!success) {
    throw new Error("Copy failed.");
  }
}

/* =========================================================
   VIEW
========================================================= */

function showView(view) {
  elements.generatorView.hidden = view !== "generator";

  elements.visitorView.hidden = view !== "visitor";

  elements.invalidView.hidden = view !== "invalid";
}

/* =========================================================
   VISITOR STATE
========================================================= */

function setVisitorState(state) {
  /*
    READY
  */

  if (state === "ready") {
    elements.visitorTitle.textContent = "Ready to continue";

    elements.visitorSubtitle.textContent =
      "Watch the advertisement to unlock the content.";

    elements.retryAdButton.hidden = false;

    elements.retryAdButton.disabled = false;

    elements.retryAdButton.textContent = "Continue & Watch Ad";

    return;
  }

  /*
    LOADING
  */

  if (state === "loading") {
    elements.visitorTitle.textContent = "Advertisement loading...";

    elements.visitorSubtitle.textContent = "Please wait.";

    elements.retryAdButton.hidden = true;

    return;
  }

  /*
    COMPLETED
  */

  if (state === "completed") {
    elements.visitorTitle.textContent = "Advertisement completed";

    elements.visitorSubtitle.textContent = "Opening your content...";

    elements.retryAdButton.hidden = true;

    return;
  }

  /*
    ERROR
  */

  if (state === "error") {
    elements.visitorTitle.textContent = "Advertisement unavailable";

    elements.visitorSubtitle.textContent = "Please try again.";

    elements.retryAdButton.hidden = false;

    elements.retryAdButton.disabled = false;

    elements.retryAdButton.textContent = "Try Again";

    return;
  }
}

/* =========================================================
   MESSAGE
========================================================= */

function showMessage(element, text, type = "") {
  element.textContent = text;

  element.classList.remove("success", "error");

  if (type) {
    element.classList.add(type);
  }
}

function clearMessage(element) {
  showMessage(element, "");
}

/* =========================================================
   BOT USERNAME VALIDATION
========================================================= */

function isValidBotUsername(username) {
  return Boolean(
    username &&
    username !== "YOUR_BOT_USERNAME" &&
    /^[A-Za-z0-9_]{5,32}$/.test(username),
  );
}

/* =========================================================
   WAIT
========================================================= */

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
