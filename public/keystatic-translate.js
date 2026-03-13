// CCAKD Translate Widget — adds "Translate EN → 中文" button to Keystatic edit pages
(function () {
  var TRANSLATE_API = '/api/translate';
  var FIELD_SEP = '\n---FIELD---\n';

  // Use Unicode escapes to avoid charset/encoding issues with external script loading
  var LABEL_EN = '(English)';
  var LABEL_ZH = '(\u7b80\u4f53\u4e2d\u6587)';       // (简体中文)
  var LABEL_ZHTW = '(\u7e41\u9ad4\u4e2d\u6587)';      // (繁體中文)

  function isEditPage() {
    var path = location.pathname;
    // In GitHub mode, Keystatic URLs include /branch/<name>/ (e.g. /keystatic/branch/main/collection/...).
    // Matching on /collection/ and /singleton/ alone works for any branch.
    return (
      path.includes('/singleton/') ||
      (path.includes('/collection/') &&
        (path.includes('/create') || path.includes('/item/')))
    );
  }

  // Get the label text for an input by checking the <label for="id"> element
  function getLabelForInput(input) {
    if (input.id) {
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label) return label.textContent || '';
    }
    return '';
  }

  // Get the label text for a rich text editor by walking up to the field wrapper
  function getLabelForEditor(editor) {
    var el = editor;
    for (var i = 0; i < 10 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      var children = el.children;
      for (var j = 0; j < children.length; j++) {
        var text = children[j].textContent || '';
        if (text.includes(LABEL_EN) || text.includes(LABEL_ZH) || text.includes(LABEL_ZHTW)) {
          return text;
        }
      }
    }
    return '';
  }

  function getTextInputsByLocale() {
    var inputs = document.querySelectorAll('input');
    var en = [], zh = [], zhtw = [];
    for (var i = 0; i < inputs.length; i++) {
      var label = getLabelForInput(inputs[i]);
      if (label.includes(LABEL_EN)) en.push(inputs[i]);
      else if (label.includes(LABEL_ZH)) zh.push(inputs[i]);
      else if (label.includes(LABEL_ZHTW)) zhtw.push(inputs[i]);
    }
    return { en: en, zh: zh, zhtw: zhtw };
  }

  function getRichEditorsByLocale() {
    var editors = document.querySelectorAll('[role="textbox"][contenteditable="true"]');
    var en = [], zh = [], zhtw = [];
    for (var i = 0; i < editors.length; i++) {
      var label = getLabelForEditor(editors[i]);
      if (label.includes(LABEL_EN)) en.push(editors[i]);
      else if (label.includes(LABEL_ZH)) zh.push(editors[i]);
      else if (label.includes(LABEL_ZHTW)) zhtw.push(editors[i]);
    }
    return { en: en, zh: zh, zhtw: zhtw };
  }

  function setInputValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setRichTextContent(editor, text) {
    editor.focus();
    setTimeout(function () {
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    }, 50);
  }

  function translateFields(btn) {
    var originalText = btn.textContent;
    var originalBg = btn.style.background;
    btn.textContent = 'Translating...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    var textInputs = getTextInputsByLocale();
    var richEditors = getRichEditorsByLocale();

    // Collect non-empty English text field values
    var textValues = [];
    var textIndices = [];
    for (var i = 0; i < textInputs.en.length; i++) {
      if (textInputs.en[i].value.trim()) {
        textValues.push(textInputs.en[i].value);
        textIndices.push(i);
      }
    }

    // Collect non-empty English rich text content (skip placeholder text)
    var richValues = [];
    var richIndices = [];
    for (var i = 0; i < richEditors.en.length; i++) {
      var text = (richEditors.en[i].textContent || '').trim();
      if (text && !text.includes('Start writing or press')) {
        richValues.push(text);
        richIndices.push(i);
      }
    }

    if (textValues.length === 0 && richValues.length === 0) {
      alert('No English content found to translate. Please fill in the English fields first.');
      btn.textContent = originalText;
      btn.disabled = false;
      btn.style.opacity = '1';
      return;
    }

    // Translate text fields (batched into one API call)
    var textPromise = textValues.length > 0
      ? fetch(TRANSLATE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textValues.join(FIELD_SEP), sourceLocale: 'en', format: 'plain' }),
        }).then(function (res) {
          if (!res.ok) return res.json().then(function (e) { throw new Error(e.error || 'API error ' + res.status); });
          return res.json();
        }).then(function (data) {
          // Re-query DOM to get fresh references (React may have re-rendered)
          var freshInputs = getTextInputsByLocale();
          var zhParts = (data.translations.zh || '').split(FIELD_SEP);
          var zhtwParts = (data.translations['zh-tw'] || '').split(FIELD_SEP);
          for (var j = 0; j < textIndices.length; j++) {
            var idx = textIndices[j];
            if (freshInputs.zh[idx] && zhParts[j]) setInputValue(freshInputs.zh[idx], zhParts[j].trim());
            if (freshInputs.zhtw[idx] && zhtwParts[j]) setInputValue(freshInputs.zhtw[idx], zhtwParts[j].trim());
          }
        })
      : Promise.resolve();

    // Translate rich text fields sequentially (one API call returns both zh and zh-tw)
    textPromise.then(function () {
      var chain = Promise.resolve();
      richIndices.forEach(function (idx, j) {
        chain = chain.then(function () {
          btn.textContent = 'Translating rich text ' + (j + 1) + '/' + richIndices.length + '...';
          return fetch(TRANSLATE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: richValues[j], sourceLocale: 'en', format: 'plain' }),
          }).then(function (res) {
            if (!res.ok) return res.json().then(function (e) { throw new Error(e.error || 'API error ' + res.status); });
            return res.json();
          }).then(function (data) {
            // Re-query DOM for fresh references
            var freshEditors = getRichEditorsByLocale();
            if (freshEditors.zh[idx] && data.translations.zh) {
              setRichTextContent(freshEditors.zh[idx], data.translations.zh);
            }
            return new Promise(function (r) { setTimeout(r, 300); });
          }).then(function () {
            // Need a separate call for zh-tw since setRichTextContent uses focus/execCommand
            return fetch(TRANSLATE_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: richValues[j], sourceLocale: 'en', format: 'plain' }),
            }).then(function (res) { return res.json(); })
              .then(function (data2) {
                var freshEditors2 = getRichEditorsByLocale();
                if (freshEditors2.zhtw[idx] && data2.translations && data2.translations['zh-tw']) {
                  setRichTextContent(freshEditors2.zhtw[idx], data2.translations['zh-tw']);
                }
                return new Promise(function (r) { setTimeout(r, 300); });
              });
          });
        });
      });
      return chain;
    }).then(function () {
      btn.textContent = 'Done!';
      btn.style.background = '#16a34a';
      btn.style.opacity = '1';
      setTimeout(function () {
        btn.textContent = originalText;
        btn.style.background = originalBg;
        btn.disabled = false;
      }, 2000);
    }).catch(function (err) {
      console.error('Translation error:', err);
      alert('Translation failed: ' + err.message);
      btn.textContent = originalText;
      btn.style.background = originalBg;
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  }

  function injectButton() {
    if (document.getElementById('ccakd-translate-btn')) return;
    if (!isEditPage()) return;

    var toolbar = document.querySelector('[role="toolbar"]');
    if (!toolbar) return;

    var btn = document.createElement('button');
    btn.id = 'ccakd-translate-btn';
    btn.textContent = 'Translate EN \u2192 \u4E2D\u6587';
    btn.title = 'Auto-translate English fields to Simplified & Traditional Chinese using AI';
    btn.style.cssText = 'background:#D04830;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;margin-left:8px;transition:background 0.2s,opacity 0.2s;';
    btn.onmouseenter = function () { if (!btn.disabled) btn.style.background = '#b83d2a'; };
    btn.onmouseleave = function () { if (!btn.disabled) btn.style.background = '#D04830'; };
    btn.onclick = function () { translateFields(btn); };

    toolbar.appendChild(btn);
  }

  function cleanupButton() {
    if (!isEditPage()) {
      var existing = document.getElementById('ccakd-translate-btn');
      if (existing) existing.remove();
    }
  }

  var observer = new MutationObserver(function () {
    requestAnimationFrame(function () {
      injectButton();
      cleanupButton();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(injectButton, 1500);
  setTimeout(injectButton, 3000);
})();
