const header = document.querySelector("[data-site-header]");
const mobileToggle = document.querySelector("[data-mobile-nav-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const mobileMenuLinks = document.querySelectorAll("[data-mobile-menu-link]");
const revealItems = document.querySelectorAll("[data-reveal]");
const driftItems = document.querySelectorAll("[data-scroll-drift]");
const heroTypewriter = document.querySelector("[data-hero-typewriter]");
const heroTypewriterSubline = document.querySelector("[data-hero-typewriter-subline]");
const heroTypewriterBlock = document.querySelector("[data-hero-typewriter-block]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.body.classList.add("is-ready");

const startHeroTypewriter = () => {
  if (!heroTypewriter || heroTypewriter.dataset.started === "true") return;
  heroTypewriter.dataset.started = "true";
  const fullText = heroTypewriter.getAttribute("data-typewriter-text") || heroTypewriter.textContent.trim();

  if (prefersReducedMotion.matches) {
    heroTypewriter.textContent = fullText;
    heroTypewriter.classList.add("is-complete");
    heroTypewriterSubline?.classList.add("is-visible");
  } else {
    heroTypewriter.textContent = "";
    let index = 0;

    const typeNextCharacter = () => {
      if (index >= fullText.length) {
        heroTypewriter.classList.add("is-complete");
        heroTypewriterSubline?.classList.add("is-visible");
        return;
      }

      heroTypewriter.textContent += fullText[index];
      index += 1;
      window.setTimeout(typeNextCharacter, index === 6 ? 270 : 143);
    };

    window.setTimeout(typeNextCharacter, 630);
  }
};

if (heroTypewriter && prefersReducedMotion.matches) {
  startHeroTypewriter();
}

if (header) {
  const syncHeaderState = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
}

if (mobileToggle && mobileMenu) {
  const setMobileMenu = (open) => {
    mobileToggle.setAttribute("aria-expanded", String(open));
    mobileToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.classList.toggle("is-open", open);
    header?.classList.toggle("is-menu-open", open);
  };

  mobileToggle.addEventListener("click", () => {
    const open = mobileToggle.getAttribute("aria-expanded") !== "true";
    setMobileMenu(open);
  });

  mobileMenuLinks.forEach((link) => link.addEventListener("click", () => setMobileMenu(false)));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMobileMenu(false);
  });

  document.addEventListener("click", (event) => {
    if (!header?.contains(event.target) && mobileToggle.getAttribute("aria-expanded") === "true") {
      setMobileMenu(false);
    }
  });
}

if (revealItems.length && !prefersReducedMotion.matches) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        if (heroTypewriterBlock && entry.target === heroTypewriterBlock) {
          startHeroTypewriter();
        }
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
  startHeroTypewriter();
}

if (driftItems.length && !prefersReducedMotion.matches) {
  const syncDrift = () => {
    driftItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const viewportCenter = window.innerHeight * 0.5;
      const elementCenter = rect.top + rect.height * 0.5;
      const progress = Math.max(-1, Math.min(1, (viewportCenter - elementCenter) / window.innerHeight));
      item.style.setProperty("--drift-y", `${(progress * 18).toFixed(2)}px`);
    });
  };

  syncDrift();
  window.addEventListener("scroll", syncDrift, { passive: true });
  window.addEventListener("resize", syncDrift);
} else {
  driftItems.forEach((item) => item.style.setProperty("--drift-y", "0px"));
}

const contactForm = document.querySelector("[data-contact-form]");

if (contactForm) {
  const statusEl = contactForm.querySelector("[data-contact-status]");
  const submitButton = contactForm.querySelector("[data-contact-submit]");
  const buttonLabel = contactForm.querySelector("[data-contact-button-label]");
  const defaultButtonLabel = buttonLabel?.textContent || "Send Message";
  const defaultStatus = statusEl?.textContent || "";

  const setStatus = (message, tone = "neutral") => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.setAttribute("data-tone", tone);
    statusEl.style.color = tone === "success" ? "rgb(21, 128, 61)" : tone === "error" ? "rgb(153, 27, 27)" : "";
  };

  const sentFlag = new URLSearchParams(window.location.search).get("sent");
  if (sentFlag === "1") {
    setStatus("Thanks. Your message has been sent.", "success");
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!submitButton || !buttonLabel) return;

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    if (String(payload.website || "").trim()) {
      contactForm.reset();
      setStatus("Thanks. Your message has been sent.", "success");
      return;
    }

    const requiredFields = ["first_name", "last_name", "email", "subject", "message"];
    const missingField = requiredFields.find((field) => !String(payload[field] || "").trim());

    if (missingField) {
      setStatus("Please complete the required fields before sending.", "error");
      contactForm.querySelector(`[name="${missingField}"]`)?.focus();
      return;
    }

    submitButton.disabled = true;
    buttonLabel.textContent = "Sending...";
    setStatus("Sending your message...", "neutral");

    try {
      // Use the form's own action so the endpoint is defined in one place
      // (see the comment on the <form> in src/contact/index.njk).
      const endpoint = contactForm.getAttribute("action") || "/api/contact";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Could not send your message.");
      }

      contactForm.reset();
      setStatus(result.message || "Thanks. Your message has been sent.", "success");
    } catch (error) {
      setStatus(error.message || "Could not send your message right now.", "error");
    } finally {
      submitButton.disabled = false;
      buttonLabel.textContent = defaultButtonLabel;
    }
  });

  if (statusEl && defaultStatus && sentFlag !== "1") {
    statusEl.textContent = defaultStatus;
  }
}

