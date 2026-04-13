const PILL_CONFIG = {
  desktop: {
    maxWidth: "800px", width: "100%", height: "58px", minHeight: "58px",
    padding: "6px", borderRadius: "100px"
  },
  mobile: {
    maxWidth: "800px", width: "calc(100% - 40px)", height: "140px", minHeight: "140px",
    padding: "12px", borderRadius: "16px"
  }
};

function getRelativePos(element, container) {
  const elRect = element.getBoundingClientRect();
  const contRect = container.getBoundingClientRect();
  const compStyle = window.getComputedStyle(container);
  return {
    top: elRect.top - contRect.top - (parseFloat(compStyle.borderTopWidth) || 0),
    left: elRect.left - contRect.left - (parseFloat(compStyle.borderLeftWidth) || 0),
    width: elRect.width,
    height: elRect.height,
  };
}

function makeSpacer(pos) {
  const el = document.createElement("div");
  el.style.cssText = `width:${pos.width}px;height:${pos.height}px;flex-shrink:0;box-sizing:border-box;`;
  return el;
}

export function animateExpand({
  panel, initialView, expandedView, sharedToggle,
  toggleExpandedSlot, messages,
}) {
  if (
    !panel ||
    !initialView ||
    !expandedView ||
    !sharedToggle ||
    !toggleExpandedSlot
  ) {
    console.error("[SmartRoom] animateExpand: missing DOM references");
    return;
  }
  const startPos = getRelativePos(sharedToggle, panel);
  const startSpacer = makeSpacer(startPos);
  sharedToggle.parentNode.replaceChild(startSpacer, sharedToggle);

  const origPanelCss = panel.style.cssText;
  panel.classList.add("is-expanded");
  initialView.style.display = "none";
  expandedView.style.display = "block";
  expandedView.style.opacity = "1";
  panel.style.cssText = "max-width:100%;width:100%;min-height:75vh;padding:20px;height:auto;border-radius:0px;";

  toggleExpandedSlot.appendChild(sharedToggle);
  const _forceLayout = panel.offsetHeight;
  const endPos = getRelativePos(sharedToggle, panel);

  const endSpacer = makeSpacer(endPos);
  sharedToggle.parentNode.replaceChild(endSpacer, sharedToggle);

  panel.appendChild(sharedToggle);
  gsap.set(sharedToggle, {
    position: "absolute", top: 0, left: 0,
    x: startPos.left, y: startPos.top,
    width: startPos.width, height: startPos.height,
    margin: 0, boxSizing: "border-box", zIndex: 50,
  });

  panel.classList.remove("is-expanded");
  panel.style.cssText = origPanelCss;
  initialView.style.display = "flex";
  expandedView.style.display = "none";

  const initialElementsToHide = initialView.querySelectorAll(
    ".storage-form__divider, .storage-form__action-group"
  );

  gsap.to(initialElementsToHide, {
    opacity: 0, duration: 0.2,
    onComplete: () => {
      initialView.style.display = "none";
      expandedView.style.display = "block";
      expandedView.style.opacity = "1";

      const expandedElementsToFadeIn = expandedView.querySelectorAll(
        ".calc-back-btn, .calc-postcode-display, .calc-content"
      );
      gsap.set(expandedElementsToFadeIn, { opacity: 0 });

      gsap.to(sharedToggle, {
        x: endPos.left, y: endPos.top,
        width: endPos.width, height: endPos.height,
        duration: 0.8, ease: "expo.inOut",
        onComplete: () => {
          gsap.set(sharedToggle, { clearProps: "all" });
          endSpacer.parentNode.replaceChild(sharedToggle, endSpacer);
          if (startSpacer.parentNode) startSpacer.remove();
        },
      });

      const tl = gsap.timeline({
        onComplete: () =>
          gsap.set(panel, { clearProps: "maxWidth,width,height,minHeight,borderRadius,padding" }),
      });
      tl.to(panel, {
        maxWidth: "100%", width: "100%", height: _forceLayout,
        minHeight: "75vh", borderRadius: "0px", padding: "20px",
        duration: 0.8, ease: "expo.inOut",
        onStart: () => panel.classList.add("is-expanded"),
      }).to(expandedElementsToFadeIn, { opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.4");

      if (window.innerWidth <= 820) {
        const mobileSidebar = expandedView.querySelector(".calc-sidebar");
        if (mobileSidebar) {
          gsap.fromTo(mobileSidebar, { y: "100%" }, { y: "0%", duration: 0.6, ease: "expo.out" });
        }
      }

      const headerHeight = document.querySelector('.site-header')?.offsetHeight || 80;
      gsap.to(window, {
        scrollTo: { y: toggleExpandedSlot, offsetY: headerHeight },
        duration: 0.8, ease: "power2.inOut",
      });
    },
  });
}

export function animateCollapse({
  panel, initialView, expandedView, sharedToggle,
  messages, currentPostcodeInput, revertToPill, postcodeSearchMode,
}) {
  if (
    !panel ||
    !initialView ||
    !expandedView ||
    !sharedToggle ||
    !messages
  ) {
    console.error("[SmartRoom] animateCollapse: missing DOM references");
    return;
  }
  const startPos = getRelativePos(sharedToggle, panel);
  const startSpacer = makeSpacer(startPos);
  sharedToggle.parentNode.replaceChild(startSpacer, sharedToggle);

  const origPanelCss = panel.style.cssText;
  const isMobile = window.innerWidth <= 820;
  const conf = isMobile ? PILL_CONFIG.mobile : PILL_CONFIG.desktop;

  panel.classList.remove("is-expanded");
  expandedView.style.display = "none";
  initialView.style.display = "flex";

  panel.style.cssText = `
    max-width: ${conf.maxWidth};
    width: ${conf.width};
    height: ${conf.height};
    min-height: ${conf.minHeight};
    padding: ${conf.padding};
    border-radius: ${conf.borderRadius};
  `;

  initialView.insertBefore(sharedToggle, initialView.firstChild);
  const _forceLayout = panel.offsetHeight;
  const endPos = getRelativePos(sharedToggle, panel);

  const endSpacer = makeSpacer(endPos);
  sharedToggle.parentNode.replaceChild(endSpacer, sharedToggle);

  panel.appendChild(sharedToggle);
  gsap.set(sharedToggle, {
    position: "absolute", top: 0, left: 0,
    x: startPos.left, y: startPos.top,
    width: startPos.width, height: startPos.height,
    margin: 0, boxSizing: "border-box", zIndex: 50,
  });

  panel.classList.add("is-expanded");
  panel.style.cssText = origPanelCss;
  initialView.style.display = "none";
  expandedView.style.display = "block";
  expandedView.style.opacity = "1";

  const expandedElementsToHide = expandedView.querySelectorAll(
    ".calc-back-btn, .calc-postcode-display, .calc-content"
  );
  const initialElementsToFadeIn = initialView.querySelectorAll(
    ".storage-form__divider, .storage-form__action-group"
  );

  const tl = gsap.timeline({
    onComplete: () => {
      panel.classList.remove("is-expanded");
      gsap.set([panel, initialView, expandedView, initialElementsToFadeIn, expandedElementsToHide], {
        clearProps: "all",
      });
      expandedView.style.display = "none";
      messages.style.display = "block";
      if (currentPostcodeInput) currentPostcodeInput.disabled = false;
      revertToPill();
      postcodeSearchMode?.classList.remove("is-error");
      gsap.to(".storage-form__messages", { opacity: 1, duration: 0.4, ease: "power2.out", clearProps: "all" });
    },
  });

  tl.to(expandedElementsToHide, {
    opacity: 0, duration: 0.2, ease: "power2.inOut",
    onStart: () => {
      if (isMobile) {
        const mobileSidebar = expandedView.querySelector(".calc-sidebar");
        if (mobileSidebar) gsap.to(mobileSidebar, { y: "100%", duration: 0.3, ease: "power2.in" });
      }
    },
    onComplete: () => {
      expandedView.style.display = "none";
      initialView.style.display = "flex";
      gsap.set(initialElementsToFadeIn, { opacity: 0 });
      gsap.to(sharedToggle, {
        x: endPos.left, y: endPos.top, width: endPos.width, height: endPos.height,
        duration: 0.8, ease: "expo.inOut",
        onComplete: () => {
          gsap.set(sharedToggle, { clearProps: "all" });
          endSpacer.parentNode.replaceChild(sharedToggle, endSpacer);
          if (startSpacer.parentNode) startSpacer.remove();
        },
      });
    },
  })
    .to(panel, {
      ...conf,
      duration: 0.8, ease: "expo.inOut",
    }, "+=0")
    .to(initialElementsToFadeIn, { opacity: 1, duration: 0.4, ease: "power2.out" }, "-=0.2");

  gsap.to(window, { scrollTo: { y: 0 }, duration: 0.8, ease: "power2.inOut" });
}
