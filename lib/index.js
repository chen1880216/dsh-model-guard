/**
 * Model Guard — Host half.
 *
 * 让用户可以在设置里「禁用」与「排序」模型：
 * - 被禁用的模型不再出现在会话的模型选择器里，也不能被选中或提交（`session/model-unavailable`）；
 * - 排序决定选择器里服务商的先后，以及每个服务商内部模型的先后。
 *
 * 实现方式：不改动 DSH 已发布的包（/usr/local 只读），而是作为 profile 层 bundle，
 * 在 `internal/get` waterfall 上拦截 `llm` 服务的读取，返回一个**缓存的 Proxy**：
 * 覆盖 `listModels()` 与 `listProviders()`，过滤被禁用的条目并按配置重排，
 * 其余属性原样透传并绑定回真实实例（避免 `this` 指向 Proxy）。
 *
 * 为什么选 `listModels` / `listProviders`：
 * - `buildModelCatalog()`（GUI 选择器的数据源）与 `modelAvailable()`
 *   （`selectModel()` / `requireModel()` 的判定依据）都只经 `ctx.llm.listModels()` 取目录，
 *   所以过滤这一处即可同时挡住「显示」和「选择/提交」。
 * - 客户端 `orderModelProviders()` 只把 `deepseek-account` / `deepseek-official` 提前，
 *   其余服务商保持 Host 返回的相对顺序；`rankByName()` 在无搜索词时也返回原顺序。
 *   因此重排这两个方法的返回顺序即可决定选择器里的显示顺序。
 * - 只做减法与重排，不新增模型，不改路由，`resolveCallConfig()` / `stream()` 仍走原始实例。
 *
 * 配置为 `volatile()`：设置页可在运行中写入，写入落到 profile 的 cordis.patch.yml，
 * 由 loader 原地更新 volatile 引用并发出 `loader/volatile-update`，我们据此重算并
 * 广播 `llm/adapters-updated`，浏览器侧模型目录随即重载。
 *
 * @module @local/dsh-model-guard
 */

import Schema from '@deepseek-ai/schemastery'
import { symbols } from '@deepseek-ai/cordis'

/** 模型选择器所依赖的 LLM 服务名。 */
const LLM_SERVICE = 'llm'

/** 每个 `provider/model` 的分隔符；模型 id 本身可以含 `/`（如 `vendor/model-name`）。 */
const KEY_SEPARATOR = '\u0000'

/** 排序策略：保持 Host 原顺序。 */
const SORT_NATURAL = 'natural'

/** 排序策略：按显示名做不区分大小写的字母序。 */
const SORT_NAME = 'name'

/**
 * 把一条禁用条目规范化为 `provider + 分隔符 + model` 的集合键。
 * @param {unknown} entry - 形如 `"provider/model"` 的配置值。
 * @returns {string | undefined} 规范化后的键；条目非法时返回 undefined。
 */
function entryKey(entry) {
  if (typeof entry !== 'string') return undefined
  const text = entry.trim()
  if (text === '') return undefined
  const slash = text.indexOf('/')
  // 必须形如 provider/model，且两侧都非空。
  if (slash <= 0 || slash === text.length - 1) return undefined
  return `${text.slice(0, slash)}${KEY_SEPARATOR}${text.slice(slash + 1)}`
}

/**
 * 判断两个字符串集合是否相等。
 * @param {Set<string>} left - 集合一。
 * @param {Set<string>} right - 集合二。
 * @returns {boolean} 是否相等。
 */
function sameSet(left, right) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

/**
 * 判断两个字符串数组是否完全相等（含顺序）。
 * @param {readonly string[]} left - 数组一。
 * @param {readonly string[]} right - 数组二。
 * @returns {boolean} 是否相等。
 */
function sameOrder(left, right) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false
  return true
}

/**
 * 把配置里的排序列表规范化为去重后的字符串数组（保留首次出现的顺序）。
 * @param {readonly string[] | undefined} entries - 配置里的排序条目。
 * @returns {string[]} 规范化后的条目。
 */
