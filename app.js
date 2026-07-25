(function () {
  "use strict";

  const PAGE_SIZE = 50;
  const DATA_DRAGON_VERSION = window.DATA_DRAGON_VERSION;
  const ICON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DATA_DRAGON_VERSION}/img/profileicon`;
  const ids = Array.isArray(window.PROFILE_ICON_IDS) ? window.PROFILE_ICON_IDS : [];

  const elements = {
    form: document.querySelector("#search-form"),
    search: document.querySelector("#icon-search"),
    clear: document.querySelector("#clear-search"),
    grid: document.querySelector("#icon-grid"),
    total: document.querySelector("#total-count"),
    summary: document.querySelector("#result-summary"),
    pagination: document.querySelector("#pagination"),
    empty: document.querySelector("#empty-state"),
    emptyReset: document.querySelector("#empty-reset"),
    dialog: document.querySelector("#preview-dialog"),
    dialogClose: document.querySelector("#dialog-close"),
    previewImage: document.querySelector("#preview-image"),
    previewId: document.querySelector("#preview-id"),
    detailId: document.querySelector("#detail-id"),
    detailSize: document.querySelector("#detail-size"),
    detailFormat: document.querySelector("#detail-format"),
    sourceLink: document.querySelector("#source-link"),
    sourceUrl: document.querySelector("#source-url"),
  };

  let currentPage = 1;
  let filteredIds = ids;
  let selectedId = null;

  function iconUrl(id) {
    return `${ICON_BASE}/${id}.png`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN").format(value);
  }

  function getPageNumbers(totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const candidates = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const sorted = [...candidates].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
    const result = [];

    sorted.forEach((page, index) => {
      if (index > 0 && page - sorted[index - 1] > 1) result.push("ellipsis");
      result.push(page);
    });
    return result;
  }

  function paginationButton(label, page, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    button.setAttribute("aria-label", options.ariaLabel || `第 ${page} 页`);
    if (options.current) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      currentPage = page;
      render();
      document.querySelector("#catalog-title").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return button;
  }

  function renderPagination(totalPages) {
    elements.pagination.replaceChildren();
    if (totalPages <= 1) return;

    elements.pagination.append(
      paginationButton("‹", currentPage - 1, {
        disabled: currentPage === 1,
        ariaLabel: "上一页",
      }),
    );

    getPageNumbers(totalPages).forEach((page) => {
      if (page === "ellipsis") {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "…";
        ellipsis.setAttribute("aria-hidden", "true");
        elements.pagination.append(ellipsis);
      } else {
        elements.pagination.append(paginationButton(String(page), page, { current: page === currentPage }));
      }
    });

    elements.pagination.append(
      paginationButton("›", currentPage + 1, {
        disabled: currentPage === totalPages,
        ariaLabel: "下一页",
      }),
    );
  }

  function createCard(id) {
    const card = document.createElement("button");
    card.className = "icon-card";
    card.type = "button";
    card.setAttribute("aria-label", `预览召唤师图标 ${id}`);

    const image = document.createElement("img");
    image.src = iconUrl(id);
    image.alt = `召唤师图标 ${id}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => card.classList.add("image-error"), { once: true });

    const label = document.createElement("span");
    label.className = "icon-card-label";
    label.innerHTML = `<small>ICON ID</small><strong>#${id}</strong>`;

    card.append(image, label);
    card.addEventListener("click", () => openPreview(id));
    return card;
  }

  function render() {
    const totalPages = Math.max(1, Math.ceil(filteredIds.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageIds = filteredIds.slice(start, start + PAGE_SIZE);

    elements.grid.replaceChildren(...pageIds.map(createCard));
    elements.grid.hidden = pageIds.length === 0;
    elements.grid.setAttribute("aria-busy", "false");
    elements.empty.hidden = pageIds.length > 0;
    elements.pagination.hidden = pageIds.length === 0;

    if (filteredIds.length === ids.length) {
      elements.summary.textContent = `共 ${formatNumber(ids.length)} 枚 · 按 ID 从新到旧`;
    } else {
      elements.summary.textContent = `找到 ${formatNumber(filteredIds.length)} 枚匹配图标`;
    }
    renderPagination(totalPages);
  }

  function applySearch() {
    const query = elements.search.value.replace(/\D/g, "");
    elements.search.value = query;
    elements.clear.hidden = query.length === 0;
    filteredIds = query ? ids.filter((id) => String(id).includes(query)) : ids;
    currentPage = 1;
    render();
  }

  function resetSearch() {
    elements.search.value = "";
    applySearch();
    elements.search.focus();
  }

  function updateSourceUrl() {
    const url = iconUrl(selectedId);
    elements.detailFormat.textContent = "PNG";
    elements.sourceLink.href = url;
    elements.sourceUrl.href = url;
    elements.sourceUrl.textContent = url;
  }

  function openPreview(id) {
    selectedId = id;
    elements.previewId.textContent = id;
    elements.detailId.textContent = id;
    elements.detailSize.textContent = "载入中…";
    updateSourceUrl();
    elements.previewImage.alt = `召唤师图标 ${id} 大图预览`;
    elements.previewImage.src = iconUrl(id);
    elements.dialog.showModal();
  }

  function closePreview() {
    elements.dialog.close();
    elements.previewImage.removeAttribute("src");
    selectedId = null;
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
  });
  elements.search.addEventListener("input", applySearch);
  elements.clear.addEventListener("click", resetSearch);
  elements.emptyReset.addEventListener("click", resetSearch);
  elements.dialogClose.addEventListener("click", closePreview);
  elements.previewImage.addEventListener("load", () => {
    elements.detailSize.textContent = `${elements.previewImage.naturalWidth} × ${elements.previewImage.naturalHeight} px`;
  });
  elements.previewImage.addEventListener("error", () => {
    elements.detailSize.textContent = "资源暂时不可用";
  });
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) closePreview();
  });

  elements.total.textContent = formatNumber(ids.length);
  render();
})();
