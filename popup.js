(function() {
"use strict";

// === shared/constants.js ===
/**
 * 常量定义模块
 * 统一管理所有常量，避免魔法字符串
 */

// ==================== 存储相关 ====================
const STORAGE_PREFIX = 'ai_assistant_';
const storageKey = (key) => `${STORAGE_PREFIX}${key}`;

// 存储键名
const StorageKeys = {
  // 配置
  API_URL: 'apiUrl',
  API_TOKEN: 'apiToken',
  MODEL: 'model',
  WEBHOOK_URL: 'webhookUrl',
  CONFLUENCE_TOKEN: 'confluenceToken',
  CONFLUENCE_USERNAME: 'confluenceUsername',
  WEEKLY_REPORT_ROOT_PAGE_ID: 'weeklyReportRootPageId',
  MAX_STEPS: 'maxSteps',
  VERBOSE_LOGS: 'verboseLogs',
  THEME: 'theme',

  // 会话
  CHAT_SESSIONS: 'chatSessions',
  ACTIVE_SESSION_ID: 'activeSessionId',
  CHAT_HISTORY: 'chatHistory',

  // Skills
  CUSTOM_SKILLS: 'customSkills',

  // 任务
  TASK_LOGS: 'taskLogs',
  LAST_LOG_TIME: 'lastLogTime',
  LAST_RESULT: 'lastResult',
  LAST_TASK: 'lastTask',

  // 错误
  ERROR_HISTORY: 'errorHistory',

  // 操作历史
  ACTION_HISTORY: 'actionHistory',

  // 缓存
  PAGE_SNAPSHOT_CACHE: 'pageSnapshotCache',
  API_RESPONSE_CACHE: 'apiResponseCache',
};

// ==================== API 相关 ====================
const DEFAULT_API_URL = 'https://model-router.meitu.com/v1';
const DEFAULT_MODEL = 'gpt-5.2';
const FALLBACK_MODEL = 'gpt-5.2-chat';

// 模型最大 Token 限制
const MODEL_MAX_TOKENS = {
  'gpt-5.2': 32768,
  'gpt-5.2-chat': 32768,
  'glm-4.7': 128000,
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'deepseek-reasoner': 32768,
  'deepseek-v3.2': 32768,
  'minimax-m2.1': 65536,
};

// ==================== 任务执行相关 ====================
const DEFAULT_MAX_STEPS = 15;
const MAX_STEPS_LIMIT = 200;
const DEFAULT_TASK_TIMEOUT = 120000; // 2分钟
const AI_CALL_TIMEOUT = 60000; // 1分钟
const GEMINI_CALL_TIMEOUT = 20000; // Gemini 快速失败

// ==================== 神舟平台 URL ====================
const SHENZHOU_URLS = {
  BASE: 'https://shenzhou.tatstm.com',
  QUERY: 'https://shenzhou.tatstm.com/data-develop/query',
  TABLES: 'https://shenzhou.tatstm.com/data-manage/tables',
  TASKS: 'https://shenzhou.tatstm.com/data-develop/tasks',
  INSTANCES: 'https://shenzhou.tatstm.com/data-develop/instances',
  DEV: 'https://shenzhou.tatstm.com/data-develop/dev',
};

// ==================== Confluence 相关 ====================
const CONFLUENCE_BASE_URL = 'https://cf.meitu.com';
const DEFAULT_WEEKLY_REPORT_ROOT_PAGE_ID = '529775023';

// ==================== 扩展更新相关 ====================
const FALLBACK_UPDATE_MANIFEST_URL = 'https://linqingjian.github.io/chrome-extension/extension/update_manifest.xml';
const MANIFEST_UPDATE_URL = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
  ? chrome.runtime.getManifest().update_url
  : '';
const UPDATE_MANIFEST_URL = MANIFEST_UPDATE_URL || FALLBACK_UPDATE_MANIFEST_URL;
const EXTENSION_ZIP_BASE_URL = UPDATE_MANIFEST_URL.replace(/\/update_manifest\.xml$/i, '');
const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/linqingjian/chrome-extension/main/manifest.json';

// ==================== UI 相关 ====================
const DEFAULT_SESSION_TITLE = '新对话';
const WELCOME_MESSAGE = '你好！我是数仓小助手，可以帮你查询数据、执行SQL、查看表结构、分析任务、搜索文档等。有什么可以帮你的吗？';

// ==================== 安全相关 ====================
// 删除操作关键词
const DELETE_VERBS = ['删除', '移除', '清空', '清除', 'delete', 'remove', 'erase'];
const BLOCK_DELETE_OBJECTS = ['表', '任务', '作业', '节点', 'dag', 'node', 'table', 'task'];
const SAFE_DELETE_HINTS = ['取消删除', '撤销删除', '恢复', '放弃'];

// 危险 SQL 正则
const BLOCKED_SQL_REGEXES = [
  /\bdrop\s+table\b/i,
  /\bdrop\s+view\b/i,
];

// 敏感 URL 关键词
const DELETE_SENSITIVE_URL_HINTS = [
  'data-manage/tables',
  'data-develop/tasks',
  'data-develop/dev',
  'data-develop/instances',
  'dag',
  'workflow',
  'node',
];

// ==================== 特殊标记 ====================
const SCREENSHOT_REQUEST_TOKEN = '[[NEED_SCREENSHOT]]';


// === shared/utils.js ===
/**
 * 工具函数模块
 * 统一管理所有通用工具函数，避免重复实现
 */


// ==================== API URL 处理 ====================

/**
 * 规范化 API URL
 * @param {string} apiUrl - 原始 API URL
 * @param {string} defaultBase - 默认基础 URL
 * @returns {string} 规范化后的完整 URL
 */
function normalizeApiUrl(apiUrl, defaultBase = 'https://model-router.meitu.com/v1') {
  if (!apiUrl) {
    return `${defaultBase}/chat/completions`;
  }

  const trimmed = String(apiUrl).replace(/\/+$/u, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`;
  }
  return trimmed;
}

// ==================== 模型相关 ====================

/**
 * 获取模型的最大 Token 数
 * @param {string} modelName - 模型名称
 * @returns {number} 最大 Token 数
 */
function getModelMaxTokens(modelName) {
  const lower = String(modelName || '').toLowerCase().trim();
  if (!lower) return 2000;
  if (MODEL_MAX_TOKENS[lower]) return MODEL_MAX_TOKENS[lower];
  if (lower.startsWith('gpt-5')) return 32768;
  if (lower.startsWith('gpt-4o')) return 16384;
  if (lower.startsWith('deepseek')) return 32768;
  if (lower.startsWith('glm')) return 128000;
  return 2000;
}

/**
 * 判断是否为 Gemini 模型
 * @param {string} modelName - 模型名称
 * @returns {boolean}
 */
function isGeminiModel(modelName) {
  return typeof modelName === 'string' && modelName.toLowerCase().includes('gemini');
}

/**
 * 获取备选模型
 * @param {string} currentModel - 当前模型
 * @returns {string} 备选模型
 */
function getFallbackModel(currentModel) {
  if (currentModel === DEFAULT_MODEL) {
    return FALLBACK_MODEL;
  }
  return FALLBACK_MODEL;
}

// ==================== Skills 相关 ====================

/**
 * 规范化 Skill Handle
 * @param {string} value - 原始值
 * @returns {string} 规范化后的 handle
 */
function normalizeSkillHandle(value) {
  return String(value || '')
    .replace(/^@+/, '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * 获取 Skill 的 Handle
 * @param {Object} skill - Skill 对象
 * @returns {string} handle
 */
function getSkillHandle(skill) {
  return normalizeSkillHandle(skill?.handle || skill?.name || '');
}

/**
 * 从文本中提取 @skill 提及
 * @param {string} text - 文本内容
 * @returns {string[]} 提及的 skill handles
 */
function extractSkillMentions(text) {
  const normalized = String(text || '');
  const regex = /@([\w\u4e00-\u9fa5_-]+)/g;
  const mentions = new Set();
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const handle = normalizeSkillHandle(match[1]);
    if (handle) mentions.add(handle);
  }
  return Array.from(mentions);
}

// ==================== 存储相关 ====================

/**
 * 从存储结果中读取值（兼容带前缀和不带前缀的键）
 * @param {Object} result - chrome.storage.local.get 的结果
 * @param {string} key - 键名（不带前缀）
 * @param {string} prefix - 前缀
 * @returns {*} 值
 */
function readStoredValue(result, key, prefix = 'ai_assistant_') {
  const prefixed = `${prefix}${key}`;
  return result[prefixed] ?? result[key];
}

// ==================== 时间相关 ====================

/**
 * 延迟执行
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时的 Promise
 * @param {Promise} promise - 原始 Promise
 * @param {number} ms - 超时毫秒数
 * @param {string} errorMessage - 超时错误消息
 * @returns {Promise}
 */
function withTimeout(promise, ms, errorMessage = '操作超时') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * 格式化时间
 * @param {Date|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

/**
 * 格式化日期时间
 * @param {Date|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('zh-CN', { hour12: false });
}

// ==================== 字符串处理 ====================

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 截断后缀
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLength, suffix = '...') {
  const str = String(text || '');
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 构建会话标题
 * @param {string} text - 文本内容
 * @param {number} maxLength - 最大长度
 * @returns {string} 会话标题
 */
function buildSessionTitle(text, maxLength = 20) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '新对话';
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

// ==================== URL 处理 ====================

/**
 * 判断是否为可操作的页面 URL
 * @param {string} url - URL
 * @returns {boolean}
 */
function isOperablePageUrl(url) {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * 判断是否为神舟平台 URL
 * @param {string} url - URL
 * @returns {boolean}
 */
function isShenzhouUrl(url) {
  return !!url && url.includes('shenzhou.tatstm.com');
}

/**
 * 判断是否为临时查询页面
 * @param {string} url - URL
 * @returns {boolean}
 */
function isQueryPage(url) {
  return !!url && url.includes('data-develop/query');
}

// ==================== 剪贴板 ====================

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否成功
 */
async function copyTextToClipboard(text) {
  const content = String(text || '');
  if (!content) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch (e) {
    // 降级到 execCommand
  }

  // 降级方案
  try {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    return false;
  }
}

// ==================== 数组/对象处理 ====================

/**
 * 安全获取嵌套属性
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径，如 'a.b.c'
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值或默认值
 */
function getNestedValue(obj, path, defaultValue = undefined) {
  if (!obj || !path) return defaultValue;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  return result ?? defaultValue;
}

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return obj;
  }
}

// ==================== 生成器 ====================

/**
 * 生成唯一 ID
 * @param {string} prefix - 前缀
 * @returns {string} 唯一 ID
 */
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 生成请求 ID
 * @returns {string} 请求 ID
 */
function generateRequestId() {
  return generateId('req');
}

/**
 * 生成会话 ID
 * @returns {string} 会话 ID
 */
function generateSessionId() {
  return generateId('session');
}

/**
 * 生成 Skill ID
 * @returns {string} Skill ID
 */
function generateSkillId() {
  return generateId('skill');
}


// === shared/storage.js ===
/**
 * 存储管理模块
 * 统一管理 Chrome Extension 的数据存储
 */


/**
 * 存储管理器类
 */
class StorageManager {
  constructor(prefix = STORAGE_PREFIX) {
    this.prefix = prefix;
  }

  /**
   * 构建带前缀的键名
   * @param {string} key - 原始键名
   * @returns {string} 带前缀的键名
   */
  buildKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * 获取单个值
   * @param {string} key - 键名
   * @returns {Promise<*>} 值
   */
  async get(key) {
    return new Promise((resolve) => {
      const prefixedKey = this.buildKey(key);
      chrome.storage.local.get([prefixedKey, key], (result) => {
        resolve(readStoredValue(result, key, this.prefix));
      });
    });
  }

  /**
   * 获取多个值
   * @param {string[]} keys - 键名数组
   * @returns {Promise<Object>} 键值对象
   */
  async getMany(keys) {
    return new Promise((resolve) => {
      const allKeys = keys.flatMap(k => [this.buildKey(k), k]);
      chrome.storage.local.get(allKeys, (result) => {
        const mappedResult = {};
        keys.forEach(key => {
          mappedResult[key] = readStoredValue(result, key, this.prefix);
        });
        resolve(mappedResult);
      });
    });
  }

  /**
   * 设置单个值
   * @param {string} key - 键名
   * @param {*} value - 值
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.buildKey(key)]: value }, resolve);
    });
  }

  /**
   * 设置多个值
   * @param {Object} data - 键值对象
   * @returns {Promise<void>}
   */
  async setMany(data) {
    const prefixedData = {};
    for (const [key, value] of Object.entries(data)) {
      prefixedData[this.buildKey(key)] = value;
    }
    return new Promise((resolve) => {
      chrome.storage.local.set(prefixedData, resolve);
    });
  }

  /**
   * 删除单个值
   * @param {string} key - 键名
   * @returns {Promise<void>}
   */
  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([this.buildKey(key), key], resolve);
    });
  }

  /**
   * 删除多个值
   * @param {string[]} keys - 键名数组
   * @returns {Promise<void>}
   */
  async removeMany(keys) {
    const allKeys = keys.flatMap(k => [this.buildKey(k), k]);
    return new Promise((resolve) => {
      chrome.storage.local.remove(allKeys, resolve);
    });
  }

  /**
   * 清空所有数据
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }

  /**
   * 监听存储变化
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消监听的函数
   */
  onChanged(callback) {
    const listener = (changes, areaName) => {
      if (areaName !== 'local') return;

      const mappedChanges = {};
      for (const [key, change] of Object.entries(changes)) {
        // 处理带前缀的键
        if (key.startsWith(this.prefix)) {
          const originalKey = key.slice(this.prefix.length);
          mappedChanges[originalKey] = change;
        } else {
          // 也处理不带前缀的键
          mappedChanges[key] = change;
        }
      }

      if (Object.keys(mappedChanges).length > 0) {
        callback(mappedChanges);
      }
    };

    chrome.storage.onChanged.addListener(listener);

    // 返回取消监听的函数
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

// 创建全局单例
const storage = new StorageManager();

// ==================== 便捷函数 ====================

/**
 * 加载配置
 * @returns {Promise<Object>} 配置对象
 */
async function loadConfig() {
  return storage.getMany([
    StorageKeys.API_URL,
    StorageKeys.API_TOKEN,
    StorageKeys.MODEL,
    StorageKeys.WEBHOOK_URL,
    StorageKeys.CONFLUENCE_TOKEN,
    StorageKeys.CONFLUENCE_USERNAME,
    StorageKeys.WEEKLY_REPORT_ROOT_PAGE_ID,
    StorageKeys.MAX_STEPS,
    StorageKeys.VERBOSE_LOGS,
    StorageKeys.THEME,
  ]);
}

/**
 * 保存配置
 * @param {Object} config - 配置对象
 * @returns {Promise<void>}
 */
async function saveConfig(config) {
  return storage.setMany(config);
}

/**
 * 加载聊天会话
 * @returns {Promise<Object>} { sessions, activeSessionId }
 */
async function loadChatSessions() {
  const data = await storage.getMany([
    StorageKeys.CHAT_SESSIONS,
    StorageKeys.ACTIVE_SESSION_ID,
    StorageKeys.CHAT_HISTORY, // 兼容旧版
  ]);

  return {
    sessions: data[StorageKeys.CHAT_SESSIONS] || [],
    activeSessionId: data[StorageKeys.ACTIVE_SESSION_ID] || null,
    legacyHistory: data[StorageKeys.CHAT_HISTORY] || [],
  };
}

/**
 * 保存聊天会话
 * @param {Array} sessions - 会话数组
 * @param {string} activeSessionId - 当前活动会话 ID
 * @returns {Promise<void>}
 */
async function saveChatSessions(sessions, activeSessionId) {
  return storage.setMany({
    [StorageKeys.CHAT_SESSIONS]: sessions,
    [StorageKeys.ACTIVE_SESSION_ID]: activeSessionId,
  });
}

/**
 * 加载自定义 Skills
 * @returns {Promise<Array>} Skills 数组
 */
async function loadCustomSkills() {
  const skills = await storage.get(StorageKeys.CUSTOM_SKILLS);
  return Array.isArray(skills) ? skills : [];
}

/**
 * 保存自定义 Skills
 * @param {Array} skills - Skills 数组
 * @returns {Promise<void>}
 */
async function saveCustomSkills(skills) {
  return storage.set(StorageKeys.CUSTOM_SKILLS, skills);
}

/**
 * 加载任务日志
 * @returns {Promise<Array>} 日志数组
 */
async function loadTaskLogs() {
  const logs = await storage.get(StorageKeys.TASK_LOGS);
  return Array.isArray(logs) ? logs : [];
}

/**
 * 保存任务日志
 * @param {Array} logs - 日志数组
 * @param {number} maxLogs - 最大日志数量
 * @returns {Promise<void>}
 */
async function saveTaskLogs(logs, maxLogs = 1000) {
  const logsToSave = logs.slice(-maxLogs);
  return storage.setMany({
    [StorageKeys.TASK_LOGS]: logsToSave,
    [StorageKeys.LAST_LOG_TIME]: new Date().toISOString(),
  });
}

/**
 * 清空任务日志
 * @returns {Promise<void>}
 */
async function clearTaskLogs() {
  return storage.removeMany([StorageKeys.TASK_LOGS, StorageKeys.LAST_LOG_TIME]);
}

/**
 * 保存最后结果
 * @param {string} task - 任务描述
 * @param {string} result - 结果
 * @returns {Promise<void>}
 */
async function saveLastResult(task, result) {
  return storage.setMany({
    [StorageKeys.LAST_TASK]: task,
    [StorageKeys.LAST_RESULT]: result,
  });
}

/**
 * 获取最后结果
 * @returns {Promise<Object>} { task, result }
 */
async function getLastResult() {
  return storage.getMany([StorageKeys.LAST_TASK, StorageKeys.LAST_RESULT]);
}

storage;


// === shared/message-types.js ===
/**
 * 消息类型定义模块
 * 统一管理所有消息类型，避免字符串散落各处
 */

// ==================== 任务相关消息 ====================
const TaskMessages = {
  // 任务控制
  START_TASK: 'START_TASK',
  TASK_PAUSE: 'TASK_PAUSE',
  TASK_RESUME: 'TASK_RESUME',
  TASK_CANCEL: 'TASK_CANCEL',

  // 任务状态
  GET_STATUS: 'GET_STATUS',
  TASK_PROGRESS: 'TASK_PROGRESS',
  TASK_COMPLETE: 'TASK_COMPLETE',
  TASK_ERROR: 'TASK_ERROR',
  TASK_PAUSED: 'TASK_PAUSED',
  TASK_RESUMED: 'TASK_RESUMED',
  TASK_CANCELED: 'TASK_CANCELED',
  TASK_STATUS_UPDATE: 'TASK_STATUS_UPDATE',

  // 结果
  GET_LAST_RESULT: 'GET_LAST_RESULT',
};

// ==================== 聊天相关消息 ====================
const ChatMessages = {
  // 普通聊天
  CHAT_MESSAGE: 'CHAT_MESSAGE',

  // 流式聊天
  CHAT_MESSAGE_STREAM: 'CHAT_MESSAGE_STREAM',
  CHAT_STREAM: 'CHAT_STREAM',
  CHAT_STREAM_DONE: 'CHAT_STREAM_DONE',
  CHAT_STREAM_ERROR: 'CHAT_STREAM_ERROR',
  CHAT_STREAM_STATUS: 'CHAT_STREAM_STATUS',
  CHAT_STREAM_CANCEL: 'CHAT_STREAM_CANCEL',
};

// ==================== 日志相关消息 ====================
const LogMessages = {
  LOG_UPDATE: 'LOG_UPDATE',
  GET_LOGS: 'GET_LOGS',
  CLEAR_LOGS: 'CLEAR_LOGS',
};

// ==================== 页面相关消息 ====================
const PageMessages = {
  // 页面同步
  SYNC_PAGE_CONTEXT: 'SYNC_PAGE_CONTEXT',

  // Content Script 操作
  GET_PAGE_SNAPSHOT: 'getPageSnapshot',
  EXECUTE_SQL: 'executeSQL',
  CLICK_ELEMENT: 'clickElement',
  TYPE_TEXT: 'typeText',
  GET_QUERY_RESULT: 'getQueryResult',
};

// ==================== UI 相关消息 ====================
const UIMessages = {
  OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL',
  OPEN_POPUP: 'openPopup',
};

// ==================== 外部服务消息 ====================
const ExternalMessages = {
  SEND_TO_WECHAT: 'SEND_TO_WECHAT',
};

// ==================== 页面注入脚本消息 ====================
const InjectedMessages = {
  // Content Script <-> Injected Script
  CALL_WAREHOUSE_ASSISTANT: 'CALL_WAREHOUSE_ASSISTANT',
  WAREHOUSE_ASSISTANT_RESPONSE: 'WAREHOUSE_ASSISTANT_RESPONSE',
  WAREHOUSE_ASSISTANT_STATUS_UPDATE: 'WAREHOUSE_ASSISTANT_STATUS_UPDATE',
  CHECK_WAREHOUSE_ASSISTANT: 'CHECK_WAREHOUSE_ASSISTANT',
  WAREHOUSE_ASSISTANT_CHECK_RESPONSE: 'WAREHOUSE_ASSISTANT_CHECK_RESPONSE',
};

// ==================== Keep Alive 消息 ====================
const KeepAliveMessages = {
  PING: 'PING',
  PONG: 'PONG',
};

// 导出所有消息类型的扁平对象（向后兼容）
const MessageTypes = {
  ...TaskMessages,
  ...ChatMessages,
  ...LogMessages,
  ...PageMessages,
  ...UIMessages,
  ...ExternalMessages,
  ...InjectedMessages,
  ...KeepAliveMessages,
};

MessageTypes;


// === popup/session-manager.js ===
/**
 * 会话管理模块
 * 处理聊天会话的增删改查
 */


/**
 * 会话管理器类
 */
class SessionManager {
  constructor() {
    this.sessions = [];
    this.activeSessionId = null;
    this.chatHistory = [];
    this.listeners = new Set();
    this.saveTimer = null;
    this.savePending = false;
    this.saveDelayMs = 300;
  }

  /**
   * 添加变更监听器
   * @param {Function} listener - 监听函数
   * @returns {Function} 取消监听的函数
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener({
          sessions: this.sessions,
          activeSessionId: this.activeSessionId,
          chatHistory: this.chatHistory,
        });
      } catch (e) {
        console.error('会话监听器错误:', e);
      }
    });
  }

  /**
   * 从存储加载会话
   */
  async load() {
    try {
      const data = await storage.getMany([
        StorageKeys.CHAT_SESSIONS,
        StorageKeys.ACTIVE_SESSION_ID,
        StorageKeys.CHAT_HISTORY, // 兼容旧版
      ]);

      const storedSessions = data[StorageKeys.CHAT_SESSIONS];
      const storedActive = data[StorageKeys.ACTIVE_SESSION_ID];
      const legacyHistory = data[StorageKeys.CHAT_HISTORY];

      if (Array.isArray(storedSessions) && storedSessions.length > 0) {
        this.sessions = storedSessions;
        this.activeSessionId = storedActive || storedSessions[0].id;

        const active = this.sessions.find(s => s.id === this.activeSessionId) || this.sessions[0];
        this.activeSessionId = active?.id || null;
        this.chatHistory = Array.isArray(active?.messages) ? [...active.messages] : [];
      } else if (Array.isArray(legacyHistory) && legacyHistory.length > 0) {
        // 迁移旧版数据
        const id = generateSessionId();
        this.sessions = [{
          id,
          title: DEFAULT_SESSION_TITLE,
          autoTitle: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: legacyHistory,
        }];
        this.activeSessionId = id;
        this.chatHistory = legacyHistory;
      } else {
        this.sessions = [];
        this.activeSessionId = null;
        this.chatHistory = [];
      }

      this.notifyListeners();
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  }

  /**
   * 保存会话到存储
   */
  async save() {
    try {
      // 更新当前会话的消息
      if (this.activeSessionId) {
        const session = this.sessions.find(s => s.id === this.activeSessionId);
        if (session) {
          session.messages = this.chatHistory.slice(-80);
          session.updatedAt = Date.now();
        }
      }

      await storage.setMany({
        [StorageKeys.CHAT_SESSIONS]: this.sessions,
        [StorageKeys.ACTIVE_SESSION_ID]: this.activeSessionId,
      });
    } catch (error) {
      console.error('保存会话失败:', error);
    }
  }

  scheduleSave() {
    this.savePending = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushSave();
    }, this.saveDelayMs);
  }

  async flushSave() {
    if (!this.savePending) return;
    this.savePending = false;
    await this.save();
  }

  /**
   * 确保有活动会话
   * @param {string} initialTitle - 初始标题
   */
  ensureActiveSession(initialTitle = '') {
    if (this.activeSessionId) return;

    const id = generateSessionId();
    const title = initialTitle ? buildSessionTitle(initialTitle) : DEFAULT_SESSION_TITLE;

    const session = {
      id,
      title,
      autoTitle: !initialTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    this.sessions.unshift(session);
    this.activeSessionId = id;
    this.chatHistory = [];

    this.notifyListeners();
    this.scheduleSave();
  }

  /**
   * 创建新会话
   * @param {string} title - 会话标题
   * @returns {Object} 新会话
   */
  createSession(title = '') {
    const id = generateSessionId();
    const session = {
      id,
      title: title || DEFAULT_SESSION_TITLE,
      autoTitle: !title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    this.sessions.unshift(session);
    this.activeSessionId = id;
    this.chatHistory = [];

    this.notifyListeners();
    this.scheduleSave();

    return session;
  }

  /**
   * 切换到指定会话
   * @param {string} sessionId - 会话 ID
   */
  switchSession(sessionId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    this.activeSessionId = sessionId;
    this.chatHistory = Array.isArray(session.messages) ? [...session.messages] : [];

    this.notifyListeners();
    this.scheduleSave();
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话 ID
   */
  deleteSession(sessionId) {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);

    if (this.activeSessionId === sessionId) {
      if (this.sessions.length > 0) {
        this.activeSessionId = this.sessions[0].id;
        this.chatHistory = Array.isArray(this.sessions[0].messages) ? [...this.sessions[0].messages] : [];
      } else {
        this.activeSessionId = null;
        this.chatHistory = [];
      }
    }

    this.notifyListeners();
    this.scheduleSave();
  }

  /**
   * 添加消息到当前会话
   * @param {string} role - 角色 (user/assistant)
   * @param {string} content - 消息内容
   */
  addMessage(role, content) {
    const text = String(content || '').trim();
    if (!text) return;

    // 确保有活动会话
    this.ensureActiveSession();

    // 截断过长内容
    const clipped = text.length > 6000 ? `${text.slice(0, 6000)}\n\n[已截断]` : text;

    const message = {
      role,
      content: clipped,
      ts: Date.now(),
    };

    this.chatHistory.push(message);

    // 自动生成标题
    const session = this.sessions.find(s => s.id === this.activeSessionId);
    if (session && session.autoTitle && role === 'user') {
      session.title = buildSessionTitle(clipped);
      session.autoTitle = false;
    }

    // 限制历史长度
    if (this.chatHistory.length > 40) {
      this.chatHistory = this.chatHistory.slice(-40);
    }

    this.notifyListeners();
    this.scheduleSave();
  }

  /**
   * 获取当前会话
   * @returns {Object|null} 当前会话
   */
  getCurrentSession() {
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }

  /**
   * 获取所有会话（按更新时间排序）
   * @returns {Array} 会话数组
   */
  getSortedSessions() {
    return [...this.sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  /**
   * 构建上下文文本
   * @param {number} maxItems - 最大消息数
   * @returns {string} 上下文文本
   */
  buildContextText(maxItems = 12) {
    const items = this.chatHistory.slice(-maxItems);
    if (items.length === 0) return '';

    return items
      .map(m => `${m.role === 'user' ? '用户' : '助手'}：${String(m.content || '').replace(/\s+$/g, '')}`)
      .join('\n');
  }

  /**
   * 清空当前会话历史
   */
  clearCurrentHistory() {
    this.chatHistory = [];

    const session = this.sessions.find(s => s.id === this.activeSessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
    }

    this.notifyListeners();
    this.scheduleSave();
  }
}

// 创建全局单例
const sessionManager = new SessionManager();

sessionManager;


// === popup/skills-manager.js ===
/**
 * Skills 管理模块 (Popup 端)
 * 处理自定义技能的 UI 管理
 */


/**
 * Skills 管理器类
 */
class SkillsManager {
  constructor() {
    this.skills = [];
    this.editingSkillId = null;
    this.listeners = new Set();
  }

  /**
   * 添加变更监听器
   * @param {Function} listener - 监听函数
   * @returns {Function} 取消监听的函数
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener({
          skills: this.skills,
          editingSkillId: this.editingSkillId,
        });
      } catch (e) {
        console.error('Skills 监听器错误:', e);
      }
    });
  }

  /**
   * 从存储加载 Skills
   */
  async load() {
    try {
      const skills = await storage.get(StorageKeys.CUSTOM_SKILLS);
      this.skills = Array.isArray(skills)
        ? skills.map(skill => ({
            ...skill,
            handle: getSkillHandle(skill) || normalizeSkillHandle(skill?.name || ''),
          }))
        : [];
      this.notifyListeners();
    } catch (error) {
      console.error('加载 Skills 失败:', error);
    }
  }

  /**
   * 保存 Skills 到存储
   */
  async save() {
    try {
      await storage.set(StorageKeys.CUSTOM_SKILLS, this.skills);
    } catch (error) {
      console.error('保存 Skills 失败:', error);
    }
  }

  /**
   * 添加新 Skill
   * @param {Object} skillData - Skill 数据
   * @returns {Object} 新 Skill
   */
  addSkill(skillData) {
    const skill = {
      id: generateSkillId(),
      name: skillData.name || '',
      description: skillData.description || '',
      prompt: skillData.prompt || '',
      handle: getSkillHandle({ name: skillData.name }),
      enabled: true,
    };

    this.skills.unshift(skill);
    this.notifyListeners();
    this.save();

    return skill;
  }

  /**
   * 更新 Skill
   * @param {string} skillId - Skill ID
   * @param {Object} updates - 更新数据
   */
  updateSkill(skillId, updates) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    if (updates.name !== undefined) {
      skill.name = updates.name;
      skill.handle = getSkillHandle({ name: updates.name });
    }
    if (updates.description !== undefined) {
      skill.description = updates.description;
    }
    if (updates.prompt !== undefined) {
      skill.prompt = updates.prompt;
    }
    if (updates.enabled !== undefined) {
      skill.enabled = updates.enabled;
    }

    this.notifyListeners();
    this.save();
  }

  /**
   * 删除 Skill
   * @param {string} skillId - Skill ID
   */
  deleteSkill(skillId) {
    this.skills = this.skills.filter(s => s.id !== skillId);

    if (this.editingSkillId === skillId) {
      this.editingSkillId = null;
    }

    this.notifyListeners();
    this.save();
  }

  /**
   * 切换 Skill 启用状态
   * @param {string} skillId - Skill ID
   */
  toggleSkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (skill) {
      skill.enabled = !skill.enabled;
      this.notifyListeners();
      this.save();
    }
  }

  /**
   * 开始编辑 Skill
   * @param {string} skillId - Skill ID
   */
  startEditing(skillId) {
    this.editingSkillId = skillId;
    this.notifyListeners();
  }

  /**
   * 取消编辑
   */
  cancelEditing() {
    this.editingSkillId = null;
    this.notifyListeners();
  }

  /**
   * 保存或创建 Skill（从表单）
   * @param {Object} formData - 表单数据
   */
  saveFromForm(formData) {
    const { name, description, prompt } = formData;

    if (!name?.trim()) {
      return { success: false, error: '名称不能为空' };
    }

    if (this.editingSkillId) {
      this.updateSkill(this.editingSkillId, { name, description, prompt });
      this.editingSkillId = null;
    } else {
      this.addSkill({ name, description, prompt });
    }

    this.notifyListeners();
    return { success: true };
  }

  /**
   * 获取正在编辑的 Skill
   * @returns {Object|null} Skill 对象
   */
  getEditingSkill() {
    if (!this.editingSkillId) return null;
    return this.skills.find(s => s.id === this.editingSkillId) || null;
  }

  /**
   * 获取启用的 Skills
   * @returns {Array} 启用的 Skills
   */
  getEnabledSkills() {
    return this.skills.filter(s => s.enabled !== false);
  }

  /**
   * 根据 handle 查找 Skill
   * @param {string} handle - Skill handle
   * @returns {Object|null} Skill 对象
   */
  findByHandle(handle) {
    const normalized = normalizeSkillHandle(handle);
    return this.skills.find(s => getSkillHandle(s) === normalized) || null;
  }

  /**
   * 获取缺失的 Skill 提及
   * @param {Array} mentions - 提及的 handles
   * @returns {Array} 缺失的 handles
   */
  getMissingMentions(mentions) {
    const handles = new Set(this.skills.map(getSkillHandle).filter(Boolean));
    return (mentions || []).filter(m => !handles.has(normalizeSkillHandle(m)));
  }
}

// 创建全局单例
const skillsManager = new SkillsManager();

skillsManager;


// === popup/chat-ui.js ===
/**
 * 聊天 UI 模块
 * 处理聊天界面的渲染和交互
 */


/**
 * 创建代码块元素
 * @param {string} code - 代码内容
 * @param {string} lang - 语言
 * @returns {HTMLElement} 代码块元素
 */
function createCodeBlockElement(code, lang) {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';

  const header = document.createElement('div');
  header.className = 'code-block-header';

  const label = document.createElement('span');
  label.className = 'lang';
  label.textContent = lang || 'TEXT';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'code-copy-btn';
  copyBtn.textContent = '复制';
  copyBtn.addEventListener('click', async () => {
    await copyTextToClipboard(code);
    copyBtn.textContent = '已复制';
    setTimeout(() => {
      copyBtn.textContent = '复制';
    }, 1200);
  });

  header.appendChild(label);
  header.appendChild(copyBtn);

  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  wrapper.appendChild(header);
  wrapper.appendChild(pre);

  return wrapper;
}

/**
 * 渲染消息内容（处理代码块）
 * @param {HTMLElement} container - 容器元素
 * @param {string} text - 文本内容
 */
function renderMessageContent(container, text) {
  if (!container) return;
  container.innerHTML = '';

  const rawText = String(text || '');
  if (!rawText) return;

  const normalized = rawText.replace(/\r\n/g, '\n');
  const regex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  const fragment = document.createDocumentFragment();

  while ((match = regex.exec(normalized)) !== null) {
    const [full, lang, code] = match;

    // 添加代码块之前的文本
    if (match.index > lastIndex) {
      const textPart = normalized.slice(lastIndex, match.index);
      fragment.appendChild(document.createTextNode(textPart));
    }

    // 添加代码块
    const cleanCode = String(code || '').replace(/\n$/, '');
    fragment.appendChild(createCodeBlockElement(cleanCode, lang));

    lastIndex = match.index + full.length;
  }

  // 添加剩余文本
  if (lastIndex < normalized.length) {
    fragment.appendChild(document.createTextNode(normalized.slice(lastIndex)));
  }

  container.appendChild(fragment);
}

/**
 * 渲染机器人回复（带思考过程处理）
 * @param {HTMLElement} bubble - 气泡元素
 * @param {string} content - 内容
 */
function renderBotReplyIntoBubble(bubble, content) {
  if (!bubble) return;

  // 检查是否有思考过程标记
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    const thinkContent = thinkMatch[1].trim();
    const mainContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();

    // 创建思考过程折叠区域
    if (thinkContent) {
      const thinkSection = document.createElement('details');
      thinkSection.className = 'think-section';

      const summary = document.createElement('summary');
      summary.textContent = '💭 思考过程';
      thinkSection.appendChild(summary);

      const thinkBody = document.createElement('div');
      thinkBody.className = 'think-content';
      renderMessageContent(thinkBody, thinkContent);
      thinkSection.appendChild(thinkBody);

      bubble.appendChild(thinkSection);
    }

    // 渲染主要内容
    if (mainContent) {
      const mainDiv = document.createElement('div');
      mainDiv.className = 'main-content';
      renderMessageContent(mainDiv, mainContent);
      bubble.appendChild(mainDiv);
    }
  } else {
    renderMessageContent(bubble, content);
  }
}

/**
 * 创建消息元素
 * @param {Object} message - 消息对象
 * @returns {HTMLElement} 消息元素
 */
function createMessageElement(message) {
  const isUser = message.role === 'user';
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (isUser) {
    renderMessageContent(bubble, message.content || '');
  } else {
    renderBotReplyIntoBubble(bubble, message.content || '');
  }

  const time = document.createElement('div');
  time.className = 'message-time';
  const ts = message.ts ? new Date(message.ts) : new Date();
  time.textContent = ts.toLocaleTimeString('zh-CN');

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(time);

  return messageDiv;
}

/**
 * 创建欢迎消息元素
 * @returns {HTMLElement} 欢迎消息元素
 */
function createWelcomeMessage() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message bot-message';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  renderMessageContent(bubble, WELCOME_MESSAGE);

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString('zh-CN');

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(time);

  return messageDiv;
}

/**
 * 创建会话列表项
 * @param {Object} session - 会话对象
 * @param {boolean} isActive - 是否为当前活动会话
 * @param {Object} callbacks - 回调函数
 * @returns {HTMLElement} 会话列表项元素
 */
function createSessionListItem(session, isActive, callbacks) {
  const item = document.createElement('div');
  item.className = `chat-session-item${isActive ? ' active' : ''}`;

  const title = document.createElement('div');
  title.className = 'chat-session-item-title';
  title.textContent = session.title || '新对话';

  const meta = document.createElement('div');
  meta.className = 'chat-session-item-meta';

  const timeText = document.createElement('span');
  const ts = session.updatedAt || session.createdAt;
  timeText.textContent = ts
    ? new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = '×';
  deleteBtn.title = '删除';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (callbacks.onDelete) {
      callbacks.onDelete(session.id);
    }
  });

  meta.appendChild(timeText);
  meta.appendChild(deleteBtn);

  item.appendChild(title);
  item.appendChild(meta);

  item.addEventListener('click', () => {
    if (callbacks.onSelect) {
      callbacks.onSelect(session.id);
    }
  });

  return item;
}

/**
 * 创建 Skill 列表项
 * @param {Object} skill - Skill 对象
 * @param {Object} callbacks - 回调函数
 * @returns {HTMLElement} Skill 列表项元素
 */
function createSkillListItem(skill, callbacks) {
  const item = document.createElement('div');
  item.className = 'skill-item';

  const header = document.createElement('div');
  header.className = 'skill-item-header';

  const title = document.createElement('div');
  title.className = 'skill-item-title';
  const handle = skill.handle || '';
  title.textContent = handle ? `${skill.name} (@${handle})` : skill.name;

  const actions = document.createElement('div');
  actions.className = 'skill-item-actions';

  // 启用开关
  const toggleLabel = document.createElement('label');
  toggleLabel.style.display = 'inline-flex';
  toggleLabel.style.alignItems = 'center';
  toggleLabel.style.gap = '4px';

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.checked = skill.enabled !== false;
  toggle.addEventListener('change', () => {
    if (callbacks.onToggle) {
      callbacks.onToggle(skill.id, toggle.checked);
    }
  });

  const toggleText = document.createElement('span');
  toggleText.style.fontSize = '11px';
  toggleText.textContent = '启用';

  toggleLabel.appendChild(toggle);
  toggleLabel.appendChild(toggleText);

  // 编辑按钮
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = '编辑';
  editBtn.addEventListener('click', () => {
    if (callbacks.onEdit) {
      callbacks.onEdit(skill.id);
    }
  });

  // 删除按钮
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = '删除';
  deleteBtn.addEventListener('click', () => {
    if (callbacks.onDelete) {
      callbacks.onDelete(skill.id);
    }
  });

  actions.appendChild(toggleLabel);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(title);
  header.appendChild(actions);

  const desc = document.createElement('div');
  desc.className = 'skill-item-desc';
  desc.textContent = skill.description || '（暂无描述）';

  const hint = document.createElement('div');
  hint.className = 'skill-hint';
  hint.textContent = skill.prompt ? `说明: ${skill.prompt}` : '说明: -';

  item.appendChild(header);
  item.appendChild(desc);
  item.appendChild(hint);

  return item;
}

/**
 * 更新聊天状态显示
 * @param {HTMLElement} statusEl - 状态元素
 * @param {string} text - 状态文本
 * @param {string} type - 状态类型
 */
function updateChatStatus(statusEl, text, type = '') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `chat-status ${type}`;
}

/**
 * 设置聊天控制按钮状态
 * @param {Object} buttons - 按钮元素对象
 * @param {Object} state - 状态对象
 */
function setChatControlButtons(buttons, state) {
  const { pauseBtn, resumeBtn, cancelBtn } = buttons;
  const { running = false, paused = false, streaming = false } = state;

  if (!pauseBtn || !resumeBtn || !cancelBtn) return;

  if (streaming) {
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    cancelBtn.style.display = 'inline-flex';
    cancelBtn.textContent = '⏹';
    cancelBtn.title = '停止回复';
    return;
  }

  cancelBtn.textContent = '⛔';
  cancelBtn.title = '停止任务';

  if (!running) {
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    return;
  }

  cancelBtn.style.display = 'inline-flex';

  if (paused) {
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'inline-flex';
  } else {
    pauseBtn.style.display = 'inline-flex';
    resumeBtn.style.display = 'none';
  }
}

/**
 * 应用主题
 * @param {string} theme - 主题名称
 */
function applyTheme(theme) {
  const body = document.body;
  if (!body) return;

  if (theme === 'light') {
    body.classList.add('theme-light');
  } else {
    body.classList.remove('theme-light');
  }
}

// === popup/index.js ===
/**
 * Popup 主入口
 * 初始化和协调各个模块
 */



// ==================== DOM 元素 ====================
let elements = {};

// ==================== 状态 ====================
let isTaskRunning = false;
let taskLogs = [];
let lastTaskText = '';
let chatStreamRequestId = null;
let chatStreamBuffer = '';
let chatStreamBubbleEl = null;
let keepAlivePort = null;
let keepAliveTimer = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  await loadConfig();
  await sessionManager.load();
  await skillsManager.load();
  taskLogs = await loadTaskLogs();

  setupEventListeners();
  setupMessageListeners();
  setupKeepAlive();
  window.addEventListener('pagehide', () => {
    sessionManager.flushSave();
  });

  renderUI();
});

/**
 * 初始化 DOM 元素引用
 */
function initElements() {
  elements = {
    // 聊天相关
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    chatSendBtn: document.getElementById('chatSendBtn'),
    chatStatus: document.getElementById('chatStatus'),
    chatMode: document.getElementById('chatMode'),
    chatShowPlanToggle: document.getElementById('chatShowPlan'),
    chatSyncPageButton: document.getElementById('chatSyncPage'),
    pinBtn: document.getElementById('pinBtn'),

    // 控制按钮
    pauseBtn: document.getElementById('pauseBtn'),
    resumeBtn: document.getElementById('resumeBtn'),
    cancelBtn: document.getElementById('cancelBtn'),

    // 会话相关
    sessionToggle: document.getElementById('sessionToggle'),
    chatSidebar: document.getElementById('chatSidebar'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatSessionList: document.getElementById('chatSessionList'),

    // 配置相关
    apiUrl: document.getElementById('apiUrl'),
    apiToken: document.getElementById('apiToken'),
    model: document.getElementById('model'),
    themeSelect: document.getElementById('themeSelect'),
    verboseLogsToggle: document.getElementById('verboseLogsToggle'),

    // Skills 相关
    skillNameInput: document.getElementById('skillNameInput'),
    skillDescInput: document.getElementById('skillDescInput'),
    skillPromptInput: document.getElementById('skillPromptInput'),
    skillSaveBtn: document.getElementById('skillSaveBtn'),
    skillCancelBtn: document.getElementById('skillCancelBtn'),
    skillsList: document.getElementById('skillsList'),
    skillSuggest: document.getElementById('skillSuggest'),

    // 附件相关
    attachBtn: document.getElementById('attachBtn'),
    screenshotBtn: document.getElementById('screenshotBtn'),
    fileInput: document.getElementById('fileInput'),
    attachmentBar: document.getElementById('attachmentBar'),

    // 任务相关
    taskInput: document.getElementById('taskInput'),
    executeBtn: document.getElementById('executeBtn'),
    sendBtn: document.getElementById('sendBtn'),
    exportLogsBtn: document.getElementById('exportLogsBtn'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    outputArea: document.getElementById('outputArea'),
    resultSection: document.getElementById('resultSection'),
    resultTitle: document.getElementById('resultTitle'),
    resultContent: document.getElementById('resultContent'),
    resultIcon: document.getElementById('resultIcon'),

    // 其他
    downloadExtensionBtn: document.getElementById('downloadExtensionBtn'),
    chatIncludePageContextToggle: document.getElementById('chatIncludePageContext'),
  };
}

/**
 * 加载配置
 */
async function loadConfig() {
  try {
    const config = await storage.getMany([
      StorageKeys.API_URL,
      StorageKeys.API_TOKEN,
      StorageKeys.MODEL,
      StorageKeys.THEME,
      StorageKeys.VERBOSE_LOGS,
    ]);

    if (elements.apiUrl) {
      elements.apiUrl.value = config[StorageKeys.API_URL] || DEFAULT_API_URL;
    }
    if (elements.apiToken) {
      elements.apiToken.value = config[StorageKeys.API_TOKEN] || '';
    }
    if (elements.model) {
      elements.model.value = config[StorageKeys.MODEL] || DEFAULT_MODEL;
    }
    if (elements.themeSelect) {
      elements.themeSelect.value = config[StorageKeys.THEME] || 'light';
      applyTheme(config[StorageKeys.THEME] || 'light');
    }
    if (elements.verboseLogsToggle) {
      elements.verboseLogsToggle.checked = !!config[StorageKeys.VERBOSE_LOGS];
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

/**
 * 保存配置
 */
async function saveConfig() {
  try {
    await storage.setMany({
      [StorageKeys.API_URL]: elements.apiUrl?.value?.trim() || DEFAULT_API_URL,
      [StorageKeys.API_TOKEN]: elements.apiToken?.value?.trim() || '',
      [StorageKeys.MODEL]: elements.model?.value?.trim() || DEFAULT_MODEL,
      [StorageKeys.THEME]: elements.themeSelect?.value || 'light',
      [StorageKeys.VERBOSE_LOGS]: elements.verboseLogsToggle?.checked || false,
    });
  } catch (error) {
    console.error('保存配置失败:', error);
  }
}

// ==================== 事件监听 ====================

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  setupTabs();

  // 发送消息
  elements.chatSendBtn?.addEventListener('click', handleSendMessage);
  elements.chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // 控制按钮
  elements.pauseBtn?.addEventListener('click', handlePause);
  elements.resumeBtn?.addEventListener('click', handleResume);
  elements.cancelBtn?.addEventListener('click', handleCancel);

  // 会话管理
  elements.sessionToggle?.addEventListener('click', toggleSidebar);
  elements.newChatBtn?.addEventListener('click', handleNewChat);
  elements.pinBtn?.addEventListener('click', handleOpenSidePanel);

  // 配置变更
  elements.apiUrl?.addEventListener('change', saveConfig);
  elements.apiToken?.addEventListener('change', saveConfig);
  elements.model?.addEventListener('change', saveConfig);
  elements.themeSelect?.addEventListener('change', () => {
    applyTheme(elements.themeSelect.value);
    saveConfig();
  });
  elements.verboseLogsToggle?.addEventListener('change', saveConfig);

  // Skills 管理
  elements.skillSaveBtn?.addEventListener('click', handleSaveSkill);
  elements.skillCancelBtn?.addEventListener('click', handleCancelSkillEdit);

  // 附件
  elements.attachBtn?.addEventListener('click', () => elements.fileInput?.click());
  elements.fileInput?.addEventListener('change', handleFileSelect);
  elements.screenshotBtn?.addEventListener('click', handleScreenshot);

  // 页面同步
  elements.chatSyncPageButton?.addEventListener('click', handleSyncPage);

  // 下载扩展
  elements.downloadExtensionBtn?.addEventListener('click', handleDownloadExtension);

  // Skill 建议
  elements.chatInput?.addEventListener('input', updateSkillSuggest);
  elements.chatInput?.addEventListener('keydown', handleSkillSuggestKeydown);

  // 任务执行
  elements.executeBtn?.addEventListener('click', handleExecuteTask);
  elements.sendBtn?.addEventListener('click', handleSendToWechat);
  elements.exportLogsBtn?.addEventListener('click', handleExportLogs);
  elements.clearLogsBtn?.addEventListener('click', handleClearTaskLogs);

  // 监听会话变更
  sessionManager.addListener(renderSessionUI);
  skillsManager.addListener(renderSkillsUI);
}

/**
 * 设置消息监听器
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((request) => {
    switch (request.type) {
      case ChatMessages.CHAT_STREAM:
        handleStreamChunk(request);
        break;
      case ChatMessages.CHAT_STREAM_DONE:
        handleStreamDone(request);
        break;
      case ChatMessages.CHAT_STREAM_ERROR:
        handleStreamError(request);
        break;
      case ChatMessages.CHAT_STREAM_STATUS:
        handleStreamStatus(request);
        break;
      case TaskMessages.TASK_PROGRESS:
        handleTaskProgress(request);
        break;
      case TaskMessages.TASK_COMPLETE:
        handleTaskComplete(request);
        break;
      case TaskMessages.TASK_ERROR:
        handleTaskError(request);
        break;
      case TaskMessages.TASK_PAUSED:
        handleTaskPaused();
        break;
      case TaskMessages.TASK_RESUMED:
        handleTaskResumed();
        break;
      case TaskMessages.TASK_CANCELED:
        handleTaskCanceled();
        break;
      case LogMessages.LOG_UPDATE:
        handleLogUpdate(request);
        break;
    }
  });
}

/**
 * 设置 Keep Alive
 */
function setupKeepAlive() {
  try {
    keepAlivePort = chrome.runtime.connect({ name: 'popup-keepalive' });
    keepAlivePort.onDisconnect.addListener(() => {
      keepAlivePort = null;
    });

    keepAliveTimer = setInterval(() => {
      if (keepAlivePort) {
        try {
          keepAlivePort.postMessage({ type: 'PING' });
        } catch (e) {
          // ignore
        }
      }
    }, 25000);
  } catch (e) {
    console.warn('Keep alive 设置失败:', e);
  }
}

// ==================== Tabs ====================

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      if (!target) return;

      tabs.forEach((btn) => btn.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-content').forEach((content) => {
        const isMatch = content.id === `${target}Tab`;
        content.classList.toggle('active', isMatch);
      });
    });
  });
}

function handleOpenSidePanel() {
  chrome.runtime.sendMessage({ type: UIMessages.OPEN_SIDE_PANEL });
}

// ==================== 任务执行 ====================

async function startTask(task, preferShenzhou) {
  if (!task) return;

  isTaskRunning = true;
  lastTaskText = task;
  hideResult();
  updateChatStatus(elements.chatStatus, '执行中...', 'running');
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: true }
  );

  chrome.runtime.sendMessage({
    type: TaskMessages.START_TASK,
    task,
    model: elements.model?.value || DEFAULT_MODEL,
    preferShenzhou,
    contextText: sessionManager.buildContextText(),
    skillMentions: extractSkillMentions(task),
  });
}

function handleExecuteTask() {
  const task = elements.taskInput?.value?.trim();
  if (!task) return;

  elements.taskInput.value = '';
  startTask(task, true);
}

async function handleSendToWechat() {
  const lastResult = await getLastResult();
  const content = lastResult?.[StorageKeys.LAST_RESULT] || '';
  if (!content) {
    updateChatStatus(elements.chatStatus, '无可发送结果', 'error');
    return;
  }

  chrome.runtime.sendMessage({
    type: ExternalMessages.SEND_TO_WECHAT,
    result: content,
  }, (response) => {
    if (response?.success) {
      updateChatStatus(elements.chatStatus, '已发送到群', 'success');
    } else {
      updateChatStatus(elements.chatStatus, response?.error || '发送失败', 'error');
    }
  });
}

function handleExportLogs() {
  if (!taskLogs.length) {
    updateChatStatus(elements.chatStatus, '暂无日志可导出', 'error');
    return;
  }

  const content = taskLogs.map(formatLogLine).join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const filename = `task_logs_${new Date().toISOString().slice(0, 10)}.txt`;

  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    URL.revokeObjectURL(url);
  });
}

async function handleClearTaskLogs() {
  taskLogs = [];
  renderTaskLogs();
  await clearTaskLogs();
  chrome.runtime.sendMessage({ type: LogMessages.CLEAR_LOGS });
  hideResult();
}

function formatLogLine(log) {
  const time = log?.time || '';
  const type = log?.type ? log.type.toUpperCase() : 'INFO';
  const message = log?.message || '';
  return `[${time}] [${type}] ${message}`;
}

function appendTaskLog(log) {
  if (!elements.outputArea || !log) return;
  const line = document.createElement('div');
  line.className = `log-line log-${log.type || 'info'}`;
  line.textContent = formatLogLine(log);
  elements.outputArea.appendChild(line);
  elements.outputArea.scrollTop = elements.outputArea.scrollHeight;
}

function renderTaskLogs() {
  if (!elements.outputArea) return;
  elements.outputArea.innerHTML = '';

  if (!taskLogs.length) {
    elements.outputArea.textContent = '等待执行任务...';
    return;
  }

  taskLogs.forEach((log) => appendTaskLog(log));
}

function showResult(title, content, isError = false) {
  if (!elements.resultSection) return;
  elements.resultSection.style.display = 'block';
  if (elements.resultTitle) elements.resultTitle.textContent = title;
  if (elements.resultContent) elements.resultContent.textContent = content;
  if (elements.resultIcon) elements.resultIcon.textContent = isError ? '❌' : '✅';
}

function hideResult() {
  if (!elements.resultSection) return;
  elements.resultSection.style.display = 'none';
}

// ==================== 消息处理 ====================

/**
 * 处理发送消息
 */
async function handleSendMessage() {
  const message = elements.chatInput?.value?.trim();
  if (!message) return;

  const attachments = pendingAttachments.slice();
  pendingAttachments = [];
  renderAttachmentBar();

  // 清空输入
  elements.chatInput.value = '';

  // 添加用户消息
  sessionManager.addMessage('user', message);
  renderChatMessages();

  const mode = elements.chatMode?.value || 'chat';
  if (mode !== 'chat') {
    if (attachments.length) {
      updateChatStatus(elements.chatStatus, '执行模式暂不支持附件，已忽略', 'warn');
    }
    startTask(message, mode === 'exec_shenzhou');
    return;
  }

  // 创建助手消息占位
  chatStreamBuffer = '';
  chatStreamBubbleEl = createStreamingBubble();

  // 生成请求 ID
  chatStreamRequestId = `chat_${Date.now()}`;

  // 更新状态
  updateChatStatus(elements.chatStatus, '思考中...', 'thinking');
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { streaming: true }
  );

  // 发送消息
  try {
    const skillMentions = extractSkillMentions(message);

    chrome.runtime.sendMessage({
      type: ChatMessages.CHAT_MESSAGE_STREAM,
      requestId: chatStreamRequestId,
      message,
      model: elements.model?.value || DEFAULT_MODEL,
      contextText: sessionManager.buildContextText(),
      skillMentions,
      attachments,
      allowImages: attachments.some(item => item.type === 'image'),
      showPlan: elements.chatShowPlanToggle?.checked !== false,
      includePageContext: elements.chatIncludePageContextToggle?.checked !== false,
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    updateChatStatus(elements.chatStatus, `错误: ${error.message}`, 'error');
  }
}

/**
 * 创建流式输出气泡
 */
function createStreamingBubble() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message bot-message';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble streaming';
  bubble.textContent = '...';

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString('zh-CN');

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(time);

  elements.chatMessages?.appendChild(messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  return bubble;
}

/**
 * 处理流式输出块
 */
function handleStreamChunk(request) {
  if (request.requestId !== chatStreamRequestId) return;

  chatStreamBuffer += request.chunk || '';

  if (chatStreamBubbleEl) {
    chatStreamBubbleEl.classList.remove('streaming');
    renderMessageContent(chatStreamBubbleEl, chatStreamBuffer);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }
}

/**
 * 处理流式输出完成
 */
function handleStreamDone(request) {
  if (request.requestId !== chatStreamRequestId) return;

  const reply = request.reply || chatStreamBuffer;

  // 保存到会话
  sessionManager.addMessage('assistant', reply);

  // 更新 UI
  if (chatStreamBubbleEl) {
    chatStreamBubbleEl.classList.remove('streaming');
    renderMessageContent(chatStreamBubbleEl, reply);
  }

  // 重置状态
  chatStreamRequestId = null;
  chatStreamBuffer = '';
  chatStreamBubbleEl = null;

  updateChatStatus(elements.chatStatus, '', '');
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: false }
  );
}

/**
 * 处理流式输出错误
 */
function handleStreamError(request) {
  if (request.requestId !== chatStreamRequestId) return;

  updateChatStatus(elements.chatStatus, `错误: ${request.error}`, 'error');

  if (chatStreamBubbleEl) {
    chatStreamBubbleEl.classList.remove('streaming');
    chatStreamBubbleEl.textContent = `错误: ${request.error}`;
  }

  chatStreamRequestId = null;
  chatStreamBuffer = '';
  chatStreamBubbleEl = null;

  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: false }
  );
}

/**
 * 处理流式输出状态
 */
function handleStreamStatus(request) {
  if (request.requestId !== chatStreamRequestId) return;
  updateChatStatus(elements.chatStatus, request.status, 'thinking');
}

// ==================== 任务控制 ====================

function handlePause() {
  chrome.runtime.sendMessage({ type: TaskMessages.TASK_PAUSE });
}

function handleResume() {
  chrome.runtime.sendMessage({ type: TaskMessages.TASK_RESUME });
}

function handleCancel() {
  if (chatStreamRequestId) {
    chrome.runtime.sendMessage({
      type: ChatMessages.CHAT_STREAM_CANCEL,
      requestId: chatStreamRequestId,
    });
    chatStreamRequestId = null;
    chatStreamBuffer = '';
    updateChatStatus(elements.chatStatus, '已取消', '');
    setChatControlButtons(
      { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
      { running: false }
    );
  } else {
    chrome.runtime.sendMessage({ type: TaskMessages.TASK_CANCEL });
  }
}

function handleTaskProgress(request) {
  updateChatStatus(elements.chatStatus, `执行: ${request.action}`, 'running');
}

function handleTaskComplete(request) {
  updateChatStatus(elements.chatStatus, '完成', 'success');
  isTaskRunning = false;
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: false }
  );
  if (request.result) {
    showResult('任务完成', request.result, false);
    saveLastResult(lastTaskText, request.result);
  }
}

function handleTaskError(request) {
  updateChatStatus(elements.chatStatus, `错误: ${request.error}`, 'error');
  isTaskRunning = false;
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: false }
  );
  if (request.error) {
    showResult('任务失败', request.error, true);
  }
}

function handleTaskPaused() {
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: true, paused: true }
  );
}

function handleTaskResumed() {
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: true, paused: false }
  );
}

function handleTaskCanceled() {
  updateChatStatus(elements.chatStatus, '已取消', '');
  isTaskRunning = false;
  setChatControlButtons(
    { pauseBtn: elements.pauseBtn, resumeBtn: elements.resumeBtn, cancelBtn: elements.cancelBtn },
    { running: false }
  );
}

function handleLogUpdate(request) {
  if (!request?.log) return;
  taskLogs.push(request.log);
  if (taskLogs.length > MAX_TASK_LOGS) {
    taskLogs = taskLogs.slice(-MAX_TASK_LOGS);
  }
  appendTaskLog(request.log);
}

// ==================== 会话管理 ====================

function toggleSidebar() {
  elements.chatSidebar?.classList.toggle('open');
}

function handleNewChat() {
  sessionManager.createSession();
  renderChatMessages();
}

// ==================== Skills 管理 ====================

function handleSaveSkill() {
  const result = skillsManager.saveFromForm({
    name: elements.skillNameInput?.value,
    description: elements.skillDescInput?.value,
    prompt: elements.skillPromptInput?.value,
  });

  if (result.success) {
    resetSkillForm();
  }
}

function handleCancelSkillEdit() {
  skillsManager.cancelEditing();
  resetSkillForm();
}

function resetSkillForm() {
  if (elements.skillNameInput) elements.skillNameInput.value = '';
  if (elements.skillDescInput) elements.skillDescInput.value = '';
  if (elements.skillPromptInput) elements.skillPromptInput.value = '';
  if (elements.skillSaveBtn) elements.skillSaveBtn.textContent = '保存技能';
}

// ==================== Skill 建议 ====================

let skillSuggestItems = [];
let skillSuggestIndex = -1;

function updateSkillSuggest() {
  if (!elements.skillSuggest || !elements.chatInput) return;

  const cursor = elements.chatInput.selectionStart;
  const text = elements.chatInput.value || '';

  // 查找 @ 位置
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf('@');

  if (atIndex < 0) {
    elements.skillSuggest.style.display = 'none';
    skillSuggestItems = [];
    skillSuggestIndex = -1;
    return;
  }

  const afterAt = beforeCursor.slice(atIndex + 1);
  if (afterAt.length > 0 && /\s/.test(afterAt)) {
    elements.skillSuggest.style.display = 'none';
    skillSuggestItems = [];
    skillSuggestIndex = -1;
    return;
  }

  const query = normalizeSkillHandle(afterAt);
  const skills = skillsManager.getEnabledSkills();

  const matches = query
    ? skills.filter(skill => {
        const handle = getSkillHandle(skill);
        const name = normalizeSkillHandle(skill.name);
        return handle.includes(query) || name.includes(query);
      })
    : skills;

  if (matches.length === 0) {
    elements.skillSuggest.style.display = 'none';
    skillSuggestItems = [];
    skillSuggestIndex = -1;
    return;
  }

  elements.skillSuggest.innerHTML = '';
  skillSuggestItems = matches.slice(0, 8);
  skillSuggestIndex = 0;

  skillSuggestItems.forEach((skill, idx) => {
    const item = document.createElement('div');
    item.className = `skill-suggest-item${idx === 0 ? ' active' : ''}`;

    const title = document.createElement('strong');
    const handle = getSkillHandle(skill);
    title.textContent = handle ? `${skill.name} (@${handle})` : skill.name;

    const desc = document.createElement('span');
    desc.textContent = skill.description || '（暂无描述）';

    item.appendChild(title);
    item.appendChild(desc);

    item.addEventListener('click', () => applySkillSuggest(skill, atIndex));

    elements.skillSuggest.appendChild(item);
  });

  elements.skillSuggest.style.display = 'block';
}

function applySkillSuggest(skill, atIndex) {
  if (!elements.chatInput) return;

  const text = elements.chatInput.value || '';
  const handle = getSkillHandle(skill);
  const insert = handle ? `@${handle} ` : `@${normalizeSkillHandle(skill.name)} `;

  const before = text.slice(0, atIndex);
  const after = text.slice(elements.chatInput.selectionStart || 0);

  elements.chatInput.value = `${before}${insert}${after}`;
  const cursor = (before + insert).length;
  elements.chatInput.focus();
  elements.chatInput.setSelectionRange(cursor, cursor);

  elements.skillSuggest.style.display = 'none';
  skillSuggestItems = [];
  skillSuggestIndex = -1;
}

function handleSkillSuggestKeydown(e) {
  if (elements.skillSuggest?.style.display !== 'block') return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    skillSuggestIndex = (skillSuggestIndex + 1) % skillSuggestItems.length;
    updateSkillSuggestHighlight();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    skillSuggestIndex = (skillSuggestIndex - 1 + skillSuggestItems.length) % skillSuggestItems.length;
    updateSkillSuggestHighlight();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (skillSuggestItems.length > 0 && skillSuggestIndex >= 0) {
      e.preventDefault();
      const text = elements.chatInput.value || '';
      const cursor = elements.chatInput.selectionStart;
      const beforeCursor = text.slice(0, cursor);
      const atIndex = beforeCursor.lastIndexOf('@');
      if (atIndex >= 0) {
        applySkillSuggest(skillSuggestItems[skillSuggestIndex], atIndex);
      }
    }
  } else if (e.key === 'Escape') {
    elements.skillSuggest.style.display = 'none';
    skillSuggestItems = [];
    skillSuggestIndex = -1;
  }
}

function updateSkillSuggestHighlight() {
  const items = elements.skillSuggest?.children;
  if (!items) return;

  Array.from(items).forEach((item, idx) => {
    item.classList.toggle('active', idx === skillSuggestIndex);
  });
}

// ==================== 附件处理 ====================

let pendingAttachments = [];

function handleFileSelect(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const isImage = file.type.startsWith('image/');
      pendingAttachments.push({
        type: isImage ? 'image' : 'text',
        name: file.name,
        dataUrl: isImage ? event.target.result : null,
        content: isImage ? null : event.target.result,
      });
      renderAttachmentBar();
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });

  e.target.value = '';
}

async function handleScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    if (!dataUrl) {
      throw new Error('未获取到截图');
    }
    pendingAttachments.push({
      type: 'image',
      name: '截图',
      dataUrl,
    });
    renderAttachmentBar();
  } catch (error) {
    console.error('截图失败:', error);
    updateChatStatus(elements.chatStatus, `截图失败: ${error.message}`, 'error');
  }
}

function renderAttachmentBar() {
  if (!elements.attachmentBar) return;

  if (pendingAttachments.length === 0) {
    elements.attachmentBar.style.display = 'none';
    elements.attachmentBar.innerHTML = '';
    return;
  }

  elements.attachmentBar.style.display = 'flex';
  elements.attachmentBar.innerHTML = '';

  pendingAttachments.forEach((attachment, idx) => {
    const item = document.createElement('div');
    item.className = 'attachment-item';

    if (attachment.type === 'image' && attachment.dataUrl) {
      const img = document.createElement('img');
      img.src = attachment.dataUrl;
      img.style.maxWidth = '40px';
      img.style.maxHeight = '40px';
      item.appendChild(img);
    } else {
      const name = document.createElement('span');
      name.textContent = attachment.name;
      item.appendChild(name);
    }

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      pendingAttachments.splice(idx, 1);
      renderAttachmentBar();
    });
    item.appendChild(removeBtn);

    elements.attachmentBar.appendChild(item);
  });
}

// ==================== 其他功能 ====================

async function handleSyncPage() {
  try {
    updateChatStatus(elements.chatStatus, '同步页面中...', 'thinking');
    const result = await chrome.runtime.sendMessage({ type: 'SYNC_PAGE_CONTEXT' });
    if (result?.success) {
      updateChatStatus(elements.chatStatus, '页面已同步', 'success');
    } else {
      updateChatStatus(elements.chatStatus, '同步失败', 'error');
    }
    setTimeout(() => updateChatStatus(elements.chatStatus, '', ''), 2000);
  } catch (error) {
    updateChatStatus(elements.chatStatus, `错误: ${error.message}`, 'error');
  }
}

async function handleDownloadExtension() {
  try {
    const version = await fetchLatestVersion();
    const filename = `chrome-extension_${version}.zip`;

    chrome.downloads.download({
      url: `${EXTENSION_ZIP_BASE_URL}/${filename}`,
      filename,
      saveAs: true,
    });
  } catch (error) {
    console.error('下载失败:', error);
  }
}

async function fetchLatestVersion() {
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
    if (response.ok) {
      const text = await response.text();
      const match = text.match(/<updatecheck[^>]*\\bversion=['"]([^'"]+)['"]/i);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (error) {
    // ignore and fallback
  }

  try {
    const response = await fetch(GITHUB_MANIFEST_URL, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data?.version) {
        return data.version;
      }
    }
  } catch (error) {
    // ignore and fallback
  }

  return chrome.runtime.getManifest()?.version || 'latest';
}

// ==================== UI 渲染 ====================

function renderUI() {
  renderChatMessages();
  renderSessionList();
  renderSkillsList();
  renderTaskLogs();
}

function renderChatMessages() {
  if (!elements.chatMessages) return;

  elements.chatMessages.innerHTML = '';

  const history = sessionManager.chatHistory;

  if (!history || history.length === 0) {
    elements.chatMessages.appendChild(createWelcomeMessage());
  } else {
    history.forEach(entry => {
      elements.chatMessages.appendChild(createMessageElement(entry));
    });
  }

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function renderSessionList() {
  if (!elements.chatSessionList) return;

  elements.chatSessionList.innerHTML = '';

  const sessions = sessionManager.getSortedSessions();

  if (sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'chat-session-item';
    empty.textContent = '暂无历史会话';
    elements.chatSessionList.appendChild(empty);
    return;
  }

  sessions.forEach(session => {
    const item = createSessionListItem(
      session,
      session.id === sessionManager.activeSessionId,
      {
        onSelect: (id) => {
          sessionManager.switchSession(id);
          renderChatMessages();
        },
        onDelete: (id) => {
          sessionManager.deleteSession(id);
          renderChatMessages();
        },
      }
    );
    elements.chatSessionList.appendChild(item);
  });
}

function renderSkillsList() {
  if (!elements.skillsList) return;

  elements.skillsList.innerHTML = '';

  const skills = skillsManager.skills;

  if (!skills || skills.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'skill-item';
    empty.textContent = '暂无自定义技能，添加后可用 @技能名 调用。';
    elements.skillsList.appendChild(empty);
    return;
  }

  skills.forEach(skill => {
    const item = createSkillListItem(skill, {
      onToggle: (id, enabled) => {
        skillsManager.updateSkill(id, { enabled });
      },
      onEdit: (id) => {
        skillsManager.startEditing(id);
        const skill = skillsManager.getEditingSkill();
        if (skill) {
          if (elements.skillNameInput) elements.skillNameInput.value = skill.name || '';
          if (elements.skillDescInput) elements.skillDescInput.value = skill.description || '';
          if (elements.skillPromptInput) elements.skillPromptInput.value = skill.prompt || '';
          if (elements.skillSaveBtn) elements.skillSaveBtn.textContent = '保存修改';
        }
      },
      onDelete: (id) => {
        skillsManager.deleteSkill(id);
      },
    });
    elements.skillsList.appendChild(item);
  });
}

function renderSessionUI() {
  renderSessionList();
}

function renderSkillsUI() {
  renderSkillsList();
}


})();
