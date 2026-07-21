document.addEventListener('DOMContentLoaded', async () => {

  let currentStep = 0;
  let selectedLang = 'en';
  const totalSteps = 3;

  // Détecter la langue par défaut
  const browserLang = (navigator.language || 'en').split('-')[0];
  const supportedLangs = ['en', 'fr', 'es', 'pt', 'it', 'de'];
  selectedLang = supportedLangs.includes(browserLang) ? browserLang : 'en';

  // ── Sélection de langue ──
  const langButtons = document.querySelectorAll('.language-button');
  langButtons.forEach(btn => {
    if (btn.dataset.lang === selectedLang) {
      langButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    }
    btn.addEventListener('click', () => {
      langButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedLang = btn.dataset.lang;
    });
  });

  // ── Navigation ──
  document.getElementById('btn-next-0')?.addEventListener('click', () => goTo(1));
  document.getElementById('btn-next-1')?.addEventListener('click', () => goTo(2));
  document.getElementById('btn-back-1')?.addEventListener('click', () => goTo(0));
  document.getElementById('btn-back-2')?.addEventListener('click', () => goTo(1));

  document.getElementById('start-btn')?.addEventListener('click', async () => {
    // Sauvegarder la langue choisie
    await chrome.storage.local.set({ userLang: selectedLang, onboardingDone: true });
    window.close();
  });

  function goTo(step) {
    const steps = document.querySelectorAll('.wizard-step');
    const pills = document.querySelectorAll('.step-pill');

    // Animation de sortie
    const dir = step > currentStep ? 'slide-out-left' : 'slide-out-right';
    steps[currentStep].classList.add(dir);
    setTimeout(() => {
      steps[currentStep].classList.remove('active', dir);
    }, 500);

    // Activation de l'étape suivante
    setTimeout(() => {
      currentStep = step;
      steps[currentStep].classList.add('active');

      // Mettre à jour le stepper
      pills.forEach((pill, i) => {
        pill.classList.remove('active', 'completed');
        if (i < currentStep) pill.classList.add('completed');
        else if (i === currentStep) pill.classList.add('active');
      });

      // Mettre à jour le compteur
      const counter = document.getElementById('step-counter-current');
      if (counter) counter.textContent = String(currentStep + 1).padStart(2, '0');
    }, 300);
  }
});
