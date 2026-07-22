function slugify(title, date) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const year = date ? date.slice(0, 4) : "";
  return year ? `${base}-${year}` : base;
}

function extractPageInfo() {
  // Runs inside the Mixcloud page. Mixcloud's title tag is usually
  // "Mix Name by Username | Mixcloud" — strip the site suffix as a
  // starting guess; the popup lets you correct it either way.
  const title = document.title.replace(/\s*\|\s*Mixcloud\s*$/i, "");
  const timeEl = document.querySelector("time[datetime]");
  const date = timeEl ? timeEl.getAttribute("datetime").slice(0, 10) : "";
  return { title, date };
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const urls = await chrome.runtime.sendMessage({ type: "getCaptured", tabId: tab.id });

  const emptyEl = document.getElementById("empty");
  const formEl = document.getElementById("form");

  if (!urls || urls.length === 0) {
    emptyEl.style.display = "block";
    formEl.style.display = "none";
    return;
  }

  emptyEl.style.display = "none";
  formEl.style.display = "block";

  const urlSelect = document.getElementById("url");
  urlSelect.innerHTML = "";
  urls.forEach((url) => {
    const option = document.createElement("option");
    option.value = url;
    option.textContent = url.length > 60 ? `${url.slice(0, 57)}...` : url;
    urlSelect.appendChild(option);
  });

  const titleInput = document.getElementById("title");
  const dateInput = document.getElementById("date");
  const slugInput = document.getElementById("slug");

  let pageInfo = { title: "", date: "" };
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageInfo,
    });
    pageInfo = result;
  } catch (err) {
    // Not on a page we can inject into (e.g. the CDN request happened
    // in a background tab) — leave fields blank for manual entry.
  }

  titleInput.value = pageInfo.title || "";
  dateInput.value = pageInfo.date || "";
  slugInput.value = slugify(pageInfo.title || "", pageInfo.date || "");

  const updateSlug = () => {
    slugInput.value = slugify(titleInput.value, dateInput.value);
  };
  titleInput.addEventListener("input", updateSlug);
  dateInput.addEventListener("input", updateSlug);

  const statusEl = document.getElementById("status");
  const flashStatus = (msg) => {
    statusEl.style.color = "#2f9e44";
    statusEl.textContent = msg;
    setTimeout(() => (statusEl.textContent = ""), 2000);
  };

  const HELPER_URL = "http://127.0.0.1:8787";

  document.getElementById("launch").addEventListener("click", async () => {
    const launchBtn = document.getElementById("launch");
    launchBtn.disabled = true;

    try {
      const health = await fetch(`${HELPER_URL}/health`).catch(() => null);
      if (!health || !health.ok) {
        throw new Error(
          "Helper server not running. In the mixhoster repo, run: node scripts/recover-server.js"
        );
      }

      statusEl.style.color = "#333";
      statusEl.textContent = "Downloading + transcoding... this can take a minute.";

      const response = await fetch(`${HELPER_URL}/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugInput.value,
          title: titleInput.value,
          date: dateInput.value,
          url: urlSelect.value,
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error);
      }

      statusEl.style.color = "#2f9e44";
      statusEl.textContent = `Done — ${result.outPath.split("/").pop()} uploaded to R2 and added to mixes.json.`;
    } catch (err) {
      statusEl.style.color = "#e03131";
      statusEl.textContent = err.message;
    } finally {
      launchBtn.disabled = false;
    }
  });

  document.getElementById("copy").addEventListener("click", () => {
    const command = `scripts/recover-mix.sh ${slugInput.value} "${titleInput.value}" ${dateInput.value} "${urlSelect.value}"`;
    navigator.clipboard.writeText(command);
    flashStatus("Copied command!");
  });

  document.getElementById("copyUrl").addEventListener("click", () => {
    navigator.clipboard.writeText(urlSelect.value);
    flashStatus("Copied URL!");
  });
}

main();
