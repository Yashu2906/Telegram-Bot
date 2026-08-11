"use strict";

// ================================
// APPLICATION CONFIGURATION
// ================================
const CONFIG = {
  botUsername: "MyAd_Link_Bot",
  monetagEnabled: true,
  monetagSdkFunctionName: "show_11551467",
  interstitialAdCount: 1,
  requestVarPrefix: "ad_link",
  inAppInterstitialEnabled: false,
  inAppInterstitialSettings: {
    frequency: 1,
    capping: 1,
    interval: 120,
    timeout: 8,
    everyPage: false,
  },
};

const STORAGE_KEYS = {
  destination: "destination",
};

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
};

let adSequenceRunning = false;

init();

function init() {
  initTelegramWebApp();
  bindEvents();

  const startParam = getStartParam();

  if (!startParam) {
    showView("generator");
    return;
  }

  handleVisitorStartParam(startParam);
}

function initTelegramWebApp() {
  const webApp = getTelegramWebApp();

  if (!webApp) {
    return;
  }

  try {
    webApp.ready();
    webApp.expand();
  } catch (error) {
    // Telegram SDK can be present but unavailable in some browser previews.
  }
}

function bindEvents() {
  elements.generatorForm.addEventListener("submit", handleGenerateLink);
  elements.copyButton.addEventListener("click", handleCopyLink);
  elements.retryAdButton.addEventListener("click", handleRetryAd);
}

function handleGenerateLink(event) {
  event.preventDefault();
  setMessage(elements.generatorMessage, "");

  const input = elements.urlInput.value.trim();

  if (!input) {
    setMessage(elements.generatorMessage, "Please enter a URL.", "error");
    return;
  }

  const validation = validateHttpUrl(input);

  if (!validation.valid) {
    setMessage(elements.generatorMessage, validation.message, "error");
    return;
  }

  if (!isConfiguredBotUsername(CONFIG.botUsername)) {
    setMessage(
      elements.generatorMessage,
      "Please set your Telegram bot username in app.js first.",
      "error",
    );
    return;
  }

  const encodedDestination = encodeUrlSafeBase64(validation.url);
  const generatedUrl = createTelegramLink(encodedDestination);

  elements.generatedLink.value = generatedUrl;
  elements.copyButton.disabled = false;
  setMessage(
    elements.generatorMessage,
    "Link generated successfully.",
    "success",
  );
}

async function handleCopyLink() {
  const link = elements.generatedLink.value.trim();

  if (!link) {
    setMessage(
      elements.generatorMessage,
      "Generate a link before copying.",
      "error",
    );
    return;
  }

  try {
    await copyText(link);
    setMessage(elements.generatorMessage, "Link copied!", "success");
  } catch (error) {
    setMessage(
      elements.generatorMessage,
      "Copy failed. Please select and copy the link manually.",
      "error",
    );
  }
}

async function handleVisitorStartParam(startParam) {
  try {
    const decodedDestination = decodeUrlSafeBase64(startParam);
    const validation = validateHttpUrl(decodedDestination);

    if (!validation.valid) {
      throw new Error("Unsupported destination");
    }

    sessionStorage.setItem(STORAGE_KEYS.destination, validation.url);
  } catch (error) {
    sessionStorage.removeItem(STORAGE_KEYS.destination);
    showView("invalid");
    return;
  }

  showView("visitor");
  startInAppInterstitial();
  await showMonetagAdAndRedirect();
}

async function handleRetryAd() {
  await showMonetagAdAndRedirect();
}

async function showMonetagAdAndRedirect() {
  if (adSequenceRunning) {
    return;
  }

  adSequenceRunning = true;
  setMessage(elements.visitorMessage, "");
  setVisitorState("loading");

  const destination = sessionStorage.getItem(STORAGE_KEYS.destination);
  const validation = validateHttpUrl(destination || "");

  if (!validation.valid) {
    adSequenceRunning = false;
    setMessage(
      elements.visitorMessage,
      "This link is invalid or expired.",
      "error",
    );
    return;
  }

  if (!CONFIG.monetagEnabled) {
    adSequenceRunning = false;
    setVisitorState("error");
    setMessage(
      elements.visitorMessage,
      "Monetag is not configured yet.",
      "error",
    );
    return;
  }

  const showAd = getMonetagAdFunction();

  if (!showAd) {
    adSequenceRunning = false;
    setVisitorState("error");
    setMessage(
      elements.visitorMessage,
      "Unable to load the advertisement. Please try again.",
      "error",
    );
    return;
  }

  try {
    elements.retryAdButton.hidden = true;

    for (let adNumber = 1; adNumber <= CONFIG.interstitialAdCount; adNumber += 1) {
      elements.visitorSubtitle.textContent =
        CONFIG.interstitialAdCount > 1
          ? `Advertisement ${adNumber} of ${CONFIG.interstitialAdCount} loading...`
          : "Advertisement loading...";
      await showAd({
        type: "end",
        ymid: createAdEventId(adNumber),
        requestVar: `${CONFIG.requestVarPrefix}_${adNumber}`,
        catchIfNoFeed: true,
      });
    }

    setVisitorState("completed");
    setMessage(elements.visitorMessage, "Opening content...", "success");

    const storedDestination = sessionStorage.getItem(STORAGE_KEYS.destination);
    const redirectValidation = validateHttpUrl(storedDestination || "");

    if (!redirectValidation.valid) {
      throw new Error("Stored destination is invalid");
    }

    window.location.href = redirectValidation.url;
  } catch (error) {
    adSequenceRunning = false;
    setVisitorState("error");
    setMessage(
      elements.visitorMessage,
      "Unable to load the advertisement. Please try again.",
      "error",
    );
  }
}

