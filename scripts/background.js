const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

// Installation / mise à jour de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }

  // Les menus contextuels sont persistés par Chrome et survivent aux mises à jour.
  // On repart d'une base propre pour éviter l'erreur "duplicate id" quand onInstalled
  // se redéclenche (update, chrome_update, rechargement de l'extension).
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "anti-paste-bypass",
      title: chrome.i18n.getMessage("contextMenuTitle") || "Paste with Anti-Paste & Select/Copy",
      contexts: ["editable"]
    });
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
    // Injecter le bypass clic droit si le mode est activé
    const { rightClickBypass } = await chrome.storage.local.get(['rightClickBypass']);
    if (rightClickBypass) {
      await injectRightClickBypass(tab.id);
    }
    
    try {
      const { savedText, typingSpeed = 10, antiAiMode = false, incognitoMode = false } = await chrome.storage.local.get(['savedText', 'typingSpeed', 'antiAiMode', 'incognitoMode']);
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
        args: [text, parseInt(typingSpeed, 10), antiAiMode]
      });
      
      // Sécurité : Vider le texte si le mode Incognito est actif
      if (incognitoMode) {
        await chrome.storage.local.set({ savedText: "" });
      }
    } catch (err) {
      console.error("Erreur :", err);
      await showAlert(tab.id, "❌ Erreur : " + err.message);
    }
  }
});

// --- GESTION DU RACCOURCI CLAVIER ---
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "paste-bypass") {
    // tab est absent si le raccourci est déclenché hors d'un onglet exploitable
    if (!tab?.id) return;
    try {
      // Lire le presse-papiers système via le document Offscreen
      const clipboardText = await getClipboardFromOffscreen();
      
      const { typingSpeed = 10, antiAiMode = false, incognitoMode = false } = await chrome.storage.local.get(['typingSpeed', 'antiAiMode', 'incognitoMode']);
      // Si incognitoMode est activé, on NE PASSE PAS par savedText, on utilise direct clipboardText
      const textToPaste = clipboardText || "";
      
      if (!textToPaste.trim()) {
        await showAlert(tab.id, "❌ Votre presse-papiers est vide.");
        return;
      }
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: simulateTypingInPage,
        args: [textToPaste, parseInt(typingSpeed, 10), antiAiMode]
      });
      
    } catch (err) {
      console.error("Erreur raccourci :", err);
      await showAlert(tab.id, "❌ Erreur raccourci : " + err.message);
    }
  }
});

// --- GESTION DU BYPASS CLIC DROIT ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'inject-rightclick-bypass') {
    injectRightClickBypass(message.tabId || sender.tab?.id);
    sendResponse({ success: true });
    return true;
  }
});

// Injection automatique sur chaque nouvelle page quand le toggle est activé.
// Dépend de la host permission optionnelle <all_urls> : sans elle, tab.url reste
// undefined et executeScript est refusé sur un onglet non activé par un geste utilisateur.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;

  chrome.storage.local.get(['rightClickBypass'], (result) => {
    if (result.rightClickBypass) {
      injectRightClickBypass(tabId);
    }
  });
});

// Si l'utilisateur révoque <all_urls> depuis chrome://extensions, le toggle doit suivre :
// sans la permission, l'injection automatique est silencieusement impossible.
chrome.permissions.onRemoved.addListener((permissions) => {
  if (permissions.origins?.includes('<all_urls>')) {
    chrome.storage.local.set({ rightClickBypass: false });
  }
});

async function injectRightClickBypass(tabId) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: rightClickBypassInjection,
      world: 'MAIN'
    });
  } catch (err) {
    console.error("Erreur injection right-click bypass:", err);
  }
}

function rightClickBypassInjection() {
  document.querySelectorAll('[oncontextmenu]').forEach(el => el.removeAttribute('oncontextmenu'));
  document.oncontextmenu = null;
  document.querySelectorAll('[onselectstart]').forEach(el => el.removeAttribute('onselectstart'));
  document.onselectstart = null;

  const orig = Event.prototype.preventDefault;
  Object.defineProperty(Event.prototype, 'preventDefault', {
    value: function () {
      if (this.type === 'contextmenu' || this.type === 'selectstart') return;
      orig.call(this);
    },
    writable: true, configurable: true
  });

  const s = document.createElement('style');
  s.id = '__apb_selection';
  s.textContent = '*, *::before, *::after { user-select: auto !important; -webkit-user-select: auto !important; }';
  document.documentElement.appendChild(s);
}

// --- GESTION OFFSCREEN (Lecture du presse-papiers) ---
let creating; // Promise globale pour éviter de créer le document plusieurs fois en même temps
async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['CLIPBOARD'],
      justification: 'Read clipboard text to bypass paste block'
    });
  }

  try {
    await creating;
  } finally {
    // Réinitialisation systématique : sans le finally, une promesse rejetée restait
    // en cache et faisait échouer instantanément tous les appels suivants.
    creating = null;
  }
}

