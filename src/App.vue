<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <div class="kicker">CLI Proxy API</div>
        <h1>CPA 认证文件工具</h1>
      </div>
      <div class="topMeta">
        <a
          class="authorLink"
          href="https://linux.do/u/victor_ferline/summary"
          target="_blank"
          rel="noopener noreferrer"
        >作者：Victor ferline</a>
        <div class="versionPill">v{{ appVersion }}</div>
        <div class="endpoint">{{ endpointText }}</div>
      </div>
    </header>

    <nav class="tabs" aria-label="功能切换">
      <a class="tabButton" :aria-selected="activeTab === 'import'" href="#/import" @click="activeTab = 'import'">
        批量导入
      </a>
      <a class="tabButton" :aria-selected="activeTab === 'accounts'" href="#/accounts" @click="activeTab = 'accounts'">
        账号管理
      </a>
    </nav>

    <section class="grid">
      <aside class="panel">
        <div class="panelHeader">
          <h2 class="panelTitle">{{ activeTab === 'accounts' ? '连接与密钥' : '连接与文件' }}</h2>
          <span v-if="activeTab === 'import'" class="badge" :class="stateBadge.className">{{ stateBadge.label }}</span>
        </div>
        <div class="panelBody stack">
          <div class="field">
            <label for="baseUrl">CPA URL</label>
            <input class="input" id="baseUrl" v-model="form.baseUrl" placeholder="http://localhost:3000" autocomplete="url" />
          </div>

          <div class="field">
            <label for="managementKey">管理密钥</label>
            <div class="keyRow">
              <input class="input" id="managementKey" v-model="form.managementKey" :type="showManagementKey ? 'text' : 'password'" autocomplete="off" />
              <button class="btn" type="button" @click="showManagementKey = !showManagementKey">{{ showManagementKey ? '隐藏' : '显示' }}</button>
            </div>
          </div>

          <template v-if="activeTab === 'accounts'">
            <div class="field">
              <label for="proxyApiKey">API 密钥</label>
              <div class="keyRow">
                <input class="input" id="proxyApiKey" v-model="form.proxyApiKey" :type="showProxyApiKey ? 'text' : 'password'" autocomplete="off" />
                <button class="btn" type="button" :disabled="apiKeyLoading" @click="fetchProxyApiKey">读取</button>
              </div>
            </div>

            <div class="buttonGrid">
              <button class="btn" type="button" @click="showProxyApiKey = !showProxyApiKey">{{ showProxyApiKey ? '隐藏' : '显示' }}</button>
              <button class="btn" type="button" @click="copyProxyApiKey">复制密钥</button>
            </div>

            <div class="settingsRow">
              <div class="field">
                <label for="quotaConcurrency">额度并发</label>
                <input class="numberInput" id="quotaConcurrency" v-model="form.quotaConcurrency" type="number" min="1" max="20" />
              </div>
              <div class="field">
                <label for="deleteConcurrency">删除/导出并发</label>
                <input class="numberInput" id="deleteConcurrency" v-model="form.deleteConcurrency" type="number" min="1" max="10" />
              </div>
            </div>

            <div class="field">
              <label for="deleteBatchSize">删除每批数量</label>
              <input class="numberInput" id="deleteBatchSize" v-model="form.deleteBatchSize" type="number" min="1" max="100" />
            </div>
          </template>

          <div class="buttonGrid singleAction">
            <button class="btn" type="button" title="清理已填写并保存在本地的信息" @click="restoreDefaults">恢复默认</button>
          </div>

          <template v-if="activeTab === 'import'">
            <div class="settingsRow">
              <div class="field">
                <label for="chunkSize">每批数量</label>
                <input class="numberInput" id="chunkSize" v-model="form.chunkSize" type="number" min="1" max="100" />
              </div>
              <div class="field">
                <label for="maxBytes">单文件上限 MB</label>
                <input class="numberInput" id="maxBytes" v-model="form.maxBytes" type="number" min="1" max="200" />
              </div>
            </div>

            <div class="buttonGrid">
              <button class="btn" type="button" @click="fileInput?.click()">选择文件</button>
              <button class="btn" type="button" @click="folderInput?.click()">选择文件夹</button>
              <button class="btn" type="button" @click="clearFiles">清空列表</button>
              <button class="btn btnDanger" type="button" :disabled="!state.running" @click="cancelImport">停止导入</button>
            </div>

            <div
              class="dropZone"
              :class="{ isDragging: dragging }"
              @dragenter.prevent="dragging = true"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="handleDrop"
            >
              拖入 JSON 认证文件，或使用上方按钮选择；非 .json 自动跳过
            </div>

            <button class="btn btnPrimary" type="button" :disabled="state.running" @click="startImport">开始导入</button>

            <input ref="fileInput" class="srOnly" type="file" accept=".json,application/json" multiple @change="handleFileInput" />
            <input ref="folderInput" class="srOnly" type="file" accept=".json,application/json" webkitdirectory directory multiple @change="handleFolderInput" />
          </template>
        </div>
      </aside>

      <section class="stack">
        <template v-if="activeTab === 'import'">
          <div class="panel">
            <div class="panelHeader">
              <h2 class="panelTitle">导入进度</h2>
              <span class="endpoint">{{ state.batchText }}</span>
            </div>
            <div class="panelBody stack">
              <div class="summaryGrid">
                <div class="metric"><span>已选择</span><strong>{{ state.files.length }}</strong></div>
                <div class="metric"><span>已成功</span><strong>{{ importStats.success }}</strong></div>
                <div class="metric"><span>失败</span><strong>{{ importStats.failed }}</strong></div>
                <div class="metric"><span>已跳过</span><strong>{{ state.skipped.length }}</strong></div>
              </div>
              <div>
                <div class="progressShell"><div class="progressBar" :style="{ width: `${progress.percent}%` }"></div></div>
                <div class="statusLine">
                  <span>{{ progress.percent }}%</span>
                  <span>{{ formatBytes(progress.loaded) }} / {{ formatBytes(progress.total) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panelHeader">
              <h2 class="panelTitle">文件列表</h2>
              <span class="endpoint">{{ formatBytes(totalFileBytes) }}</span>
            </div>
            <div class="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>文件</th>
                    <th>大小</th>
                    <th>状态</th>
                    <th>结果</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!state.files.length"><td colspan="4" class="empty">暂无文件</td></tr>
                  <tr v-for="item in state.files" :key="item.key">
                    <td class="fileName">{{ item.displayName }}</td>
                    <td>{{ formatBytes(item.size) }}</td>
                    <td><span class="badge" :class="item.status === 'pending' ? '' : item.status">{{ STATUS_LABELS[item.status] }}</span></td>
                    <td>{{ item.message || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="panel">
            <div class="panelHeader">
              <h2 class="panelTitle">账号管理</h2>
            </div>
            <div class="panelBody stack">
              <div class="summaryGrid">
                <div class="metric"><span>已导入账号</span><strong>{{ state.accounts.length }}</strong></div>
                <div class="metric"><span>异常账号</span><strong>{{ accountStats.abnormal }}</strong></div>
                <div class="metric"><span>已停用</span><strong>{{ accountStats.disabled }}</strong></div>
                <div class="metric"><span>已选中</span><strong>{{ state.selectedAccounts.size }}</strong></div>
              </div>
              <div class="summaryGrid">
                <div class="metric"><span>可查额度</span><strong>{{ quotaStats.eligible }}</strong></div>
                <div class="metric"><span>读取成功</span><strong>{{ quotaStats.success }}</strong></div>
                <div class="metric"><span>读取失败</span><strong>{{ quotaStats.failed }}</strong></div>
                <div class="metric"><span>待导出</span><strong>{{ selectedExportAccounts.length }}</strong></div>
              </div>
              <div class="accountControls">
                <input class="input" v-model="state.accountSearch" placeholder="搜索账号名、类型或状态" />
                <select class="selectInput" v-model="state.accountFilter">
                  <option value="all">全部账号</option>
                  <option value="abnormal">仅异常</option>
                  <option value="disabled">仅停用</option>
                  <option value="enabled">仅启用</option>
                  <option value="healthy">仅正常</option>
                  <option value="quotaFailed">额度失败</option>
                </select>
              </div>
              <div class="accountActions">
                <button class="btn" type="button" :disabled="state.accountsLoading || state.accountsDeleting || state.quotasLoading" @click="loadAccounts()">刷新账号列表</button>
                <button class="btn" type="button" :disabled="state.accountsLoading || state.accountsDeleting || state.quotasLoading || (!state.accounts.length && !getManagementKey())" @click="refreshAccountQuotas">刷新账号额度</button>
                <button class="btn" type="button" :disabled="!state.quotasLoading" @click="stopAccountQuotaFetch">停止读取额度</button>
                <button class="btn" type="button" :disabled="state.accountsLoading || state.accountsDeleting || state.quotasLoading" @click="identifyAbnormalAccounts">检测异常账号</button>
                <button class="btn btnDanger" type="button" :disabled="state.accountsDeleting || state.quotasLoading || !state.selectedAccounts.size" @click="deleteAccountsByName(Array.from(state.selectedAccounts), '选中账号')">删除选中账号</button>
                <button class="btn btnDanger" type="button" :disabled="state.accountsDeleting || state.quotasLoading || !accountStats.abnormal" @click="deleteAccountsByName(abnormalAccountNames, '异常账号')">清理异常账号</button>
                <button class="btn btnDanger" type="button" :disabled="state.accountsDeleting || state.quotasLoading || !quotaFailedAccountNames.length" @click="deleteAccountsByName(quotaFailedAccountNames, '额度读取失败账号')">清理额度失败账号</button>
                <button class="btn btnPrimary" type="button" :disabled="state.exportingZip || !selectedExportAccounts.length" @click="exportSelectedAccountsZip">导出选中账号 ZIP ({{ selectedExportAccounts.length }})</button>
              </div>
              <div v-if="state.exportingZip" class="statusLine">
                <span>正在生成 ZIP</span>
                <span>{{ Math.round(state.exportProgress) }}%</span>
              </div>
            </div>
            <div class="tableWrap accountTableWrap">
              <table>
                <thead>
                  <tr>
                    <th class="checkboxCell"><input type="checkbox" :disabled="!selectableAccounts.length || state.accountsDeleting || state.quotasLoading" :checked="visibleSelectionState.checked" :indeterminate="visibleSelectionState.indeterminate" aria-label="选择当前可见账号" @change="toggleVisibleAccounts" /></th>
                    <th>账号</th>
                    <th>类型</th>
                    <th>健康状态</th>
                    <th>账号额度</th>
                    <th>说明</th>
                    <th>修改时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="state.accountsLoading"><td colspan="7" class="empty">正在读取账号列表...</td></tr>
                  <tr v-else-if="!state.accounts.length"><td colspan="7" class="empty">点击“刷新账号列表”读取已导入账号</td></tr>
                  <tr v-else-if="!filteredAccounts.length"><td colspan="7" class="empty">没有匹配的账号</td></tr>
                  <template v-else>
                    <tr v-for="account in filteredAccounts" :key="account.name">
                      <td class="checkboxCell"><input type="checkbox" :checked="state.selectedAccounts.has(account.name)" :disabled="isRuntimeOnly(account)" :aria-label="isRuntimeOnly(account) ? '虚拟账号不可删除' : '选择账号'" @change="toggleAccount(account.name)" /></td>
                      <td class="fileName">{{ account.name }}</td>
                      <td>{{ normalizeProvider(account.type ?? account.provider) }}</td>
                      <td><span class="badge" :class="getAccountBadge(account).className">{{ getAccountBadge(account).label }}</span></td>
                      <td class="quotaCell"><QuotaCell :account="account" :quota="state.accountQuotas[account.name]" /></td>
                      <td class="accountMessage">{{ getStatusMessage(account) || account.note || '-' }}</td>
                      <td>{{ formatModified(account) }}</td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <div class="panel">
          <div class="panelHeader">
            <h2 class="panelTitle">操作日志</h2>
            <button class="btn" type="button" @click="copyLog">复制日志</button>
          </div>
          <div class="panelBody">
            <div ref="logBox" class="log">{{ state.log }}</div>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup>
import JSZip from "jszip";
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import packageInfo from "../package.json";

const DEFAULT_BASE = "http://localhost:3000";
const LOCAL_STORAGE_KEY = "cpa-auth-importer-form-vue";
const FORM_DEFAULTS = {
  baseUrl: "",
  managementKey: "",
  proxyApiKey: "",
  chunkSize: "50",
  maxBytes: "10",
  quotaConcurrency: "10",
  deleteConcurrency: "6",
  deleteBatchSize: "50",
};
const LEGACY_DEFAULT_UPGRADES = {
  chunkSize: ["20", FORM_DEFAULTS.chunkSize],
  quotaConcurrency: ["5", FORM_DEFAULTS.quotaConcurrency],
  deleteConcurrency: ["3", FORM_DEFAULTS.deleteConcurrency],
  deleteBatchSize: ["20", FORM_DEFAULTS.deleteBatchSize],
};
const STATUS_LABELS = {
  pending: "待上传",
  uploading: "上传中",
  success: "成功",
  failed: "失败",
  skipped: "跳过",
};
const HEALTHY_MESSAGES = new Set(["ok", "healthy", "ready", "success", "available"]);
const QUOTA_ACCOUNT_TYPES = new Set(["antigravity", "claude", "codex", "kimi", "xai"]);
const CLAUDE_QUOTA_WINDOWS = [
  ["five_hour", "5 小时"],
  ["seven_day", "7 天"],
  ["seven_day_oauth_apps", "7 天 OAuth 应用"],
  ["seven_day_opus", "7 天 Opus"],
  ["seven_day_sonnet", "7 天 Sonnet"],
  ["seven_day_cowork", "7 天 Cowork"],
  ["iguana_necktie", "Iguana Necktie"],
];
const ANTIGRAVITY_QUOTA_ENDPOINTS = [
  "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
  "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary",
  "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
];
const QUOTA_REQUESTS = {
  claude: {
    url: "https://api.anthropic.com/api/oauth/usage",
    header: {
      Authorization: "Bearer $TOKEN$",
      "Content-Type": "application/json",
      "anthropic-beta": "oauth-2025-04-20",
    },
  },
  codex: {
    url: "https://chatgpt.com/backend-api/wham/usage",
    header: {
      Authorization: "Bearer $TOKEN$",
      "Content-Type": "application/json",
      "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
    },
  },
  kimi: {
    url: "https://api.kimi.com/coding/v1/usages",
    header: { Authorization: "Bearer $TOKEN$" },
  },
  xai: {
    url: "https://cli-chat-proxy.grok.com/v1/billing",
    header: { Authorization: "Bearer $TOKEN$" },
  },
};

const appVersion = packageInfo.version || "0.0.0";
const activeTab = ref(getTabFromHash());
const dragging = ref(false);
const showManagementKey = ref(false);
const showProxyApiKey = ref(false);
const apiKeyLoading = ref(false);
const fileInput = ref(null);
const folderInput = ref(null);
const logBox = ref(null);

const form = reactive({ ...FORM_DEFAULTS });
const state = reactive({
  files: [],
  skipped: [],
  accounts: [],
  accountQuotas: {},
  selectedAccounts: new Set(),
  accountsLoading: false,
  accountsDeleting: false,
  quotasLoading: false,
  quotaAbortController: null,
  quotaUpdatedAt: null,
  accountFilter: "all",
  accountSearch: "",
  running: false,
  activeXhr: null,
  completedBytes: 0,
  currentBatchBytes: 0,
  currentBatchLoaded: 0,
  batchText: "0 / 0",
  log: "",
  exportingZip: false,
  exportProgress: 0,
});

const apiBase = computed(() => normalizeApiBase(form.baseUrl));
const endpointText = computed(() => `${activeTab.value === "accounts" ? "GET" : "POST"} ${apiBase.value}/auth-files`);
const totalFileBytes = computed(() => state.files.reduce((sum, item) => sum + item.size, 0));
const importStats = computed(() => ({
  success: state.files.filter((item) => item.status === "success").length,
  failed: state.files.filter((item) => item.status === "failed").length,
}));
const progress = computed(() => {
  const total = totalFileBytes.value;
  const loaded = Math.min(total, state.completedBytes + state.currentBatchLoaded);
  return {
    total,
    loaded,
    percent: total ? Math.round((loaded / total) * 100) : 0,
  };
});
const stateBadge = computed(() => {
  if (state.running) return { label: "导入中", className: "uploading" };
  const failed = state.files.filter((item) => item.status === "failed").length;
  const success = state.files.filter((item) => item.status === "success").length;
  if (!state.files.length && !state.skipped.length) return { label: "待开始", className: "" };
  if (failed) return { label: "部分失败", className: "failed" };
  if (success || state.skipped.length) return { label: "已完成", className: "success" };
  return { label: "待开始", className: "" };
});
const accountStats = computed(() => ({
  abnormal: state.accounts.filter(isAbnormalAccount).length,
  disabled: state.accounts.filter(isDisabledAccount).length,
}));
const quotaStats = computed(() => {
  const entries = Object.values(state.accountQuotas);
  return {
    eligible: state.accounts.filter(canFetchAccountQuota).length,
    success: entries.filter((item) => item.status === "success").length,
    failed: entries.filter((item) => item.status === "error").length,
    loading: entries.filter((item) => item.status === "loading").length,
  };
});
const quotaFailedAccountNames = computed(() => state.accounts
  .filter((account) => !isRuntimeOnly(account) && state.accountQuotas[account.name]?.status === "error")
  .map((account) => account.name));
const abnormalAccountNames = computed(() => state.accounts
  .filter((account) => isAbnormalAccount(account) && !isRuntimeOnly(account))
  .map((account) => account.name));
const filteredAccounts = computed(() => {
  const keyword = state.accountSearch.trim().toLowerCase();
  return state.accounts.filter((account) => {
    const matchesKeyword =
      !keyword ||
      [account.name, account.type, account.provider, getStatusMessage(account), account.note]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    if (!matchesKeyword) return false;
    if (state.accountFilter === "abnormal") return isAbnormalAccount(account);
    if (state.accountFilter === "disabled") return isDisabledAccount(account);
    if (state.accountFilter === "enabled") return !isDisabledAccount(account) && !isRuntimeOnly(account);
    if (state.accountFilter === "healthy") return isNormalAccount(account);
    if (state.accountFilter === "quotaFailed") return state.accountQuotas[account.name]?.status === "error";
    return true;
  });
});
const selectableAccounts = computed(() => filteredAccounts.value.filter((account) => !isRuntimeOnly(account)));
const visibleSelectionState = computed(() => {
  const total = selectableAccounts.value.length;
  const selected = selectableAccounts.value.filter((account) => state.selectedAccounts.has(account.name)).length;
  return {
    checked: !!total && selected === total,
    indeterminate: selected > 0 && selected < total,
  };
});
const selectedExportAccounts = computed(() => state.accounts.filter((account) => state.selectedAccounts.has(account.name) && !isRuntimeOnly(account)));

watch(form, saveLocalForm, { deep: true });

onMounted(() => {
  restoreLocalForm();
  syncRouteFromHash();
  window.addEventListener("hashchange", syncRouteFromHash);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", syncRouteFromHash);
});

function normalizeApiBase(input) {
  let value = String(input || "").trim() || DEFAULT_BASE;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  value = value.replace(/\/+$/g, "");
  if (!/\/v0\/management$/i.test(value)) {
    value = `${value.replace(/\/v0\/management\/?$/i, "")}/v0/management`;
  }
  return value;
}

function getTabFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "").split(/[/?#]/)[0];
  return hash === "accounts" ? "accounts" : "import";
}

function syncRouteFromHash() {
  activeTab.value = getTabFromHash();
  if (!/^#\/(import|accounts)(?:[/?#]|$)/.test(window.location.hash)) {
    window.location.replace(`${window.location.pathname}${window.location.search}#/${activeTab.value}`);
  }
}

function getManagementKey() {
  return form.managementKey.trim();
}

function saveLocalForm() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...form }));
  } catch {
    // localStorage can be unavailable; the tool still works.
  }
}

