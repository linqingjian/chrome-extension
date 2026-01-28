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
const MAX_TASK_LOGS = 1000;
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
const EXTENSION_ZIP_BASE_URL = 'https://linqingjian.github.io/chrome-extension/extension';
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

const TASK_LOG_SAVE_DELAY_MS = 400;
let taskLogsSaveTimer = null;
let pendingTaskLogs = null;

function buildTaskLogsPayload(logs, maxLogs = MAX_TASK_LOGS) {
  const logsToSave = logs.slice(-maxLogs);
  return {
    [StorageKeys.TASK_LOGS]: logsToSave,
    [StorageKeys.LAST_LOG_TIME]: new Date().toISOString(),
  };
}

/**
 * 保存任务日志
 * @param {Array} logs - 日志数组
 * @param {number} maxLogs - 最大日志数量
 * @returns {Promise<void>}
 */
async function saveTaskLogs(logs, maxLogs = MAX_TASK_LOGS) {
  return storage.setMany(buildTaskLogsPayload(logs, maxLogs));
}

function scheduleTaskLogsSave(logs, maxLogs = MAX_TASK_LOGS) {
  pendingTaskLogs = logs.slice(-maxLogs);
  if (taskLogsSaveTimer) return;

  taskLogsSaveTimer = setTimeout(() => {
    taskLogsSaveTimer = null;
    const logsToSave = pendingTaskLogs;
    pendingTaskLogs = null;
    if (!logsToSave) return;
    storage.setMany(buildTaskLogsPayload(logsToSave, logsToSave.length)).catch(() => {});
  }, TASK_LOG_SAVE_DELAY_MS);
}

async function flushTaskLogsSave() {
  if (taskLogsSaveTimer) {
    clearTimeout(taskLogsSaveTimer);
    taskLogsSaveTimer = null;
  }
  if (!pendingTaskLogs) return;
  const logsToSave = pendingTaskLogs;
  pendingTaskLogs = null;
  await storage.setMany(buildTaskLogsPayload(logsToSave, logsToSave.length));
}

/**
 * 清空任务日志
 * @returns {Promise<void>}
 */
async function clearTaskLogs() {
  pendingTaskLogs = null;
  if (taskLogsSaveTimer) {
    clearTimeout(taskLogsSaveTimer);
    taskLogsSaveTimer = null;
  }
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


// === shared/logger.js ===
/**
 * 日志管理模块
 * 提供统一的日志记录功能
 */


// 日志级别
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

// 日志类型图标
const LOG_ICONS = {
  debug: '🔍',
  action: '⚡',
  info: 'ℹ️',
  success: '✅',
  warn: '⚠️',
  warning: '⚠️',
  error: '❌',
  result: '📊',
};

/**
 * 日志管理器类
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.maxLogs = options.maxLogs ?? 1000;
    this.logs = [];
    this.listeners = new Set();
  }

  /**
   * 设置日志级别
   * @param {number} level - 日志级别
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * 添加日志监听器
   * @param {Function} listener - 监听函数
   * @returns {Function} 取消监听的函数
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   * @param {Object} logEntry - 日志条目
   */
  notifyListeners(logEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (e) {
        console.error('日志监听器错误:', e);
      }
    });
  }

  /**
   * 记录日志
   * @param {number} level - 日志级别
   * @param {string} type - 日志类型
   * @param {string} message - 日志消息
   * @returns {Object} 日志条目
   */
  log(level, type, message) {
    if (level < this.level) return null;

    const logEntry = {
      time: formatTime(),
      timestamp: Date.now(),
      level,
      type,
      message,
    };

    // 添加到日志数组
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 控制台输出
    const icon = LOG_ICONS[type.toLowerCase()] || '📝';
    const methodName = {
      [LogLevel.DEBUG]: 'debug',
      [LogLevel.INFO]: 'log',
      [LogLevel.WARN]: 'warn',
      [LogLevel.ERROR]: 'error',
    }[level] || 'log';

    console[methodName](`${icon} [${type.toUpperCase()}] ${message}`);

    // 通知监听器
    this.notifyListeners(logEntry);

    return logEntry;
  }

  /**
   * 调试日志
   * @param {string} message - 消息
   */
  debug(message) {
    return this.log(LogLevel.DEBUG, 'debug', message);
  }

  /**
   * 信息日志
   * @param {string} message - 消息
   */
  info(message) {
    return this.log(LogLevel.INFO, 'info', message);
  }

  /**
   * 操作日志
   * @param {string} message - 消息
   */
  action(message) {
    return this.log(LogLevel.INFO, 'action', message);
  }

  /**
   * 成功日志
   * @param {string} message - 消息
   */
  success(message) {
    return this.log(LogLevel.INFO, 'success', message);
  }

  /**
   * 警告日志
   * @param {string} message - 消息
   */
  warn(message) {
    return this.log(LogLevel.WARN, 'warn', message);
  }

  /**
   * 错误日志
   * @param {string} message - 消息
   */
  error(message) {
    return this.log(LogLevel.ERROR, 'error', message);
  }

  /**
   * 结果日志
   * @param {string} message - 消息
   */
  result(message) {
    return this.log(LogLevel.INFO, 'result', message);
  }

  /**
   * 获取所有日志
   * @param {string} typeFilter - 类型过滤
   * @returns {Array} 日志数组
   */
  getLogs(typeFilter = null) {
    if (typeFilter) {
      return this.logs.filter(log => log.type === typeFilter);
    }
    return [...this.logs];
  }

  /**
   * 获取增量日志
   * @param {number} fromIndex - 起始索引
   * @returns {Array} 日志数组
   */
  getLogsFromIndex(fromIndex = 0) {
    return this.logs.slice(fromIndex);
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
  }

  /**
   * 获取日志数量
   * @returns {number}
   */
  get count() {
    return this.logs.length;
  }

  /**
   * 导出日志为文本
   * @returns {string}
   */
  exportAsText() {
    return this.logs
      .map(log => `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');
  }

  /**
   * 导出日志为 JSON
   * @returns {string}
   */
  exportAsJson() {
    return JSON.stringify(this.logs, null, 2);
  }
}

// 创建全局单例
const logger = new Logger();

// ==================== 便捷函数 ====================

/**
 * 判断日志项是否应该显示（用于精简模式）
 * @param {Object} logItem - 日志项
 * @param {boolean} verbose - 是否详细模式
 * @returns {boolean}
 */
function shouldShowLogItem(logItem, verbose = false) {
  if (verbose) return true;

  const type = (logItem?.type || '').toLowerCase();
  const msg = String(logItem?.message || '');

  // 只保留关键进度/结果/错误
  const keepTypes = new Set(['action', 'success', 'error', 'warn', 'warning', 'result']);
  if (keepTypes.has(type)) return true;

  // 丢掉大段噪音
  const noisy = [
    'messages 数量',
    'messages 总字符数',
    '估计 token',
    'SQL 完整长度',
    '找到 ',
    '候选',
    '调试信息',
    '准备调用 AI',
    '响应键',
    '完整响应',
    'choice 对象',
  ];
  if (noisy.some(k => msg.includes(k))) return false;

  // 默认不显示 info
  if (type === 'info') return false;

  return false;
}

/**
 * 格式化日志消息用于显示
 * @param {Object} logItem - 日志项
 * @returns {string}
 */
function formatLogMessage(logItem) {
  const icon = LOG_ICONS[logItem.type?.toLowerCase()] || '📝';
  return `${icon} [${logItem.time}] ${logItem.message}`;
}

logger;


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


// === shared/ai-client.js ===
/**
 * AI 客户端模块
 * 统一处理与 AI 模型的交互
 */


/**
 * AI 客户端类
 */
class AIClient {
  constructor() {
    this.baseUrl = DEFAULT_API_URL;
    this.defaultModel = DEFAULT_MODEL;
    this.fallbackModel = FALLBACK_MODEL;
  }

  /**
   * 获取配置的 API Token
   * @returns {Promise<string>}
   */
  async getApiToken() {
    const token = await storage.get(StorageKeys.API_TOKEN);
    if (!token) {
      throw new Error('API Token 未配置，请在插件设置中配置');
    }
    return token;
  }

  /**
   * 获取配置的模型
   * @returns {Promise<string>}
   */
  async getModel() {
    return await storage.get(StorageKeys.MODEL) || this.defaultModel;
  }

  /**
   * 获取配置的 API URL
   * @returns {Promise<string>}
   */
  async getApiUrl() {
    return await storage.get(StorageKeys.API_URL) || this.baseUrl;
  }

  /**
   * 调用 AI 模型（非流式）
   * @param {Array} messages - 消息数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 响应结果
   */
  async chat(messages, options = {}) {
    const {
      model,
      maxTokens,
      temperature = 0.7,
      systemPrompt = null,
      timeout,
      signal,
    } = options;

    const actualModel = model || await this.getModel();
    const apiToken = await this.getApiToken();
    const apiUrl = await this.getApiUrl();
    const requestUrl = normalizeApiUrl(apiUrl);

    // 计算超时时间
    const actualTimeout = timeout || (isGeminiModel(actualModel) ? GEMINI_CALL_TIMEOUT : AI_CALL_TIMEOUT);

    // 计算 max_tokens
    const actualMaxTokens = maxTokens || getModelMaxTokens(actualModel);

    // 处理消息
    let formattedMessages = [...messages];
    if (systemPrompt) {
      const hasSystem = formattedMessages.some(m => m.role === 'system');
      if (!hasSystem) {
        formattedMessages.unshift({ role: 'system', content: systemPrompt });
      } else {
        formattedMessages[0] = { role: 'system', content: systemPrompt };
      }
    }

    logger.action(`调用模型: ${actualModel}`);
    logger.debug(`消息数量: ${formattedMessages.length}, 超时: ${actualTimeout}ms`);

    // 构建请求体
    const body = {
      model: actualModel,
      messages: formattedMessages,
      temperature,
    };

    // 根据模型选择 token 参数
    if (actualModel.toLowerCase().includes('gpt-5') || actualModel.toLowerCase().includes('o1')) {
      body.max_completion_tokens = actualMaxTokens;
    } else {
      body.max_tokens = actualMaxTokens;
    }

    // 创建 fetch 请求
    const fetchPromise = fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'X-Mtcc-Client': 'ai-assistant-extension',
      },
      body: JSON.stringify(body),
      signal,
    });

    // 带超时的请求
    const response = await withTimeout(fetchPromise, actualTimeout, `AI 调用超时 (${actualTimeout}ms)`);
    const responseText = await response.text();

    if (!response.ok) {
      logger.error(`AI 调用失败 (${response.status}): ${responseText.substring(0, 200)}`);
      throw new Error(`AI 调用失败 (${response.status}): ${responseText.substring(0, 100)}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      logger.error(`AI 响应解析失败: ${responseText.substring(0, 200)}`);
      throw new Error('AI 响应解析失败');
    }

    if (!data.choices || !data.choices[0]) {
      logger.error(`AI 响应格式异常: ${JSON.stringify(data).substring(0, 200)}`);
      throw new Error('AI 响应格式异常: choices 为空数组');
    }

    const choice = data.choices[0];
    const content = choice.message?.content || choice.message?.reasoning_content || '';

    if (!content) {
      throw new Error(`AI 未返回内容 (finish_reason: ${choice.finish_reason})`);
    }

    if (choice.finish_reason === 'length') {
      logger.warn('AI 响应被截断');
    }

    logger.success('AI 调用成功');
    return {
      content,
      model: actualModel,
      usage: data.usage,
      finishReason: choice.finish_reason,
    };
  }

  /**
   * 流式调用 AI 模型
   * @param {Array} messages - 消息数组
   * @param {Object} options - 选项
   * @returns {AsyncGenerator} 流式响应生成器
   */
  async *chatStream(messages, options = {}) {
    const {
      model,
      maxTokens,
      temperature = 0.7,
      systemPrompt = null,
      signal,
    } = options;

    const actualModel = model || await this.getModel();
    const apiToken = await this.getApiToken();
    const apiUrl = await this.getApiUrl();
    const requestUrl = normalizeApiUrl(apiUrl);
    const actualMaxTokens = maxTokens || getModelMaxTokens(actualModel);

    // 处理消息
    let formattedMessages = [...messages];
    if (systemPrompt) {
      const hasSystem = formattedMessages.some(m => m.role === 'system');
      if (!hasSystem) {
        formattedMessages.unshift({ role: 'system', content: systemPrompt });
      } else {
        formattedMessages[0] = { role: 'system', content: systemPrompt };
      }
    }

    logger.action(`流式调用模型: ${actualModel}`);

    // 构建请求体
    const body = {
      model: actualModel,
      messages: formattedMessages,
      temperature,
      stream: true,
    };

    if (actualModel.toLowerCase().includes('gpt-5') || actualModel.toLowerCase().includes('o1')) {
      body.max_completion_tokens = actualMaxTokens;
    } else {
      body.max_tokens = actualMaxTokens;
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'X-Mtcc-Client': 'ai-assistant-extension',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI 调用失败 (${response.status}): ${errorText.substring(0, 100)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: 'content', content: delta };
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    logger.success('流式调用完成');
  }

  /**
   * 带重试的 AI 调用
   * @param {Array} messages - 消息数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 响应结果
   */
  async chatWithRetry(messages, options = {}) {
    const maxRetries = options.maxRetries ?? 2;
    const originalModel = options.model || await this.getModel();
    let currentModel = originalModel;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`AI 调用尝试 ${attempt + 1}/${maxRetries + 1}, 模型: ${currentModel}`);
        return await this.chat(messages, { ...options, model: currentModel });
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || '';

        // 超时或空 choices 时尝试切换模型
        const isTimeout = errorMsg.includes('超时');
        const isEmptyChoices = errorMsg.includes('choices 为空');
        const isUnknownModel = errorMsg.toLowerCase().includes('unknown_model');

        if (isUnknownModel && currentModel === this.defaultModel) {
          logger.warn(`模型 ${currentModel} 不可用，切换到 ${this.fallbackModel}`);
          currentModel = this.fallbackModel;
          continue;
        }

        if ((isTimeout || isEmptyChoices) && isGeminiModel(currentModel)) {
          logger.warn(`Gemini 模型调用失败，切换到 ${this.fallbackModel}`);
          currentModel = this.fallbackModel;
          continue;
        }

        if (attempt < maxRetries) {
          logger.warn(`AI 调用失败，准备重试: ${errorMsg}`);
          continue;
        }
      }
    }

    throw lastError || new Error('AI 调用失败');
  }

  /**
   * 简化版对话（仅返回文本内容）
   * @param {Array} messages - 消息数组
   * @param {string} systemPrompt - 系统提示词
   * @returns {Promise<string>} 响应文本
   */
  async chatSimple(messages, systemPrompt = null) {
    const result = await this.chat(messages, { systemPrompt });
    return result.content;
  }

  /**
   * 测试连接
   * @param {string} apiUrl - API URL
   * @param {string} apiToken - API Token
   * @param {string} model - 模型名称
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection(apiUrl, apiToken, model) {
    const requestUrl = normalizeApiUrl(apiUrl);
    const testModel = model || this.defaultModel;

    const attemptTest = async (useMaxCompletionTokens, testModelName) => {
      const body = {
        model: testModelName,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      if (useMaxCompletionTokens) {
        body.max_completion_tokens = 10;
      } else {
        body.max_tokens = 10;
      }

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'X-Mtcc-Client': 'ai-assistant-extension',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return { success: true, model: testModelName };
      }

      const responseText = await response.text();
      return { success: false, status: response.status, error: responseText };
    };

    // 首先尝试原始模型
    const preferMaxCompletionTokens = /gpt-5/i.test(testModel);
    let result = await attemptTest(preferMaxCompletionTokens, testModel);

    if (result.success) {
      return result;
    }

    // 如果是 unknown_model 错误，尝试备选模型
    if (result.error?.toLowerCase().includes('unknown_model') && testModel === this.defaultModel) {
      result = await attemptTest(preferMaxCompletionTokens, this.fallbackModel);
      if (result.success) {
        return { ...result, fallback: true };
      }
    }

    // 如果是 token 参数错误，尝试另一种参数
    if (result.error?.toLowerCase().includes('max_tokens') && result.error?.toLowerCase().includes('max_completion_tokens')) {
      result = await attemptTest(!preferMaxCompletionTokens, testModel);
      if (result.success) {
        return result;
      }
    }

    throw new Error(`连接测试失败: ${result.error?.substring(0, 100) || '未知错误'}`);
  }
}

// 创建全局单例
const aiClient = new AIClient();

aiClient;


// === background/page-operations.js ===
/**
 * 页面操作模块
 * 处理所有与页面交互的操作
 */


