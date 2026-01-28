// Content Script utilities for page interaction.

const MAX_SNAPSHOT_TEXT = 4000;

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findElementByText(text) {
  if (!text) return null;
  const candidates = document.querySelectorAll('button, a, [role="button"], .ant-btn, .ant-menu-item, span, div');
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (!isVisible(el)) continue;
    const content = (el.textContent || '').trim();
    if (!content) continue;
    if (content === text || content.includes(text)) return el;
  }
  return null;
}

function resolveElement(selector) {
  if (!selector) return null;
  try {
    const el = document.querySelector(selector);
    if (el) return el;
  } catch (e) {
    // ignore invalid selector
  }
  return findElementByText(selector);
}

export function getPageSnapshot() {
  const title = document.title || '';
  const url = window.location.href || '';
  const bodyText = document.body?.innerText || document.body?.textContent || '';
  const text = bodyText.replace(/\s+/g, ' ').trim().slice(0, MAX_SNAPSHOT_TEXT);
  return { title, url, text, ts: Date.now() };
}

export async function executeSQL(sql) {
  const sqlText = String(sql || '').trim();
  if (!sqlText) return { success: false, error: 'SQL 不能为空' };

  const cmElement = document.querySelector('.CodeMirror');
  if (cmElement && cmElement.CodeMirror) {
    cmElement.CodeMirror.setValue(sqlText);
    return { success: true, editor: 'CodeMirror' };
  }

  const aceElement = document.querySelector('.ace_editor');
  if (aceElement && window.ace && typeof window.ace.edit === 'function') {
    const editor = window.ace.edit(aceElement);
    editor.setValue(sqlText, -1);
    return { success: true, editor: 'Ace' };
  }

  const monacoElement = document.querySelector('.monaco-editor');
  if (monacoElement && window.monaco && window.monaco.editor?.getEditors) {
    const editors = window.monaco.editor.getEditors();
    if (editors.length > 0) {
      editors[0].setValue(sqlText);
      return { success: true, editor: 'Monaco' };
    }
  }

  const textarea = document.querySelector('textarea.sql-editor, textarea[name*="sql"], textarea');
  if (textarea) {
    textarea.value = sqlText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, editor: 'textarea' };
  }

  return { success: false, error: '未找到 SQL 编辑器' };
}

export function clickElement(selector) {
  const element = resolveElement(selector);
  if (!element) return { success: false, error: `未找到可点击元素: ${selector}` };
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.click();
  return { success: true, tag: element.tagName };
}

export function typeText(selector, text) {
  const inputText = String(text ?? '');
  let element = resolveElement(selector);

  if (!element) {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"], .ant-input');
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i];
      if (!isVisible(el)) continue;
      const placeholder = el.getAttribute('placeholder') || '';
      if (placeholder.includes(selector)) {
        element = el;
        break;
      }
    }
  }

  if (!element) {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i];
      if (isVisible(el)) {
        element = el;
        break;
      }
    }
  }

  if (!element) return { success: false, error: `未找到输入框: ${selector}` };

  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.focus();
  element.value = inputText;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return { success: true, typed: inputText.slice(0, 50) };
}

export function getQueryResult() {
  const table = document.querySelector('.ant-table-tbody, .result-table tbody, table tbody');
  if (table) {
    const headers = Array.from(document.querySelectorAll('.ant-table-thead th, thead th'))
      .map(th => th.textContent?.trim() || '');
    const rows = Array.from(table.querySelectorAll('tr')).slice(0, 20).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() || '')
    );

    if (headers.length > 0 || rows.length > 0) {
      let formatted = headers.join(' | ') + '\n';
      formatted += '-'.repeat(50) + '\n';
      formatted += rows.map(r => r.join(' | ')).join('\n');

      const total = document.querySelector('.result-count, .ant-pagination-total-text');
      if (total) {
        formatted += `\n\n共 ${total.textContent}`;
      }

      return { success: true, resultType: 'table', data: { headers, rows }, formatted };
    }
  }

  const error = document.querySelector('.ant-message-error, .error-message, .ant-alert-error');
  if (error) {
    return { success: true, resultType: 'error', error: error.textContent };
  }

  const textResult = document.querySelector('.result-preview, .query-result');
  if (textResult) {
    return { success: true, resultType: 'text', text: textResult.textContent?.slice(0, 2000) };
  }

  return { success: false, error: '未找到查询结果' };
}
