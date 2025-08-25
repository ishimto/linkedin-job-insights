let lastUrl = location.href;
let inFlightJobId = null;

console.log("LinkedIn Extractor: content loaded");

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "DATA_RESULT") {
    if (!msg.ok) {
      console.warn("data fetch failed:", msg.error);
      return;
    }
    if (typeof msg.applies === "number") {
      const date = formatTimestamp(msg.ts)
      renderApplies(date, msg.applies, msg.views);
    } else {
      removeApplies();
    }
  }
});

initUrlWatch();


function initUrlWatch() {
  hookHistoryChanges();
  window.addEventListener("locationchange", onUrlPotentiallyChanged);
  window.addEventListener("popstate", onUrlPotentiallyChanged);

  const mo = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      dispatchLocationChange();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  onUrlPotentiallyChanged();
}

function hookHistoryChanges() {
  if (window.__li_ext_history_hooked__) return;
  window.__li_ext_history_hooked__ = true;

  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function () {
    const ret = pushState.apply(this, arguments);
    dispatchLocationChange();
    return ret;
  };
  history.replaceState = function () {
    const ret = replaceState.apply(this, arguments);
    dispatchLocationChange();
    return ret;
  };
}

function dispatchLocationChange() {
  window.dispatchEvent(new Event("locationchange"));
}

function onUrlPotentiallyChanged() {
  const current = location.href;
  if (current === lastUrl) return;
  lastUrl = current;
  
  if (!/^\/jobs(\/|$)/.test(location.pathname)) {
    removeApplies();
    return;
  }

  const jobId = getCurrentJobIdFromUrl();
  if (jobId) {
    requestApplies(jobId);
  } else {
    removeApplies();
  }
}

function getCurrentJobIdFromUrl() {
  try {
    const u = new URL(location.href);
    return u.searchParams.get("currentJobId");
  } catch {
    return null;
  }
}

let lastRequestAt = 0;
function requestApplies(jobId) {
  const now = Date.now();

  if (inFlightJobId === jobId && now - lastRequestAt < 1000) return;

  inFlightJobId = jobId;
  lastRequestAt = now;

  chrome.runtime.sendMessage({ type: "FETCH_APPLIES", jobId });
}

function removeApplies() {
  const old = document.getElementById("linkedin-applies-display");
  if (old) old.remove();
}

function renderApplies(date, applies, views) {
  removeApplies();

  const el = document.createElement("div");
  el.id = "linkedin-applies-display";
  el.textContent = `🔎  Date Posted: ${date}   •   Total Applied: ${applies}   •   Views: ${views}`;
  el.style.whiteSpace = "pre";

  Object.assign(el.style, {
    marginTop: "12px",
    marginBottom: "8px",
    padding: "6px 10px",
    fontSize: "14px",
    fontWeight: "700",
    color: "#ffffff",
    backgroundColor: "#9C6925",
    borderRadius: "6px",
    border: "1px solid #ffffff",
    fontFamily: "Segoe UI, Arial, sans-serif",
    display: "inline-block"
  });

  const fitLevelBlock = document.querySelector(".job-details-fit-level-preferences");

  if (fitLevelBlock && fitLevelBlock.parentNode) {
    fitLevelBlock.parentNode.insertBefore(el, fitLevelBlock);
  } else {
    console.warn("Not Found: .job-details-fit-level-preferences – fallback");
    const h1 = document.querySelector(".jobs-unified-top-card h1, h1");
    if (h1) {
      h1.insertAdjacentElement("afterend", el);
    } else {
      document.body.appendChild(el);
    }
  }
}


function formatTimestamp(ts) {
  const date = new Date(ts);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}



