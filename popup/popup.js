document.addEventListener('DOMContentLoaded', () => {
  // 1. Traduire l'interface
  localizeHTML();
  
  // 2. Éléments DOM
  const speedSelect = document.getElementById('speed-select');
  const antiAiToggle = document.getElementById('anti-ai-toggle');
  const incognitoToggle = document.getElementById('incognito-toggle');
  const savedText = document.getElementById('saved-text');
  const statusMessage = document.getElementById('status-message');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');

  // Indicateur de sauvegarde
  let saveTimeout;
  const showSavedIndicator = () => {
    statusMessage.classList.remove('hidden');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 2000);
  };

  // Afficher l'historique
  const renderHistory = (history) => {
    historyList.innerHTML = '';
    if (!history || history.length === 0) {
      historyList.innerHTML = `<div class="history-empty" data-i18n="historyEmpty">${chrome.i18n.getMessage("historyEmpty") || "Aucun historique"}</div>`;
      return;
    }

    history.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.textContent = item;
      div.title = item; // Tooltip avec le texte complet
      div.addEventListener('click', () => {
        savedText.value = item;
        chrome.storage.local.set({ savedText: item }, showSavedIndicator);
      });
      historyList.appendChild(div);
    });
  };

  // 3. Charger les données (Langue incluse)
  chrome.storage.local.get(['typingSpeed', 'antiAiMode', 'incognitoMode', 'savedText', 'pasteHistory', 'userLang'], (result) => {
    if (result.userLang) {
      document.getElementById('lang-selector').value = result.userLang;
      localizeHTML(result.userLang);
    } else {
      // Détecter la langue du navigateur par défaut
      const browserLang = chrome.i18n.getUILanguage().split('-')[0];
      const supportedLangs = ['en', 'fr', 'es', 'pt', 'it', 'de'];
      const defaultLang = supportedLangs.includes(browserLang) ? browserLang : 'en';
      document.getElementById('lang-selector').value = defaultLang;
      localizeHTML(defaultLang);
    }
    
    if (result.typingSpeed !== undefined) {
      speedSelect.value = result.typingSpeed;
    }
    if (result.antiAiMode !== undefined) {
      antiAiToggle.checked = result.antiAiMode;
    }
    if (result.incognitoMode !== undefined) {
      incognitoToggle.checked = result.incognitoMode;
    }
    if (result.savedText !== undefined) {
      savedText.value = result.savedText;
    }
    renderHistory(result.pasteHistory || []);
  });

  // 4. Événements
  speedSelect.addEventListener('change', (e) => {
    const value = parseInt(e.target.value, 10);
    chrome.storage.local.set({ typingSpeed: value }, showSavedIndicator);
  });

  antiAiToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ antiAiMode: e.target.checked }, showSavedIndicator);
  });
  
  // Sélecteur de langue
  document.getElementById('lang-selector').addEventListener('change', (e) => {
    const lang = e.target.value;
    chrome.storage.local.set({ userLang: lang }, () => {
      localizeHTML(lang);
    });
  });

  incognitoToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ incognitoMode: e.target.checked }, showSavedIndicator);
  });

  savedText.addEventListener('input', (e) => {
    const text = e.target.value;
    
    // Si Incognito est activé, on garde le texte dans le textarea mais on ne le sauvegarde PAS
    if (incognitoToggle.checked) {
      chrome.storage.local.set({ savedText: text }); // On le sauvegarde temporairement pour l'injecter 
      // Mais on ne le met pas dans l'historique
      showSavedIndicator();
      return;
    }
    
    chrome.storage.local.set({ savedText: text }, showSavedIndicator);
    
    // Mettre à jour l'historique (debounced/on blur pour éviter trop d'ajouts ?)
    // Non, on mettra à jour l'historique quand il perd le focus s'il n'est pas vide
  });

  savedText.addEventListener('change', (e) => {
    const text = e.target.value.trim();
    if (!text.trim() || incognitoToggle.checked) return;

    chrome.storage.local.get(['pasteHistory'], (result) => {
        let history = result.pasteHistory || [];
        // Enlever le texte s'il existe déjà pour le remonter
        history = history.filter(item => item !== text);
        // Ajouter au début
        history.unshift(text);
        // Garder seulement les 5 derniers
        if (history.length > 5) history.pop();
        
        chrome.storage.local.set({ pasteHistory: history });
        renderHistory(history);
    });
  });

  clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.set({ pasteHistory: [] }, () => {
      renderHistory([]);
    });
  });
});

async function localizeHTML(lang) {
  let messages = {};
  try {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const response = await fetch(url);
    messages = await response.json();
  } catch (err) {
    console.error("Erreur chargement langue:", err);
    return;
  }

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (messages[key] && messages[key].message) {
      element.textContent = messages[key].message;
    }
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (messages[key] && messages[key].message) {
      element.setAttribute('placeholder', messages[key].message);
    }
  });

  if (messages["extensionName"]) {
    document.title = messages["extensionName"].message;
  }
}