/**
 * 等待标签页加载完成
 * @param {number} tabId - 标签页 ID
 * @param {number} timeoutMs - 超时时间
 * @returns {Promise<Object>} 结果
 */
function waitForTabComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      } catch (e) {
        // ignore
      }
      clearTimeout(timer);
      resolve(result);
    };

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId !== tabId) return;
      if (info && info.status === 'complete') {
        finish({ ok: true, status: 'complete' });
      }
    };

    const timer = setTimeout(() => {
      finish({ ok: false, status: 'timeout' });
    }, timeoutMs);

    try {
      chrome.tabs.onUpdated.addListener(onUpdated);
    } catch (e) {
      finish({ ok: false, status: 'listener_error' });
      return;
    }

    try {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) return;
        if (tab && tab.status === 'complete') {
          finish({ ok: true, status: 'complete' });
        }
      });
    } catch (e) {
      // ignore
    }
  });
}

/**
 * 查找最佳的神舟标签页
 * @returns {Promise<Object|null>} 标签页对象
 */
async function findBestShenzhouTab() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://shenzhou.tatstm.com/*' });
    if (!tabs || tabs.length === 0) return null;

    const active = tabs.find(t => t.active && isOperablePageUrl(t.url));
    if (active) return active;

    const sorted = tabs
      .filter(t => isOperablePageUrl(t.url))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    return sorted[0] || null;
  } catch (e) {
    console.warn('⚠️ findBestShenzhouTab 失败:', e?.message || e);
    return null;
  }
}

/**
 * 解析初始任务标签页 ID
 * @param {Object} options - 选项
 * @returns {Promise<number|null>} 标签页 ID
 */
async function resolveInitialTaskTabId(options = {}) {
  const preferShenzhou = options.preferShenzhou !== false;

  // 先尝试当前窗口激活 tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (tab && isOperablePageUrl(tab.url) && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('chrome://')) {
      return tab.id;
    }
  } catch (e) {
    // ignore
  }

  // 可选：最近访问的神舟页面 tab
  if (preferShenzhou) {
    const shenzhouTab = await findBestShenzhouTab();
    if (shenzhouTab) return shenzhouTab.id;
  }

  // 兜底：任意可操作的 http(s) tab
  try {
    const tabs = await chrome.tabs.query({});
    const candidates = (tabs || [])
      .filter(t => isOperablePageUrl(t.url) && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    return candidates[0]?.id || null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取当前标签页 URL
 * @param {number} tabId - 标签页 ID
 * @returns {Promise<string>} URL
 */
async function getCurrentTabUrl(tabId) {
  if (!tabId) return '';
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab?.url || '';
  } catch (e) {
    return '';
  }
}

/**
 * 自动关闭阻塞弹窗
 * @param {number} tabId - 标签页 ID
 * @returns {Promise<Object>} 结果
 */
async function autoDismissBlockingDialogs(tabId) {
  if (!tabId) return { dismissed: false };
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const isVisible = (el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          if (!style) return false;
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

        // Ant Design 弹窗/对话框
        const modals = Array.from(document.querySelectorAll('.ant-modal, .ant-modal-root, .ant-modal-wrap, .ant-modal-content'))
          .filter(isVisible);

        // 常见遮罩/对话框（非 antd）
        const overlays = Array.from(document.querySelectorAll('[role="dialog"], .modal, .dialog, .ant-popover, .ant-message'))
          .filter(isVisible);

        const candidates = [...modals, ...overlays];
        if (candidates.length === 0) return { dismissed: false };

        const dialog = candidates.find(el =>
          el.classList?.contains('ant-modal') ||
          el.querySelector?.('.ant-modal-footer, .ant-modal-confirm-btns, button')
        ) || candidates[0];

        const dialogText = textOf(dialog).slice(0, 200);

        // 优先点击"放弃/取消/关闭/×"
        const buttonTexts = ['放弃', '取消', '关闭', '我知道了', '知道了', '确定', 'OK'];
        const buttons = Array.from(dialog.querySelectorAll('button, [role="button"], .ant-btn')).filter(isVisible);

        const pickButton = () => {
          for (const t of buttonTexts) {
            const btn = buttons.find(b => textOf(b) === t || textOf(b).includes(t));
            if (btn) return { btn, t };
          }
          return null;
        };

        const picked = pickButton();
        if (picked?.btn) {
          picked.btn.click();
          return { dismissed: true, method: 'button', picked: picked.t, dialogText };
        }

        // 尝试右上角关闭按钮
        const close = dialog.querySelector('.ant-modal-close, .ant-modal-close-x, .close, [aria-label="Close"]');
        if (close && isVisible(close)) {
          close.click();
          return { dismissed: true, method: 'close', picked: 'close', dialogText };
        }

        // 兜底：点击遮罩
        const mask = document.querySelector('.ant-modal-mask, .modal-backdrop, .overlay, [class*="mask"]');
        if (mask && isVisible(mask)) {
          mask.click();
          return { dismissed: true, method: 'mask', picked: 'mask', dialogText };
        }

        return { dismissed: false, dialogText };
      }
    });
    return result?.[0]?.result || { dismissed: false };
  } catch (e) {
    return { dismissed: false, error: e?.message || String(e) };
  }
}

/**
 * 截取当前标签页截图
 * @returns {Promise<Object>} 结果
 */
async function captureActiveTabScreenshot() {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return { success: false, error: '未找到当前标签页' };
    }
    const url = String(activeTab.url || '');
    if (!isOperablePageUrl(url) || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
      return { success: false, error: '当前页面不支持截图' };
    }

    const dataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'png' }, (capturedUrl) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(capturedUrl);
      });
    });

    if (!dataUrl || typeof dataUrl !== 'string') {
      return { success: false, error: '截图失败：未获取到图像' };
    }

    if (dataUrl.length > 1_600_000) {
      return { success: false, error: '截图过大，建议缩小窗口或局部截图后重试' };
    }

    return { success: true, dataUrl };
  } catch (error) {
    return { success: false, error: error.message || '截图失败' };
  }
}

/**
 * 获取页面信息摘要
 * @param {number} tabId - 标签页 ID
 * @returns {Promise<Object>} 页面信息
 */
async function getPageInfoSummary(tabId) {
  if (!tabId) return { success: false, error: '无效的标签页 ID' };

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const isVisible = (el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          if (!style) return false;
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };

        const getSelector = (el) => {
          if (el.id) return `#${el.id}`;
          if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
            if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
          }
          return el.tagName.toLowerCase();
        };

        const getText = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);

        // 可点击元素
        const clickables = [];
        const clickableSelectors = 'button, a, [role="button"], [onclick], .ant-btn, .ant-menu-item, .ant-tabs-tab';
        const clickableNodes = document.querySelectorAll(clickableSelectors);
        for (let i = 0; i < clickableNodes.length && clickables.length < 50; i++) {
          const el = clickableNodes[i];
          if (!isVisible(el)) continue;
          clickables.push({
            index: clickables.length,
            tag: el.tagName.toLowerCase(),
            text: getText(el),
            selector: getSelector(el),
          });
        }

        // 输入框
        const inputs = [];
        const inputSelectors = 'input, textarea, [contenteditable="true"], .ant-input, .ant-select';
        const inputNodes = document.querySelectorAll(inputSelectors);
        for (let i = 0; i < inputNodes.length && inputs.length < 20; i++) {
          const el = inputNodes[i];
          if (!isVisible(el)) continue;
          inputs.push({
            index: inputs.length,
            tag: el.tagName.toLowerCase(),
            type: el.type || 'text',
            placeholder: el.placeholder || '',
            selector: getSelector(el),
          });
        }

        // 可滚动容器
        const scrollables = [];
        const scrollableSelectors = 'div, section, main, article, aside, ul, ol, table, .ant-table-body, .ant-table-content, .ant-table-container';
        const scrollableNodes = document.querySelectorAll(scrollableSelectors);
        for (let i = 0; i < scrollableNodes.length && scrollables.length < 10; i++) {
          const el = scrollableNodes[i];
          const style = window.getComputedStyle(el);
          if (!style) continue;
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          const overflow = style.overflow || '';
          const overflowY = style.overflowY || '';
          const isScrollable = (overflow === 'auto' || overflow === 'scroll' ||
            overflowY === 'auto' || overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 50;
          if (!isScrollable) continue;
          scrollables.push({
            index: scrollables.length,
            tag: el.tagName.toLowerCase(),
            selector: getSelector(el),
            scroll: {
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            },
          });
        }

        return {
          success: true,
          url: window.location.href,
          title: document.title,
          clickables: clickables.slice(0, 50),
          inputs: inputs.slice(0, 20),
          scrollables: scrollables.slice(0, 10),
        };
      },
    });

    return result?.[0]?.result || { success: false, error: '执行脚本失败' };
  } catch (error) {
    return { success: false, error: error.message || '获取页面信息失败' };
  }
}

