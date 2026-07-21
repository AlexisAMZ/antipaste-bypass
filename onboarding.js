document.addEventListener('DOMContentLoaded', async () => {

  let currentStep = 0;
  let selectedLang = 'en';
  let isAnimating = false;

  // Récupérer la langue déjà sauvegardée
  const stored = await chrome.storage.local.get(['userLang']);
  if (stored.userLang) {
    selectedLang = stored.userLang;
  }

  // ── Appliquer la traduction initiale ──
  await applyTranslation(selectedLang);
  activateLangButton(selectedLang);

  // ── Événements boutons de langue ──
  document.querySelectorAll('.language-button').forEach(btn => {
    btn.addEventListener('click', async () => {
      selectedLang = btn.dataset.lang;
      activateLangButton(selectedLang);
      await applyTranslation(selectedLang);
    });
  });

  // ── Navigation ──
  document.getElementById('btn-next-0')?.addEventListener('click', () => goTo(1));
  document.getElementById('btn-next-1')?.addEventListener('click', () => goTo(2));
  document.getElementById('btn-back-1')?.addEventListener('click', () => goTo(0));
  document.getElementById('btn-back-2')?.addEventListener('click', () => goTo(1));

  document.getElementById('start-btn')?.addEventListener('click', async () => {
    await chrome.storage.local.set({ userLang: selectedLang, onboardingDone: true });
    window.close();
  });

  // ── Clic sur les pills ──
  document.querySelectorAll('.step-pill').forEach((pill, i) => {
    pill.addEventListener('click', () => {
      if (!isAnimating && i !== currentStep) goTo(i);
    });
  });

  // ── Activation visuelle du bouton de langue ──
  function activateLangButton(lang) {
    document.querySelectorAll('.language-button').forEach(b => {
      b.classList.toggle('is-active', b.dataset.lang === lang);
    });
  }

  // ── Traduction dynamique ──
  async function applyTranslation(lang) {
    let messages = {};
    try {
      const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
      const response = await fetch(url);
      messages = await response.json();
    } catch (err) {
      console.warn('Translation not found for:', lang, err);
      return;
    }

    // Traduire tous les éléments avec data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (messages[key]?.message) {
        el.textContent = messages[key].message;
      }
    });
  }

  // ── Navigation avec animationend ──
  function goTo(nextStep) {
    if (isAnimating || nextStep === currentStep) return;
    isAnimating = true;

    const steps = document.querySelectorAll('.wizard-step');
    const pills = document.querySelectorAll('.step-pill');
    const outClass = nextStep > currentStep ? 'slide-out-left' : 'slide-out-right';

    const leavingStep = steps[currentStep];
    leavingStep.classList.add(outClass);

    leavingStep.addEventListener('animationend', function onEnd() {
      leavingStep.removeEventListener('animationend', onEnd);
      leavingStep.classList.remove('active', outClass);

      currentStep = nextStep;
      steps[currentStep].classList.add('active');

      pills.forEach((pill, i) => {
        pill.classList.remove('active', 'completed');
        if (i < currentStep) pill.classList.add('completed');
        else if (i === currentStep) pill.classList.add('active');
      });

      const counter = document.getElementById('step-counter-current');
      if (counter) counter.textContent = String(currentStep + 1).padStart(2, '0');

      isAnimating = false;
    }, { once: true });
  }

});
