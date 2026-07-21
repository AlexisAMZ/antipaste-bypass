document.addEventListener('DOMContentLoaded', async () => {

  let currentStep = 0;
  let selectedLang = 'en'; // Toujours EN par défaut dans le sélecteur
  let isAnimating = false;

  // ── Récupérer la langue déjà sauvegardée (si l'utilisateur revient) ──
  const stored = await chrome.storage.local.get(['userLang']);
  if (stored.userLang) {
    selectedLang = stored.userLang;
  }

  // ── Activer le bon bouton de langue au démarrage ──
  activateLangButton(selectedLang);

  // ── Événements boutons de langue ──
  const langButtons = document.querySelectorAll('.language-button');
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedLang = btn.dataset.lang;
      activateLangButton(selectedLang);
    });
  });

  function activateLangButton(lang) {
    document.querySelectorAll('.language-button').forEach(b => {
      b.classList.toggle('is-active', b.dataset.lang === lang);
    });
  }

  // ── Navigation ──
  document.getElementById('btn-next-0')?.addEventListener('click', () => goTo(1));
  document.getElementById('btn-next-1')?.addEventListener('click', () => goTo(2));
  document.getElementById('btn-back-1')?.addEventListener('click', () => goTo(0));
  document.getElementById('btn-back-2')?.addEventListener('click', () => goTo(1));

  document.getElementById('start-btn')?.addEventListener('click', async () => {
    await chrome.storage.local.set({ userLang: selectedLang, onboardingDone: true });
    window.close();
  });

  // ── Clic sur les pills du stepper pour naviguer ──
  document.querySelectorAll('.step-pill').forEach((pill, i) => {
    pill.addEventListener('click', () => {
      if (!isAnimating && i !== currentStep) goTo(i);
    });
  });

  function goTo(nextStep) {
    if (isAnimating || nextStep === currentStep) return;
    isAnimating = true;

    const steps = document.querySelectorAll('.wizard-step');
    const pills = document.querySelectorAll('.step-pill');

    const outClass = nextStep > currentStep ? 'slide-out-left' : 'slide-out-right';

    // 1. Animer la sortie de l'étape actuelle
    const leavingStep = steps[currentStep];
    leavingStep.classList.add(outClass);

    // 2. Après la fin de l'animation de sortie, switcher
    leavingStep.addEventListener('animationend', function onEnd() {
      leavingStep.removeEventListener('animationend', onEnd);
      leavingStep.classList.remove('active', outClass);

      // 3. Activer la nouvelle étape
      currentStep = nextStep;
      steps[currentStep].classList.add('active');

      // 4. Mettre à jour le stepper
      pills.forEach((pill, i) => {
        pill.classList.remove('active', 'completed');
        if (i < currentStep) pill.classList.add('completed');
        else if (i === currentStep) pill.classList.add('active');
      });

      // 5. Mettre à jour le compteur
      const counter = document.getElementById('step-counter-current');
      if (counter) counter.textContent = String(currentStep + 1).padStart(2, '0');

      isAnimating = false;
    }, { once: true });
  }

});