function toOrderList(entries) {
  const seen = new Set()
  const result = []
  for (const entry of entries ?? []) {
    if (typeof entry !== 'string') continue
    const text = entry.trim()
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

/**
 * 按 `order` 里出现的先后重排 `items`：先按显式顺序，未列出的保持原相对顺序排在后面。
 *
 * 这是「手动置顶/上移下移」的落地方式：设置页把整份顺序数组写进配置，
 * Host 只负责按该数组排序；数组里缺失的项（例如新装的模型）自然排在末尾，
 * 因此不需要在每次模型拓扑变化时重写配置。
 * @param {readonly object[]} items - 待排序项。
 * @param {readonly string[]} order - 显式顺序（键列表）。
 * @param {(item: object) => string} keyOf - 从项取出用于比对的键。
 * @param {string} strategy - 未显式排序时的排序策略。
 * @param {(item: object) => string} nameOf - 从项取出显示名（用于名称排序）。
 * @returns {object[]} 重排后的新数组。
 */
function applyOrder(items, order, keyOf, strategy, nameOf) {
  const rank = new Map()
  for (let index = 0; index < order.length; index++) if (!rank.has(order[index])) rank.set(order[index], index)

  const decorated = items.map((item, index) => ({ item, index, key: keyOf(item) }))

  if (strategy === SORT_NAME) {
    decorated.sort((left, right) => {
      // 显式顺序优先；两侧都未列出时才比较名称，最后回落到原顺序保证稳定。
      const leftRank = rank.get(left.key)
      const rightRank = rank.get(right.key)
      const leftHas = leftRank !== undefined
      const rightHas = rightRank !== undefined
      if (leftHas && rightHas) return leftRank - rightRank
      if (leftHas !== rightHas) return leftHas ? -1 : 1
      const byName = nameOf(left.item).localeCompare(nameOf(right.item), undefined, { sensitivity: 'base' })
      return byName !== 0 ? byName : left.index - right.index
    })
    return decorated.map((entry) => entry.item)
  }

  // natural：仅按显式顺序提前，其余保持原相对顺序。
  decorated.sort((left, right) => {
    const leftRank = rank.get(left.key)
    const rightRank = rank.get(right.key)
    const leftHas = leftRank !== undefined
    const rightHas = rightRank !== undefined
    if (leftHas && rightHas) return leftRank - rightRank
    if (leftHas !== rightHas) return leftHas ? -1 : 1
    return left.index - right.index
  })
  return decorated.map((entry) => entry.item)
}

/**
 * 把配置中的禁用列表折叠成查找集合。
 * @param {readonly string[] | undefined} entries - 配置里的禁用条目。
 * @returns {Set<string>} 规范化后的键集合；空列表返回空集合。
 */
function toDisabledSet(entries) {
  const disabled = new Set()
  for (const entry of entries ?? []) {
    const key = entryKey(entry)
    if (key !== undefined) disabled.add(key)
  }
  return disabled
}

/** 模型守卫的配置：可在运行中修改的禁用与排序设置。 */
export const Config = Schema.object({
  disabledModels: Schema.array(Schema.string())
    .default([])
    .volatile()
    .description('禁用的模型，形如 "provider/model"；禁用后不会出现在会话的模型选择器中。'),
  disabledProviders: Schema.array(Schema.string())
    .default([])
    .volatile()
    .description('禁用的服务商（provider id）；禁用后其全部模型都不会出现在会话的模型选择器中。'),
  providerOrder: Schema.array(Schema.string())
    .default([])
    .volatile()
    .description('服务商的显示顺序（provider id 列表）；未列出的服务商排在后面，按下面的排序策略处理。'),
  modelOrder: Schema.array(Schema.string())
    .default([])
    .volatile()
    .description('模型的显示顺序，形如 "provider/model"；未列出的模型排在所属服务商内已列出项之后。'),
  probeConcurrency: Schema.number()
    .default(3)
    .volatile()
    .description('探测并发：同时向多少个模型发探测请求（1–8）；太高容易触发服务商限流。'),
  probeTimeoutMs: Schema.number()
    .default(10000)
    .volatile()
    .description('单个模型的探测超时（毫秒，1000–60000）。'),
  priorityModels: Schema.array(Schema.string())
    .default([])
    .volatile()
    .description('优先模型，形如 "provider/model"；这些模型始终排在其服务商的最前面，顺序即此列表的先后。'),
  providerSort: Schema.union([SORT_NATURAL, SORT_NAME])
    .default(SORT_NATURAL)
    .volatile()
    .description('未手动排序时服务商的排列策略：natural 保持原顺序，name 按名称字母序。'),
  modelSort: Schema.union([SORT_NATURAL, SORT_NAME])
    .default(SORT_NATURAL)
    .volatile()
    .description('未手动排序时模型的排列策略：natural 保持原顺序，name 按名称字母序。'),
  collapsePickerGroups: Schema.boolean()
    .default(true)
    .volatile()
    .description('对话输入框的模型菜单是否默认收起服务商分组（点击标题展开）。'),
})

/**
 * 读取一份 volatile 配置快照里的禁用条目。
 * @param {unknown} reference - `Config` 校验后的 volatile 引用。
 * @returns {readonly string[]} 当前禁用条目；引用缺失时返回空数组。
 */
/**
 * 把任意输入夹到 [min, max] 的整数；非法时回退默认值。
 * @param {unknown} value - 原始值（可能是字符串）。
 * @param {number} min - 下限（含）。
 * @param {number} max - 上限（含）。
 * @param {number} fallback - 非法时的回退值。
 * @returns {number} 夹取后的整数。
 */
function clampInteger(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/**
 * 读取一份 volatile 配置里的数字。
 * @param {unknown} reference - 配置引用。
 * @returns {unknown} 原始值；引用缺失时返回 undefined。
 */
function readNumber(reference) {
  if (reference === undefined || reference === null) return undefined
  return typeof reference.get === 'function' ? reference.get() : reference
}

function readEntries(reference) {
  if (reference === undefined || reference === null) return []
  const snapshot = typeof reference.get === 'function' ? reference.get() : reference
  return Array.isArray(snapshot) ? snapshot : []
}

/**
 * 读取排序策略，非法值回落到 natural。
 * @param {unknown} reference - 策略字段的 volatile 引用。
 * @returns {string} `natural` 或 `name`。
 */
function readStrategy(reference) {
  if (reference === undefined || reference === null) return SORT_NATURAL
  const value = typeof reference.get === 'function' ? reference.get() : reference
  return value === SORT_NAME ? SORT_NAME : SORT_NATURAL
}

/**
 * 为一个真实的 LLM 服务实例构建（并缓存）只过滤 `listModels()` 的 Proxy。
 *
 * 除 `listModels` 之外的一切都走真实实例：
 * - 函数属性绑定回 `target`，避免 `this` 落在 Proxy 上；
 * - symbol 属性（`symbols.original`、`symbols.tracker` 等）直接透传，保持
 *   Cordis 的追踪与 Typert Gateway 的绑定校验可用。
 */
class ModelGuard {
  /** @type {import('@deepseek-ai/cordis').Context} 提供 volatile 配置的插件上下文。 */
  #ctx

  /** @type {{ get(): readonly string[] } | undefined} 配置里的禁用模型 volatile 引用。 */
  #modelConfig

  /** @type {{ get(): readonly string[] } | undefined} 配置里的禁用服务商 volatile 引用。 */
  #providerConfig

  /** @type {{ get(): readonly string[] } | undefined} 配置里的服务商顺序引用。 */
  #providerOrderConfig

  /** @type {{ get(): readonly string[] } | undefined} 配置里的模型顺序引用。 */
  #modelOrderConfig

  /** @type {{ get(): readonly string[] } | undefined} 配置里的优先模型引用。 */
  #priorityConfig

  /** @type {{ get(): unknown } | undefined} 配置里的探测并发引用。 */
  #probeConcurrencyConfig

  /** @type {{ get(): unknown } | undefined} 配置里的探测超时引用。 */
  #probeTimeoutConfig

  /** @type {{ get(): string } | undefined} 服务商排序策略引用。 */
  #providerSortConfig

  /** @type {{ get(): string } | undefined} 模型排序策略引用。 */
  #modelSortConfig

  /** @type {Set<string>} 当前禁用的模型集合（已规范化）。 */
  #disabled = new Set()

  /** @type {Set<string>} 当前禁用的服务商集合。 */
  #disabledProviders = new Set()

  /** @type {string[]} 服务商的显式顺序。 */
  #providerOrder = []

  /** @type {string[]} 模型的显式顺序（`provider/model`）。 */
  #modelOrder = []

  /** @type {string[]} 优先模型（`provider/model`），顺序即优先级。 */
  #priorityOrder = []

  /** @type {Map<string, string[]>} provider → 该服务商内优先模型的 model id 顺序。 */
  #priorityByProvider = new Map()

  /** @type {number} 探测并发（1–8）。 */
  #probeConcurrency = PROBE_CONCURRENCY

  /** @type {number} 单个模型的探测超时（毫秒）。 */
  #probeTimeoutMs = PROBE_TIMEOUT_MS

  /** @type {Map<string, number>} `provider/model` → 显式顺序下标。 */
  #modelRank = new Map()

  /** @type {string} 服务商排序策略。 */
  #providerSort = SORT_NATURAL

  /** @type {string} 模型排序策略。 */
  #modelSort = SORT_NATURAL

  /** @type {WeakMap<object, object>} 真实服务实例 → 过滤用 Proxy，保持引用稳定。 */
  #wrappers = new WeakMap()

  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
   * @param {object} config - 校验后的配置。
   */
  constructor(ctx, config) {
    this.#ctx = ctx
    this.#modelConfig = config?.disabledModels
    this.#providerConfig = config?.disabledProviders
    this.#providerOrderConfig = config?.providerOrder
    this.#modelOrderConfig = config?.modelOrder
    this.#priorityConfig = config?.priorityModels
    this.#probeConcurrencyConfig = config?.probeConcurrency
    this.#probeTimeoutConfig = config?.probeTimeoutMs
    this.#providerSortConfig = config?.providerSort
    this.#modelSortConfig = config?.modelSort
    this.reload()
  }

  /**
   * 按当前配置重算禁用集合与排序。
   * @returns {boolean} 是否发生了变化（变化才需要广播目录刷新）。
   */
  reload() {
    const nextDisabled = toDisabledSet(readEntries(this.#modelConfig))
    const nextDisabledProviders = new Set(
      readEntries(this.#providerConfig)
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ''),
    )
    const nextProviderOrder = toOrderList(readEntries(this.#providerOrderConfig))
    const nextModelOrder = toOrderList(readEntries(this.#modelOrderConfig))
    const nextPriorityOrder = toOrderList(readEntries(this.#priorityConfig))
    const nextProbeConcurrency = clampInteger(readNumber(this.#probeConcurrencyConfig), 1, PROBE_MAX_CONCURRENCY, PROBE_CONCURRENCY)
    const nextProbeTimeoutMs = clampInteger(readNumber(this.#probeTimeoutConfig), PROBE_MIN_TIMEOUT_MS, PROBE_MAX_TIMEOUT_MS, PROBE_TIMEOUT_MS)
    const nextProviderSort = readStrategy(this.#providerSortConfig)
    const nextModelSort = readStrategy(this.#modelSortConfig)

    const nextModelRank = new Map()
    for (let index = 0; index < nextModelOrder.length; index++) {
      if (!nextModelRank.has(nextModelOrder[index])) nextModelRank.set(nextModelOrder[index], index)
    }

    // 优先模型按 provider 分组，组内保持配置顺序。
    const nextPriorityByProvider = new Map()
    for (const entry of nextPriorityOrder) {
      const slash = entry.indexOf('/')
      if (slash <= 0 || slash === entry.length - 1) continue
      const provider = entry.slice(0, slash)
      const model = entry.slice(slash + 1)
      const bucket = nextPriorityByProvider.get(provider)
      if (bucket === undefined) nextPriorityByProvider.set(provider, [model])
      else if (!bucket.includes(model)) bucket.push(model)
    }

    const changed =
      !sameSet(nextDisabled, this.#disabled) ||
      !sameSet(nextDisabledProviders, this.#disabledProviders) ||
      !sameOrder(nextProviderOrder, this.#providerOrder) ||
      nextModelSort !== this.#modelSort ||
      nextProviderSort !== this.#providerSort ||
      !sameOrder(nextModelOrder, this.#modelOrder)
      || !sameOrder(nextPriorityOrder, this.#priorityOrder)
      || nextProbeConcurrency !== this.#probeConcurrency
      || nextProbeTimeoutMs !== this.#probeTimeoutMs

    this.#disabled = nextDisabled
    this.#disabledProviders = nextDisabledProviders
    this.#providerOrder = nextProviderOrder
    this.#modelOrder = nextModelOrder
    this.#priorityOrder = nextPriorityOrder
    this.#priorityByProvider = nextPriorityByProvider
    this.#probeConcurrency = nextProbeConcurrency
    this.#probeTimeoutMs = nextProbeTimeoutMs
    this.#modelRank = nextModelRank
    this.#providerSort = nextProviderSort
    this.#modelSort = nextModelSort
    return changed
  }

  /** @returns {number} 当前被禁用的模型条数。 */
  get size() {
    return this.#disabled.size
  }

  /** @returns {number} 当前被禁用的服务商条数。 */
  get providerSize() {
    return this.#disabledProviders.size
  }

  /** @returns {string[]} 当前禁用条目的 `provider/model` 展示形式。 */
  get disabled() {
    return [...this.#disabled].map((key) => key.replace(KEY_SEPARATOR, '/'))
  }

  /** @returns {string[]} 当前禁用的服务商 id。 */
  get disabledProviderIds() {
    return [...this.#disabledProviders]
  }

  /** @returns {string[]} 服务商的显式顺序。 */
  get providerOrder() {
    return [...this.#providerOrder]
  }

  /** @returns {string[]} 模型的显式顺序。 */
  get modelOrder() {
    return [...this.#modelOrder]
  }

  /** @returns {number} 探测并发（1–8）。 */
  get probeConcurrency() {
    return this.#probeConcurrency
  }

  /** @returns {number} 单个模型的探测超时（毫秒）。 */
  get probeTimeoutMs() {
    return this.#probeTimeoutMs
  }

  /** @returns {string[]} 优先模型（`provider/model`），顺序即优先级。 */
  get priorityModels() {
    return [...this.#priorityOrder]
  }

  /**
   * 判断一条模型是否被标记为优先。
   * @param {string} provider - provider 路由 id。
   * @param {string} model - 模型 id。
   * @returns {boolean} 是否优先。
   */
  isPriority(provider, model) {
    return this.#priorityByProvider.get(provider)?.includes(model) === true
  }

  /**
   * 判断一个服务商是否被整体禁用。
   * @param {string} provider - provider 路由 id。
   * @returns {boolean} 是否禁用。
   */
  isProviderDisabled(provider) {
    return this.#disabledProviders.has(provider)
  }

  /**
   * 判断一条 `provider/model` 是否被禁用（含服务商整体禁用）。
   * @param {string} provider - provider 路由 id。
   * @param {string} model - 模型 id。
   * @returns {boolean} 是否禁用。
   */
  isDisabled(provider, model) {
    if (this.#disabledProviders.has(provider)) return true
    if (this.#disabled.size === 0) return false
    return this.#disabled.has(`${provider}${KEY_SEPARATOR}${model}`)
  }

  /** @returns {boolean} 是否配置了任何禁用项。 */
  get active() {
    return this.#disabled.size > 0 || this.#disabledProviders.size > 0
  }

  /**
   * 按配置重排一个服务商的模型列表。
   * @param {string} provider - 该列表所属的 provider id。
   * @param {readonly object[]} models - 已过滤的模型列表。
   * @returns {object[]} 重排后的列表。
   */
  sortModels(provider, models) {
    const priority = this.#priorityByProvider.get(provider)
    if ((priority === undefined || priority.length === 0) && models.length < 2) return models
    if (priority === undefined && this.#modelSort === SORT_NATURAL && this.#modelRank.size === 0) return models

    // 第一层：优先模型恒在最前。它们不参与后续的策略排序，因此后续「置顶/上移」
    // 只会调整优先段之后的普通模型，不会把优先模型挤下去。
    const priorityRank = new Map()
    for (let index = 0; index < (priority?.length ?? 0); index++) {
      if (!priorityRank.has(priority[index])) priorityRank.set(priority[index], index)
    }
    const head = []
    const tail = []
    for (const model of models) {
      if (priorityRank.has(model.id)) head.push(model)
      else tail.push(model)
    }
    head.sort((left, right) => priorityRank.get(left.id) - priorityRank.get(right.id))

    // 第二层：普通模型按「显式顺序 > 排序策略 > 原顺序」。
    const ordered = tail.length < 2 || (this.#modelSort === SORT_NATURAL && this.#modelRank.size === 0)
      ? tail
      : applyOrder(
          tail,
          // 显式顺序是全局的 `provider/model` 列表，这里只取本服务商的那部分相对次序。
          this.#modelOrder.filter((entry) => entry.startsWith(`${provider}/`)),
          (model) => `${provider}/${model.id}`,
          this.#modelSort,
          (model) => model.name,
        )
    return [...head, ...ordered]
  }

  /**
   * 按配置重排服务商列表。
   * @param {readonly object[]} providers - 已过滤的 provider 列表。
   * @returns {object[]} 重排后的列表。
   */
  sortProviders(providers) {
    if (providers.length < 2) return providers
    if (this.#providerSort === SORT_NATURAL && this.#providerOrder.length === 0) return providers
    return applyOrder(providers, this.#providerOrder, (provider) => provider.id, this.#providerSort, (provider) => provider.name)
  }

  /**
   * 为一个真实服务实例取得过滤/排序用 Proxy（同一实例始终返回同一 Proxy）。
   * @param {object} target - 真实的 `llm` 服务实例。
   * @returns {object} 覆盖了 `listModels()` 与 `listProviders()` 的 Proxy。
   */
  wrap(target) {
    const existing = this.#wrappers.get(target)
    if (existing !== undefined) return existing
    const guard = this
    // Cordis 的 traceable 代理把真实服务挂在 `symbols.original` 上；对外暴露的
    // `symbols.original` 必须继续指向那个真实实例（而不是本 Proxy 或 traceable
    // 代理），否则按 original 做绑定校验的调用方会看到不一致的服务身份。
    const original = target[symbols.original] ?? target
    const wrapper = new Proxy(target, {
      get(object, property, receiver) {
        if (property === symbols.original) return original
        if (typeof property === 'symbol') return Reflect.get(object, property, receiver)
        if (property === 'listModels') {
          return async function listModels(provider) {
            // 服务商被整体禁用时，目录里一个模型都不返回：buildModelCatalog 会
            // 过滤掉空分组，选择器里连这个服务商都不再出现。
            if (guard.isProviderDisabled(provider)) return []
            const models = await Reflect.apply(Reflect.get(object, 'listModels', object), object, [provider])
            const kept = guard.#disabled.size === 0 ? models : models.filter((model) => !guard.isDisabled(provider, model.id))
            return guard.sortModels(provider, kept)
          }
        }
        if (property === 'listProviders') {
          return function listProviders() {
            const providers = Reflect.apply(Reflect.get(object, 'listProviders', object), object, [])
            // 被整体禁用的服务商不再出现在 provider 列表里，选择器因此不会渲染空分组。
            const kept = guard.#disabledProviders.size === 0
              ? providers
              : providers.filter((provider) => !guard.isProviderDisabled(provider.id))
            return guard.sortProviders(kept)
          }
        }
        // 其余成员一律从 traceable 代理读取并绑定回它，保留 cordis 的
        // 按读取方上下文追踪的语义。
        const value = Reflect.get(object, property, object)
        return typeof value === 'function' ? value.bind(object) : value
      },
      // 过滤只做减法：写入与读取语义保持与真实实例一致。
      has(object, property) {
        return Reflect.has(object, property)
      },
      // 保持 `instanceof LlmRuntime` 与原型链查询为真。
      getPrototypeOf(object) {
        return Reflect.getPrototypeOf(object)
      },
    })
    this.#wrappers.set(target, wrapper)
    return wrapper
  }

  /**
   * 服务读取拦截：只处理 `llm`，其余服务原样返回。
   * @param {import('@deepseek-ai/cordis').Context} _reader - 读取方上下文。
   * @param {string} name - 被读取的服务名。
   * @param {unknown} _error - 未注入时的错误对象（本插件不修改它）。
   * @param {() => unknown} next - 继续 waterfall，取真实服务值。
   * @returns {unknown} 真实服务值或其过滤 Proxy。
   */
  intercept(_reader, name, _error, next) {
    const value = next()
    if (name !== LLM_SERVICE || value === null || typeof value !== 'object') return value
    return this.wrap(value)
  }

  /**
   * 配置热更新后广播模型目录变更，让浏览器侧重新拉取 catalog。
   * `llm/adapters-updated` 是 API 层已转发的 Host 事件，客户端模型选择器
   * （`@deepseek-ai/dsh-client-ui-model-selection`）订阅它并重载目录。
   */
  broadcast() {
    try {
      this.#ctx.emit('llm/adapters-updated')
    } catch (error) {
      this.#ctx.logger?.warn?.(`model-guard: failed to broadcast the model catalog change: ${String(error)}`)
    }
  }
}

/** 本插件依赖的 Host 服务。 */
export const inject = ['llm']

/** 插件显示名（Plugin Manager / 设置页的清单行使用）。 */
export const name = 'model-guard'

/**
 * 安装模型守卫。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @param {object} config - 校验后的配置。
 */
export function apply(ctx, config) {
  const guard = new ModelGuard(ctx, config)

  // 拦截服务读取：声明 inject: ['llm'] 的消费者（含 session-controller）读 ctx.llm 时经过此处。
  ctx.effect(() => ctx.on('internal/get', guard.intercept.bind(guard), { global: true }), 'model-guard: llm read interception')

  // volatile 配置被原地更新时重算；集合变化才广播，避免无意义的目录重载。
  ctx.effect(
    () =>
      ctx.on('loader/volatile-update', () => {
        if (guard.reload()) guard.broadcast()
      }),
    'model-guard: volatile config updates',
  )

  // 模型可用性探测端点：只在有 HTTP 服务的部署（Web GUI）里注册；
  // 纯进程内宿主没有 webServer，客户端会自动退化为「当前环境不支持」。
  ctx.inject(['webServer'], (sub) =>
    sub.effect(() => installProbeRoute(sub, guard), 'model-guard: model probe endpoint'),
  )

  // 默认模型读写：仅在部署真的提供 agentDefaultModel 时挂载。
  ctx.inject(['webServer', 'agentDefaultModel'], (sub) =>
    sub.effect(() => installDefaultRoute(sub), 'model-guard: default model endpoint'),
  )

  // 供同进程内的观测/测试读取当前禁用与排序状态（不暴露写接口）。
  ctx.effect(
    () =>
      ctx.provide('modelGuard', {
        get disabled() {
          return guard.disabled
        },
        get disabledProviders() {
          return guard.disabledProviderIds
        },
        get providerOrder() {
          return guard.providerOrder
        },
        get modelOrder() {
          return guard.modelOrder
        },
        get priorityModels() {
          return guard.priorityModels
        },
        get probeConcurrency() {
          return guard.probeConcurrency
        },
        get probeTimeoutMs() {
          return guard.probeTimeoutMs
        },
        isPriority: (provider, model) => guard.isPriority(provider, model),
        isProviderDisabled: (provider) => guard.isProviderDisabled(provider),
        isDisabled: (provider, model) => guard.isDisabled(provider, model),
      }),
    'model-guard: inspection service',
  )

  ctx.logger?.info?.(
    `model-guard: active with ${guard.size} disabled model(s), ${guard.providerSize} disabled provider(s), ` +
      `${guard.providerOrder.length} provider order entr(ies), ${guard.modelOrder.length} model order entr(ies), ` +
      `${guard.priorityModels.length} priority model(s)`,
  )
}

//#region 模型可用性探测

/** 探测端点：同源 POST，返回每个模型的可用性与耗时。 */
const PROBE_PATH = '/api/model-guard/probe'

/** 单次探测的默认超时（毫秒）；可被配置 `probeTimeoutMs` 覆盖。 */
const PROBE_TIMEOUT_MS = 10000

/** 单次请求允许探测的模型数量上限，避免误触全量长跑。 */
const PROBE_MAX_ITEMS = 200

/** 默认并发探测数：太低会让「测试全部」等太久，太高容易触发服务商限流。 */
const PROBE_CONCURRENCY = 3

/** 并发上限：再多基本只会撞服务商的限流，不会更快。 */
const PROBE_MAX_CONCURRENCY = 8

/** 超时上下限（毫秒）。 */
const PROBE_MIN_TIMEOUT_MS = 1000
const PROBE_MAX_TIMEOUT_MS = 60000

/** 探测用的最小提示词：只要模型回一个词，成本与耗时都可忽略。 */
const PROBE_PROMPT = 'ping'

/** 探测用的系统提示：让返回内容可预期，便于判断「通但答非所问」。 */
const PROBE_SYSTEM = 'You are a health check endpoint. Reply with exactly one word: pong'

/**
 * 写一个 JSON 响应。
 * @param {import('node:http').ServerResponse} res - HTTP 响应。
 * @param {number} status - 状态码。
 * @param {unknown} payload - 响应体。
 * @returns {void}
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

/**
 * 读取并解析 JSON 请求体。
 * @param {import('node:http').IncomingMessage} req - HTTP 请求。
 * @param {number} [limit] - 允许的最大字节数。
 * @returns {Promise<unknown>} 解析后的 JSON。
 */
function readJsonBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

/**
 * 探测单个模型：发一条极小的对话请求，测量首字/整体耗时并归类失败原因。
 *
 * 走 `prepareCall` + `stream`（与 `dsh-session-title-llm` 同一条链路），
 * 因此凭据解析、路由选择、重试策略都与真实对话一致；失败时把 `LlmFailure`
 * 的 `code` 一起返回，前端可以区分「没有适配器」「鉴权失败」「限流」等情形。
 * @param {object} llm - `ctx.llm` 服务（已被本插件的 Proxy 包装，透传）。
 * @param {string} provider - provider 路由 id。
 * @param {string} model - 模型 id。
 * @param {number} timeoutMs - 单次超时。
 * @returns {Promise<object>} 探测结果。
 */
async function probeModel(llm, provider, model, timeoutMs) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const call = await llm.prepareCall({ provider, model, maxTokens: 16 }, controller.signal)
    const options = {
      ...call.config,
      messages: [{ role: 'user', content: [{ type: 'text', text: PROBE_PROMPT }] }],
      system: PROBE_SYSTEM,
      signal: controller.signal,
    }
    let text = ''
    let finish
    for await (const chunk of call.stream(options)) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish') finish = chunk.reason
    }
    const latencyMs = Date.now() - startedAt
    if (finish?.kind === 'aborted' || finish?.kind === 'error') {
      const failure = finish.failure ?? {}
      const timedOut = controller.signal.aborted
      return {
        provider,
        model,
        ok: false,
        latencyMs,
        code: timedOut ? 'TIMEOUT' : failure.code ?? 'FAILED',
        error: timedOut ? `超时（${timeoutMs} ms）` : failure.message ?? '模型调用失败',
      }
    }
    return { provider, model, ok: true, latencyMs, sample: text.trim().slice(0, 40) }
  } catch (error) {
    const timedOut = controller.signal.aborted
    return {
      provider,
      model,
      ok: false,
      latencyMs: Date.now() - startedAt,
      code: timedOut ? 'TIMEOUT' : error?.code ?? 'ERROR',
      error: timedOut ? `超时（${timeoutMs} ms）` : error?.message ?? String(error),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 以固定并发度跑完一批探测，结果顺序与输入一致。
 * @param {readonly object[]} items - `{ provider, model }` 列表。
 * @param {(item: object) => Promise<object>} run - 单条执行函数。
 * @param {number} concurrency - 并发上限。
 * @returns {Promise<object[]>} 结果列表。
 */
async function runPool(items, run, concurrency) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.min(concurrency, items.length)).fill(undefined).map(async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await run(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * 判断请求是否同源：`Origin` 的 host 必须等于 `Host`。
 *
 * 本机 GUI 没有登录态（鉴权在 Caddy 外层），同源校验是这里能做的唯一约束。
 * @param {import('node:http').IncomingMessage} req - 请求。
 * @returns {boolean} 是否同源。
 */
function isSameOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
  try {
    return new URL(origin).host === req.headers.host
  } catch (_error) {
    return true
  }
}

/** 默认模型端点：同源 GET 读、POST 写 profile 的 `agent-default-model`。 */
const DEFAULT_PATH = '/api/model-guard/default'

/**
 * 注册默认模型读写路由。
 *
 * 直接调用 Host 的 `agentDefaultModel` 服务：它的 `saveSelection()` 经
 * `configEditor` 写回 profile 配置，因此改完即持久化，重启后仍生效——
 * 比在本插件里另存一份「默认模型」字段可靠（那样只影响本插件的视图）。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 已注入 webServer 与 agentDefaultModel 的子上下文。
 * @returns {() => void} 卸载函数。
 */
function installDefaultRoute(ctx) {
  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: DEFAULT_PATH,
    async handler(req, res) {
      if (!isSameOrigin(req)) {
        sendJson(res, 403, { error: 'cross-origin' })
        return
      }
      const service = ctx.agentDefaultModel
      if (service === undefined) {
        sendJson(res, 501, { error: 'no-default-service' })
        return
      }
      if (req.method === 'GET') {
        try {
          const current = service.currentSelection()
          sendJson(res, 200, {
            provider: current.provider,
            model: current.model,
            ...(current.reasoningEffort === undefined ? {} : { reasoningEffort: current.reasoningEffort }),
          })
        } catch (error) {
          sendJson(res, 500, { error: 'read-failed', message: String(error?.message ?? error) })
        }
        return
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method-not-allowed' })
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch (_error) {
        sendJson(res, 400, { error: 'invalid-body' })
        return
      }
      const provider = typeof body?.provider === 'string' ? body.provider.trim() : ''
      const model = typeof body?.model === 'string' ? body.model.trim() : ''
      if (provider === '' || model === '') {
        sendJson(res, 400, { error: 'invalid-selection' })
        return
      }
      if (ctx.get('configEditor') === undefined) {
        // 没有配置编辑器时 saveSelection() 会静默不写；这里说清楚，避免「提示成功其实没存」。
        sendJson(res, 501, { error: 'no-config-editor' })
        return
      }
      try {
        const current = service.currentSelection()
        const same = current.provider === provider && current.model === model
        const next = { provider, model }
        // 同一个模型只改默认标记时保留原有推理强度；换模型则不保留（可能对该模型不合法）。
        if (same && current.reasoningEffort !== undefined) next.reasoningEffort = current.reasoningEffort
        await service.saveSelection(next)
        ctx.logger?.info?.(`model-guard: default model set to ${provider}/${model}`)
        sendJson(res, 200, { ok: true, provider, model })
      } catch (error) {
        sendJson(res, 500, { error: 'save-failed', message: String(error?.message ?? error) })
      }
    },
  })
  ctx.logger?.info?.(`model-guard: default model endpoint listening on ${DEFAULT_PATH}`)
  return dispose
}

/**
 * 把请求体规范化为待探测列表；非法条目直接丢弃。
 * @param {unknown} body - 已解析的请求体。
 * @returns {{ provider: string, model: string }[]} 待探测列表。
 */
function toProbeItems(body) {
  const raw = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : body?.provider ? [body] : []
  const items = []
  for (const entry of raw) {
    const provider = typeof entry?.provider === 'string' ? entry.provider.trim() : ''
    const model = typeof entry?.model === 'string' ? entry.model.trim() : ''
    if (provider === '' || model === '') continue
    items.push({ provider, model })
    if (items.length >= PROBE_MAX_ITEMS) break
  }
  return items
}

/**
 * 注册探测路由。
 *
 * 走 HTTP 而不是新增 Remote 命名空间：Remote 的命名空间与参数描述由
 * Typert 代码生成器产出，第三方插件无法在运行时注册；而 `webServer.register()`
 * 是公开的精确路由入口，且精确路由优先于 `/api` 前缀桥，同源 fetch 直接命中。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 插件上下文。
 * @param {object} guard - 模型守卫实例（仅用于日志）。
 * @returns {() => void} 卸载函数。
 */
function installProbeRoute(ctx, guard) {
  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: PROBE_PATH,
    async handler(req, res) {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method-not-allowed' })
        return
      }
      // 只接受同源请求：探测会消耗真实额度，不能给任意跨站页面用。
      if (!isSameOrigin(req)) {
        sendJson(res, 403, { error: 'cross-origin' })
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch (_error) {
        sendJson(res, 400, { error: 'invalid-body' })
        return
      }
      const items = toProbeItems(body)
      if (items.length === 0) {
        sendJson(res, 400, { error: 'no-items' })
        return
      }
      // 请求体可覆盖，但都夹在安全区间内；默认取设置页的「探测并发 / 超时」。
      const timeoutMs = clampInteger(body?.timeoutMs, PROBE_MIN_TIMEOUT_MS, PROBE_MAX_TIMEOUT_MS, guard.probeTimeoutMs)
      const concurrency = clampInteger(body?.concurrency, 1, PROBE_MAX_CONCURRENCY, guard.probeConcurrency)
      const startedAt = Date.now()
      const results = await runPool(items, (item) => probeModel(ctx.llm, item.provider, item.model, timeoutMs), concurrency)
      const okCount = results.filter((result) => result.ok).length
      ctx.logger?.info?.(`model-guard: probed ${results.length} model(s), ${okCount} reachable in ${Date.now() - startedAt} ms`)
      sendJson(res, 200, { results, timeoutMs, concurrency })
    },
  })
  ctx.logger?.info?.(`model-guard: probe endpoint listening on ${PROBE_PATH}`)
  return dispose
}

//#endregion
