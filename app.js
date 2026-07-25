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
  let motionEnabled = false;
  let cardTween = null;
  let cardTrigger = null;
  let dialogTimeline = null;

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

  function clearCardAnimation() {
    cardTween?.kill();
    cardTrigger?.kill();
    cardTween = null;
    cardTrigger = null;
  }

  function animateCards() {
    const gsap = window.gsap;
    const cards = [...elements.grid.querySelectorAll(".icon-card")];

    clearCardAnimation();
    if (!gsap || !motionEnabled || cards.length === 0) return;

    gsap.set(cards, { autoAlpha: 0, y: 22, scale: 0.985 });

    const play = () => {
      cardTrigger = null;
      cardTween = gsap.to(cards, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.52,
        ease: "power2.out",
        stagger: { each: 0.025, from: "start" },
        overwrite: "auto",
        onComplete: () => {
          gsap.set(cards, { clearProps: "opacity,visibility,transform" });
          cardTween = null;
        },
      });
    };

    const bounds = elements.grid.getBoundingClientRect();
    if (!window.ScrollTrigger || (bounds.top < window.innerHeight * 0.88 && bounds.bottom > 0)) {
      play();
    } else if (bounds.bottom <= 0) {
      gsap.set(cards, { clearProps: "opacity,visibility,transform" });
    } else {
      cardTrigger = window.ScrollTrigger.create({
        trigger: elements.grid,
        start: "top 88%",
        once: true,
        onEnter: play,
      });
    }
  }

  function animateRenderFeedback() {
    if (!window.gsap || !motionEnabled) return;

    window.gsap.fromTo(
      elements.summary,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", overwrite: true },
    );

    if (!elements.empty.hidden) {
      window.gsap.fromTo(
        elements.empty,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out", overwrite: true },
      );
    }

    requestAnimationFrame(animateCards);
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
    animateRenderFeedback();
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

  function animateDialogIn() {
    const gsap = window.gsap;
    if (!gsap || !motionEnabled) return;

    dialogTimeline?.kill();
    const details = elements.dialog.querySelectorAll(
      ".preview-details .section-kicker, .preview-details h2, .preview-details dl, .source-button, .source-note, .source-url, .source-help",
    );

    dialogTimeline = gsap
      .timeline({ defaults: { ease: "power3.out" } })
      .fromTo(
        elements.dialog,
        { autoAlpha: 0, y: 20, scale: 0.975 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.42 },
      )
      .fromTo(".preview-frame", { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.5 }, "<0.06")
      .fromTo(
        ".preview-dialog .corner",
        { autoAlpha: 0, scale: 0.45 },
        { autoAlpha: 0.75, scale: 1, duration: 0.42, stagger: 0.08 },
        "<0.02",
      )
      .fromTo(details, { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.38, stagger: 0.045 }, "<0.04");
  }

  function cleanupPreview() {
    const gsap = window.gsap;
    if (gsap) {
      gsap.set(elements.dialog, { clearProps: "opacity,visibility,transform" });
      gsap.set(
        elements.dialog.querySelectorAll(".preview-frame, .corner, .preview-details > *"),
        { clearProps: "opacity,visibility,transform" },
      );
    }
    elements.previewImage.removeAttribute("src");
    selectedId = null;
    dialogTimeline = null;
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
    animateDialogIn();
  }

  function closePreview() {
    if (elements.dialog.open) elements.dialog.close();
  }

  function setupAnimations() {
    const gsap = window.gsap;
    if (!gsap) return;

    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    const media = gsap.matchMedia();
    media.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        isDesktop: "(min-width: 800px)",
      },
      (context) => {
        const { reduceMotion, isDesktop } = context.conditions;
        motionEnabled = !reduceMotion;

        if (reduceMotion) {
          clearCardAnimation();
          elements.total.textContent = formatNumber(ids.length);
          return () => {
            motionEnabled = false;
          };
        }

        const count = { value: 0 };
        elements.total.textContent = "0";

        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from(".site-header .brand", { autoAlpha: 0, y: -12, duration: 0.55 })
          .from(".archive-status", { autoAlpha: 0, y: -8, duration: 0.45 }, "<0.12")
          .from(".hero .eyebrow", { autoAlpha: 0, x: -14, duration: 0.48 }, "-=0.15")
          .from(".hero .eyebrow span", { scaleX: 0, transformOrigin: "left center", duration: 0.5 }, "<")
          .from(".hero h1", { autoAlpha: 0, y: 34, duration: 0.9 }, "-=0.2")
          .from(".hero-copy", { autoAlpha: 0, y: 18, duration: 0.6 }, "-=0.5")
          .from(".search", { autoAlpha: 0, y: 18, duration: 0.62 }, "-=0.4")
          .from(".archive-facts > div", { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.1 }, "-=0.35")
          .to(
            count,
            {
              value: ids.length,
              duration: 1.1,
              ease: "power2.out",
              onUpdate: () => {
                elements.total.textContent = formatNumber(Math.round(count.value));
              },
              onComplete: () => {
                elements.total.textContent = formatNumber(ids.length);
              },
            },
            "-=0.65",
          );

        gsap.to(".archive-status i", {
          autoAlpha: 0.5,
          scale: 1.65,
          duration: 1.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        if (isDesktop) {
          gsap.to(".ambient-one", {
            x: 52,
            y: 32,
            scale: 1.08,
            duration: 10,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });
          gsap.to(".ambient-two", {
            x: -46,
            y: -36,
            scale: 1.06,
            duration: 12,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });
        }

        if (window.ScrollTrigger) {
          gsap.to(".hero", {
            "--diamond-y": "-70px",
            "--diamond-rotation": "51deg",
            "--diamond-scale": 1.05,
            ease: "none",
            scrollTrigger: {
              trigger: ".hero",
              start: "top top",
              end: "bottom top",
              scrub: 1.1,
            },
          });

          gsap
            .timeline({
              scrollTrigger: {
                trigger: ".section-heading",
                start: "top 88%",
                once: true,
              },
              defaults: { ease: "power3.out" },
            })
            .from(".section-heading .section-kicker", { autoAlpha: 0, x: -12, duration: 0.42 })
            .from(".section-heading h2", { autoAlpha: 0, y: 18, duration: 0.58 }, "-=0.18")
            .from(".result-summary", { autoAlpha: 0, y: 10, duration: 0.42 }, "-=0.3");
        }

        requestAnimationFrame(animateCards);

        return () => {
          motionEnabled = false;
          clearCardAnimation();
          dialogTimeline?.kill();
          dialogTimeline = null;
        };
      },
    );
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
  });
  elements.search.addEventListener("input", applySearch);
  elements.clear.addEventListener("click", resetSearch);
  elements.emptyReset.addEventListener("click", resetSearch);
  elements.dialogClose.addEventListener("click", closePreview);
  elements.dialog.addEventListener("close", cleanupPreview);
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
  setupAnimations();
})();
