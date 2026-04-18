const DATASET = Array.isArray(window.TRANSLATIONS) ? window.TRANSLATIONS : [];

const form = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const statusMessage = document.getElementById("statusMessage");
const toast = document.getElementById("toast");

const resultFields = {
  sourceValue: document.getElementById("sourceValue"),
  englishValue: document.getElementById("englishValue"),
  arabicValue: document.getElementById("arabicValue"),
  domainValue: document.getElementById("domainValue"),
};

const copyButtons = Array.from(document.querySelectorAll(".copy-button"));

const preparedData = DATASET.map((entry) => ({
  ...entry,
  originalLookup: normalizeText(entry.original),
  cleanLookup: normalizeText(entry.clean),
}));

let toastTimer = 0;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanCategory(category) {
  return String(category || "")
    .replace(/^\s*[\d.]+\s*/, "")
    .trim();
}

function formatCategory(category) {
  return cleanCategory(category).replace(/\s*(\[[^\]]+])$/, "\n$1");
}

function setFieldValue(element, value, options = {}) {
  const text = String(value || "").trim();
  element.textContent = text;

  if (options.direction) {
    element.setAttribute("dir", text ? options.direction : "ltr");
  } else {
    element.removeAttribute("dir");
  }
}

function updateCopyState() {
  copyButtons.forEach((button) => {
    const targetId = button.dataset.copyTarget;
    const target = resultFields[targetId];
    button.disabled = !target || !target.textContent.trim();
  });
}

function clearResults() {
  setFieldValue(resultFields.sourceValue, "");
  setFieldValue(resultFields.englishValue, "");
  setFieldValue(resultFields.arabicValue, "", { direction: "rtl" });
  setFieldValue(resultFields.domainValue, "");
  updateCopyState();
}

function renderResult(result) {
  setFieldValue(resultFields.sourceValue, result.original || result.clean);
  setFieldValue(resultFields.englishValue, result.english);
  setFieldValue(resultFields.arabicValue, result.arabic, { direction: "rtl" });
  setFieldValue(resultFields.domainValue, formatCategory(result.category));
  updateCopyState();
}

function showStatus(message = "") {
  statusMessage.textContent = message;
}

function showToast(message) {
  if (!message) {
    return;
  }

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function searchTranslation(query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  let bestMatch = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const entry of preparedData) {
    const candidates = [entry.cleanLookup, entry.originalLookup].filter(Boolean);

    if (!candidates.length) {
      continue;
    }

    let score = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      if (candidate === normalizedQuery) {
        score = 0;
        break;
      }

      if (candidate.startsWith(normalizedQuery)) {
        score = Math.min(score, 1);
      } else if (candidate.includes(normalizedQuery)) {
        score = Math.min(score, 2);
      } else if (normalizedQuery.includes(candidate)) {
        score = Math.min(score, 3);
      }
    }

    if (!Number.isFinite(score)) {
      continue;
    }

    const reference = entry.cleanLookup || entry.originalLookup;
    score += Math.abs(reference.length - normalizedQuery.length) / 100;

    if (score < bestScore) {
      bestScore = score;
      bestMatch = entry;

      if (score === 0) {
        break;
      }
    }
  }

  return bestMatch;
}

async function copyText(targetId) {
  const target = resultFields[targetId];
  const text = target?.textContent.trim();

  if (!text) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "absolute";
      helper.style.left = "-9999px";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }

    showToast("Le texte a été copié.");
  } catch (error) {
    showToast("Impossible de copier le texte.");
  }
}

function handleSearch(event) {
  event.preventDefault();

  const query = searchInput.value.trim();

  if (!query) {
    clearResults();
    showStatus("Écrivez un mot en français pour lancer la recherche.");
    showToast("Veuillez entrer un mot.");
    searchInput.focus();
    return;
  }

  const result = searchTranslation(query);

  if (!result) {
    clearResults();
    showStatus(`Aucune traduction trouvée pour "${query}".`);
    showToast("Aucune traduction trouvée.");
    return;
  }

  renderResult(result);
  showStatus("");
}

form.addEventListener("submit", handleSearch);

copyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    copyText(button.dataset.copyTarget);
  });
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    clearResults();
    showStatus("");
  }
});

clearResults();

const initialQuery = new URLSearchParams(window.location.search).get("q");

if (initialQuery) {
  searchInput.value = initialQuery;
  form.requestSubmit();
}
