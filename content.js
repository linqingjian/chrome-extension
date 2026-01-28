(function() {
"use strict";

// === content/action-bridge.js ===
/**
 * Content Script - 消息桥接模块
 * 处理扩展与页面之间的消息传递
 */

// 消息类型常量
const MessageTypes = {
  TASK_STATUS_UPDATE: 'TASK_STATUS_UPDATE',
  CALL_WAREHOUSE_ASSISTANT: 'CALL_WAREHOUSE_ASSISTANT',
  WAREHOUSE_ASSISTANT_RESPONSE: 'WAREHOUSE_ASSISTANT_RESPONSE',
  WAREHOUSE_ASSISTANT_STATUS_UPDATE: 'WAREHOUSE_ASSISTANT_STATUS_UPDATE',
  CHECK_WAREHOUSE_ASSISTANT: 'CHECK_WAREHOUSE_ASSISTANT',
  WAREHOUSE_ASSISTANT_CHECK_RESPONSE: 'WAREHOUSE_ASSISTANT_CHECK_RESPONSE',
};

let pageAnalyzerPromise = null;

function loadPageAnalyzer() {
  if (!pageAnalyzerPromise) {
    pageAnalyzerPromise = import('./page-analyzer.js').catch((error) => {
      pageAnalyzerPromise = null;
      throw error;
    });
  }
  return pageAnalyzerPromise;
}

function sendPageAnalyzerError(sendResponse, error) {
  const message = error?.message || String(error);
  sendResponse({ success: false, error: message });
}

/**
 * 初始化消息桥接
 */
function initMessageBridge() {
  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === MessageTypes.TASK_STATUS_UPDATE) {
      handleTaskStatusUpdate(request);
      return;
    }

    // 处理其他消息类型
    switch (request.action) {
      case 'getPageSnapshot':
        loadPageAnalyzer()
          .then(module => sendResponse(module.getPageSnapshot()))
          .catch(error => sendPageAnalyzerError(sendResponse, error));
        return true;

      case 'executeSQL':
        loadPageAnalyzer()
          .then(module => module.executeSQL(request.sql))
          .then(result => sendResponse(result))
          .catch(error => sendPageAnalyzerError(sendResponse, error));
        return true;

      case 'clickElement':
        loadPageAnalyzer()
          .then(module => sendResponse(module.clickElement(request.selector)))
          .catch(error => sendPageAnalyzerError(sendResponse, error));
        return true;

      case 'typeText':
        loadPageAnalyzer()
          .then(module => sendResponse(module.typeText(request.selector, request.text)))
          .catch(error => sendPageAnalyzerError(sendResponse, error));
        return true;

      case 'getQueryResult':
        loadPageAnalyzer()
          .then(module => sendResponse(module.getQueryResult()))
          .catch(error => sendPageAnalyzerError(sendResponse, error));
        return true;
    }
  });

  // 监听来自页面的消息
  window.addEventListener('message', handlePageMessage);

  // 监听检查响应
  window.addEventListener('message', handleCheckResponse);
}

/**
 * 处理任务状态更新
 * @param {Object} request - 请求对象
 */
function handleTaskStatusUpdate(request) {
  const status = {
    status: request.status || 'running',
    result: request.result || null,
    error: request.error || null,
  };

  console.log('📨 Content script 收到状态更新:', status);

  // 转发到页面 MAIN 上下文
  window.postMessage({
    type: MessageTypes.WAREHOUSE_ASSISTANT_STATUS_UPDATE,
    status,
  }, '*');
}

/**
 * 处理来自页面的消息
 * @param {MessageEvent} event - 消息事件
 */
function handlePageMessage(event) {
  if (event.source !== window) return;
  if (!event.data || !event.data.type) return;

  console.log('📨 Content script 收到消息:', event.data.type);

  if (event.data.type === MessageTypes.CALL_WAREHOUSE_ASSISTANT) {
    handleCallWarehouseAssistant(event.data);
  }
}

/**
 * 处理调用数仓助手请求
 * @param {Object} data - 请求数据
 */
