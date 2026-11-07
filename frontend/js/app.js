document.getElementById("role-user-btn").addEventListener("click", () => enterApp("user"));
document.getElementById("role-owner-btn").addEventListener("click", () => enterApp("owner"));

let currentRole = null;
let viewHistory = [];

function enterApp(role) {
  currentRole = role;
  viewHistory = [];

  document.getElementById("role-select").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("back-btn").classList.remove("hidden");

  document.getElementById("nav-user").classList.toggle("hidden", role !== "user");
  document.getElementById("nav-owner").classList.toggle("hidden", role !== "owner");

  showView(role === "user" ? "browse" : "create-event", { addToHistory: false });
}

document.querySelectorAll("nav button[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

async function showView(viewName, opts = {}) {
  const { addToHistory = true } = opts;

  if (typeof html5QrScanner !== "undefined" && html5QrScanner && viewName !== "checkin") {
    await stopQrScanner();
  }

  const current = document.querySelector(".view:not(.hidden)");
  if (addToHistory && current) {
    const currentId = current.id.replace("view-", "");
    if (currentId !== viewName) viewHistory.push(currentId);
  }

  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById("view-" + viewName).classList.remove("hidden");

  document.querySelectorAll("nav button[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  if (viewName === "browse") await renderBrowseEvents();
  if (viewName === "my-tickets") await renderMyTickets();
  if (viewName === "my-events") await renderMyEvents();
  if (viewName === "marketplace") await renderResaleMarketplace();
}

document.getElementById("back-btn").addEventListener("click", async () => {
  if (viewHistory.length > 0) {
    const previous = viewHistory.pop();
    await showView(previous, { addToHistory: false });
  } else {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("back-btn").classList.add("hidden");
    document.getElementById("role-select").classList.remove("hidden");
  }
});

// ===== صفحات وسيطة/نهائية مشتركة =====
function showProcessing(title, steps) {
  document.getElementById("processing-title").textContent = title;
  const list = document.getElementById("processing-steps");
  list.innerHTML = steps.map((s, i) => `
    <li class="step pending" data-step="${s.id}">
      <span class="step-marker">${i + 1}</span>
      <span class="step-label">${s.label}</span>
    </li>`).join("");
  showView("processing", { addToHistory: true });
}

function setStepStatus(stepId, status) {
  const el = document.querySelector(`#processing-steps .step[data-step="${stepId}"]`);
  if (!el) return;
  el.classList.remove("pending", "active", "done", "error");
  el.classList.add(status);
  const marker = el.querySelector(".step-marker");
  marker.textContent = status === "done" ? "✓" : status === "error" ? "✕" : marker.textContent;
}

function showSuccess(bodyHtml) {
  document.getElementById("success-body").innerHTML = bodyHtml;
  showView("success", { addToHistory: false });
  document.querySelectorAll("#success-body [data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewHistory = [];
      showView(btn.dataset.nav, { addToHistory: false });
    });
  });
}

function downloadCanvasAsImage(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
