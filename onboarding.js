document.addEventListener('DOMContentLoaded', () => {
  // Gérer le bouton de fermeture
  document.getElementById('start-btn').addEventListener('click', () => {
    window.close();
  });

  // Gérer le sélecteur de langue
  const langSelector = document.getElementById('lang-selector');
  let browserLang = "fr"; // Par défaut
  
  if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) {
    browserLang = chrome.i18n.getUILanguage().split('-')[0];
  }
  
  // Sélectionner la langue actuelle dans la liste si elle existe
  if (Array.from(langSelector.options).some(opt => opt.value === browserLang)) {
    langSelector.value = browserLang;
  }

  // Toujours forcer le chargement de la langue affichée dans le select au démarrage
  loadLanguage(langSelector.value);

  langSelector.addEventListener('change', (e) => {
    loadLanguage(e.target.value);
  });
});

// Chargement manuel d'un fichier de langue (quand on change le select ou au démarrage)
async function loadLanguage(lang) {
  try {
    const response = await fetch(`_locales/${lang}/messages.json`);
    const messages = await response.json();
    
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (messages[key] && messages[key].message) {
        element.textContent = messages[key].message;
      }
    });
  } catch (error) {
    console.error("Erreur de chargement de la langue", error);
  }
}
