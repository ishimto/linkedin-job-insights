// --- SPA Navigation Hook ---
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.url.includes("/jobs/")) {
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content.js"]
    }).catch((e) => console.error("Injection error:", e));
  }
}, { url: [{ hostContains: "linkedin.com" }] });

async function getCsrfToken() {
  const candidates = [
    { url: "https://www.linkedin.com/", name: "JSESSIONID" },
    { url: "https://www.linkedin.com/", name: "bcookie" }
  ];

  const cookie = await chrome.cookies.get(candidates[0]).catch(() => null);
  if (cookie && cookie.value) {
    return cookie.value.replace(/^"|"$/g, "");
  }

  const cookie2 = await chrome.cookies.get(candidates[1]).catch(() => null);
  return cookie2 ? cookie2.value.replace(/^"|"$/g, "") : null;
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "FETCH_APPLIES" || !msg.jobId) return;

  (async () => {
    const csrf = await getCsrfToken();
    if (!csrf) {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "DATA_RESULT",
          ok: false,
          error: "Missing CSRF (JSESSIONID) cookie"
        });
      }
      return;
    }

    const url = `https://www.linkedin.com/voyager/api/jobs/jobPostings/${msg.jobId}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "accept": "application/json",
          "x-restli-protocol-version": "2.0.0",
          "csrf-token": csrf
        }
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      const applies = data?.applies ?? null;
      const views = data?.views ?? null;
      const ts = data?.listedAt ?? null;

      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "DATA_RESULT",
          ok: true,
          ts,
          applies,
          views,
          jobId: msg.jobId
        });
      }
    } catch (e) {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "DATA_RESULT",
          ok: false,
          error: String(e)
        });
      }
    }
  })();
});