// ==================== 安全检查 ====================

/**
 * 检查文本是否包含危险的删除操作
 * @param {string} text - 文本
 * @param {string} tabUrl - 当前标签页 URL
 * @returns {string|null} 危险原因或 null
 */
function looksBlockedDeleteText(text, tabUrl = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();

  // 安全操作（取消删除等）
  if (SAFE_DELETE_HINTS.some(k => lowered.includes(k.toLowerCase()))) return null;

  // 危险 SQL
  for (const regex of BLOCKED_SQL_REGEXES) {
    if (regex.test(lowered)) return raw.slice(0, 120);
  }

  // 删除动词
  const hasDeleteVerb = DELETE_VERBS.some(keyword => lowered.includes(keyword.toLowerCase()));
  if (!hasDeleteVerb) return null;

  // 危险对象
  const hasBlockedObject = BLOCK_DELETE_OBJECTS.some(keyword => lowered.includes(keyword.toLowerCase()));
  if (hasBlockedObject) return raw.slice(0, 120);

  // 敏感 URL 上下文
  const urlLower = String(tabUrl || '').toLowerCase();
  const inSensitiveContext = DELETE_SENSITIVE_URL_HINTS.some(hint => urlLower.includes(hint));
  if (inSensitiveContext) return raw.slice(0, 120);

  return null;
}

/**
 * 收集操作中的文本候选
 * @param {Object} action - 操作对象
 * @param {Object} lastPageInfo - 上一次页面信息
 * @returns {string[]} 文本候选数组
 */
function collectActionTextCandidates(action, lastPageInfo = null) {
  const candidates = [];
  const index = typeof action?.index === 'number' ? action.index : (typeof action?.索引 === 'number' ? action.索引 : null);

  if (action?.action === 'click' && index !== null && lastPageInfo?.clickables?.[index]) {
    const clickItem = lastPageInfo.clickables[index];
    if (clickItem.text) candidates.push(clickItem.text);
    if (clickItem.selector) candidates.push(clickItem.selector);
  }

  if (action?.action === 'click') {
    candidates.push(action.selector, action.target, action.text, action.文本, action.参数);
  }

  if (action?.action === 'type') {
    candidates.push(action.text, action.value, action.内容, action.值, action.参数);
  }

  if (action?.action === 'input_sql') {
    candidates.push(action.sql, action.参数);
  }

  return candidates.filter(Boolean).map(value => String(value));
}

/**
 * 获取破坏性操作原因
 * @param {Object} action - 操作对象
 * @param {Object} context - 上下文
 * @returns {string|null} 原因或 null
 */
function getDestructiveReason(action, context = {}) {
  const candidates = collectActionTextCandidates(action, context.lastPageInfo);
  const tabUrl = context.url || '';
  for (const candidate of candidates) {
    const reason = looksBlockedDeleteText(candidate, tabUrl);
    if (reason) return reason;
  }
  return null;
}

// === background/confluence-api.js ===
/**
 * Confluence API 模块
 * 处理与 Confluence 的所有交互
 */


/**
 * Confluence API 客户端
 */
class ConfluenceClient {
  constructor() {
    this.baseUrl = CONFLUENCE_BASE_URL;
    this.token = '';
    this.username = '';
    this.weeklyReportRootPageId = DEFAULT_WEEKLY_REPORT_ROOT_PAGE_ID;
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    const config = await storage.getMany([
      StorageKeys.CONFLUENCE_TOKEN,
      StorageKeys.CONFLUENCE_USERNAME,
      StorageKeys.WEEKLY_REPORT_ROOT_PAGE_ID,
    ]);

    this.token = config[StorageKeys.CONFLUENCE_TOKEN] || '';
    this.username = config[StorageKeys.CONFLUENCE_USERNAME] || '';
    this.weeklyReportRootPageId = config[StorageKeys.WEEKLY_REPORT_ROOT_PAGE_ID] || DEFAULT_WEEKLY_REPORT_ROOT_PAGE_ID;
  }

  /**
   * 设置 Token
   * @param {string} token - Confluence Token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * 设置周报根目录页面 ID
   * @param {string} pageId - 页面 ID
   */
  setWeeklyReportRootPageId(pageId) {
    this.weeklyReportRootPageId = pageId;
  }

