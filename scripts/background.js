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

// --- COMMUNICATION AVEC CONTENT SCRIPT (Bouton flottant) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get-paste-data') {
    (async () => {
      try {
        const clipboardText = await getClipboardFromOffscreen();
        const { typingSpeed = 10, antiAiMode = false, incognitoMode = false } = await chrome.storage.local.get(['typingSpeed', 'antiAiMode', 'incognitoMode']);
        
        sendResponse({
          text: clipboardText || "",
          speed: parseInt(typingSpeed, 10),
          antiAiMode: antiAiMode
        });
      } catch (err) {
        console.error("Erreur get-paste-data :", err);
        sendResponse({ text: null });
      }
    })();
    return true; // Keep channel open
  }
});

// --- GESTION OFFSCREEN (Lecture du presse-papiers) ---
let creating; // Promise globale pour éviter de créer le document plusieurs fois en même temps
async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Read clipboard text to bypass paste block'
    });
    await creating;
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
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        const newValue = element.value.slice(0, -1);
        if (element.tagName === 'INPUT' && nativeInputValueSetter) {
          nativeInputValueSetter.call(element, newValue);
        } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
          nativeTextAreaValueSetter.call(element, newValue);
        } else {
          element.value = newValue;
        }
      } else if (element.isContentEditable) {
        element.textContent = element.textContent.slice(0, -1);
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
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