function restoreLocalForm() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    Object.assign(form, raw ? migrateStoredForm(JSON.parse(raw)) : FORM_DEFAULTS);
  } catch {
    Object.assign(form, FORM_DEFAULTS);
  }
}

function migrateStoredForm(stored) {
  const next = { ...FORM_DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
  Object.entries(LEGACY_DEFAULT_UPGRADES).forEach(([key, [legacyValue, nextValue]]) => {
    if (String(stored?.[key] ?? "") === legacyValue) next[key] = nextValue;
  });
  return next;
}

function clearLocalForm() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function restoreDefaults() {
  Object.assign(form, FORM_DEFAULTS);
  clearLocalForm();
  state.accountSearch = "";
  state.accountFilter = "all";
  state.selectedAccounts.clear();
  resetObject(state.accountQuotas);
  state.quotaUpdatedAt = null;
  showManagementKey.value = false;
  showProxyApiKey.value = false;
  addLog("已恢复默认设置，并清理本地保存的信息。");
}

function resetObject(object) {
  Object.keys(object).forEach((key) => delete object[key]);
}

async function readFetchResponse(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function apiRequest(path, options = {}) {
  const key = getManagementKey();
  if (!key) throw new Error("缺少管理密钥。");
  const { raw = false, headers: optionHeaders = {}, ...fetchOptions } = options;
  const response = await fetch(`${apiBase.value}${path}`, {
    ...fetchOptions,
    headers: {
      Accept: raw ? "*/*" : "application/json",
      Authorization: `Bearer ${key}`,
      ...optionHeaders,
    },
  });
  if (raw) {
    if (!response.ok) {
      const data = await readFetchResponse(response);
      throw new Error(`HTTP ${response.status}: ${data.message || response.statusText || "请求失败"}`);
    }
    return response;
  }
  const data = await readFetchResponse(response);
  if (!response.ok) {
    const message =
      data.message ||
      (data.error && (data.error.message || data.error)) ||
      response.statusText ||
      "请求失败";
    throw new Error(`HTTP ${response.status}: ${message}`);
  }
  return data;
}

function parseJsonMaybe(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function toObject(value) {
  const parsed = parseJsonMaybe(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    const numeric = Number(text.endsWith("%") ? text.slice(0, -1) : text);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return toNumber(value.val ?? value.value);
  }
  return null;
}

function clampPercent(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value) {
  const percent = clampPercent(value);
  if (percent == null) return "--";
  return `${Math.round(percent)}%`;
}

function formatMoneyCents(value) {
  const numeric = toNumber(value);
  if (numeric == null) return "--";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(numeric / 100);
}

function formatShortDate(value) {
  if (!value) return "";
  const numeric = toNumber(value);
  const date = numeric != null
    ? new Date(numeric < 0xe8d4a51000 ? numeric * 1000 : numeric)
    : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatResetFromWindow(windowData) {
  if (!windowData || typeof windowData !== "object") return "";
  const resetAt = windowData.reset_at ?? windowData.resetAt ?? windowData.resets_at ?? windowData.resetsAt;
  const direct = formatShortDate(resetAt);
  if (direct) return direct;
  const resetAfter = toNumber(windowData.reset_after_seconds ?? windowData.resetAfterSeconds ?? windowData.reset_in ?? windowData.resetIn ?? windowData.ttl);
  if (resetAfter != null && resetAfter > 0) {
    return formatShortDate(Math.floor(Date.now() / 1000 + resetAfter));
  }
  return "";
}

function getApiCallMessage(data, statusCode) {
  const body = parseJsonMaybe(data?.body ?? data?.bodyText ?? data);
  if (body && typeof body === "object") {
    const error = body.error;
    if (error && typeof error === "object" && error.message) return String(error.message);
    if (error && typeof error === "string") return error;
    if (body.message) return String(body.message);
  }
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  return statusCode ? `HTTP ${statusCode}` : "请求失败";
}

async function apiCall(payload, options = {}) {
  const data = await apiRequest("/api-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...options,
  });
  const statusCode = Number(data?.status_code ?? data?.statusCode ?? 0);
  const body = parseJsonMaybe(data?.body);
  const bodyText = typeof data?.body === "string" ? data.body : JSON.stringify(data?.body ?? "");
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(getApiCallMessage(data, statusCode));
  }
  return {
    statusCode,
    header: data?.header ?? data?.headers ?? {},
    body,
    bodyText,
  };
}

function normalizeApiKeysPayload(data) {
  const source = data?.["api-keys"] ?? data?.apiKeys ?? data;
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(item.key ?? item.apiKey ?? item["api-key"] ?? item.value ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

async function fetchProxyApiKey() {
  apiKeyLoading.value = true;
  addLog("正在从 CPA 配置读取 API 密钥。");
  try {
    const data = await apiRequest("/api-keys");
    const keys = normalizeApiKeysPayload(data);
    if (!keys.length) {
      addLog("未读取到 API 密钥，请在 CPA 配置面板确认 api-keys 已配置。");
      return;
    }
    form.proxyApiKey = keys[0];
    addLog(keys.length > 1 ? `已读取 ${keys.length} 个 API 密钥，已填入第一个。` : "已读取 API 密钥。");
  } catch (error) {
    addLog(`读取 API 密钥失败：${error.message}`);
  } finally {
    apiKeyLoading.value = false;
  }
}

async function copyProxyApiKey() {
  const key = form.proxyApiKey.trim();
  if (!key) {
    addLog("API 密钥为空，无法复制。");
    return;
  }
  try {
    await navigator.clipboard.writeText(key);
    addLog("API 密钥已复制。");
  } catch {
    addLog("API 密钥复制失败。");
  }
}

function normalizeBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(text)) return true;
    if (["0", "false", "no", "n", "off"].includes(text)) return false;
  }
  return false;
}

function getStatusMessage(account) {
  const value = account.status_message ?? account.statusMessage;
  return value == null ? "" : String(value).trim();
}

function isRuntimeOnly(account) {
  return normalizeBool(account.runtime_only ?? account.runtimeOnly);
}

function isDisabledAccount(account) {
  return normalizeBool(account.disabled);
}

function isAbnormalAccount(account) {
  if (isRuntimeOnly(account) || isDisabledAccount(account)) return false;
  const message = getStatusMessage(account);
  return !!message && !HEALTHY_MESSAGES.has(message.toLowerCase());
}

function isNormalAccount(account) {
  return !isRuntimeOnly(account) && !isDisabledAccount(account) && !isAbnormalAccount(account);
}

function normalizeProvider(value) {
  return String(value || "unknown").trim() || "unknown";
}

function normalizeAccounts(data) {
  const source = Array.isArray(data?.files) ? data.files : Array.isArray(data) ? data : [];
  const byName = new Map();
  source.forEach((item) => {
    const account = item && typeof item === "object" ? item : { name: String(item || "") };
    const name = String(account.name ?? account.file ?? account.path ?? "").trim();
    if (!name) return;
    const normalized = { ...account, name };
    const current = byName.get(name);
    if (!current || accountCompletenessScore(normalized) > accountCompletenessScore(current)) {
      byName.set(name, normalized);
    }
  });
  return Array.from(byName.values()).sort((a, b) => {
    const providerCompare = normalizeProvider(a.type ?? a.provider).localeCompare(normalizeProvider(b.type ?? b.provider));
    return providerCompare || a.name.localeCompare(b.name);
  });
}

function accountCompletenessScore(account) {
  return Object.values(account).reduce((score, value) => {
    if (value == null) return score;
    if (typeof value === "string") return score + (value.trim() ? 1 : 0);
    if (Array.isArray(value)) return score + (value.length ? 1 : 0);
    return score + 1;
  }, 0);
}

function formatModified(account) {
  const value = account.modtime ?? account.modified ?? account.updated_at ?? account.updatedAt;
  if (!value) return "-";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 0xe8d4a51000 ? numeric * 1000 : numeric)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function getAccountBadge(account) {
  if (isRuntimeOnly(account)) return { label: "虚拟", className: "skipped" };
  if (isDisabledAccount(account)) return { label: "已停用", className: "disabled" };
  if (isAbnormalAccount(account)) return { label: "异常", className: "warning" };
  return { label: "正常", className: "success" };
}

function normalizeQuotaType(account) {
  const raw = String(account.provider ?? account.type ?? "").trim().toLowerCase().replaceAll("_", "-");
  if (raw === "x-ai" || raw === "grok") return "xai";
  return raw;
}

function getAuthIndex(account) {
  const value = account.auth_index ?? account.authIndex;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function canFetchAccountQuota(account) {
  return !isRuntimeOnly(account) && !isDisabledAccount(account) && QUOTA_ACCOUNT_TYPES.has(normalizeQuotaType(account)) && !!getAuthIndex(account);
}

function makeQuotaResult(type, rows, meta = {}) {
  const usableRows = rows.filter((row) => row && (row.remainingPercent != null || row.detail || row.resetLabel));
  const percents = usableRows.map((row) => row.remainingPercent).filter((value) => value != null);
  const primary = usableRows.find((row) => row.remainingPercent != null) || usableRows[0] || null;
  return {
    status: "success",
    type,
    rows: usableRows,
    primary,
    bestRemainingPercent: percents.length ? Math.max(...percents) : null,
    fetchedAt: Date.now(),
    ...meta,
  };
}

function parseClaudeQuota(body) {
  const source = toObject(body);
  if (!source) throw new Error("端点未返回额度数据。");
  const rows = CLAUDE_QUOTA_WINDOWS.map(([key, label]) => {
    const item = source[key];
    if (!item || typeof item !== "object") return null;
    const usedPercent = toNumber(item.utilization ?? item.used_percent ?? item.usedPercent);
    return {
      id: key,
      label,
      remainingPercent: usedPercent == null ? null : clampPercent(100 - usedPercent),
      resetLabel: formatResetFromWindow(item),
    };
  }).filter(Boolean);
  if (source.extra_usage && typeof source.extra_usage === "object" && source.extra_usage.is_enabled) {
    rows.push({
      id: "extra-usage",
      label: "额外用量",
      detail: `${formatMoneyCents(source.extra_usage.used_credits)} / ${formatMoneyCents(source.extra_usage.monthly_limit)}`,
    });
  }
  if (!rows.length) throw new Error("暂无额度数据。");
  return makeQuotaResult("claude", rows);
}

function parseCodexWindow(windowData, label, id, limitReached, allowed) {
  if (!windowData || typeof windowData !== "object") return null;
  const resetLabel = formatResetFromWindow(windowData);
  let usedPercent = toNumber(windowData.used_percent ?? windowData.usedPercent);
  if (usedPercent == null && (limitReached || allowed === false) && resetLabel) usedPercent = 100;
  return {
    id,
    label,
    remainingPercent: usedPercent == null ? null : clampPercent(100 - usedPercent),
    resetLabel,
  };
}

function parseCodexLimitPair(limit, prefix, labels) {
  const rows = [];
  if (!limit || typeof limit !== "object") return rows;
  const primary = limit.primary_window ?? limit.primaryWindow;
  const secondary = limit.secondary_window ?? limit.secondaryWindow;
  const limitReached = limit.limit_reached ?? limit.limitReached;
  const allowed = limit.allowed;
  const primaryRow = parseCodexWindow(primary, labels.primary, `${prefix}-primary`, limitReached, allowed);
  const secondarySeconds = toNumber(secondary?.limit_window_seconds ?? secondary?.limitWindowSeconds);
  const secondaryLabel = secondarySeconds != null && secondarySeconds >= 2419200 ? labels.monthly : labels.secondary;
  const secondaryRow = parseCodexWindow(secondary, secondaryLabel, `${prefix}-secondary`, limitReached, allowed);
  if (primaryRow) rows.push(primaryRow);
  if (secondaryRow) rows.push(secondaryRow);
  return rows;
}

function parseCodexQuota(body, account) {
  const source = toObject(body);
  if (!source) throw new Error("端点未返回额度数据。");
  const rows = [
    ...parseCodexLimitPair(source.rate_limit ?? source.rateLimit, "code", {
      primary: "5 小时",
      secondary: "周限额",
      monthly: "月限额",
    }),
    ...parseCodexLimitPair(source.code_review_rate_limit ?? source.codeReviewRateLimit, "review", {
      primary: "Code Review 5 小时",
      secondary: "Code Review 周限额",
      monthly: "Code Review 月限额",
    }),
  ];
  const additional = source.additional_rate_limits ?? source.additionalRateLimits;
  if (Array.isArray(additional)) {
    additional.forEach((item, index) => {
      const name = String(item?.limit_name ?? item?.limitName ?? item?.metered_feature ?? item?.meteredFeature ?? `附加限额 ${index + 1}`).trim();
      rows.push(...parseCodexLimitPair(item?.rate_limit ?? item?.rateLimit, `additional-${index}`, {
        primary: `${name} 5 小时`,
        secondary: `${name} 周限额`,
        monthly: `${name} 月限额`,
      }));
    });
  }
  const planType = String(source.plan_type ?? source.planType ?? account.plan_type ?? account.planType ?? "").trim();
  if (!rows.length) throw new Error(planType === "free" ? "该凭证可能没有 Codex 访问权限。" : "暂无额度数据。");
  return makeQuotaResult("codex", rows, { planType });
}

function getKimiResetHint(item) {
  if (!item || typeof item !== "object") return "";
  const direct = formatResetFromWindow(item);
  if (direct) return direct;
  const resetIn = toNumber(item.reset_in ?? item.resetIn ?? item.ttl);
  if (resetIn == null || resetIn <= 0) return "";
  const hours = Math.floor(resetIn / 3600);
  const minutes = Math.floor((resetIn % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m 后重置`;
  if (hours) return `${hours}h 后重置`;
  if (minutes) return `${minutes}m 后重置`;
  return "<1m 后重置";
}

function parseKimiUsageRow(item, fallbackLabel, id) {
  if (!item || typeof item !== "object") return null;
  const limit = toNumber(item.limit);
  let used = toNumber(item.used);
  const remaining = toNumber(item.remaining);
  if (used == null && remaining != null && limit != null) used = limit - remaining;
  if (used == null && limit == null) return null;
  const label = String(item.name ?? item.title ?? fallbackLabel).trim();
  return {
    id,
    label,
    remainingPercent: limit && limit > 0 && used != null ? clampPercent(((limit - used) / limit) * 100) : used != null && used > 0 ? 0 : null,
    detail: limit && limit > 0 && used != null ? `已用 ${used} / 总额 ${limit}` : "",
    resetLabel: getKimiResetHint(item),
  };
}

function parseKimiQuota(body) {
  const source = toObject(body);
  if (!source) throw new Error("端点未返回额度数据。");
  const rows = [];
  const summary = parseKimiUsageRow(source.usage, "周限额", "summary");
  if (summary) rows.push(summary);
  if (Array.isArray(source.limits)) {
    source.limits.forEach((item, index) => {
      const detail = item?.detail && typeof item.detail === "object" ? item.detail : item;
      const label = item?.name ?? item?.title ?? detail?.name ?? detail?.title ?? `限额 #${index + 1}`;
      const row = parseKimiUsageRow(detail, label, `limit-${index}`);
      if (row) rows.push(row);
    });
  }
  if (!rows.length) throw new Error("暂无额度数据。");
  return makeQuotaResult("kimi", rows);
}

function parseXaiQuota(body) {
  const source = toObject(body);
  const config = toObject(source?.config ?? source);
  if (!config) throw new Error("端点未返回额度数据。");
  const monthlyLimit = toNumber(config.monthlyLimit ?? config.monthly_limit);
  const used = toNumber(config.used);
  const onDemandCap = toNumber(config.onDemandCap ?? config.on_demand_cap);
  const billingEnd = config.billingPeriodEnd ?? config.billing_period_end;
  const rows = [];
  if (monthlyLimit != null || used != null || billingEnd) {
    const includedUsed = used == null ? null : monthlyLimit != null && monthlyLimit > 0 ? Math.min(used, monthlyLimit) : used;
    rows.push({
      id: "monthly",
      label: "月度额度",
      remainingPercent: monthlyLimit && monthlyLimit > 0 && includedUsed != null ? clampPercent(((monthlyLimit - includedUsed) / monthlyLimit) * 100) : null,
      detail: monthlyLimit != null && includedUsed != null ? `${formatMoneyCents(Math.max(0, monthlyLimit - includedUsed))} / ${formatMoneyCents(monthlyLimit)}` : "",
      resetLabel: formatShortDate(billingEnd),
    });
  }
  if (onDemandCap != null && onDemandCap > 0 && used != null && monthlyLimit != null) {
    const onDemandUsed = Math.max(0, used - monthlyLimit);
    rows.push({
      id: "pay-as-you-go",
      label: "按量额度",
      remainingPercent: clampPercent(((onDemandCap - onDemandUsed) / onDemandCap) * 100),
      detail: `${formatMoneyCents(Math.max(0, onDemandCap - onDemandUsed))} / ${formatMoneyCents(onDemandCap)}`,
    });
  }
  if (!rows.length) throw new Error("暂无额度数据。");
  return makeQuotaResult("xai", rows);
}

function getAntigravityProjectId(account) {
  const metadata = account.metadata && typeof account.metadata === "object" ? account.metadata : {};
  const attributes = account.attributes && typeof account.attributes === "object" ? account.attributes : {};
  return String(
    account.project_id ??
    account.projectId ??
    metadata.project_id ??
    metadata.projectId ??
    attributes.project_id ??
    attributes.projectId ??
    attributes.gemini_virtual_project ??
    "",
  ).trim();
}

function parseAntigravityQuota(body, header) {
  const source = toObject(body);
  const groups = Array.isArray(source?.groups) ? source.groups : [];
  const rows = [];
  groups.forEach((group, groupIndex) => {
    const groupName = String(group.displayName ?? group.display_name ?? `额度组 ${groupIndex + 1}`).trim();
    const buckets = Array.isArray(group.buckets) ? group.buckets : [];
    buckets.forEach((bucket, bucketIndex) => {
      const fraction = toNumber(bucket.remainingFraction ?? bucket.remaining_fraction);
      if (fraction == null) return;
      const label = String(bucket.displayName ?? bucket.display_name ?? bucket.window ?? `额度 ${bucketIndex + 1}`).trim();
      rows.push({
        id: `${groupIndex}-${bucketIndex}`,
        label: `${groupName} · ${label}`,
        remainingPercent: clampPercent(fraction * 100),
        resetLabel: formatShortDate(bucket.resetTime ?? bucket.reset_time),
      });
    });
  });
  if (!rows.length) throw new Error("暂无额度数据。");
  const dateHeader = Object.entries(header || {}).find(([key]) => key.toLowerCase() === "date")?.[1];
  return makeQuotaResult("antigravity", rows, { serverDate: Array.isArray(dateHeader) ? dateHeader[0] : dateHeader });
}

async function fetchAccountQuota(account, options = {}) {
  const type = normalizeQuotaType(account);
  const authIndex = getAuthIndex(account);
  if (!authIndex) throw new Error("认证文件缺少 auth_index。");
  if (!QUOTA_ACCOUNT_TYPES.has(type)) throw new Error("该账号类型暂不支持额度查询。");

  if (type === "antigravity") {
    const projectId = getAntigravityProjectId(account);
    if (!projectId) throw new Error("Antigravity 凭证缺少 project_id。");
    let lastError = null;
    for (const url of ANTIGRAVITY_QUOTA_ENDPOINTS) {
      if (options.signal?.aborted) throw new DOMException("已停止读取额度。", "AbortError");
      try {
        const response = await apiCall({
          authIndex,
          method: "POST",
          url,
          header: {
            Authorization: "Bearer $TOKEN$",
            "Content-Type": "application/json",
            "User-Agent": "antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)",
          },
          data: JSON.stringify({ project: projectId }),
        }, options);
        return parseAntigravityQuota(response.body, response.header);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Antigravity 额度读取失败。");
  }

  const config = QUOTA_REQUESTS[type];
  const header = { ...config.header };
  if (type === "codex") {
    const chatgptAccountId = getChatgptAccountId(account);
    if (chatgptAccountId) header["Chatgpt-Account-Id"] = chatgptAccountId;
  }
  const response = await apiCall({
    authIndex,
    method: "GET",
    url: config.url,
    header,
  }, options);
  if (type === "claude") return parseClaudeQuota(response.body);
  if (type === "codex") return parseCodexQuota(response.body, account);
  if (type === "kimi") return parseKimiQuota(response.body);
  if (type === "xai") return parseXaiQuota(response.body);
  throw new Error("该账号类型暂不支持额度查询。");
}

function decodeBase64Url(text) {
  try {
    const normalized = String(text).replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return "";
  }
}

function decodeTokenPayload(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Not JSON; try JWT payload below.
  }
  const parts = text.split(".");
  if (parts.length < 2) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(parts[1]));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getChatgptAccountId(account) {
  const metadata = account.metadata && typeof account.metadata === "object" ? account.metadata : {};
  const attributes = account.attributes && typeof account.attributes === "object" ? account.attributes : {};
  const tokens = [account.id_token, metadata.id_token, attributes.id_token];
  for (const token of tokens) {
    const payload = decodeTokenPayload(token);
    const openaiAuth = payload?.["https://api.openai.com/auth"];
    const source = openaiAuth && typeof openaiAuth === "object" ? openaiAuth : payload;
    const id = source?.chatgpt_account_id ?? source?.chatgptAccountId;
    if (id) return String(id).trim();
  }
  return "";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function fileKey(file) {
  return [file.webkitRelativePath || file.name, file.size, file.lastModified].join("|");
}

function clampInteger(value, min, max, fallback) {
  const numeric = Math.trunc(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function getMaxBytes() {
  return Math.max(1, Number(form.maxBytes || 10)) * 1024 * 1024;
}

function getQuotaConcurrency() {
  return clampInteger(form.quotaConcurrency, 1, 20, Number(FORM_DEFAULTS.quotaConcurrency));
}

function getDeleteConcurrency() {
  return clampInteger(form.deleteConcurrency, 1, 10, Number(FORM_DEFAULTS.deleteConcurrency));
}

function getDeleteBatchSize() {
  return clampInteger(form.deleteBatchSize, 1, 100, Number(FORM_DEFAULTS.deleteBatchSize));
}

function addLog(message) {
  const now = new Date().toLocaleTimeString();
  state.log += `[${now}] ${message}\n`;
  nextTick(() => {
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
  });
}

function addFiles(fileList) {
  if (state.running) return;
  const maxBytes = getMaxBytes();
  const existing = new Set(state.files.map((item) => item.key));
  const skippedNow = [];
  let added = 0;

  Array.from(fileList || []).forEach((file) => {
    const relative = file.webkitRelativePath || file.name;
    if (!/\.json$/i.test(file.name)) {
      skippedNow.push({ name: relative, reason: "不是 .json 文件" });
      return;
    }
    if (file.size > maxBytes) {
      skippedNow.push({ name: relative, reason: `超过 ${formatBytes(maxBytes)}` });
      return;
    }
    const key = fileKey(file);
    if (existing.has(key)) return;
    existing.add(key);
    state.files.push({
      key,
      file,
      displayName: relative,
      uploadName: file.name,
      size: file.size,
      status: "pending",
      message: "",
    });
    added += 1;
  });

  state.skipped.push(...skippedNow);
  if (added) addLog(`已加入 ${added} 个 JSON 文件。`);
  if (skippedNow.length) {
    skippedNow.slice(0, 6).forEach((item) => addLog(`跳过 ${item.name}: ${item.reason}`));
    if (skippedNow.length > 6) addLog(`另有 ${skippedNow.length - 6} 个文件已跳过。`);
  }
}

function handleFileInput(event) {
  addFiles(event.target.files);
  event.target.value = "";
}

function handleFolderInput(event) {
  addFiles(event.target.files);
  event.target.value = "";
}

function handleDrop(event) {
  dragging.value = false;
  addFiles(event.dataTransfer.files);
}

function clearFiles() {
  if (state.running) return;
  state.files = [];
  state.skipped = [];
  state.completedBytes = 0;
  state.currentBatchLoaded = 0;
  state.currentBatchBytes = 0;
  state.batchText = "0 / 0";
  state.log = "";
}

function resetProgress() {
  state.completedBytes = 0;
  state.currentBatchBytes = 0;
  state.currentBatchLoaded = 0;
  state.skipped = state.skipped.filter((item) => !["existing", "server", "upload", "upload-error"].includes(item.source));
  state.files.forEach((item) => {
    item.status = "pending";
    item.message = "";
  });
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

async function runLimited(items, concurrency, worker, shouldStop = () => false) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const runners = Array.from({ length: workerCount }, async () => {
    while (!shouldStop()) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

function readResponse(xhr) {
  const text = xhr.responseText || "";
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { status: "ok", message: text.slice(0, 500) };
  }
}

function normalizeUploadResult(data, fallbackNames) {
  const failed = Array.isArray(data.failed)
    ? data.failed.map((item) => ({
      name: String((item && item.name) || "").trim(),
      error: String((item && (item.error || item.message)) || "Unknown error").trim(),
    }))
    : [];
  const skipped = Array.isArray(data.skipped)
    ? data.skipped.map((item) => {
      if (typeof item === "string") return { name: item.trim(), reason: "已跳过" };
      return {
        name: String((item && (item.name || item.file)) || "").trim(),
        reason: String((item && (item.reason || item.message)) || "已跳过").trim(),
      };
    }).filter((item) => item.name)
    : [];
  const files = Array.isArray(data.files) ? data.files.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const skippedNames = new Set(skipped.map((item) => item.name));
  const implicitSuccess = data.uploaded === undefined && failed.length === 0 && skipped.length === 0;
  return {
    status: data.status || (failed.length || skipped.length ? "partial" : "ok"),
    uploaded: data.uploaded === undefined ? (implicitSuccess ? fallbackNames.length : 0) : data.uploaded,
    files: files.length ? files : implicitSuccess ? fallbackNames : fallbackNames.filter((name) => !skippedNames.has(name)),
    failed,
    skipped,
  };
}

function markBatchResult(batch, result) {
  const failedByName = new Map(result.failed.map((item) => [item.name, item.error]));
  const skippedByName = new Map(result.skipped.map((item) => [item.name, item.reason]));
  const successNames = new Set(result.files);

  batch.forEach((item) => {
    const error = failedByName.get(item.uploadName);
    const skippedReason = skippedByName.get(item.uploadName);
    if (error) {
      markUploadSkipped(item, error, "server");
    } else if (skippedReason) {
      markUploadSkipped(item, skippedReason, "server");
    } else if (!successNames.size || successNames.has(item.uploadName)) {
      item.status = "success";
      item.message = "已导入";
    } else {
      markUploadSkipped(item, "服务端未返回导入确认", "server");
    }
  });
}

function markUploadSkipped(item, reason, source) {
  item.status = "skipped";
  item.message = reason || "上传失败，已跳过";
  state.skipped.push({
    name: item.displayName,
    reason: item.message,
    source: source || "upload",
  });
}

async function getExistingAccountNames() {
  const data = await apiRequest("/auth-files");
  const accounts = normalizeAccounts(data);
  state.accounts = accounts;
  return new Set(accounts.map((account) => account.name));
}

function markExistingFilesAsSkipped(existingNames) {
  const skipped = [];
  state.files.forEach((item) => {
    if (!existingNames.has(item.uploadName)) return;
    item.status = "skipped";
    item.message = "CPA 列表已存在，已跳过";
    skipped.push(item);
  });
  if (skipped.length) {
    state.skipped.push(...skipped.map((item) => ({
      name: item.displayName,
      reason: item.message,
      source: "existing",
    })));
  }
  return skipped;
}

function uploadBatch(batch, batchIndex, batchTotal) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    const names = batch.map((item) => item.uploadName);
    batch.forEach((item) => {
      item.status = "uploading";
      item.message = `批次 ${batchIndex}/${batchTotal}`;
      formData.append("file", item.file, item.uploadName);
    });

    state.currentBatchBytes = batch.reduce((sum, item) => sum + item.size, 0);
    state.currentBatchLoaded = 0;

    const xhr = new XMLHttpRequest();
    state.activeXhr = xhr;
    xhr.open("POST", `${apiBase.value}/auth-files`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${getManagementKey()}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        state.currentBatchLoaded = Math.min(state.currentBatchBytes, event.loaded);
      }
    };
    xhr.onload = () => {
      state.activeXhr = null;
      const data = readResponse(xhr);
      if (xhr.status < 200 || xhr.status >= 300) {
        const message =
          data.message ||
          (data.error && (data.error.message || data.error)) ||
          xhr.statusText ||
          "请求失败";
        reject(new Error(`HTTP ${xhr.status}: ${message}`));
        return;
      }
      resolve(normalizeUploadResult(data, names));
    };
    xhr.onerror = () => {
      state.activeXhr = null;
      reject(new Error("网络请求失败，可能是 URL、密钥或浏览器跨域限制导致。"));
    };
    xhr.onabort = () => {
      state.activeXhr = null;
      reject(new Error("导入已停止。"));
    };
    xhr.send(formData);
  });
}

async function startImport() {
  if (state.running) return;
  const key = getManagementKey();
  const chunkSize = clampInteger(form.chunkSize, 1, 100, Number(FORM_DEFAULTS.chunkSize));

  if (!key) {
    addLog("缺少管理密钥。");
    return;
  }
  if (!state.files.length) {
    addLog("请先选择认证文件。");
    return;
  }

  resetProgress();
  state.running = true;
  addLog(`开始导入，接口 ${apiBase.value}/auth-files。`);

  let existingNames;
  try {
    addLog("正在检查 CPA 已有账号列表。");
    existingNames = await getExistingAccountNames();
  } catch (error) {
    existingNames = new Set();
    addLog(`读取 CPA 账号列表失败，将继续导入但无法提前跳过已存在账号：${error.message}`);
  }

  const skippedExisting = markExistingFilesAsSkipped(existingNames);
  if (skippedExisting.length) {
    state.completedBytes += skippedExisting.reduce((sum, item) => sum + item.size, 0);
    addLog(`已跳过 ${skippedExisting.length} 个 CPA 列表中已存在的账号。`);
  }

  const uploadFiles = state.files.filter((item) => item.status !== "skipped");
  const batches = chunk(uploadFiles, chunkSize);
  let stopped = false;

  if (!batches.length) {
    state.running = false;
    addLog(`导入结束：成功 0，失败 0，跳过 ${state.skipped.length}。`);
    return;
  }

  for (let index = 0; index < batches.length; index += 1) {
    if (!state.running) {
      stopped = true;
      break;
    }
    const batch = batches[index];
    state.batchText = `${index + 1} / ${batches.length}`;
    addLog(`上传批次 ${index + 1}/${batches.length}，${batch.length} 个文件。`);
    try {
      const result = await uploadBatch(batch, index + 1, batches.length);
      markBatchResult(batch, result);
      state.completedBytes += state.currentBatchBytes;
      state.currentBatchLoaded = 0;
      addLog(`批次 ${index + 1} 完成：status=${result.status}, uploaded=${result.uploaded}, skipped=${result.skipped.length + result.failed.length}`);
    } catch (error) {
      if (!state.running) {
        stopped = true;
        break;
      }
      addLog(`批次 ${index + 1} 失败，改为逐个文件继续导入：${error.message}`);
      for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
        if (!state.running) {
          stopped = true;
          break;
        }
        const item = batch[itemIndex];
        state.batchText = `${index + 1}.${itemIndex + 1} / ${batches.length}`;
        try {
          const result = await uploadBatch([item], `${index + 1}.${itemIndex + 1}`, batches.length);
          markBatchResult([item], result);
          state.completedBytes += state.currentBatchBytes;
          state.currentBatchLoaded = 0;
        } catch (itemError) {
          markUploadSkipped(item, itemError.message, "upload-error");
          state.completedBytes += item.size;
          state.currentBatchBytes = 0;
          state.currentBatchLoaded = 0;
          addLog(`跳过 ${item.displayName}: ${itemError.message}`);
        }
      }
      if (stopped) break;
    }
  }

  state.running = false;
  state.activeXhr = null;
  const success = state.files.filter((item) => item.status === "success").length;
  const failed = state.files.filter((item) => item.status === "failed").length;
  addLog(`导入结束：成功 ${success}，失败 ${failed}，跳过 ${state.skipped.length}${stopped ? "，已停止" : ""}。`);
  if (state.accounts.length) loadAccounts({ silent: true });
}

function cancelImport() {
  state.running = false;
  if (state.activeXhr) state.activeXhr.abort();
}

function normalizeDeleteResult(data, requestedNames) {
  const failed = Array.isArray(data.failed)
    ? data.failed.map((item) => ({
      name: String((item && item.name) || "").trim(),
      error: String((item && (item.error || item.message)) || "Unknown error").trim(),
    }))
    : [];
  const failedNames = new Set(failed.map((item) => item.name).filter(Boolean));
  const files = Array.isArray(data.files)
    ? data.files.map((item) => String(item || "").trim()).filter(Boolean)
    : requestedNames.filter((name) => !failedNames.has(name));
  return {
    status: data.status || (failed.length ? "partial" : "ok"),
    deleted: data.deleted === undefined ? files.length : data.deleted,
    files,
    failed,
  };
}

async function loadAccounts({ silent = false } = {}) {
  if (state.accountsLoading) return false;
  state.accountsLoading = true;
  if (!silent) addLog("正在读取已导入账号列表。");
  try {
    const data = await apiRequest("/auth-files");
    state.accounts = normalizeAccounts(data);
    const names = new Set(state.accounts.map((account) => account.name));
    state.selectedAccounts = new Set(Array.from(state.selectedAccounts).filter((name) => names.has(name)));
    Object.keys(state.accountQuotas).forEach((name) => {
      if (!names.has(name)) delete state.accountQuotas[name];
    });
    const abnormal = state.accounts.filter(isAbnormalAccount).length;
    if (!silent) addLog(`账号列表已刷新：共 ${state.accounts.length} 个，异常 ${abnormal} 个。`);
    return true;
  } catch (error) {
    addLog(`读取账号列表失败：${error.message}`);
    return false;
  } finally {
    state.accountsLoading = false;
  }
}

async function refreshAccountQuotas() {
  if (state.quotasLoading) return;
  if (!state.accounts.length) {
    addLog("账号列表为空，先刷新账号列表。");
    const loaded = await loadAccounts({ silent: true });
    if (!loaded) return;
  }
  const targets = state.accounts.filter(canFetchAccountQuota);
  if (!targets.length) {
    addLog("没有可读取额度的账号。支持 Antigravity、Claude、Codex、Kimi、xAI/Grok，且需要 auth_index。");
    return;
  }

  const concurrency = getQuotaConcurrency();
  const controller = new AbortController();
  state.quotasLoading = true;
  state.quotaAbortController = controller;
  targets.forEach((account) => {
    state.accountQuotas[account.name] = {
      status: "loading",
      type: normalizeQuotaType(account),
      fetchedAt: Date.now(),
    };
  });
  addLog(`开始读取 ${targets.length} 个账号额度，并发 ${concurrency}。`);

  let success = 0;
  let failed = 0;
  let stopped = false;

  await runLimited(targets, concurrency, async (account) => {
    if (controller.signal.aborted) return;
    try {
      const quota = await fetchAccountQuota(account, { signal: controller.signal });
      if (controller.signal.aborted) return;
      state.accountQuotas[account.name] = quota;
      success += 1;
    } catch (error) {
      if (controller.signal.aborted || error.name === "AbortError") {
        stopped = true;
        return;
      }
      state.accountQuotas[account.name] = {
        status: "error",
        type: normalizeQuotaType(account),
        error: error.message || "读取失败",
        fetchedAt: Date.now(),
      };
      failed += 1;
      addLog(`额度读取失败 ${account.name}: ${error.message}`);
    }
  }, () => controller.signal.aborted);

  state.quotasLoading = false;
  state.quotaAbortController = null;
  if (controller.signal.aborted || stopped) {
    targets.forEach((account) => {
      if (state.accountQuotas[account.name]?.status === "loading") {
        state.accountQuotas[account.name] = {
          status: "stopped",
          type: normalizeQuotaType(account),
          fetchedAt: Date.now(),
        };
      }
    });
    addLog(`已停止读取账号额度：成功 ${success}，失败 ${failed}，剩余已标记为停止。`);
    return;
  }
  state.quotaUpdatedAt = Date.now();
  addLog(`账号额度读取完成：成功 ${success}，失败 ${failed}。`);
}

function stopAccountQuotaFetch() {
  if (!state.quotasLoading || !state.quotaAbortController) return;
  state.quotaAbortController.abort();
  addLog("正在停止读取账号额度，已发出的请求会尽快结束。");
}

async function identifyAbnormalAccounts() {
  if (!state.accounts.length) {
    addLog("账号列表为空，先刷新账号列表。");
    const loaded = await loadAccounts({ silent: true });
    if (!loaded) return;
  }
  state.selectedAccounts = new Set(abnormalAccountNames.value);
  addLog(abnormalAccountNames.value.length ? `检测到并选中 ${abnormalAccountNames.value.length} 个异常账号。` : "账号列表中没有检测到异常账号。");
}

async function deleteAccountsByName(names, label) {
  if (state.accountsDeleting) return;
  const uniqueNames = Array.from(new Set(names.map((name) => String(name || "").trim()).filter(Boolean)));
  const accountByName = new Map(state.accounts.map((account) => [account.name, account]));
  const targets = uniqueNames.filter((name) => {
    const account = accountByName.get(name);
    return account && !isRuntimeOnly(account);
  });
  if (!targets.length) {
    addLog(`没有可删除的${label}。`);
    return;
  }
  if (!window.confirm(`确定删除 ${targets.length} 个${label}吗？此操作不可恢复。`)) return;

  const batchSize = getDeleteBatchSize();
  const concurrency = getDeleteConcurrency();
  const batches = chunk(targets, batchSize);
  const deletedNames = new Set();
  const failed = [];

  state.accountsDeleting = true;
  addLog(`开始删除 ${targets.length} 个${label}，每批 ${batchSize}，并发 ${concurrency}。`);
  try {
    await runLimited(batches, concurrency, async (batch, index) => {
      try {
        const data = await apiRequest("/auth-files", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: batch }),
        });
        const result = normalizeDeleteResult(data, batch);
        result.files.forEach((name) => deletedNames.add(name));
        failed.push(...result.failed);
        addLog(`删除批次 ${index + 1}/${batches.length} 完成：deleted=${result.deleted}, failed=${result.failed.length}。`);
      } catch (error) {
        batch.forEach((name) => failed.push({ name, error: error.message || "删除失败" }));
        addLog(`删除批次 ${index + 1}/${batches.length} 失败：${error.message}`);
      }

      state.accounts = state.accounts.filter((account) => !deletedNames.has(account.name));
      deletedNames.forEach((name) => {
        state.selectedAccounts.delete(name);
        delete state.accountQuotas[name];
      });
    });
    addLog(`删除完成：deleted=${deletedNames.size}, failed=${failed.length}。`);
    failed.slice(0, 12).forEach((item) => addLog(`删除失败 ${item.name || "(unknown)"}: ${item.error}`));
    if (failed.length > 12) addLog(`另有 ${failed.length - 12} 个删除失败，日志已省略。`);
    await loadAccounts({ silent: true });
  } catch (error) {
    addLog(`删除失败：${error.message}`);
  } finally {
    state.accountsDeleting = false;
  }
}