  /**
   * 获取请求头
   * @returns {Object} 请求头
   */
  getHeaders() {
    if (!this.token) {
      throw new Error('Confluence Token 未配置');
    }
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * 搜索 Confluence 页面
   * @param {string} query - 搜索关键词
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 搜索结果
   */
  async search(query, options = {}) {
    const { limit = 10, spaceKey = null } = options;

    await this.loadConfig();
    logger.action(`搜索 Confluence: ${query}`);

    let cql = `text ~ "${query}" AND type = page`;
    if (spaceKey) {
      cql += ` AND space = "${spaceKey}"`;
    }

    const url = `${this.baseUrl}/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}&expand=space,version`;

    try {
      const response = await withTimeout(
        fetch(url, { method: 'GET', headers: this.getHeaders() }),
        10000,
        'Confluence 搜索超时'
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Confluence 搜索失败 (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      const results = (data.results || []).map(page => ({
        id: page.id,
        title: page.title,
        space: page.space?.name || page.space?.key || '',
        url: `${this.baseUrl}${page._links?.webui || `/pages/viewpage.action?pageId=${page.id}`}`,
        lastModified: page.version?.when || '',
        lastModifiedBy: page.version?.by?.displayName || '',
      }));

      logger.success(`找到 ${results.length} 个结果`);
      return results;
    } catch (error) {
      logger.error(`Confluence 搜索失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取页面内容
   * @param {string} pageId - 页面 ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 页面内容
   */
  async getPageContent(pageId, options = {}) {
    const { maxLength = 8000 } = options;

    await this.loadConfig();
    logger.action(`获取 Confluence 页面: ${pageId}`);

    const url = `${this.baseUrl}/rest/api/content/${pageId}?expand=body.storage,space,version`;

    try {
      const response = await withTimeout(
        fetch(url, { method: 'GET', headers: this.getHeaders() }),
        10000,
        'Confluence 获取页面超时'
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取页面失败 (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();

      // 提取纯文本内容
      const htmlContent = data.body?.storage?.value || '';
      const textContent = this.htmlToText(htmlContent);

      const result = {
        id: data.id,
        title: data.title,
        space: data.space?.name || data.space?.key || '',
        url: `${this.baseUrl}${data._links?.webui || `/pages/viewpage.action?pageId=${pageId}`}`,
        content: truncateText(textContent, maxLength),
        lastModified: data.version?.when || '',
        lastModifiedBy: data.version?.by?.displayName || '',
      };

      logger.success(`获取页面成功: ${result.title}`);
      return result;
    } catch (error) {
      logger.error(`获取 Confluence 页面失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取子页面列表
   * @param {string} parentPageId - 父页面 ID
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 子页面列表
   */
  async getChildPages(parentPageId, options = {}) {
    const { limit = 100 } = options;

    await this.loadConfig();
    logger.action(`获取子页面: ${parentPageId}`);

    const url = `${this.baseUrl}/rest/api/content/${parentPageId}/child/page?expand=version,space&limit=${limit}`;

    try {
      const response = await withTimeout(
        fetch(url, { method: 'GET', headers: this.getHeaders() }),
        10000,
        'Confluence 获取子页面超时'
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取子页面失败 (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      const results = (data.results || []).map(page => ({
        id: page.id,
        title: page.title,
        space: page.space?.name || page.space?.key || '',
        url: `${this.baseUrl}${page._links?.webui || `/pages/viewpage.action?pageId=${page.id}`}`,
        lastModified: page.version?.when || '',
      }));

      logger.success(`找到 ${results.length} 个子页面`);
      return results;
    } catch (error) {
      logger.error(`获取子页面失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从周报根目录搜索
   * @param {string} query - 搜索关键词
   * @returns {Promise<Array>} 搜索结果
   */
  async searchInWeeklyReports(query) {
    await this.loadConfig();

    if (!this.weeklyReportRootPageId) {
      logger.warn('周报根目录页面 ID 未配置');
      return [];
    }

    try {
      // 获取所有子页面
      const childPages = await this.getChildPages(this.weeklyReportRootPageId);

      // 过滤匹配的页面
      const queryLower = query.toLowerCase();
      const matched = childPages.filter(page =>
        page.title.toLowerCase().includes(queryLower)
      );

      return matched.slice(0, 10);
    } catch (error) {
      logger.warn(`从周报目录搜索失败: ${error.message}`);
      return [];
    }
  }

  /**
   * HTML 转纯文本
   * @param {string} html - HTML 内容
   * @returns {string} 纯文本
   */
  htmlToText(html) {
    if (!html) return '';

    // 移除脚本和样式
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // 替换常见标签
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');

    // 移除所有 HTML 标签
    text = text.replace(/<[^>]+>/g, '');

    // 解码 HTML 实体
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // 清理多余空白
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.trim();

    return text;
  }
}

// 创建全局单例
const confluenceClient = new ConfluenceClient();

confluenceClient;


// === background/action-executor.js ===
/**
 * 操作执行器模块
 * 执行 AI 返回的各种操作
 */


/**
 * 操作执行器类
 */
class ActionExecutor {
  constructor() {
    this.tabId = null;
    this.lastPageInfo = null;
  }

  /**
   * 设置目标标签页
   * @param {number} tabId - 标签页 ID
   */
  setTabId(tabId) {
    this.tabId = tabId;
  }

  /**
   * 设置最后的页面信息
   * @param {Object} pageInfo - 页面信息
   */
  setLastPageInfo(pageInfo) {
    this.lastPageInfo = pageInfo;
  }

  /**
   * 执行操作
   * @param {Object} action - 操作对象
   * @returns {Promise<Object>} 执行结果
   */
  async execute(action) {
    const actionType = action.action || action.type;
    logger.action(`执行操作: ${actionType}`);

    switch (actionType) {
      case 'navigate':
        return await this.navigate(action);
      case 'wait':
        return await this.wait(action);
      case 'get_page_info':
        return await this.getPageInfo();
      case 'click':
        return await this.click(action);
      case 'click_at':
        return await this.clickAt(action);
      case 'type':
        return await this.type(action);
      case 'input_sql':
        return await this.inputSql(action);
      case 'click_format':
        return await this.clickFormat();
      case 'click_execute':
        return await this.clickExecute();
      case 'get_result':
        return await this.getResult();
      case 'scroll':
        return await this.scroll(action);
      case 'scroll_to':
        return await this.scrollTo(action);
      case 'scroll_to_text':
        return await this.scrollToText(action);
      case 'scroll_container':
        return await this.scrollContainer(action);
      case 'wheel':
        return await this.wheel(action);
      case 'drag':
        return await this.drag(action);
      case 'click_rerun':
        return await this.clickRerun(action);
      case 'click_dag_view':
        return await this.clickDagView();
      case 'get_dag_info':
        return await this.getDagInfo();
      case 'confluence_search':
        return await this.confluenceSearch(action);
      case 'confluence_get_content':
        return await this.confluenceGetContent(action);
      case 'finish':
        return { success: true, finished: true, result: action.result };
      default:
        logger.warn(`未知操作类型: ${actionType}`);
        return { success: false, error: `未知操作类型: ${actionType}` };
    }
  }

  /**
   * 导航到 URL
   */
  async navigate(action) {
    const url = action.url || action.target;
    if (!url) {
      return { success: false, error: 'URL 不能为空' };
    }

    logger.info(`导航到: ${url}`);

    try {
      if (this.tabId) {
        await chrome.tabs.update(this.tabId, { url });
      } else {
        const newTab = await chrome.tabs.create({ url, active: true });
        this.tabId = newTab.id;
      }

      const result = await waitForTabComplete(this.tabId, 8000);
      await sleep(500); // 额外等待页面渲染

      return { success: true, url, loadStatus: result.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 等待
   */
  async wait(action) {
    const seconds = action.seconds || action.time || 1;
    const ms = Math.min(Math.max(seconds * 1000, 100), 10000);

    logger.info(`等待 ${ms}ms`);
    await sleep(ms);

    return { success: true, waited: ms };
  }

  /**
   * 获取页面信息
   */
  async getPageInfo() {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const result = await getPageInfoSummary(this.tabId);
    if (result.success) {
      this.lastPageInfo = result;
    }

    return result;
  }

  /**
   * 点击元素
   */
  async click(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const index = action.index ?? action.索引;
    const selector = action.selector || action.target || action.text || action.文本;

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (idx, sel, pageInfo) => {
          const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };

          let element = null;

          // 优先使用 index
          if (typeof idx === 'number' && pageInfo?.clickables?.[idx]) {
            const info = pageInfo.clickables[idx];
            if (info.selector) {
              element = document.querySelector(info.selector);
            }
            if (!element && info.text) {
              const all = document.querySelectorAll('button, a, [role="button"], .ant-btn');
              element = Array.from(all).find(el =>
                el.textContent?.includes(info.text) && isVisible(el)
              );
            }
          }

          // 使用选择器
          if (!element && sel) {
            // 尝试 CSS 选择器
            try {
              element = document.querySelector(sel);
            } catch (e) {
              // 不是有效的 CSS 选择器
            }

            // 尝试文本匹配
            if (!element) {
              const all = document.querySelectorAll('button, a, [role="button"], .ant-btn, span, div');
              element = Array.from(all).find(el =>
                el.textContent?.trim() === sel || el.textContent?.includes(sel)
              );
            }
          }

          if (!element || !isVisible(element)) {
            return { success: false, error: `未找到可点击元素: ${sel || idx}` };
          }

          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.click();

          return { success: true, clicked: element.tagName, text: element.textContent?.slice(0, 50) };
        },
        args: [index, selector, this.lastPageInfo],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 在坐标点击
   */
  async clickAt(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const x = action.x || 0;
    const y = action.y || 0;

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (clickX, clickY) => {
          const element = document.elementFromPoint(clickX, clickY);
          if (!element) {
            return { success: false, error: `坐标 (${clickX}, ${clickY}) 处无元素` };
          }

          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: clickX,
            clientY: clickY,
          });
          element.dispatchEvent(event);

          return { success: true, clicked: element.tagName, x: clickX, y: clickY };
        },
        args: [x, y],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 输入文本
   */
  async type(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const index = action.index ?? action.索引;
    const selector = action.selector || action.target;
    const text = action.text || action.value || action.内容 || '';

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (idx, sel, inputText, pageInfo) => {
          const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };

          let element = null;

          // 优先使用 index
          if (typeof idx === 'number' && pageInfo?.inputs?.[idx]) {
            const info = pageInfo.inputs[idx];
            if (info.selector) {
              element = document.querySelector(info.selector);
            }
          }

          // 使用选择器
          if (!element && sel) {
            try {
              element = document.querySelector(sel);
            } catch (e) {
              // 不是有效的 CSS 选择器，尝试 placeholder 匹配
              const inputs = document.querySelectorAll('input, textarea');
              element = Array.from(inputs).find(el =>
                el.placeholder?.includes(sel) && isVisible(el)
              );
            }
          }

          // 兜底：第一个可见输入框
          if (!element) {
            const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
            element = Array.from(inputs).find(isVisible);
          }

          if (!element || !isVisible(element)) {
            return { success: false, error: `未找到输入框: ${sel || idx}` };
          }

          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
          element.value = inputText;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          return { success: true, typed: inputText.slice(0, 50), element: element.tagName };
        },
        args: [index, selector, text, this.lastPageInfo],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 输入 SQL（专用于神舟平台）
   */
  async inputSql(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const sql = action.sql || action.value || '';
    if (!sql) {
      return { success: false, error: 'SQL 不能为空' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (sqlText) => {
          // 尝试 CodeMirror
          const cmElement = document.querySelector('.CodeMirror');
          if (cmElement && cmElement.CodeMirror) {
            cmElement.CodeMirror.setValue(sqlText);
            return { success: true, editor: 'CodeMirror' };
          }

          // 尝试 Ace Editor
          const aceElement = document.querySelector('.ace_editor');
          if (aceElement && window.ace) {
            const editor = window.ace.edit(aceElement);
            editor.setValue(sqlText, -1);
            return { success: true, editor: 'Ace' };
          }

          // 尝试 Monaco Editor
          const monacoElement = document.querySelector('.monaco-editor');
          if (monacoElement && window.monaco) {
            const editors = window.monaco.editor.getEditors();
            if (editors.length > 0) {
              editors[0].setValue(sqlText);
              return { success: true, editor: 'Monaco' };
            }
          }

          // 尝试普通 textarea
          const textarea = document.querySelector('textarea.sql-editor, textarea[name*="sql"], textarea');
          if (textarea) {
            textarea.value = sqlText;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, editor: 'textarea' };
          }

          return { success: false, error: '未找到 SQL 编辑器' };
        },
        args: [sql],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 点击格式化按钮
   */
  async clickFormat() {
    return await this.click({ selector: '格式化' });
  }

  /**
   * 点击执行按钮
   */
  async clickExecute() {
    return await this.click({ selector: '执行' });
  }

  /**
   * 获取查询结果
   */
  async getResult() {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          // 尝试获取表格结果
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

          // 尝试获取 SQL 编辑器内容
          const cmElement = document.querySelector('.CodeMirror');
          if (cmElement && cmElement.CodeMirror) {
            const sql = cmElement.CodeMirror.getValue();
            if (sql) {
              return { success: true, resultType: 'sql', sql, editorType: 'CodeMirror' };
            }
          }

          const aceElement = document.querySelector('.ace_editor');
          if (aceElement && window.ace) {
            const editor = window.ace.edit(aceElement);
            const sql = editor.getValue();
            if (sql) {
              return { success: true, resultType: 'sql', sql, editorType: 'Ace' };
            }
          }

          // 尝试获取错误信息
          const error = document.querySelector('.ant-message-error, .error-message, .ant-alert-error');
          if (error) {
            return { success: true, resultType: 'error', error: error.textContent };
          }

          // 尝试获取纯文本结果
          const textResult = document.querySelector('.result-preview, .query-result');
          if (textResult) {
            return { success: true, resultType: 'text', text: textResult.textContent?.slice(0, 2000) };
          }

          return { success: false, error: '未找到查询结果' };
        },
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 滚动页面
   */
  async scroll(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const direction = action.direction || 'down';
    const amount = action.amount || 500;
    const x = action.x || 0;
    const y = action.y || (direction === 'down' ? amount : -amount);

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (scrollX, scrollY) => {
          window.scrollBy(scrollX, scrollY);
        },
        args: [x, y],
      });

      return { success: true, scrolled: { x, y } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 滚动到指定位置
   */
  async scrollTo(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const position = action.position;
    const top = action.top;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (pos, topValue) => {
          if (pos === 'top') {
            window.scrollTo(0, 0);
          } else if (pos === 'bottom') {
            window.scrollTo(0, document.body.scrollHeight);
          } else if (typeof topValue === 'number') {
            window.scrollTo(0, topValue);
          }
        },
        args: [position, top],
      });

      return { success: true, scrolledTo: position || top };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 滚动到包含指定文本的元素
   */
  async scrollToText(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const text = action.text;
    const occurrence = action.occurrence || 1;

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (searchText, occ) => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          let count = 0;
          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent?.includes(searchText)) {
              count++;
              if (count === occ) {
                node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return { success: true, found: true };
              }
            }
          }

          return { success: false, error: `未找到文本: ${searchText}` };
        },
        args: [text, occurrence],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 滚动容器
   */
  async scrollContainer(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const index = action.index;
    const selector = action.selector;
    const direction = action.direction || 'down';
    const amount = action.amount || 300;

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (idx, sel, dir, amt, pageInfo) => {
          let container = null;

          if (typeof idx === 'number' && pageInfo?.scrollables?.[idx]) {
            const info = pageInfo.scrollables[idx];
            if (info.selector) {
              container = document.querySelector(info.selector);
            }
          }

          if (!container && sel) {
            container = document.querySelector(sel);
          }

          if (!container) {
            return { success: false, error: '未找到可滚动容器' };
          }

          const scrollAmount = dir === 'up' ? -amt : amt;
          container.scrollBy(0, scrollAmount);

          return { success: true, scrolled: scrollAmount };
        },
        args: [index, selector, direction, amount, this.lastPageInfo],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 滚轮操作
   */
  async wheel(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const x = action.x || 0;
    const y = action.y || 0;
    const deltaY = action.deltaY || 100;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (wheelX, wheelY, delta) => {
          const element = document.elementFromPoint(wheelX, wheelY) || document.body;
          const event = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: wheelX,
            clientY: wheelY,
            deltaY: delta,
          });
          element.dispatchEvent(event);
        },
        args: [x, y, deltaY],
      });

      return { success: true, wheel: { x, y, deltaY } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 拖拽操作
   */
  async drag(action) {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    const from = action.from;
    const to = action.to;
    const steps = action.steps || 10;

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: (fromInfo, toInfo, stepCount) => {
          let startElement = null;
          let startX, startY;

          if (fromInfo.selector) {
            startElement = document.querySelector(fromInfo.selector);
            if (startElement) {
              const rect = startElement.getBoundingClientRect();
              startX = rect.left + (fromInfo.offsetX || rect.width / 2);
              startY = rect.top + (fromInfo.offsetY || rect.height / 2);
            }
          } else if (fromInfo.x !== undefined && fromInfo.y !== undefined) {
            startX = fromInfo.x;
            startY = fromInfo.y;
            startElement = document.elementFromPoint(startX, startY);
          }

          if (!startElement) {
            return { success: false, error: '未找到拖拽起始元素' };
          }

          const endX = toInfo.x;
          const endY = toInfo.y;

          // 模拟拖拽
          const mousedown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: startX,
            clientY: startY,
          });
          startElement.dispatchEvent(mousedown);

          // 模拟移动
          for (let i = 1; i <= stepCount; i++) {
            const progress = i / stepCount;
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;

            const mousemove = new MouseEvent('mousemove', {
              bubbles: true,
              cancelable: true,
              clientX: currentX,
              clientY: currentY,
            });
            document.dispatchEvent(mousemove);
          }

          const mouseup = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: endX,
            clientY: endY,
          });
          document.dispatchEvent(mouseup);

          return { success: true, dragged: { from: { x: startX, y: startY }, to: { x: endX, y: endY } } };
        },
        args: [from, to, steps],
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 点击重跑按钮
   */
  async clickRerun(action) {
    const rerunType = action.rerun_type || 'latest';
    // 先点击重跑按钮
    const clickResult = await this.click({ selector: '重跑' });
    if (!clickResult.success) {
      return clickResult;
    }

    await sleep(500);

    // 根据类型选择重跑方式
    if (rerunType === 'instance') {
      return await this.click({ selector: '仅重跑当前实例' });
    } else {
      return await this.click({ selector: '重跑最新实例' });
    }
  }

  /**
   * 点击 DAG 视图按钮
   */
  async clickDagView() {
    // 尝试多种可能的按钮文本
    const candidates = ['可视化', 'DAG', '依赖图', '血缘'];
    for (const text of candidates) {
      const result = await this.click({ selector: text });
      if (result.success) {
        await sleep(1000);
        return result;
      }
    }
    return { success: false, error: '未找到 DAG 视图按钮' };
  }

  /**
   * 获取 DAG 信息
   */
  async getDagInfo() {
    if (!this.tabId) {
      return { success: false, error: '无有效标签页' };
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: () => {
          // 尝试获取 DAG 节点信息
          const nodes = [];
          const edges = [];

          // 查找 DAG 节点
          document.querySelectorAll('.dag-node, .workflow-node, [class*="node"]').forEach(node => {
            const text = node.textContent?.trim().slice(0, 100);
            if (text) {
              nodes.push({ text, className: node.className });
            }
          });

          // 查找依赖关系
          document.querySelectorAll('.dag-edge, .workflow-edge, [class*="edge"]').forEach(edge => {
            edges.push({ className: edge.className });
          });

          if (nodes.length === 0) {
            return { success: false, error: '未找到 DAG 节点' };
          }

          return { success: true, nodes, edges, nodeCount: nodes.length, edgeCount: edges.length };
        },
      });

      return result?.[0]?.result || { success: false, error: '执行脚本失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 搜索 Confluence
   */
  async confluenceSearch(action) {
    const query = action.query;
    if (!query) {
      return { success: false, error: '搜索关键词不能为空' };
    }

    try {
      const results = await confluenceClient.search(query);
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取 Confluence 页面内容
   */
  async confluenceGetContent(action) {
    const pageId = action.page_id || action.pageId;
    if (!pageId) {
      return { success: false, error: '页面 ID 不能为空' };
    }

    try {
      const content = await confluenceClient.getPageContent(pageId);
      return { success: true, ...content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 创建全局单例
const actionExecutor = new ActionExecutor();

actionExecutor;


// === background/skills-manager.js ===
/**
 * Skills 管理模块
 * 处理自定义技能的加载和构建
 */


/**
 * 从存储加载自定义 Skills
 * @returns {Promise<Array>} Skills 数组
 */
async function loadCustomSkillsFromStorage() {
  const skills = await storage.get(StorageKeys.CUSTOM_SKILLS);
  return Array.isArray(skills) ? skills : [];
}

/**
 * 构建自定义 Skills 提示词块
 * @param {Array} customSkills - 自定义 Skills 数组
 * @param {Array} mentions - @提及的 skill handles
 * @param {Object} options - 选项
 * @returns {string} 提示词块
 */
function buildCustomSkillsBlock(customSkills, mentions = [], options = {}) {
  const enabled = (customSkills || []).filter(skill => skill && skill.enabled !== false);
  if (enabled.length === 0) return '';

  const normalizedMentions = (mentions || []).map(normalizeSkillHandle).filter(Boolean);
  let selected = enabled;

  // 如果有 @提及，只选择被提及的 skills
  if (normalizedMentions.length > 0) {
    selected = enabled.filter(skill => normalizedMentions.includes(getSkillHandle(skill)));
  }

  const maxSkills = typeof options.maxSkills === 'number' ? options.maxSkills : 6;
  selected = selected.slice(0, maxSkills);

  if (selected.length === 0) return '';

  const lines = selected.map(skill => {
    const handle = getSkillHandle(skill);
    const label = handle ? `${skill.name}（@${handle}）` : skill.name;
    const desc = String(skill.description || '').trim().slice(0, 200);
    const prompt = String(skill.prompt || '').trim().slice(0, 400);
    const detail = prompt ? `\n  说明: ${prompt}` : '';
    return `- ${label}: ${desc || '（暂无描述）'}${detail}`;
  });

  const header = normalizedMentions.length > 0 ? '【用户指定技能】' : '【用户自定义技能】';
  const enforce = normalizedMentions.length > 0
    ? '【执行规则】当用户 @技能 时，必须严格遵循对应技能说明与步骤，不要随意省略关键步骤。'
    : '';

  return `${header}\n${lines.join('\n')}\n${enforce}`.trim();
}

/**
 * 获取缺失的 Skill 提及
 * @param {Array} mentions - 提及的 handles
 * @param {Array} customSkills - 自定义 Skills
 * @returns {Array} 缺失的 handles
 */
function getMissingSkillMentions(mentions, customSkills) {
  const handles = new Set((customSkills || []).map(getSkillHandle).filter(Boolean));
  return (mentions || []).filter(m => !handles.has(normalizeSkillHandle(m)));
}


// === background/system-prompt.js ===
/**
 * 系统提示词模块
 * 构建 AI 调用所需的系统提示词
 */


// 极简版 Skills 文档
const SKILLS_DOC = `操作：navigate, wait, get_page_info, click, click_at, type, wheel, scroll, scroll_to, scroll_to_text, scroll_container, drag, input_sql, click_format, click_execute, get_result, click_rerun, click_dag_view, get_dag_info, confluence_search, confluence_get_content, finish

神舟URL：
- 临时查询：${SHENZHOU_URLS.QUERY}
- 数据地图：${SHENZHOU_URLS.TABLES}
- 任务列表：${SHENZHOU_URLS.TASKS}
- 任务实例：${SHENZHOU_URLS.INSTANCES}

分区：date_p格式'20260101'，type_p使用'>=0000'
SQL：SELECT SUM(cost) AS total_cost, COUNT(*) AS row_count FROM 库.表 WHERE date_p>='开始' AND date_p<='结束' AND type_p>='0000'

规则：只返回一个JSON对象（不要数组/不要markdown/不要解释）；禁止删除表/任务/任务节点（包含 Drop Table）

- navigate: {"action":"navigate","url":"https://..."}
- wait: {"action":"wait","seconds":0.2-2}
- get_page_info: {"action":"get_page_info"}（获取当前页 clickables/inputs/scrollables 列表，用于后续 click/type/scroll_container）
- click: {"action":"click","selector":"CSS选择器或按钮文本"} 或 {"action":"click","index":0}（优先用 get_page_info 的 index）
- click_at: {"action":"click_at","x":100,"y":200}（视口坐标；用于复杂组件/Canvas）
- type: {"action":"type","selector":"CSS选择器或输入框提示/文本","text":"要输入的内容"} 或 {"action":"type","index":0,"text":"..."}

通用滚动/复杂组件：
- scroll: {"action":"scroll","direction":"down|up","amount":800} 或 {"action":"scroll","x":0,"y":800}
- scroll_to: {"action":"scroll_to","position":"top|bottom"} 或 {"action":"scroll_to","top":1200}
- scroll_to_text: {"action":"scroll_to_text","text":"关键字","occurrence":1}
- scroll_container: {"action":"scroll_container","selector":"CSS","direction":"down","amount":600} 或 {"action":"scroll_container","index":0,"direction":"down","amount":600}（滚动容器，优先用 get_page_info 的 scrollables）
- wheel: {"action":"wheel","x":200,"y":300,"deltaY":800}（在坐标处滚轮；用于虚拟列表等）
- drag: {"action":"drag","from":{"selector":"CSS","offsetX":10,"offsetY":10},"to":{"x":600,"y":400},"steps":20}（拖拽/滑块/画布）

神舟查询专用：
- input_sql: {"action":"input_sql","sql":"SELECT ..."}
- click_format: {"action":"click_format"}
- click_execute: {"action":"click_execute"}
- get_result: {"action":"get_result"}（获取查询结果并自动格式化；无结果时尝试读取 SQL 编辑器内容）

任务/依赖：
- click_rerun: {"action":"click_rerun","rerun_type":"latest|instance"}
- click_dag_view: {"action":"click_dag_view"}
- get_dag_info: {"action":"get_dag_info"}

Confluence：
- confluence_search: {"action":"confluence_search","query":"关键词"}
- confluence_get_content: {"action":"confluence_get_content","page_id":"页面ID"}

- finish: {"action":"finish","result":"结果文本"}`;

/**
 * 从用户任务中提取任务名
 * @param {string} text - 用户任务文本
 * @returns {string} 任务名
 */
function extractTaskNameFromQuery(text) {
  const s = String(text || '').trim();
  if (!s) return '';

  const patterns = [
    /任务\s*[:：]?\s*([^\n，。,。]{2,60}?)(?:\s*的\s*(?:逻辑|SQL|脚本|代码)|\s*(?:逻辑|SQL|脚本|代码))/,
    /查看\s*([^\n，。,。]{2,60}?)\s*(?:任务|作业)\s*(?:逻辑|SQL|脚本|代码)/,
    /查看(?:神舟)?任务\s*([^\n，。,。]{2,60}?)(?:的|逻辑|SQL|脚本|代码)/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

/**
 * 判断是否为任务逻辑查看类任务
 * @param {string} userTask - 用户任务
 * @returns {Object} { ok: boolean, name: string }
 */
function looksLikeTaskLogicInspection(userTask) {
  const t = String(userTask || '').trim();
  if (!t) return { ok: false, name: '' };

  const hasTaskWord = /任务|作业|调度|实例/.test(t);
  const wantsLogic = /逻辑|SQL|脚本|代码|编辑|开发|依赖|DAG/.test(t);
  const name = extractTaskNameFromQuery(t);

  return { ok: hasTaskWord && wantsLogic, name };
}

/**
 * 构建任务逻辑查看的提示词
 * @param {Object} taskInspect - 任务检查结果
 * @returns {string} 提示词
 */
function buildTaskInspectHint(taskInspect) {
  if (!taskInspect.ok) return '';

  const taskName = taskInspect.name || '（从页面搜索）';

  return `
【任务逻辑查看规范 - 必须严格遵守】
你必须真实打开神舟页面获取信息，不允许凭空总结。
目标任务名：${taskName}

⚠️⚠️⚠️ 强制操作流程（不可跳过任何步骤，即使任务在列表中可见也必须先搜索）⚠️⚠️⚠️：
1) navigate 到 ${SHENZHOU_URLS.TASKS}
2) get_page_info → 获取页面状态，找到"任务名称"或"任务名"搜索输入框（通常在页面顶部）
3) type → 在搜索框输入任务名"${taskInspect.name || '任务名'}"（必须完整输入任务名称）
4) click → 点击搜索按钮（通常是输入框右侧的搜索图标或"搜索"按钮）
5) wait → 等待搜索结果加载完成（必须看到搜索结果列表，通常会有"共X条"提示）
6) get_page_info → 再次获取页面状态，确认搜索结果中出现目标任务"${taskInspect.name || '任务名'}"
7) click → 点击搜索结果中的目标任务名称或"编辑"按钮
8) get_page_info → 获取任务详情页面状态
9) click → 点击"编辑"按钮（如果还没进入编辑页面）
10) get_result → 抓取任务SQL/说明/输入输出表/调度信息
11) 如需依赖：click_dag_view / get_dag_info
12) finish → 用要点总结（目的/来源/口径/产出/分区/调度/依赖/注意事项）

