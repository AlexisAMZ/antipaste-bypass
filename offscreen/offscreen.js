chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'read-clipboard') {
    readClipboard().then(sendResponse);
    return true; // Keep the message channel open for async response
  }
});

async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    return text;
  } catch (err) {
    console.error("Erreur de lecture du presse-papiers (offscreen): ", err);
    return "";
  }
}
