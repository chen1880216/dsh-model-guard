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

/** 每个 `provider/model` 的分隔符；模型 id 本身可以含 `/`（如 `workbuddy-ai/gpt-5.5`）。 */
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
  providerSort: Schema.union([SORT_NATURAL, SORT_NAME])
    .default(SORT_NATURAL)
    .volatile()
    .description('未手动排序时服务商的排列策略：natural 保持原顺序，name 按名称字母序。'),
  modelSort: Schema.union([SORT_NATURAL, SORT_NAME])
    .default(SORT_NATURAL)
    .volatile()
    .description('未手动排序时模型的排列策略：natural 保持原顺序，name 按名称字母序。'),
})

/**
 * 读取一份 volatile 配置快照里的禁用条目。
 * @param {unknown} reference - `Config` 校验后的 volatile 引用。
 * @returns {readonly string[]} 当前禁用条目；引用缺失时返回空数组。
 */
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
    const nextProviderSort = readStrategy(this.#providerSortConfig)
    const nextModelSort = readStrategy(this.#modelSortConfig)

    const nextModelRank = new Map()
    for (let index = 0; index < nextModelOrder.length; index++) {
      if (!nextModelRank.has(nextModelOrder[index])) nextModelRank.set(nextModelOrder[index], index)
    }

    const changed =
      !sameSet(nextDisabled, this.#disabled) ||
      !sameSet(nextDisabledProviders, this.#disabledProviders) ||
      !sameOrder(nextProviderOrder, this.#providerOrder) ||
      nextModelSort !== this.#modelSort ||
      nextProviderSort !== this.#providerSort ||
      !sameOrder(nextModelOrder, this.#modelOrder)

    this.#disabled = nextDisabled
    this.#disabledProviders = nextDisabledProviders
    this.#providerOrder = nextProviderOrder
    this.#modelOrder = nextModelOrder
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
    if (models.length < 2) return models
    if (this.#modelSort === SORT_NATURAL && this.#modelRank.size === 0) return models
    return applyOrder(
      models,
      // 显式顺序是全局的 `provider/model` 列表，这里只取本服务商的那部分相对次序。
      this.#modelOrder.filter((entry) => entry.startsWith(`${provider}/`)),
      (model) => `${provider}/${model.id}`,
      this.#modelSort,
      (model) => model.name,
    )
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
        isProviderDisabled: (provider) => guard.isProviderDisabled(provider),
        isDisabled: (provider, model) => guard.isDisabled(provider, model),
      }),
    'model-guard: inspection service',
  )

  ctx.logger?.info?.(
    `model-guard: active with ${guard.size} disabled model(s), ${guard.providerSize} disabled provider(s), ` +
      `${guard.providerOrder.length} provider order entr(ies), ${guard.modelOrder.length} model order entr(ies)`,
  )
}