🚫🚫🚫 严格禁止（违反将导致任务失败）🚫🚫🚫：
- ❌ 禁止跳过搜索步骤直接点击列表中的任务（即使任务已经在列表中可见）
- ❌ 禁止在未输入任务名称到搜索框时就点击任何按钮
- ❌ 禁止在未点击搜索按钮时就点击任务
- ❌ 禁止在未看到搜索结果时就点击任何按钮
- ❌ 禁止假设任务位置，必须通过搜索确认
- ❌ 禁止在未 get_result 或 get_dag_info 之前就 finish

💡 重要提示：
- 即使任务列表已经显示了目标任务，也必须先清空搜索框、输入任务名、点击搜索
- 搜索是为了确保找到正确的任务，避免点击错误的同名任务
- 搜索后通常会显示"共X条"结果，确认找到目标任务后再点击
`;
}

/**
 * 构建动态系统提示词
 * @param {string} userTask - 用户任务
 * @param {string} contextText - 上下文文本
 * @param {string} customSkillsBlock - 自定义技能块
 * @returns {string} 系统提示词
 */
function buildSystemPrompt(userTask, contextText = '', customSkillsBlock = '') {
  const taskInspect = looksLikeTaskLogicInspection(userTask);
  const inspectHint = buildTaskInspectHint(taskInspect);

  const clippedContext = String(contextText || '').trim().slice(0, 3500);
  const contextBlock = clippedContext
    ? `\n【最近对话上下文】\n${clippedContext}\n（请结合上下文理解用户目标与约束）\n`
    : '';

  const skillBlock = customSkillsBlock
    ? `\n${customSkillsBlock}\n`
    : '';

  return `数仓助手。返回一个JSON操作。

${SKILLS_DOC}
${skillBlock}
${inspectHint}
${contextBlock}

问题：${userTask}

重要：
- 根据用户目标决定是否需要 navigate（不要盲目跳到临时查询页）
- 如果不知道点哪个/填哪个，先 get_page_info 再 click/type
- 每次只返回一个操作；尽量少步骤；action.thinking 用中文简短说明

返回：{"action":"操作名", ...}（只一个操作，不要数组）
`;
}

/**
 * 构建聊天系统提示词
 * @param {Object} options - 选项
 * @returns {string} 系统提示词
 */
function buildChatSystemPrompt(options = {}) {
  const { pageContext, customSkillsBlock } = options;

  let prompt = `你是美图公司数仓团队的 AI 助手 "数仓小助手"。

