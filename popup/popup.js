document.addEventListener('DOMContentLoaded', () => {
  // 1. Traduire l'interface
  localizeHTML();
  
  // 2. Éléments DOM
  const speedSelect = document.getElementById('speed-select');
  const savedText = document.getElementById('saved-text');
  const statusMessage = document.getElementById('status-message');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');

  // Indicateur de sauvegarde
  let saveTimeout;
  const showSavedIndicator = () => {
    statusMessage.classList.remove('opacity-0');
    statusMessage.classList.add('opacity-100');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      statusMessage.classList.remove('opacity-100');
      statusMessage.classList.add('opacity-0');
    }, 2000);
  };

  // Afficher l'historique
  const renderHistory = (history) => {
    historyList.innerHTML = '';
    if (!history || history.length === 0) {
      historyList.innerHTML = `<div class="list-group-item text-muted text-center py-2" data-i18n="historyEmpty">${chrome.i18n.getMessage("historyEmpty") || "Aucun historique"}</div>`;
      return;
    }

    history.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'list-group-item list-group-item-action history-item';
      div.textContent = item;
      div.title = item; // Tooltip avec le texte complet
      div.addEventListener('click', () => {
        savedText.value = item;
        chrome.storage.local.set({ savedText: item }, showSavedIndicator);
      });
      historyList.appendChild(div);
    });
  };

  // 3. Charger les données
  chrome.storage.local.get(['typingSpeed', 'savedText', 'pasteHistory'], (result) => {
    if (result.typingSpeed !== undefined) {
      speedSelect.value = result.typingSpeed;
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

  savedText.addEventListener('input', (e) => {
    const text = e.target.value;
    chrome.storage.local.set({ savedText: text }, showSavedIndicator);
    
    // Mettre à jour l'historique (debounced/on blur pour éviter trop d'ajouts ?)
    // Non, on mettra à jour l'historique quand il perd le focus s'il n'est pas vide
  });

  savedText.addEventListener('change', (e) => {
    const text = e.target.value.trim();
    if (text) {
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
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.set({ pasteHistory: [] }, () => {
      renderHistory([]);
    });
  });
});

function localizeHTML() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const msg = chrome.i18n.getMessage(element.getAttribute('data-i18n'));
    if (msg) {
      element.textContent = msg;
    }
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const msg = chrome.i18n.getMessage(element.getAttribute('data-i18n-placeholder'));
    if (msg) {
      element.setAttribute('placeholder', msg);
    }
  });

  document.title = chrome.i18n.getMessage("extensionName") || "Anti-Paste Bypass";
}