function toggleAccount(name) {
  if (!name) return;
  if (state.selectedAccounts.has(name)) state.selectedAccounts.delete(name);
  else state.selectedAccounts.add(name);
}

function toggleVisibleAccounts(event) {
  const names = selectableAccounts.value.map((account) => account.name);
  if (event.target.checked) names.forEach((name) => state.selectedAccounts.add(name));
  else names.forEach((name) => state.selectedAccounts.delete(name));
}

async function downloadAuthFile(name, options = {}) {
  const response = await apiRequest(`/auth-files/download?name=${encodeURIComponent(name)}`, {
    raw: true,
    signal: options.signal,
  });
  return response.blob();
}

function safeZipEntryName(name, usedNames) {
  const base = String(name || "auth-file.json")
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .pop() || "auth-file.json";
  const withExt = /\.json$/i.test(base) ? base : `${base}.json`;
  let candidate = withExt;
  let index = 2;
  while (usedNames.has(candidate)) {
    candidate = withExt.replace(/\.json$/i, `-${index}.json`);
    index += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestampForFilename() {
  const pad = (value) => String(value).padStart(2, "0");
  const date = new Date();
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function exportSelectedAccountsZip() {
  const targets = selectedExportAccounts.value;
  if (!targets.length) {
    addLog("没有可导出的选中账号。请先在账号列表中勾选账号。");
    return;
  }

  state.exportingZip = true;
  state.exportProgress = 0;
  const zip = new JSZip();
  const usedNames = new Set();
  const failed = [];
  let success = 0;
  const concurrency = getDeleteConcurrency();
  addLog(`开始导出 ${targets.length} 个选中账号，下载并发 ${concurrency}。`);

  try {
    await runLimited(targets, concurrency, async (account) => {
      try {
        const blob = await downloadAuthFile(account.name);
        zip.file(safeZipEntryName(account.name, usedNames), blob);
        success += 1;
      } catch (error) {
        failed.push({ name: account.name, error: error.message || "下载失败" });
        addLog(`导出下载失败 ${account.name}: ${error.message}`);
      }
      state.exportProgress = Math.round(((success + failed.length) / targets.length) * 80);
    });

    if (failed.length) {
      zip.file("export-errors.json", JSON.stringify(failed, null, 2));
    }
    const blob = await zip.generateAsync({ type: "blob" }, (metadata) => {
      state.exportProgress = 80 + metadata.percent * 0.2;
    });
    const filename = `cpa-auth-healthy-accounts-${timestampForFilename()}.zip`;
    downloadBlob(blob, filename);
    addLog(`ZIP 导出完成：成功 ${success}，失败 ${failed.length}，文件 ${filename}。`);
  } catch (error) {
    addLog(`ZIP 导出失败：${error.message}`);
  } finally {
    state.exportingZip = false;
    state.exportProgress = 0;
  }
}

async function copyLog() {
  try {
    await navigator.clipboard.writeText(state.log);
    addLog("日志已复制。");
  } catch {
    addLog("日志复制失败。");
  }
}

const QuotaCell = defineComponent({
  name: "QuotaCell",
  props: {
    account: { type: Object, required: true },
    quota: { type: Object, default: null },
  },
  setup(props) {
    return () => {
      const account = props.account;
      const quota = props.quota;
      if (isRuntimeOnly(account)) return h("span", { class: "mutedText" }, "虚拟账号");
      if (isDisabledAccount(account)) return h("span", { class: "mutedText" }, "已停用");
      const type = normalizeQuotaType(account);
      if (!QUOTA_ACCOUNT_TYPES.has(type)) return h("span", { class: "mutedText" }, "不支持");
      if (!getAuthIndex(account)) return h("span", { class: "mutedText" }, "缺少 auth_index");
      if (!quota) return h("span", { class: "mutedText" }, "未读取");
      if (quota.status === "loading") return h("span", { class: "badge uploading" }, "读取中");
      if (quota.status === "stopped") return h("span", { class: "mutedText" }, "已停止");
      if (quota.status === "error") {
        return h("div", [
          h("div", { class: "quotaMain" }, [h("span", { class: "badge failed" }, "失败")]),
          h("div", { class: "quotaSub" }, quota.error || "读取失败"),
        ]);
      }
      const primary = quota.primary;
      const percent = primary?.remainingPercent ?? quota.bestRemainingPercent;
      const percentText = percent == null ? "--" : `${formatPercent(percent)} 剩余`;
      const barClass = percent == null ? "" : percent < 20 ? "failed" : percent < 50 ? "warning" : "";
      const barWidth = percent == null ? 0 : clampPercent(percent);
      const plan = quota.planType ? ` · ${quota.planType}` : "";
      const label = primary?.label ? `${primary.label}${plan}` : `${type}${plan}`;
      const reset = primary?.resetLabel ? ` · ${primary.resetLabel}` : "";
      const detail = primary?.detail ? ` · ${primary.detail}` : "";
      return h("div", [
        h("div", { class: "quotaMain" }, percentText),
        h("div", { class: "quotaSub" }, label + reset + detail),
        h("div", { class: ["quotaMiniBar", barClass] }, [h("span", { style: { width: `${barWidth}%` } })]),
      ]);
    };
  },
});
</script>