## 你的主人
蔺清建（linqingjian@meitu.com），数仓工程师，负责 RoboNeo、外采成本、素材中台、活跃宽表。

## 核心能力
1. 回答数据仓库相关问题
2. 帮助编写和优化 SQL
3. 解释表结构和数据血缘
4. 搜索和获取 Confluence 文档
5. 分析任务逻辑和调度依赖

## 回复规范
- 使用中文回复
- 代码使用 markdown 代码块
- 回答简洁明了，重点突出
- 如需截图查看页面，回复 [[NEED_SCREENSHOT]]
`;

  if (customSkillsBlock) {
    prompt += `\n${customSkillsBlock}\n`;
  }

  if (pageContext) {
    prompt += `\n## 当前页面信息\n`;
    if (pageContext.url) prompt += `URL: ${pageContext.url}\n`;
    if (pageContext.title) prompt += `标题: ${pageContext.title}\n`;
  }

  return prompt;
}

// === background/task-executor.js ===
/**
 * 任务执行器模块
 * 处理任务的执行流程
 */



/**
 * 任务执行器类
 */
class TaskExecutor {
  constructor() {
    this.currentTask = null;
    this.taskLogs = [];
    this.currentTabId = null;
    this.actionsHistory = [];
    this.lastCompleted = null;
    this.lastPageInfo = null;

    // 任务控制
    this.taskControl = { paused: false, canceled: false };
    this.pauseWaiters = [];
    this.abortControllers = new Set();
  }

  /**
   * 添加日志
   * @param {string} message - 日志消息
   * @param {string} type - 日志类型
   */
  addLog(message, type = 'info') {
    const logEntry = logger[type]?.(message) || logger.info(message);

    if (logEntry) {
      this.taskLogs.push(logEntry);
      if (this.taskLogs.length > MAX_TASK_LOGS) {
        this.taskLogs = this.taskLogs.slice(-MAX_TASK_LOGS);
      }

      // 通知 popup 更新
      try {
        chrome.runtime.sendMessage({ type: MessageTypes.LOG_UPDATE, log: logEntry }).catch(() => {});
      } catch (e) {
        // ignore
      }

      // 保存到存储
      scheduleTaskLogsSave(this.taskLogs);
    }
  }

  /**
   * 设置任务暂停状态
   * @param {boolean} paused - 是否暂停
   */
  setPaused(paused) {
    this.taskControl.paused = !!paused;
    if (!this.taskControl.paused) {
      const waiters = this.pauseWaiters;
      this.pauseWaiters = [];
      waiters.forEach(r => {
        try { r(); } catch (e) {}
      });
    }
  }

  /**
   * 取消任务
   */
  cancel() {
    this.taskControl.canceled = true;
    this.setPaused(false);

    // 中断正在进行的请求
    for (const controller of this.abortControllers) {
      try { controller.abort(); } catch (e) {}
    }
    this.abortControllers.clear();
  }

  /**
   * 等待暂停状态解除
   */
  async waitIfPaused() {
    while (this.taskControl.paused) {
      await new Promise(resolve => this.pauseWaiters.push(resolve));
      if (this.taskControl.canceled) throw new Error('任务已取消');
    }
  }

  /**
   * 通知 content script 任务状态
   * @param {string} status - 状态
   * @param {*} result - 结果
   * @param {string} error - 错误
   */
  notifyContentScript(status, result = null, error = null) {
    const send = (tabId) => {
      if (!tabId) return;
      chrome.tabs.sendMessage(tabId, {
        type: MessageTypes.TASK_STATUS_UPDATE,
        status,
        result,
        error,
      }).catch(() => {});
    };

    if (this.currentTabId) {
      send(this.currentTabId);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) send(tabs[0].id);
    });
  }

  /**
   * 解析 AI 返回的操作
   * @param {string} response - AI 响应
   * @returns {Object|null} 操作对象
   */
  parseAction(response) {
    if (!response) return null;

    // 尝试直接解析
    try {
      const parsed = JSON.parse(response.trim());
      if (parsed && parsed.action) return parsed;
    } catch (e) {
      // 继续尝试其他方式
    }

    // 尝试从 markdown 代码块中提取
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed && parsed.action) return parsed;
      } catch (e) {
        // 继续尝试
      }
    }

    // 尝试提取 JSON 对象
    const jsonMatch = response.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && parsed.action) return parsed;
      } catch (e) {
        // 解析失败
      }
    }

    return null;
  }

  /**
   * 开始执行任务
   * @param {string} task - 任务描述
   * @param {string} model - 模型名称
   * @param {Object} options - 选项
   */
  async startTask(task, model, options = {}) {
    // 重置状态
    this.currentTask = task;
    this.taskLogs = [];
    this.actionsHistory = [];
    this.lastPageInfo = null;
    this.taskControl = { paused: false, canceled: false };
    this.pauseWaiters = [];

    const taskInspect = looksLikeTaskLogicInspection(task);
    let evidenceCount = 0;

    // 获取标签页
    try {
      this.currentTabId = await resolveInitialTaskTabId({ preferShenzhou: options.preferShenzhou !== false });
      actionExecutor.setTabId(this.currentTabId);

      if (this.currentTabId) {
        this.addLog(`当前标签页 ID: ${this.currentTabId}`, 'info');
      } else {
        this.addLog('⚠️ 未找到可操作的标签页，将创建新标签页', 'warn');
      }
    } catch (error) {
      this.addLog(`⚠️ 获取标签页失败: ${error.message}`, 'warn');
    }

    this.addLog(`开始任务: ${task}`, 'info');
    this.addLog(`使用模型: ${model}`, 'info');

    // 判断是否需要自动导航
    let currentUrl = '';
    let isShenzhou = false;
    let isQuery = false;

    try {
      if (this.currentTabId) {
        currentUrl = await getCurrentTabUrl(this.currentTabId);
        this.addLog(`当前页面 URL: ${currentUrl}`, 'info');
        isShenzhou = isShenzhouUrl(currentUrl);
        isQuery = isQueryPage(currentUrl);
      }
    } catch (e) {
      this.addLog(`⚠️ 无法获取当前页面 URL: ${e.message}`, 'warn');
    }

    // 判断任务类型
    const taskLower = String(task || '').toLowerCase();
    const queryLike = [
      'select ', 'from ', 'where ', 'group by', 'order by', 'sum(', 'count(',
      'sql', '查询', '临时查询', 'cost', 'row_count', 'total_cost'
    ].some(k => taskLower.includes(k));

    const needNavigateQuery = queryLike && (!this.currentTabId || !isOperablePageUrl(currentUrl) || !isShenzhou);
    const needNavigateTasks = taskInspect.ok && (!this.currentTabId || !isOperablePageUrl(currentUrl) || !isShenzhou);

    // 自动导航
    if (needNavigateTasks) {
      this.addLog(`🌐 检测到"查看任务逻辑"类任务，自动打开任务列表`, 'action');
      await this.navigateToUrl(SHENZHOU_URLS.TASKS);
    } else if (needNavigateQuery) {
      this.addLog(`🌐 检测到查询类任务，自动打开临时查询页`, 'action');
      await this.navigateToUrl(SHENZHOU_URLS.QUERY);
    } else {
      this.addLog(isQuery ? '✅ 当前已在临时查询页' : '✅ 当前页面可用，交给 AI 决定是否导航', 'success');
    }

    // 构建系统提示词
    this.addLog(`📝 构建系统提示词...`, 'action');
    const skillMentions = Array.isArray(options.skillMentions) && options.skillMentions.length > 0
      ? options.skillMentions
      : extractSkillMentions(task);
    const customSkills = await loadCustomSkillsFromStorage();
    const customSkillsBlock = buildCustomSkillsBlock(customSkills, skillMentions, { maxSkills: 6 });
    const systemPrompt = buildSystemPrompt(task, options.contextText || '', customSkillsBlock);
    this.addLog(`✅ 系统提示词构建完成`, 'success');

    // 初始化消息
    let messages = [{ role: 'system', content: systemPrompt }];

    // 获取配置
    const config = await storage.getMany([StorageKeys.MAX_STEPS]);
    const maxSteps = Math.min(Math.max(Number(config[StorageKeys.MAX_STEPS] || DEFAULT_MAX_STEPS), 1), MAX_STEPS_LIMIT);

    let step = 0;
    let waitCount = 0;
    let lastActions = [];

    this.addLog(`🚀 开始执行任务步骤（最多${maxSteps}步）...`, 'action');

    // 主循环
    while (step < maxSteps) {
      if (this.taskControl.canceled) {
        this.addLog('⛔ 任务已取消，停止执行', 'error');
        chrome.runtime.sendMessage({ type: MessageTypes.TASK_CANCELED }).catch(() => {});
        break;
      }

      await this.waitIfPaused();

      step++;
      this.addLog(`步骤 ${step}/${maxSteps}: 等待 AI 指令...`, 'action');

      try {
        // 限制消息长度
        if (messages.length > 9) {
          messages = [messages[0], ...messages.slice(-8)];
        }

        // 调用 AI
        const abortController = new AbortController();
        this.abortControllers.add(abortController);
        let aiResponse;
        try {
          aiResponse = await aiClient.chatWithRetry(messages, {
            model,
            maxTokens: 1600,
            temperature: 0.1,
            signal: abortController.signal,
          });
        } finally {
          this.abortControllers.delete(abortController);
        }

        const responseText = aiResponse.content;
        const preview = responseText.substring(0, 200);
        this.addLog(`AI 返回: ${preview}${responseText.length > 200 ? '...' : ''}`, 'info');

        // 解析操作
        const action = this.parseAction(responseText);
        if (!action) {
          this.addLog(`❌ 无法解析 AI 返回的操作`, 'error');
          messages.push({ role: 'assistant', content: responseText });
          messages.push({
            role: 'user',
            content: '你返回的内容无法解析为 JSON。请只返回一个纯 JSON 对象，格式示例：{"action": "navigate", "url": "https://..."}'
          });
          continue;
        }

        // 任务逻辑查看：检查证据
        if (taskInspect.ok && action.action === 'finish' && evidenceCount === 0) {
          this.addLog('⚠️ 拒绝 finish：尚未抓取页面证据', 'warn');
          messages.push({ role: 'assistant', content: responseText });
          messages.push({
            role: 'user',
            content: '你不能在未获取页面信息前总结。请按流程操作后再 finish。'
          });
          continue;
        }

        // 安全检查
        const currentUrl = await getCurrentTabUrl(this.currentTabId);
        const destructiveReason = getDestructiveReason(action, { url: currentUrl, lastPageInfo: this.lastPageInfo });
        if (destructiveReason) {
          const blockedMsg = `检测到删除操作，已拦截：${destructiveReason}`;
          this.addLog(`🚫 ${blockedMsg}`, 'error');
          throw new Error(blockedMsg);
        }

        this.addLog(`执行操作: ${action.action}`, 'action');
        const thinking = action.thinking || action.思路 || action.说明;
        if (thinking) {
          this.addLog(`思路: ${thinking}`, 'info');
        }

        // 通知进度
        chrome.runtime.sendMessage({
          type: MessageTypes.TASK_PROGRESS,
          action: action.action,
          thinking: thinking || '',
        }).catch(() => {});

        // 自动关闭弹窗
        const rawTarget = action.selector || action.target || action.url || '';
        const wantsDialog = action.action === 'click' && typeof rawTarget === 'string' &&
          (rawTarget.includes('恢复') || rawTarget.includes('放弃'));
        if (!wantsDialog && action.action !== 'finish') {
          const dismissed = await autoDismissBlockingDialogs(this.currentTabId);
          if (dismissed?.dismissed) {
            this.addLog(`🧹 已自动关闭弹窗`, 'action');
            await sleep(250);
          }
        }

        // 记录操作历史
        this.actionsHistory.push(action.action);
        lastActions.push(action.action);
        if (lastActions.length > 10) lastActions.shift();

        // 检测循环
        if (lastActions.length >= 10) {
          const actionCounts = {};
          lastActions.forEach(a => { actionCounts[a] = (actionCounts[a] || 0) + 1; });
          const maxCount = Math.max(...Object.values(actionCounts));
          if (maxCount >= 5) {
            const repeatedAction = Object.keys(actionCounts).find(k => actionCounts[k] === maxCount);
            this.addLog(`⚠️ 检测到可能的循环（${repeatedAction} 重复 ${maxCount} 次）`, 'warn');
            messages.push({
              role: 'user',
              content: `检测到可能的循环。请检查任务是否已完成，如果已完成请使用 finish 操作。`
            });
          }
        }

        // 统计连续 wait
        if (action.action === 'wait') {
          waitCount++;
          if (waitCount >= 5) {
            this.addLog('❌ 检测到无限循环（连续 wait 5次），任务已停止', 'error');
            this.notifyContentScript('error', null, '检测到无限循环');
            break;
          }
        } else {
          waitCount = 0;
        }

        await this.waitIfPaused();

        // 执行操作
        actionExecutor.setLastPageInfo(this.lastPageInfo);
        const result = await actionExecutor.execute(action);

        // 更新页面信息
        if (action.action === 'get_page_info' && result.success) {
          this.lastPageInfo = result;
        }

        // 记录证据
        if (taskInspect.ok) {
          const evidenceActions = new Set(['get_result', 'get_page_info', 'get_dag_info']);
          if (evidenceActions.has(action.action)) evidenceCount++;
          if (result && (result.data || result.result)) evidenceCount++;
        }

        // 检查是否需要停止
        if (result && result.stopExecution) {
          this.addLog(`🛑 操作失败，停止执行: ${result.error}`, 'error');
          this.notifyContentScript('error', null, result.error);
          break;
        }

        // 任务完成
        if (action.action === 'finish') {
          this.addLog(`✅ 任务完成: ${action.result}`, 'success');
          this.lastCompleted = { task: this.currentTask, result: action.result, ts: Date.now() };
          await saveLastResult(this.currentTask, action.result);

          chrome.runtime.sendMessage({ type: MessageTypes.TASK_COMPLETE, result: action.result }).catch(() => {});
          this.notifyContentScript('completed', action.result);
          break;
        }

        // 更新消息历史
        messages.push({ role: 'assistant', content: responseText });

        // 根据操作类型添加后续提示
        if (action.action === 'click_execute' && result.success) {
          messages.push({
            role: 'user',
            content: 'SQL 查询已执行。现在请：1) wait 5秒 2) get_result 3) finish'
          });
        } else if (action.action === 'get_result' && result.success && result.data) {
          messages.push({
            role: 'user',
            content: `查询结果已获取：${result.formatted || JSON.stringify(result.data)}。请立即 finish。`
          });
        } else {
          messages.push({
            role: 'user',
            content: `操作已执行。结果: ${JSON.stringify(result)}。请继续下一步操作。`
          });
        }

      } catch (error) {
        if (this.taskControl.canceled) {
          this.addLog('⛔ 任务已取消', 'error');
          chrome.runtime.sendMessage({ type: MessageTypes.TASK_CANCELED }).catch(() => {});
          this.notifyContentScript('error', null, '任务已取消');
          break;
        }

        this.addLog(`❌ 错误: ${error.message}`, 'error');
        this.notifyContentScript('error', null, error.message);
        chrome.runtime.sendMessage({ type: MessageTypes.TASK_ERROR, error: error.message }).catch(() => {});
        break;
      }
    }

    if (step >= maxSteps) {
      const errorMsg = `❌ 任务执行步骤过多（${step}步），已停止`;
      this.addLog(errorMsg, 'error');
      this.notifyContentScript('error', null, errorMsg);
      chrome.runtime.sendMessage({ type: MessageTypes.TASK_ERROR, error: errorMsg }).catch(() => {});
    }

    await flushTaskLogsSave().catch(() => {});
    this.currentTask = null;
  }

  /**
   * 导航到 URL
   * @param {string} url - 目标 URL
   */
  async navigateToUrl(url) {
    if (this.currentTabId) {
      await chrome.tabs.update(this.currentTabId, { url });
    } else {
      const newTab = await chrome.tabs.create({ url, active: true });
      this.currentTabId = newTab.id;
      actionExecutor.setTabId(this.currentTabId);
      this.addLog(`✅ 已创建新标签页，ID: ${this.currentTabId}`, 'info');
    }

    const navResult = await waitForTabComplete(this.currentTabId, 8000);
    if (!navResult.ok) {
      this.addLog(`⚠️ 页面加载超时`, 'warn');
    }
  }

  /**
   * 获取当前状态
   * @returns {Object} 状态对象
   */
  getStatus() {
    return {
      status: this.currentTask ? (this.taskControl.paused ? 'paused' : 'running') : 'idle',
      logs: this.taskLogs,
      lastResult: this.lastCompleted,
      paused: !!this.taskControl.paused,
    };
  }

  /**
   * 获取最后结果
   * @returns {Object|null} 最后结果
   */
  getLastResult() {
    return this.lastCompleted;
  }
}

