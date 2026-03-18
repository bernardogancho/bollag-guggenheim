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