function handleCallWarehouseAssistant(data) {
  const { task, model, options } = data;

  console.log('📨 Content script 收到调用请求:', { task, model, options });

  // 更新状态
  window.postMessage({
    type: MessageTypes.WAREHOUSE_ASSISTANT_STATUS_UPDATE,
    status: { status: 'running', currentTask: task },
  }, '*');

  // 转发到 background
  try {
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      const error = '扩展上下文不可用，请刷新页面';
      console.error('❌', error);
      sendErrorResponse(error);
      return;
    }

    chrome.runtime.sendMessage({
      type: 'START_TASK',
      task,
      model: model || 'gpt-4o-mini',
    }, (response) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        console.error('❌ Content script 调用 background 失败:', error);

        const isContextInvalidated = error.includes('Extension context invalidated') ||
          error.includes('message port closed') ||
          error.includes('Receiving end does not exist');

        const errorMsg = isContextInvalidated
          ? '扩展上下文已失效，请刷新页面后重试'
          : error;

        sendErrorResponse(errorMsg);
      } else {
        console.log('✅ Content script 收到 background 响应:', response);
        window.postMessage({
          type: MessageTypes.WAREHOUSE_ASSISTANT_RESPONSE,
          success: true,
          response: response || { status: 'started' },
        }, '*');
      }
    });
  } catch (error) {
    console.error('❌ Content script 发送消息异常:', error);
    const errorMsg = error.message?.includes('Extension context invalidated')
      ? '扩展上下文已失效，请刷新页面后重试'
      : (error.message || String(error));
    sendErrorResponse(errorMsg);
  }
}

/**
 * 发送错误响应
 * @param {string} error - 错误消息
 */
function sendErrorResponse(error) {
  window.postMessage({
    type: MessageTypes.WAREHOUSE_ASSISTANT_RESPONSE,
    success: false,
    error,
  }, '*');

  window.postMessage({
    type: MessageTypes.WAREHOUSE_ASSISTANT_STATUS_UPDATE,
    status: { status: 'error', error },
  }, '*');
}

/**
 * 处理检查响应
 * @param {MessageEvent} event - 消息事件
 */
function handleCheckResponse(event) {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== MessageTypes.WAREHOUSE_ASSISTANT_CHECK_RESPONSE) return;

  if (!event.data.exists) {
    console.warn('⚠️ callWarehouseAssistant 函数未找到，尝试重新注入...');
    injectScript();
  } else {
    console.log('✅ callWarehouseAssistant 函数已就绪');
  }
}

/**
 * 注入脚本到页面 MAIN 上下文
 */
function injectScript() {
  // 检查是否已经注入
  if (typeof window.callWarehouseAssistant === 'function') {
    console.log('✅ 数仓小助手已存在，跳过注入');
    return;
  }

  const script = document.createElement('script');
  script.id = 'warehouse-assistant-injected';
  script.src = chrome.runtime.getURL('injected_script.js');
  script.onload = function() {
    console.log('✅ 数仓小助手注入脚本已加载');
    setTimeout(() => {
      if (typeof window.callWarehouseAssistant === 'function') {
        console.log('✅ 数仓小助手函数已就绪');
      } else {
        console.warn('⚠️ 数仓小助手函数未找到，可能注入失败');
      }
    }, 100);
  };
  script.onerror = function(e) {
    console.error('❌ 数仓小助手注入脚本加载失败:', e);
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * 添加浮动按钮
 */
function addFloatingButton() {
  const btn = document.createElement('div');
  btn.innerHTML = '🤖';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #00d9ff, #00ff88);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 217, 255, 0.4);
    z-index: 999999;
    transition: transform 0.2s;
  `;
  btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
  btn.onmouseleave = () => btn.style.transform = 'scale(1)';
  btn.onclick = () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  };
  document.body.appendChild(btn);
}

{
  initMessageBridge,
  injectScript,
  addFloatingButton,
};


// === content/index.js ===
/**
 * Content Script 主入口
 * 注入到神舟平台页面
 */


console.log('🤖 数仓小助手已注入');

// 初始化消息桥接
initMessageBridge();

// 注入脚本到页面 MAIN 上下文
function initInjection() {
  // 立即注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
  } else {
    injectScript();
  }

  // load 事件后再次检查
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (typeof window.callWarehouseAssistant !== 'function') {
        console.warn('⚠️ load 事件后检查：函数不存在，重新注入...');
        injectScript();
      } else {
        console.log('✅ load 事件后检查：函数已存在');
      }

      // 通过 postMessage 检查函数是否存在
      window.postMessage({
        type: 'CHECK_WAREHOUSE_ASSISTANT',
        checkId: Date.now(),
      }, '*');
    }, 1000);
  });

  // 延迟检查
  setTimeout(() => {
    if (typeof window.callWarehouseAssistant !== 'function') {
      console.warn('⚠️ 延迟检查：函数不存在，尝试重新注入...');
      injectScript();
    }
  }, 2000);
}

// 初始化浮动按钮
function initFloatingButton() {
  if (document.readyState === 'complete') {
    addFloatingButton();
  } else {
    window.addEventListener('load', addFloatingButton);
  }
}

// 启动
initInjection();
initFloatingButton();

console.log('✅ 数仓小助手 content script 已加载');


})();