// 创建全局单例
const taskExecutor = new TaskExecutor();

taskExecutor;


// === background/chat-handler.js ===
/**
 * 聊天处理器模块
 * 处理纯对话模式的消息
 */



/**
 * 聊天处理器类
 */
class ChatHandler {
  constructor() {
    this.streamControllers = new Map();
    this.lastPageContextSummary = null;
    this.lastPageContextTabId = null;
    this.lastPageContextAt = 0;
  }

  /**
   * 检查响应是否请求截图
   * @param {string} text - 响应文本
   * @returns {boolean}
   */
  responseRequestsScreenshot(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return false;
    if (trimmed === SCREENSHOT_REQUEST_TOKEN) return true;
    const withoutToken = trimmed.replace(SCREENSHOT_REQUEST_TOKEN, '').trim();
    return withoutToken.length === 0;
  }

  /**
   * 处理聊天消息
   * @param {string} message - 用户消息
   * @param {string} model - 模型名称
   * @param {string} weeklyReportRootPageId - 周报根目录页面 ID
   * @param {Object} options - 选项
   * @returns {Promise<string>} 回复内容
   */
  async handleMessage(message, model = 'gpt-5.2', weeklyReportRootPageId = null, options = {}) {
    logger.action(`处理对话消息: ${message.slice(0, 100)}`);

    // 加载配置
    if (!weeklyReportRootPageId) {
      const config = await storage.get(StorageKeys.WEEKLY_REPORT_ROOT_PAGE_ID);
      weeklyReportRootPageId = config || confluenceClient.weeklyReportRootPageId;
    }
    confluenceClient.setWeeklyReportRootPageId(weeklyReportRootPageId);

    // 获取页面上下文
    let pageContext = null;
    let activeTabId = null;

    if (options.includePageContext !== false) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('chrome-extension://')) {
          activeTabId = activeTab.id;
          pageContext = {
            url: activeTab.url,
            title: activeTab.title,
          };

          // 获取详细页面信息（短时间内复用缓存）
          const now = Date.now();
          const reuseCache = this.lastPageContextSummary &&
            this.lastPageContextTabId === activeTabId &&
            (now - this.lastPageContextAt) < 2000;

          const summary = reuseCache
            ? this.lastPageContextSummary
            : await withTimeout(getPageInfoSummary(activeTabId), 1500).catch(() => null);

          if (summary?.success) {
            this.lastPageContextSummary = summary;
            this.lastPageContextTabId = activeTabId;
            this.lastPageContextAt = Date.now();
            pageContext = {
              ...pageContext,
              clickables: (summary.clickables || []).slice(0, 8),
              inputs: (summary.inputs || []).slice(0, 8),
              scrollables: (summary.scrollables || []).slice(0, 5),
            };
          }
        }
      } catch (error) {
        logger.warn(`获取页面上下文失败: ${error.message}`);
      }
    }

    // 流式输出相关
    const streamEnabled = !!options.stream && typeof options.onStreamChunk === 'function';
    const onStreamChunk = streamEnabled ? options.onStreamChunk : null;
    const onStreamStatus = typeof options.onStreamStatus === 'function' ? options.onStreamStatus : null;

    if (onStreamStatus) onStreamStatus('思考中...');

    try {
      // 加载自定义技能
      const skillMentions = Array.isArray(options.skillMentions) && options.skillMentions.length > 0
        ? options.skillMentions
        : extractSkillMentions(message);
      const customSkills = await loadCustomSkillsFromStorage();
      const customSkillsBlock = buildCustomSkillsBlock(customSkills, skillMentions, { maxSkills: 6 });

      // 检查是否需要搜索 Confluence
      const needsSearch = this.shouldSearchConfluence(message);
      let confluenceResults = null;

      if (needsSearch) {
        if (onStreamStatus) onStreamStatus('搜索文档中...');
        confluenceResults = await this.searchConfluenceForMessage(message, weeklyReportRootPageId);
      }

      // 构建系统提示词
      const systemPrompt = buildChatSystemPrompt({
        pageContext,
        customSkillsBlock,
      });

      // 构建消息
      const messages = [];

      // 添加上下文
      if (options.contextText) {
        messages.push({ role: 'system', content: `历史对话:\n${options.contextText}` });
      }

      // 添加 Confluence 结果
      if (confluenceResults) {
        messages.push({
          role: 'system',
          content: `相关文档:\n${confluenceResults}`,
        });
      }

      // 添加附件
      if (options.attachments && options.attachments.length > 0) {
        const attachmentContent = this.formatAttachments(options.attachments);
        if (attachmentContent) {
          messages.push({ role: 'user', content: attachmentContent });
        }
      }

      // 添加用户消息
      messages.push({ role: 'user', content: message });

      if (onStreamStatus) onStreamStatus('生成回复中...');

      // 调用 AI
      let reply = '';

      if (streamEnabled) {
        // 流式输出
        const abortController = options.abortController || new AbortController();

        try {
          for await (const chunk of aiClient.chatStream(messages, {
            model,
            systemPrompt,
            signal: abortController.signal,
          })) {
            if (chunk.type === 'content') {
              reply += chunk.content;
              onStreamChunk(chunk.content);
            }
          }
        } catch (error) {
          if (error.name === 'AbortError' || abortController.signal.aborted) {
            logger.info('流式输出已取消');
            return reply || '（已取消）';
          }
          throw error;
        }
      } else {
        // 非流式输出
        const result = await aiClient.chat(messages, {
          model,
          systemPrompt,
        });
        reply = result.content;
      }

      // 检查是否需要截图
      if (this.responseRequestsScreenshot(reply) && activeTabId) {
        if (onStreamStatus) onStreamStatus('截取页面中...');

        const screenshot = await captureActiveTabScreenshot();
        if (screenshot.success) {
          // 带截图重新调用
          const screenshotMessages = [
            ...messages,
            { role: 'assistant', content: reply },
            {
              role: 'user',
              content: [
                { type: 'text', text: '这是当前页面的截图，请根据截图内容回答问题。' },
                { type: 'image_url', image_url: { url: screenshot.dataUrl } },
              ],
            },
          ];

          if (streamEnabled) {
            reply = '';
            for await (const chunk of aiClient.chatStream(screenshotMessages, {
              model,
              systemPrompt,
            })) {
              if (chunk.type === 'content') {
                reply += chunk.content;
                onStreamChunk(chunk.content);
              }
            }
          } else {
            const result = await aiClient.chat(screenshotMessages, {
              model,
              systemPrompt,
            });
            reply = result.content;
          }
        }
      }

      logger.success(`对话处理完成，回复长度: ${reply.length}`);
      return reply;

    } catch (error) {
      logger.error(`对话处理失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 判断是否需要搜索 Confluence
   * @param {string} message - 消息内容
   * @returns {boolean}
   */
  shouldSearchConfluence(message) {
    const lower = message.toLowerCase();
    return lower.includes('confluence') ||
      lower.includes('cf') ||
      lower.includes('周报') ||
      lower.includes('日报') ||
      lower.includes('文档');
  }

  /**
   * 为消息搜索 Confluence
   * @param {string} message - 消息内容
   * @param {string} weeklyReportRootPageId - 周报根目录页面 ID
   * @returns {Promise<string|null>} 搜索结果
   */
  async searchConfluenceForMessage(message, weeklyReportRootPageId) {
    try {
      const isWeeklyReportQuery = message.includes('周报') || message.includes('日报');

      let results = [];

      if (isWeeklyReportQuery && weeklyReportRootPageId) {
        // 从周报目录搜索
        results = await confluenceClient.searchInWeeklyReports(message);
      }

      if (results.length === 0) {
        // 全局搜索
        const keywords = this.extractSearchKeywords(message);
        if (keywords) {
          results = await confluenceClient.search(keywords, { limit: 5 });
        }
      }

      if (results.length === 0) {
        return null;
      }

      // 格式化结果
      const formatted = results.slice(0, 5).map((r, i) =>
        `${i + 1}. ${r.title} (ID: ${r.id})\n   URL: ${r.url}`
      ).join('\n');

      return formatted;

    } catch (error) {
      logger.warn(`Confluence 搜索失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 提取搜索关键词
   * @param {string} message - 消息内容
   * @returns {string} 关键词
   */
  extractSearchKeywords(message) {
    // 移除常见的问句词
    let keywords = message
      .replace(/请|帮我|查找|搜索|查询|获取|找|看看|有没有|是什么|怎么|如何/g, '')
      .replace(/confluence|cf|文档|页面/gi, '')
      .trim();

    // 如果太短，使用原始消息
    if (keywords.length < 2) {
      keywords = message.slice(0, 50);
    }

    return keywords.slice(0, 100);
  }

  /**
   * 格式化附件
   * @param {Array} attachments - 附件数组
   * @returns {string|Array} 格式化后的内容
   */
  formatAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';

    const parts = [];

    for (const attachment of attachments) {
      if (attachment.type === 'image' && attachment.dataUrl) {
        parts.push({
          type: 'image_url',
          image_url: { url: attachment.dataUrl },
        });
      } else if (attachment.type === 'text' && attachment.content) {
        parts.push({
          type: 'text',
          text: `附件内容:\n${attachment.content}`,
        });
      }
    }

    if (parts.length === 0) return '';
    if (parts.length === 1 && parts[0].type === 'text') {
      return parts[0].text;
    }

    return parts;
  }

  /**
   * 同步页面上下文
   * @returns {Promise<Object>} 页面上下文
   */
  async syncPageContext() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) {
        return { success: false, error: '未找到活动标签页' };
      }

      const summary = await getPageInfoSummary(activeTab.id);
      if (summary.success) {
        this.lastPageContextSummary = summary;
        this.lastPageContextTabId = activeTab.id;
        this.lastPageContextAt = Date.now();
      }

      return summary;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 取消流式输出
   * @param {string} requestId - 请求 ID
   */
  cancelStream(requestId) {
    const controller = this.streamControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.streamControllers.delete(requestId);
    }
  }

  /**
   * 注册流式控制器
   * @param {string} requestId - 请求 ID
   * @param {AbortController} controller - 控制器
   */
  registerStreamController(requestId, controller) {
    this.streamControllers.set(requestId, controller);
  }

  /**
   * 移除流式控制器
   * @param {string} requestId - 请求 ID
   */
  removeStreamController(requestId) {
    this.streamControllers.delete(requestId);
  }
}

