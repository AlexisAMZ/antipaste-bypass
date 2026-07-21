const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

// Événement d'installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// Initialisation du menu contextuel
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "anti-paste-bypass",
    title: chrome.i18n.getMessage("contextMenuTitle") || "Paste with Anti-Paste Bypass",
    contexts: ["editable"]
  });
  
  // Vitesse par défaut dans le storage
  chrome.storage.local.get(['typingSpeed'], (result) => {
    if (!result.typingSpeed) {
      chrome.storage.local.set({ typingSpeed: 10 }); // 10ms par défaut
    }
  });
});

// Écoute du clic sur le menu contextuel
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "anti-paste-bypass") {
    try {
      const { savedText, typingSpeed = 10 } = await chrome.storage.local.get(['savedText', 'typingSpeed']);
      const text = savedText || "";
      
      if (!text.trim()) {
        // Le texte est vide, on ouvre directement l'interface de l'extension
        // en mode fenêtre (popup) pour qu'il puisse coller son texte.
        chrome.windows.create({
          url: chrome.runtime.getURL("popup/popup.html"),
          type: "popup",
          width: 380,
          height: 550,
          focused: true
        });
        
        // On affiche quand même une petite alerte discrète
        const emptyMsg = chrome.i18n.getMessage("textEmptyAlert") || "❌ Le texte est vide ! Veuillez le coller dans la fenêtre qui vient de s'ouvrir.";
        await showAlert(tab.id, emptyMsg);
        return;
      }
      
      // Envoi du script de frappe directement dans la page
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: simulateTypingInPage,
        args: [text, parseInt(typingSpeed, 10)]
      });
    } catch (err) {
      console.error("Erreur :", err);
      await showAlert(tab.id, "❌ Erreur : " + err.message);
    }
  }
});

// Cette fonction sera exécutée directement DANS le contexte de la page web
async function simulateTypingInPage(text, speed) {
  // 1. Trouver le champ ciblé (le dernier élément cliqué ou actif)
  // On privilégie l'élément actif actuel (l'utilisateur a normalement cliqué dans le champ avant le clic droit)
  const element = document.activeElement;
  
  if (!element || (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA' && !element.isContentEditable)) {
    alert("❌ Anti-Paste Bypass : Veuillez faire un clic GAUCHE dans le champ pour le sélectionner, PUIS faites votre clic droit !");
    return;
  }

  // Fonction d'insertion compatible React/Angular
  const insertCharacter = (el, char) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

    if (el.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(el, el.value + char);
    } else if (el.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(el, el.value + char);
    } else if (el.value !== undefined) {
      el.value += char;
    } else if (el.isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(char));
        range.collapse(false);
      } else {
        el.textContent += char;
      }
    }
  };

  element.focus();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
    
    insertCharacter(element, char);
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    if (speed > 0) {
      // Simulation de frappe humaine
      let currentDelay = speed;
      
      // Jitter aléatoire (+/- 40% de la vitesse de base)
      const jitter = speed * 0.4;
      currentDelay += (Math.random() * jitter * 2) - jitter;
      
      // Pause plus longue sur les espaces et ponctuations
      if ([' ', '.', ',', '!', '?', '\n'].includes(char)) {
        currentDelay += speed * (Math.random() * 3 + 2); // 2x à 5x plus lent
      }
      
      await new Promise(r => setTimeout(r, Math.max(1, currentDelay)));
    }
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
}


// Fonction utilitaire pour afficher une alerte visuelle sur la page web
async function showAlert(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (msg) => alert(msg),
      args: [message]
    });
  } catch(e) {}
}