// Reliable muted autoplay for the hero background video. iOS Safari sometimes
// ignores the `muted` HTML attribute for autoplay and needs `.muted` set from
// JS plus an explicit play() call. If the browser still refuses (e.g. an OS
// autoplay block), the first tap/click or a return to the tab starts it — so a
// stuck poster never leaves the hero frozen.
const heroVideo = document.querySelector("video");
if (heroVideo) {
  const playHeroVideo = () => {
    heroVideo.muted = true;
    heroVideo.setAttribute("muted", "");
    const attempt = heroVideo.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {});
    }
  };
  playHeroVideo();
  if (heroVideo.readyState < 2) {
    heroVideo.addEventListener("loadeddata", playHeroVideo, { once: true });
  }
  document.addEventListener("touchstart", playHeroVideo, { once: true, passive: true });
  document.addEventListener("click", playHeroVideo, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      playHeroVideo();
    }
  });
}

// ---------------------------------------------------------------------------
// Analytics events (Google Tag Manager)
//
// Every event is pushed to the dataLayer rather than sent to Google directly,
// so GTM decides what happens to it and the site stays free of vendor code.
// The pushes are harmless when no container is configured: dataLayer is just
// an array nobody reads.
// ---------------------------------------------------------------------------
const dataLayerPush = (event, params = {}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
};

(() => {
  const path = window.location.pathname;

  // Which brand is being viewed, so the portfolio can be ranked by interest.
  const brandMatch = path.match(/^\/(brands|wearhouse)\/([^/]+)\/?$/);
  if (brandMatch) {
    dataLayerPush("brand_view", {
      brand_slug: brandMatch[2],
      brand_area: brandMatch[1] === "wearhouse" ? "The Wearhouse" : "Bollag-Guggenheim",
      // The brand name is a logo image, not text, so the <title> is the reliable
      // source: "SAVE THE DUCK | The Wearhouse". The h1 is the tagline, which
      // would make the report unreadable.
      brand_name: (document.title.split("|")[0] || "").trim() || brandMatch[2]
    });
  }

  // Enquiries are the point of the site, so the form is tracked in three steps:
  // started (first keystroke), sent, and failed — the last one matters because
  // a silently broken form is otherwise invisible.
  const form = document.querySelector("[data-contact-form]");
  if (form) {
    let started = false;
    form.addEventListener("input", () => {
      if (started) return;
      started = true;
      dataLayerPush("contact_form_start");
    }, { once: false });

    // site.js reports the outcome in the status element; mirror it as an event.
    const status = form.querySelector("[data-contact-status]");
    if (status) {
      new MutationObserver(() => {
        const tone = status.getAttribute("data-tone");
        if (tone === "success") {
          dataLayerPush("generate_lead", {
            form_name: "contact",
            subject: form.querySelector('[name="subject"]')?.value || ""
          });
        } else if (tone === "error") {
          dataLayerPush("contact_form_error", { message: status.textContent.trim() });
        }
      }).observe(status, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["data-tone"] });
    }
  }

  // Clicks that leave the site, plus the two ways people make contact.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";

    if (href.startsWith("mailto:")) {
      dataLayerPush("contact_click", { method: "email", value: href.replace("mailto:", "") });
      return;
    }
    if (href.startsWith("tel:")) {
      dataLayerPush("contact_click", { method: "phone", value: href.replace("tel:", "") });
      return;
    }
    if (/^https?:\/\//i.test(href) && link.hostname !== window.location.hostname) {
      dataLayerPush("outbound_click", { destination: link.hostname, url: href });
    }
  }, { passive: true });
})();