async function getClipboardFromOffscreen() {
  await setupOffscreenDocument();
  const text = await chrome.runtime.sendMessage({ type: 'read-clipboard' });
  return text;
}

// Cette fonction sera exécutée directement DANS le contexte de la page web
async function simulateTypingInPage(text, speed, antiAiMode) {
  // 1. Trouver le champ ciblé (le dernier élément cliqué ou actif)
  // On privilégie l'élément actif actuel (l'utilisateur a normalement cliqué dans le champ avant le clic droit)
  const element = document.activeElement;
  
  if (!element || (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA' && !element.isContentEditable)) {
    alert("❌ Anti-Paste & Select/Copy : Veuillez faire un clic GAUCHE dans le champ pour le sélectionner, PUIS faites votre clic droit !");
    return;
  }

  // Setter natif : indispensable pour que React/Angular voient la nouvelle valeur
  const nativeValueSetter = (el) => {
    if (el.tagName === 'INPUT') {
      return Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    }
    if (el.tagName === 'TEXTAREA') {
      return Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    }
    return undefined;
  };

  // Certains types d'input (number, email...) n'exposent pas de sélection
  const setCaret = (el, position) => {
    try {
      el.setSelectionRange(position, position);
    } catch (e) { /* type d'input sans sélection */ }
  };

  // Insertion à la position du curseur (et non en fin de champ)
  const insertCharacter = (el, char) => {
    if (el.isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(char));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        el.textContent += char;
      }
      return;
    }

    if (el.value === undefined) return;

    const setter = nativeValueSetter(el);
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.slice(0, start) + char + el.value.slice(end);

    if (setter) {
      setter.call(el, newValue);
    } else {
      el.value = newValue;
    }
    setCaret(el, start + char.length);
  };

  // Suppression du caractère précédant le curseur (simulation du Backspace)
  const removeCharacterBeforeCaret = (el) => {
    if (el.isContentEditable) {
      el.textContent = el.textContent.slice(0, -1);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    if (el.value === undefined) return;

    const caret = el.selectionStart ?? el.value.length;
    if (caret === 0) return;

    const setter = nativeValueSetter(el);
    const newValue = el.value.slice(0, caret - 1) + el.value.slice(caret);

    if (setter) {
      setter.call(el, newValue);
    } else {
      el.value = newValue;
    }
    setCaret(el, caret - 1);
  };

  element.focus();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Logique Anti-IA : Faire une faute de frappe humaine (5% de chance)
    if (antiAiMode && speed > 0 && i > 0 && Math.random() < 0.05 && char.match(/[a-z]/i)) {
      // 1. Choisir une lettre aléatoire pour l'erreur
      const typoChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
      
      // 2. Taper la mauvaise lettre
      element.dispatchEvent(new KeyboardEvent('keydown', { key: typoChar, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: typoChar, bubbles: true }));
      insertCharacter(element, typoChar);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: typoChar, bubbles: true }));
      
      // 3. Pause de réalisation de l'erreur (temps de réaction humain : 150-300ms)
      await new Promise(r => setTimeout(r, 150 + Math.random() * 150));
      
      // 4. Appuyer sur Backspace
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
      
      // 5. Retirer le caractère
      removeCharacterBeforeCaret(element);

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
      
      // 6. Pause avant de retaper la bonne lettre (50-100ms)
      await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
    }

    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
    
    insertCharacter(element, char);
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    if (speed > 0) {
      // Simulation de frappe humaine
      let currentDelay = speed;
      
      // Jitter aléatoire (+/- 40% de la vitesse de base) pour chaque touche
      const jitter = speed * 0.4;
      currentDelay += (Math.random() * jitter * 2) - jitter;
      
      if (antiAiMode) {
        // Hésitation majeure (2% de chance) : l'humain cherche une touche ou perd le fil
        if (Math.random() < 0.02) {
          currentDelay += 400 + (Math.random() * 800); // Pause de 400ms à 1.2s
        }
        
        // Variation de rythme "Fatigue / Burst" : modifie la vitesse dynamiquement
        // Multiplicateur aléatoire entre 0.6x (plus rapide) et 2.5x (plus lent)
        currentDelay *= (0.6 + Math.random() * 1.9);
      }
      
      // Pause naturelle sur la ponctuation et les espaces
      if ([' ', '.', ',', '!', '?', '\n'].includes(char)) {
        currentDelay += speed * (Math.random() * 3 + 2); // 2x à 5x plus lent par défaut
        
        if (antiAiMode && Math.random() < 0.25) {
          // Grosse pause de fin de mot/phrase (1 fois sur 4)
          currentDelay += 300 + (Math.random() * 500); 
        }
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