// 创建全局单例
const chatHandler = new ChatHandler();

chatHandler;


// === background/index.js ===
/**
 * Background Service Worker 主入口
 * 处理消息路由和扩展生命周期
 */



// ==================== Keep Alive ====================
// MV3 Service Worker 可能在长任务中被挂起，通过长连接保持存活
const keepAlivePorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'popup-keepalive') return;

  keepAlivePorts.add(port);

  port.onMessage.addListener((msg) => {
    if (msg && msg.type === 'PING') {
      try {
        port.postMessage({ type: 'PONG', t: Date.now() });
      } catch (e) {
        // ignore
      }
    }
  });

  port.onDisconnect.addListener(() => {
    keepAlivePorts.delete(port);
  });
});

// ==================== 初始化 ====================
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('🤖 数仓小助手已安装');

  // 加载配置
  await loadConfig().catch(() => {});

  // 设置默认模型
  const config = await storage.get(StorageKeys.MODEL);
  if (!config) {
    await storage.set(StorageKeys.MODEL, DEFAULT_MODEL);
  }

  // 设置侧边栏行为
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {
    // ignore
  }

  // 首次安装打开配置页
  if (details?.reason === 'install') {
    try {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: 'options.html' });
      }
    } catch (e) {
      // ignore
    }
  }
});

// 启动时加载配置
loadConfig().catch(() => {});

// ==================== 消息处理 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const messageType = request.type;
  logger.debug(`收到消息: ${messageType}`);

  // 任务相关消息
  if (messageType === TaskMessages.START_TASK) {
    handleStartTask(request, sendResponse);
    return true;
  }

  if (messageType === TaskMessages.GET_STATUS) {
    sendResponse(taskExecutor.getStatus());
    return;
  }

  if (messageType === TaskMessages.TASK_PAUSE) {
    handleTaskPause(sendResponse);
    return;
  }

  if (messageType === TaskMessages.TASK_RESUME) {
    handleTaskResume(sendResponse);
    return;
  }

  if (messageType === TaskMessages.TASK_CANCEL) {
    handleTaskCancel(sendResponse);
    return;
  }

  if (messageType === TaskMessages.GET_LAST_RESULT) {
    const lastResult = taskExecutor.getLastResult();
    sendResponse({ result: lastResult?.result || null });
    return;
  }

  // 聊天相关消息
  if (messageType === ChatMessages.CHAT_MESSAGE) {
    handleChatMessage(request, sendResponse);
    return true;
  }

  if (messageType === ChatMessages.CHAT_MESSAGE_STREAM) {
    handleChatMessageStream(request, sendResponse);
    return true;
  }

  if (messageType === ChatMessages.CHAT_STREAM_CANCEL) {
    handleChatStreamCancel(request, sendResponse);
    return;
  }

  // 页面相关消息
  if (messageType === PageMessages.SYNC_PAGE_CONTEXT) {
    handleSyncPageContext(sendResponse);
    return true;
  }

  // UI 相关消息
  if (messageType === UIMessages.OPEN_SIDE_PANEL) {
    handleOpenSidePanel(sender, sendResponse);
    return true;
  }

  // 日志相关消息
  if (messageType === LogMessages.GET_LOGS) {
    handleGetLogs(sendResponse);
    return true;
  }

  if (messageType === LogMessages.CLEAR_LOGS) {
    handleClearLogs(sendResponse);
    return;
  }

  // 外部服务消息
  if (messageType === ExternalMessages.SEND_TO_WECHAT) {
    handleSendToWechat(request, sendResponse);
    return;
  }

  // 未知消息类型
  logger.warn(`未知消息类型: ${messageType}`);
  sendResponse({ success: false, error: '未知消息类型' });
});

// ==================== 消息处理函数 ====================

/**
 * 处理开始任务
 */
async function handleStartTask(request, sendResponse) {
  logger.action(`开始执行任务: ${request.task}`);

  // 更新 Confluence Token
  if (request.confluenceToken) {
    confluenceClient.setToken(request.confluenceToken);
  }

  // 异步执行任务
  taskExecutor.startTask(request.task, request.model, {
    preferShenzhou: request.preferShenzhou !== false,
    contextText: request.contextText || '',
    skillMentions: Array.isArray(request.skillMentions) ? request.skillMentions : [],
  }).catch(error => {
    logger.error(`任务执行失败: ${error.message}`);
  });

  // 通知 content script
  taskExecutor.notifyContentScript('running', null, null);

  sendResponse({ status: 'started' });
}

/**
 * 处理任务暂停
 */
function handleTaskPause(sendResponse) {
  const status = taskExecutor.getStatus();
  if (status.status === 'running') {
    taskExecutor.setPaused(true);
    logger.info('⏸ 已暂停任务');
    chrome.runtime.sendMessage({ type: TaskMessages.TASK_PAUSED }).catch(() => {});
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: '当前没有运行中的任务' });
  }
}

/**
 * 处理任务继续
 */
function handleTaskResume(sendResponse) {
  const status = taskExecutor.getStatus();
  if (status.status === 'paused') {
    taskExecutor.setPaused(false);
    logger.info('▶️ 已继续任务');
    chrome.runtime.sendMessage({ type: TaskMessages.TASK_RESUMED }).catch(() => {});
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: '当前没有暂停的任务' });
  }
}

/**
 * 处理任务取消
 */
function handleTaskCancel(sendResponse) {
  const status = taskExecutor.getStatus();
  if (status.status !== 'idle') {
    taskExecutor.cancel();
    logger.info('⛔ 已停止任务');
    chrome.runtime.sendMessage({ type: TaskMessages.TASK_CANCELED }).catch(() => {});
    taskExecutor.notifyContentScript('error', null, '任务已取消');
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: '当前没有运行中的任务' });
  }
}

/**
 * 处理聊天消息（非流式）
 */
async function handleChatMessage(request, sendResponse) {
  try {
    const reply = await chatHandler.handleMessage(
      request.message,
      request.model,
      request.weeklyReportRootPageId,
      {
        showPlan: !!request.showPlan,
        includePageContext: request.includePageContext !== false,
        attachments: Array.isArray(request.attachments) ? request.attachments : [],
        allowImages: !!request.allowImages,
        contextText: request.contextText || '',
        skillMentions: Array.isArray(request.skillMentions) ? request.skillMentions : [],
      }
    );

    sendResponse({ success: true, reply });
  } catch (error) {
    logger.error(`对话处理失败: ${error.message}`);
    sendResponse({ success: false, error: error.message || '对话处理失败' });
  }
}

/**
 * 处理聊天消息（流式）
 */
async function handleChatMessageStream(request, sendResponse) {
  const requestId = request.requestId || `chat_${Date.now()}`;

  const sendChunk = (chunk) => {
    chrome.runtime.sendMessage({ type: ChatMessages.CHAT_STREAM, requestId, chunk }).catch(() => {});
  };

  const sendStatus = (status) => {
    chrome.runtime.sendMessage({ type: ChatMessages.CHAT_STREAM_STATUS, requestId, status }).catch(() => {});
  };

  const abortController = new AbortController();
  chatHandler.registerStreamController(requestId, abortController);

  try {
    const reply = await chatHandler.handleMessage(
      request.message,
      request.model,
      request.weeklyReportRootPageId,
      {
        showPlan: !!request.showPlan,
        includePageContext: request.includePageContext !== false,
        attachments: Array.isArray(request.attachments) ? request.attachments : [],
        allowImages: !!request.allowImages,
        contextText: request.contextText || '',
        skillMentions: Array.isArray(request.skillMentions) ? request.skillMentions : [],
        stream: true,
        onStreamChunk: sendChunk,
        onStreamStatus: sendStatus,
        abortController,
      }
    );

    sendResponse({ success: true, reply });
    chrome.runtime.sendMessage({ type: ChatMessages.CHAT_STREAM_DONE, requestId, reply }).catch(() => {});
  } catch (error) {
    sendResponse({ success: false, error: error.message || '对话处理失败' });
    chrome.runtime.sendMessage({ type: ChatMessages.CHAT_STREAM_ERROR, requestId, error: error.message }).catch(() => {});
  } finally {
    chatHandler.removeStreamController(requestId);
  }
}

/**
 * 处理取消流式聊天
 */
function handleChatStreamCancel(request, sendResponse) {
  const requestId = request.requestId;
  if (requestId) {
    chatHandler.cancelStream(requestId);
  }
  sendResponse({ success: true });
}

/**
 * 处理同步页面上下文
 */
async function handleSyncPageContext(sendResponse) {
  try {
    const result = await chatHandler.syncPageContext();
    sendResponse(result);
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理打开侧边栏
 */
async function handleOpenSidePanel(sender, sendResponse) {
  try {
    const tabId = sender?.tab?.id;
    const winId = sender?.tab?.windowId;

    if (chrome.sidePanel?.open) {
      if (tabId) {
        await chrome.sidePanel.open({ tabId });
      } else if (winId) {
        await chrome.sidePanel.open({ windowId: winId });
      } else {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (t?.id) {
          await chrome.sidePanel.open({ tabId: t.id });
        }
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: '当前 Chrome 不支持 sidePanel API' });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理获取日志
 */
async function handleGetLogs(sendResponse) {
  const logs = logger.getLogs();
  sendResponse({ logs });
}

/**
 * 处理清空日志
 */
function handleClearLogs(sendResponse) {
  logger.clear();
  storage.removeMany([StorageKeys.TASK_LOGS, 'lastLogTime']).catch(() => {});
  sendResponse({ status: 'cleared' });
}

/**
 * 处理发送到企业微信
 */
async function handleSendToWechat(request, sendResponse) {
  try {
    const webhookUrl = await storage.get(StorageKeys.WEBHOOK_URL);
    if (!webhookUrl) {
      sendResponse({ success: false, error: 'Webhook URL 未配置' });
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          content: request.result || '无内容',
        },
      }),
    });

    if (response.ok) {
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: `发送失败: ${response.status}` });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// 导出供测试使用


})();
