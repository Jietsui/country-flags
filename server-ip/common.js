'use strict';

const style = 'background-color: #fff; position: fixed; bottom: 20px; left: 30px; z-index: 100000000000; border: none;' +
  'width: [width]px; min-width: [width]px; max-width: [width]px; height: 24px; min-height: 24px; max-height: 24px;';

const worker = new Worker('/worker.js');
worker.onmessage = ({data}) => {
  const {tabId, error, url} = data;
  let {ip} = data;
  const flag = (data.country ? data.country.iso_code : (data.continent ? data.continent.code : ''));
  chrome.storage.local.get({
    'char': 7,
    'padding': 48,
    'uppercase': true
  }, prefs => {
    if (prefs['uppercase']) {
      ip = ip.toUpperCase();
    }
    const dest = chrome.runtime.getURL(
      '/data/ip/ip.html?ip=' + ip + '&flag=' + flag + '&url=' + encodeURIComponent(url) + '&error=' + error
    );
    chrome.tabs.executeScript(tabId, {
      runAt: 'document_start',
      code: `
        if (window.iframe === undefined) {
          window.iframe = document.createElement('iframe');
          window.iframe.setAttribute('src', "${dest}");
          window.iframe.setAttribute('style', '${style.replace(/\[width\]/g, prefs.padding + ip.length * prefs.char)}');
          if (document.body) {
            document.body.appendChild(window.iframe);
          }
          else {
            document.addEventListener('DOMContentLoaded', () => {
              document.body.appendChild(window.iframe);
            });
          }
        }
      `
    }, () => chrome.runtime.lastError);
  });
};

chrome.webRequest.onResponseStarted.addListener(({tabId, ip, url}) => {
  if (ip) {
    window.setTimeout(() => worker.postMessage({
      ip,
      url,
      tabId
    }), 500);
  }
}, {
  urls: ['*://*/*'],
  types: ['main_frame']
}, [
  'responseHeaders' // to prevent "No tab with id" error
]);

chrome.runtime.onMessage.addListener((request, sender) => {
  const tabId = sender.tab.id;
  if (request.cmd === 'close-me') {
    chrome.tabs.executeScript(tabId, {
      runAt: 'document_start',
      code: `
        if (window.iframe !== undefined) {
          window.iframe.remove();
        }
      `
    });
  }
});

// FAQs
{
  const {onInstalled, setUninstallURL, getManifest} = chrome.runtime;
  const {name, version} = getManifest();
  const page = getManifest().homepage_url;
  onInstalled.addListener(({reason, previousVersion}) => {
    chrome.storage.local.get({
      'faqs': true,
      'last-update': 0
    }, prefs => {
      if (reason === 'install' || (prefs.faqs && reason === 'update')) {
        const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
        if (doUpdate && previousVersion !== version) {
          chrome.tabs.create({
            url: page + '&version=' + version +
              (previousVersion ? '&p=' + previousVersion : '') +
              '&type=' + reason,
            active: reason === 'install'
          });
          chrome.storage.local.set({'last-update': Date.now()});
        }
      }
    });
  });
  setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
}