function startInAppInterstitial() {
  if (!CONFIG.monetagEnabled || !CONFIG.inAppInterstitialEnabled) {
    return;
  }

  const showAd = getMonetagAdFunction();

  if (!showAd) {
    return;
  }

  showAd({
    type: "inApp",
    requestVar: `${CONFIG.requestVarPrefix}_in_app`,
    inAppSettings: CONFIG.inAppInterstitialSettings,
  }).catch(() => {
    // Keep the link flow working even if the optional in-app ad is unavailable.
  });
}

function getStartParam() {
  const webApp = getTelegramWebApp();
  const telegramStartParam =
    webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.start_param;

  if (typeof telegramStartParam === "string" && telegramStartParam.trim()) {
    return telegramStartParam.trim();
  }

  const params = new URLSearchParams(window.location.search);
  const fallbackKeys = ["tgWebAppStartParam", "startapp", "start_param"];
  const queryStartParam = getStartParamFromParams(params, fallbackKeys);

  if (queryStartParam) {
    return queryStartParam;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashStartParam = getStartParamFromParams(hashParams, fallbackKeys);

  if (hashStartParam) {
    return hashStartParam;
  }

  const encodedHashData = hashParams.get("tgWebAppData");

  if (encodedHashData) {
    const initDataParams = new URLSearchParams(encodedHashData);
    const initDataStartParam = initDataParams.get("start_param");

    if (initDataStartParam && initDataStartParam.trim()) {
      return initDataStartParam.trim();
    }
  }

  return "";
}

function getStartParamFromParams(params, fallbackKeys) {
  for (const key of fallbackKeys) {
    const value = params.get(key);

    if (value && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getTelegramWebApp() {
  return window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;
}

function getMonetagAdFunction() {
  if (
    !CONFIG.monetagSdkFunctionName ||
    CONFIG.monetagSdkFunctionName === "YOUR_MONETAG_FUNCTION"
  ) {
    return null;
  }

  const sdkFunction = window[CONFIG.monetagSdkFunctionName];
  return typeof sdkFunction === "function" ? sdkFunction : null;
}

function createAdEventId(adNumber) {
  const destination = sessionStorage.getItem(STORAGE_KEYS.destination) || "";
  const encodedDestination = encodeUrlSafeBase64(destination).slice(0, 18);
  const randomValue = Math.random().toString(36).slice(2, 10);

  return `${CONFIG.requestVarPrefix}_${adNumber}_${encodedDestination}_${Date.now()}_${randomValue}`;
}

function validateHttpUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        valid: false,
        message: "Please enter a valid HTTP or HTTPS URL.",
      };
    }

    return {
      valid: true,
      url: url.href,
    };
  } catch (error) {
    return {
      valid: false,
      message: "Please enter a valid HTTP or HTTPS URL.",
    };
  }
}

function encodeUrlSafeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeUrlSafeBase64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(paddingLength);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function createTelegramLink(encodedDestination) {
  return `https://t.me/${CONFIG.botUsername}?startapp=${encodedDestination}`;
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  elements.generatedLink.focus();
  elements.generatedLink.select();

  if (!document.execCommand("copy")) {
    throw new Error("Copy command failed");
  }
}

function showView(viewName) {
  elements.generatorView.hidden = viewName !== "generator";
  elements.visitorView.hidden = viewName !== "visitor";
  elements.invalidView.hidden = viewName !== "invalid";
}

function setMessage(element, text, type) {
  element.textContent = text;
  element.classList.remove("success", "error");

  if (type) {
    element.classList.add(type);
  }
}

function setVisitorState(state) {
  elements.retryAdButton.hidden = state !== "error";
  elements.retryAdButton.disabled = state !== "error";

  if (state === "completed") {
    elements.visitorTitle.textContent = "Ad completed.";
    elements.visitorSubtitle.textContent = "Opening content...";
    return;
  }

  if (state === "error") {
    elements.visitorTitle.textContent = "Unable to load the advertisement.";
    elements.visitorSubtitle.textContent = "Please try again.";
    return;
  }

  elements.visitorTitle.textContent = "Preparing your content...";
  elements.visitorSubtitle.textContent = "Advertisement loading...";
}

function isConfiguredBotUsername(username) {
  return Boolean(
    username &&
    username !== "YOUR_BOT_USERNAME" &&
    /^[A-Za-z0-9_]{5,32}$/.test(username),
  );
}
