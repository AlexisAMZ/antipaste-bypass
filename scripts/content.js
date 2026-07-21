let currentFloatingBtn = null;

// Écoute des focus sur les champs de texte
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
    if (el.tagName !== 'INPUT' || ['text', 'password', 'email', 'number', 'search', 'url', 'tel'].includes(el.type)) {
      showFloatingButton(el);
    }
  }
});

// Cache le bouton quand on quitte le champ (avec un léger délai pour permettre le clic)
document.addEventListener('focusout', (e) => {
  setTimeout(() => {
    if (currentFloatingBtn && document.activeElement !== currentFloatingBtn && document.activeElement !== currentFloatingBtn.inputTarget) {
      hideFloatingButton();
    }
  }, 200);
});

function hideFloatingButton() {
  if (currentFloatingBtn) {
    currentFloatingBtn.remove();
    currentFloatingBtn = null;
  }
}

function showFloatingButton(inputElement) {
  hideFloatingButton();
  
  const rect = inputElement.getBoundingClientRect();
  
  const btn = document.createElement('div');
  btn.innerHTML = '🧩';
  btn.style.position = 'absolute';
  // Positionné en haut à droite, légèrement à l'extérieur ou à l'intérieur
  btn.style.top = `${rect.top + window.scrollY - 10}px`;
  btn.style.left = `${rect.right + window.scrollX - 10}px`;
  btn.style.width = '24px';
  btn.style.height = '24px';
  btn.style.background = 'rgba(17, 24, 39, 0.95)';
  btn.style.border = '1px solid rgba(139, 92, 246, 0.5)';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.justifyContent = 'center';
  btn.style.alignItems = 'center';
  btn.style.fontSize = '14px';
  btn.style.zIndex = '2147483647'; // Max z-index
  btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3), 0 0 8px rgba(139, 92, 246, 0.2)';
  btn.style.transition = 'transform 0.2s, box-shadow 0.2s';
  btn.style.userSelect = 'none';
  btn.title = "Coller avec Anti-Paste Bypass";
  
  btn.inputTarget = inputElement;

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.1)';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4), 0 0 12px rgba(139, 92, 246, 0.4)';
  });
  
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3), 0 0 8px rgba(139, 92, 246, 0.2)';
  });

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Empêche la perte de focus de l'input
  });

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Demander le presse-papiers et les paramètres au background
    chrome.runtime.sendMessage({ type: 'get-paste-data' }, (response) => {
      if (response && response.text) {
        inputElement.focus();
        simulateTypingInPage(inputElement, response.text, response.speed, response.antiAiMode);
        hideFloatingButton();
      }
    });
  });
  
  document.body.appendChild(btn);
  currentFloatingBtn = btn;
}

// ============================================================================
// LOGIQUE DE FRAPPE ULTRA-HUMAINE (Copiée de background.js pour le content script)
// ============================================================================

async function simulateTypingInPage(element, text, speed, antiAiMode) {
  function insertCharacter(el, char) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = el.value.substring(0, start) + char + el.value.substring(end);
      
      if (el.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(el, newValue);
      } else if (el.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(el, newValue);
      } else {
        el.value = newValue;
      }
      
      el.setSelectionRange(start + 1, start + 1);
    } else if (el.isContentEditable) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(char);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  element.focus();
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Logique Anti-IA
    if (antiAiMode && speed > 0 && i > 0 && Math.random() < 0.05 && char.match(/[a-z]/i)) {
      const typoChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
      element.dispatchEvent(new KeyboardEvent('keydown', { key: typoChar, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: typoChar, bubbles: true }));
      insertCharacter(element, typoChar);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: typoChar, bubbles: true }));
      
      await new Promise(r => setTimeout(r, 150 + Math.random() * 150));
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
      
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
      await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
    }

    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
    insertCharacter(element, char);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    
    if (speed > 0) {
      let currentDelay = speed;
      const jitter = speed * 0.4;
      currentDelay += (Math.random() * jitter * 2) - jitter;
      
      if (antiAiMode) {
        if (Math.random() < 0.02) {
          currentDelay += 400 + (Math.random() * 800);
        }
        currentDelay *= (0.6 + Math.random() * 1.9);
      }
      
      if ([' ', '.', ',', '!', '?', '\n'].includes(char)) {
        currentDelay += speed * (Math.random() * 3 + 2);
        if (antiAiMode && Math.random() < 0.25) {
          currentDelay += 300 + (Math.random() * 500); 
        }
      }
      
      await new Promise(r => setTimeout(r, Math.max(1, currentDelay)));
    }
  }
}
