window.__ModuleLoader__.load({
	id: '@local/dsh-model-guard',
	factory: (require) => {
		const module = { exports: {} }
		const exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

		const react = require('react')
		const jsx = require('react/jsx-runtime')
		const primitives = require('@deepseek-ai/dsh-client-ui-primitives')

		//#region 文案
		/** 本插件自有的 locale 命名空间。 */
		const NS = 'model-guard'

		/** Host 侧模型探测端点（由 `lib/index.js` 在 `ctx.webServer` 上注册）。 */
		const PROBE_ENDPOINT = '/api/model-guard/probe'

		/** 每次请求携带的模型数：片内并发由 Host 控制，片间串行。 */
		const PROBE_BATCH = 6

		/** 默认模型读写端点（同源 GET / POST）。 */
		const DEFAULT_ENDPOINT = '/api/model-guard/default'

		/** 并发上下限，与 Host 侧保持一致。 */
		const PROBE_MIN_CONCURRENCY = 1
		const PROBE_MAX_CONCURRENCY = 8
		const PROBE_TIMEOUT_CHOICES = [5000, 10000, 20000, 30000]

		/** 模型菜单里徽标的文案，由 apply() 按当前语言写入。 */
		const HEALTH_LABEL = { ok: '可用', fail: '不可用' }

		const zh = {
			'nav': '模型禁用与排序',
			'intro': '被禁用的模型或服务商不会出现在对话的模型选择器中；排序决定选择器里服务商与模型的先后。',
			'loading': '正在读取模型目录…',
			'loadFailed': '读取模型目录失败',
			'retry': '重试',
			'empty': '当前没有任何可用模型。',
			'counts': '已禁用 {models} 个模型 / {providers} 个服务商',
			'saved': '设置已保存',
			'saveFailed': '保存失败，请重试',
			'disable': '禁用',
			'enable': '启用',
			'disabledTag': '已禁用',
			'providerTag': '服务商已禁用',
			'search': '搜索模型或服务商',
			'noMatch': '没有匹配的模型',
			'unavailable': '当前部署未提供可写的模型禁用配置。',
			'disableProvider': '禁用整个服务商',
			'enableProvider': '启用此服务商',
			'modelTotal': '{count} 个模型',
			'hiddenByProvider': '服务商已禁用，其 {count} 个模型全部隐藏',
			'sortSection': '排序',
			'providerSortLabel': '服务商排序',
			'modelSortLabel': '服务商内模型排序',
			'sortNatural': '保持默认顺序',
			'sortName': '按名称',
			'sortHint': '手动上移/下移会固定该层顺序；「按名称」只影响未被手动调整过的项。官方服务商（deepseek-account / deepseek-official）始终排在前面，无法调整。',
			'moveUp': '上移',
			'moveDown': '下移',
			'moveTop': '置顶',
			'resetOrder': '恢复默认顺序',
			'orderSaved': '顺序已更新',
			'sortedManually': '已手动排序',
			'expandAll': '全部展开',
			'collapseAll': '全部收起',
			'expand': '展开',
			'collapse': '收起',
			'pickerCollapse': '对话模型菜单默认收起',
			'pickerCollapseHint': '收起后只显示服务商，点击名称展开；搜索与键盘操作会自动展开。',
			'priority': '优先',
			'priorityOn': '取消优先',
			'priorityTag': '优先',
			'priorityHint': '带 ★ 的模型始终排在其服务商最前面，不受「置顶/上移」影响；点击 ☆ 可取消。',
			'probeProvider': '测试本组',
			'probeProviderAria': '测试 {provider} 的全部模型',
			'probeConcurrencyLabel': '探测并发',
			'probeTimeoutLabel': '探测超时',
			'probeLimitHint': '并发 {concurrency} · 超时 {timeout} ms；并发越高越快，但更容易被服务商限流。',
			'defaultModelLabel': '默认模型',
			'defaultModelApply': '设为默认',
			'defaultModelApplying': '保存中…',
			'defaultModelHint': '新会话默认使用这个模型；写在 profile 的 agent-default-model 条目里，重启后仍生效。',
			'defaultModelSaved': '默认模型已更新为 {name}。',
			'defaultModelFailed': '默认模型保存失败：{message}',
			'defaultModelUnsupported': '当前环境不支持修改默认模型（缺少 agentDefaultModel 或 configEditor）。',
			'defaultModelSame': '这就是当前默认模型。',
			'probe': '测试',
			'probeAll': '测试全部',
			'probing': '测试中…',
			'probeOk': '可用',
			'probeFail': '不可用',
			'probeSummary': '可用 {ok}/{total}',
			'probeUnsupported': '当前环境不支持模型探测（需要 Web GUI）。',
			'probeAria': '测试 {name} 是否可用',
			'probeHint': '测试会向模型发一条极小的请求（ping），只消耗个位数 token；结果仅本次打开有效。',
		}

		const en = {
			'nav': 'Models & ordering',
			'intro': 'A disabled model or provider is hidden from the conversation model picker; ordering decides the sequence of providers and models in that picker.',
			'loading': 'Reading the model catalog…',
			'loadFailed': 'Could not read the model catalog',
			'retry': 'Retry',
			'empty': 'No models are currently available.',
			'counts': '{models} model(s) and {providers} provider(s) disabled',
			'saved': 'Settings saved',
			'saveFailed': 'Could not save the setting',
			'disable': 'Disable',
			'enable': 'Enable',
			'disabledTag': 'Disabled',
			'providerTag': 'Provider disabled',
			'search': 'Search models or providers',
			'noMatch': 'No matching model',
			'unavailable': 'This deployment does not serve a writable disabled-model configuration.',
			'disableProvider': 'Disable the whole provider',
			'enableProvider': 'Enable this provider',
			'modelTotal': '{count} models',
			'hiddenByProvider': 'Provider disabled — all {count} models are hidden',
			'sortSection': 'Ordering',
			'providerSortLabel': 'Provider order',
			'modelSortLabel': 'Model order within a provider',
			'sortNatural': 'Keep the default order',
			'sortName': 'By name',
			'sortHint': 'Moving an item pins that level; "By name" only affects items you have not moved manually. The official providers (deepseek-account / deepseek-official) always come first and cannot be reordered.',
			'moveUp': 'Move up',
			'moveDown': 'Move down',
			'moveTop': 'Move to top',
			'resetOrder': 'Reset to default order',
			'orderSaved': 'Order updated',
			'sortedManually': 'Manually ordered',
			'expandAll': 'Expand all',
			'collapseAll': 'Collapse all',
			'expand': 'Expand',
			'collapse': 'Collapse',
			'pickerCollapse': 'Collapse groups in the chat model menu',
			'pickerCollapseHint': 'Only provider names show until you click one; searching or using the keyboard expands everything.',
			'priority': 'Prioritize',
			'priorityOn': 'Remove priority',
			'priorityTag': 'Priority',
			'priorityHint': 'Models marked with ★ always sort first inside their provider, unaffected by move to top / up / down; click ☆ to clear.',
			'probeProvider': 'Test group',
			'probeProviderAria': 'Test every model of {provider}',
			'probeConcurrencyLabel': 'Probe concurrency',
			'probeTimeoutLabel': 'Probe timeout',
			'probeLimitHint': '{concurrency} at a time · {timeout} ms timeout; higher is faster but more likely to hit provider rate limits.',
			'defaultModelLabel': 'Default model',
			'defaultModelApply': 'Set as default',
			'defaultModelApplying': 'Saving…',
			'defaultModelHint': 'New sessions start with this model; it is written to the profile entry agent-default-model, so it survives restarts.',
			'defaultModelSaved': 'Default model is now {name}.',
			'defaultModelFailed': 'Could not save the default model: {message}',
			'defaultModelUnsupported': 'This environment cannot change the default model (no agentDefaultModel or configEditor).',
			'defaultModelSame': 'This is already the default model.',
			'probe': 'Test',
			'probeAll': 'Test all',
			'probing': 'Testing…',
			'probeOk': 'Available',
			'probeFail': 'Unavailable',
			'probeSummary': '{ok}/{total} available',
			'probeUnsupported': 'This environment does not expose the probe endpoint (Web GUI required).',
			'probeAria': 'Test whether {name} is available',
			'probeHint': 'A test sends one tiny request (ping) to the model — a few tokens at most. Results last for this page only.',
		}
		//#endregion

		//#region 样式
		const CSS = `
.mg-section{display:flex;flex-direction:column;gap:12px;max-width:780px;color:var(--dsw-alias-label-primary)}
.mg-title{margin:0;font-size:16px;font-weight:500;line-height:24px;color:var(--dsw-alias-label-primary)}
.mg-intro{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary)}
.mg-toolbar{display:flex;align-items:center;gap:8px;margin-top:4px}
.mg-search{box-sizing:border-box;flex:1 1 auto;min-width:0;height:32px;padding:0 10px;font:inherit;font-size:14px;line-height:22px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.mg-search:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.mg-count{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.mg-sortBar{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:10px 12px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill)}
.mg-sortField{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mg-select{height:28px;padding:0 6px;font:inherit;font-size:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.mg-sortHint{margin:0;flex:1 1 100%;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.mg-reset{height:26px;padding:0 10px;font:inherit;font-size:12px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary)}
.mg-reset:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mg-reset:disabled{opacity:.4;cursor:default}
.mg-group{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.mg-groupHead{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.mg-groupTitle{margin:0;min-width:0;flex:1 1 auto;display:flex}
.mg-groupToggle{display:inline-flex;align-items:center;gap:6px;min-width:0;padding:2px 4px;margin-left:-4px;font:inherit;text-align:left;cursor:pointer;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:inherit}
.mg-groupToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mg-groupToggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.mg-caret{flex:none;width:12px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);transition:transform .12s ease}
.mg-caretOpen{transform:rotate(90deg)}
.mg-groupName{margin:0;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mg-groupMeta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);flex:none}
.mg-groupActions{margin-left:auto;display:inline-flex;align-items:center;gap:6px;flex:none}
.mg-move{box-sizing:border-box;width:24px;height:24px;padding:0;font:inherit;font-size:12px;line-height:1;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center}
.mg-move:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mg-move:disabled{opacity:.3;cursor:default}
.mg-moveGroup{display:inline-flex;align-items:center;gap:3px;flex:none}
.mg-switchLabel{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.mg-list{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.mg-row{display:flex;align-items:center;gap:8px;padding:8px 12px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill)}
.mg-rowDisabled{opacity:.6}
.mg-model{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.mg-modelName{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mg-modelId{font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mg-tag{flex:none;padding:1px 6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.mg-tagWarn{border-color:var(--dsw-alias-state-warn-label);color:var(--dsw-alias-state-warn-label)}
.mg-notice{margin:0;font-size:12px;line-height:18px}
.mg-noticeError{color:var(--dsw-alias-state-error-primary)}
.mg-noticeOk{color:var(--dsw-alias-state-success-primary)}
.mg-empty{margin:0;padding:12px;text-align:center;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg)}
.mg-hint{margin:2px 0 0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.mg-priority{box-sizing:border-box;width:24px;height:24px;padding:0;font:inherit;font-size:13px;line-height:1;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center}
.mg-priority:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-warn-label)}
.mg-priority:disabled{opacity:.3;cursor:default}
.mg-priorityOn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-label) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-label) 12%,transparent);color:var(--dsw-alias-state-warn-label)}
.mg-tagPriority{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-label) 45%,transparent);color:var(--dsw-alias-state-warn-label);background:color-mix(in srgb,var(--dsw-alias-state-warn-label) 10%,transparent)}
.mg-probe{box-sizing:border-box;flex:none;height:24px;padding:0 8px;font:inherit;font-size:11px;line-height:16px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary)}
.mg-probe:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mg-probe:disabled{opacity:.45;cursor:default}
.mg-health{flex:none;display:inline-flex;align-items:center;gap:4px;padding:1px 6px;border:.5px solid transparent;border-radius:var(--dsw-radius-xs);font-size:11px;line-height:16px;white-space:nowrap}
.mg-healthDot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.mg-healthOk{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 38%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent)}
.mg-healthFail{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.mg-healthBusy{color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l3)}
.mg-probeBar{display:flex;align-items:center;gap:8px;margin:0 0 8px;flex-wrap:wrap}
.mg-defaultBar{display:flex;align-items:center;gap:8px;margin:0 0 6px;flex-wrap:wrap}
.mg-defaultField{gap:6px}
.mg-defaultSelect{max-width:260px}
.mg-defaultNow{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);min-width:0}
.mg-groupHealth{font-variant-numeric:tabular-nums}
.mg-probeGroup{margin-right:2px}
.mg-probeSummary{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
`
		const TAG_ID = '@local/dsh-model-guard/section.css'
		if (typeof document !== 'undefined') {
			const selector = `style[data-plugin-css=${JSON.stringify(TAG_ID)}]`
			const existing = document.querySelector(selector)
			if (existing === null) {
				const tag = document.createElement('style')
				tag.dataset.plugin = '@local/dsh-model-guard'
				tag.dataset.pluginCss = TAG_ID
				tag.textContent = CSS
				document.head.appendChild(tag)
			} else if (existing.textContent !== CSS) {
				// 热更新后旧样式可能还挂在页面上：内容不同就地替换，省掉整页刷新。
				existing.textContent = CSS
			}
		}
		//#endregion

		//#region 探测结果存储
		/**
		 * 模型可用性探测结果的共享存储。
		 *
		 * 设置页负责「测」，对话输入框的模型菜单只负责「显示」——两边读同一份数据，
		 * 所以这里用模块级单例：key 为 `provider/model`，value 为
		 * `{ status, latencyMs, error, code, sample }`。结果只活在当前页面会话，
		 * 不发请求、不落盘；刷新页面后自然清空。
		 */
		const probeStore = {
			/** @type {Map<string, object>} */
			map: new Map(),
			/** @type {Set<() => void>} */
			listeners: new Set(),
			/**
			 * 写入一批结果并通知订阅者。
			 * @param {[string, object][]} pairs - 条目与结果。
			 * @returns {void}
			 */
			setMany(pairs) {
				for (const [key, value] of pairs) this.map.set(key, value)
				for (const listener of this.listeners) listener()
			},
			/**
			 * 读取一条结果。
			 * @param {string} key - `provider/model`。
			 * @returns {object | undefined} 结果。
			 */
			get(key) {
				return this.map.get(key)
			},
			/**
			 * 订阅变化。
			 * @param {() => void} listener - 回调。
			 * @returns {() => void} 退订函数。
			 */
			subscribe(listener) {
				this.listeners.add(listener)
				return () => this.listeners.delete(listener)
			},
		}
		//#endregion

		//#region 工具
		/**
		 * 把禁用条目规范化为 `provider/model` 字符串。
		 * @param {string} provider - provider 路由 id。
		 * @param {string} model - 模型 id。
		 * @returns {string} 展示与存储共用的条目。
		 */
		function entryOf(provider, model) {
			return `${provider}/${model}`
		}

		/**
		 * 从设置表单快照里取出字符串数组字段。
		 * @param {unknown} snapshot - 表单控制器快照。
		 * @param {string} field - 字段名。
		 * @returns {string[]} 字段值；缺失或非法时返回空数组。
		 */
		function readList(snapshot, field) {
			const list = snapshot?.value?.[field]
			return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
		}

		/**
		 * 从设置表单快照里取出排序策略字段。
		 * @param {unknown} snapshot - 表单控制器快照。
		 * @param {string} field - 字段名。
		 * @returns {string} `natural` 或 `name`。
		 */
		function readStrategy(snapshot, field) {
			return snapshot?.value?.[field] === 'name' ? 'name' : 'natural'
		}

		/**
		 * 解包 Remote 调用的 `{ ok, value }` 信封。
		 *
		 * 客户端所有 `ctx.remote.*` 调用都返回信封而不是裸值；直接当裸值用会得到
		 * `undefined`（本插件第一版的空白页就是漏了这一步）。
		 * @param {unknown} response - Remote 调用结果。
		 * @returns {unknown} 成功时的 value。
		 * @throws {Error} 调用失败时抛出带 code 的错误。
		 */
		function unwrap(response) {
			if (response !== null && typeof response === 'object' && 'ok' in response) {
				if (response.ok) return response.value
				const code = response.error?.code ?? 'unknown'
				const message = response.error?.message ?? 'remote call failed'
				throw new Error(`${code}: ${message}`)
			}
			return response
		}

		/**
		 * 在数组里把一项移动到新的下标（越界自动夹紧）。
		 * @param {readonly string[]} list - 原数组。
		 * @param {number} from - 原下标。
		 * @param {number} to - 目标下标。
		 * @returns {string[]} 新数组。
		 */
		function moveItem(list, from, to) {
			const next = [...list]
			if (from < 0 || from >= next.length) return next
			const target = Math.min(Math.max(to, 0), next.length - 1)
			const [item] = next.splice(from, 1)
			next.splice(target, 0, item)
			return next
		}

		/**
		 * 把 `ids` 规范化成「完整顺序」：显式项按给定顺序在前，其余按现有顺序补在后面。
		 *
		 * 写回配置时总是提交完整顺序，这样「上移/下移/置顶」的语义稳定，不依赖
		 * 未列出项在 Host 侧的隐含排序。
		 * @param {readonly string[]} current - 当前已列出的显式顺序。
		 * @param {readonly string[]} ids - 当前可见的全部 id（按当前显示顺序）。
		 * @returns {string[]} 完整顺序。
		 */
		function normalizeOrder(current, ids) {
			const known = new Set(ids)
			const result = []
			const seen = new Set()
			for (const id of current) {
				if (!known.has(id) || seen.has(id)) continue
				seen.add(id)
				result.push(id)
			}
			for (const id of ids) {
				if (seen.has(id)) continue
				seen.add(id)
				result.push(id)
			}
			return result
		}
		//#endregion

		//#region 对话模型菜单：默认收起分组
		/**
		 * 增强对话输入框的模型菜单：服务商分组默认收起，点击标题展开。
		 *
		 * 为什么不改官方组件：`dsh-client-ui-model-selection` 在
		 * `conversation.input.model` 槽位注册，组件本身未导出，且安装包在只读
		 * overlay 里不可 patch。这里走**纯 DOM 增强**：官方 `MenuGroup` 渲染出的
		 * 结构带有稳定语义钩子 —— `section[data-menu-group]`、
		 * `[data-menu-group-heading]`、直接子级 `button[role="menuitemradio"]` ——
		 * 因此不依赖任何 hash 过的 class 名。
		 *
		 * 收起状态用属性 + CSS 实现（不插入任何节点），避免与 React 的
		 * reconciliation 打架；键盘导航（上下键）与搜索输入会立即全部展开，
		 * 保证官方原有的键盘/搜索行为不被破坏。
		 */
		const PICKER_CSS_ID = '@local/dsh-model-guard/picker.css'
		const CHEVRON = [
			'data:image/svg+xml;utf8,',
			"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'>",
			"<path d='M2.6 1.2 5.6 4l-3 2.8' fill='none' stroke='black' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/>",
			'</svg>',
		].join('')
		const PICKER_CSS = `
/* 第一组与搜索框之间留一点呼吸 */
[role="menu"]>[data-menu-group]:first-child>[data-menu-group-heading]{margin-top:2px}

/* 收起的分组隐藏模型行 */
[data-menu-group][data-mg-collapsed]>button[role="menuitemradio"]{display:none}

/* 分组之间用细分割线拉开层次 */
[data-menu-group]{position:relative;padding:0}
[data-menu-group]+[data-menu-group]{margin-top:2px}
[data-menu-group]+[data-menu-group]::before{content:'';display:block;height:1px;margin:3px 6px 5px;background:var(--dsw-alias-border-l2);opacity:.55}

/* 分组标题：8px 箭头 + 6px 间隙 → 文字左缘 22px，与模型行缩进对齐 */
[data-menu-group]>[data-menu-group-heading]{display:flex;align-items:center;gap:6px;padding:5px 8px;margin:0 0 1px;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-weight:600;letter-spacing:.02em;cursor:pointer;user-select:none;transition:color .12s ease,background-color .12s ease}
[data-menu-group]>[data-menu-group-heading]:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}
[data-menu-group]>[data-menu-group-heading]::before{content:'';flex:none;width:8px;height:8px;background-color:currentColor;-webkit-mask:url("${CHEVRON}") center/8px 8px no-repeat;mask:url("${CHEVRON}") center/8px 8px no-repeat;opacity:.75;transition:transform .14s ease}
[data-menu-group][data-mg-open]>[data-menu-group-heading]::before{transform:rotate(90deg)}

/* 模型行：与标题文字对齐，圆角悬停 */
[data-menu-group]>button[role="menuitemradio"]{position:relative;min-height:30px;padding:4px 8px 4px 22px;border-radius:var(--dsw-radius-sm);transition:background-color .1s ease}
[data-menu-group]>button[role="menuitemradio"]+button[role="menuitemradio"]{margin-top:1px}
[data-menu-group]>button[role="menuitemradio"]:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}

/* 选中态：左侧强调条 + 品牌色底 + 字重提升 */
[data-menu-group]>button[role="menuitemradio"][aria-checked="true"]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 13%,transparent);font-weight:500}
[data-menu-group]>button[role="menuitemradio"][aria-checked="true"]::before{content:'';position:absolute;inset-inline-start:9px;top:50%;translate:0 -50%;width:2px;height:14px;border-radius:1px;background:var(--dsw-alias-state-business-primary)}
[data-menu-group]>button[role="menuitemradio"][aria-checked="true"]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 19%,transparent)}

/* 分组标题已写明服务商，行内的「服务商 · 」前缀是重复信息，拆出来后隐去 */
button[role="menuitemradio"] .mg-provider,
button[role="menuitemradio"] .mg-sep{display:none}

/* 探测结果徽标：靠右显示可用性与延迟 */
button[role="menuitemradio"]>.mg-optionHealth{flex:none;margin-left:auto;padding:0 5px;font-size:10px;line-height:14px;border-radius:var(--dsw-radius-xs);border:.5px solid transparent;opacity:.95}
button[role="menuitemradio"]>.mg-optionHealth.mg-healthOk{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 34%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 9%,transparent)}
button[role="menuitemradio"]>.mg-optionHealth.mg-healthFail{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent)}
`.trim()

		/**
		 * 菜单里真正带模型按钮的分组。
		 * @param {Element} menu - 菜单容器。
		 * @returns {Element[]} 分组元素。
		 */
		function pickerGroups(menu) {
			const result = []
			for (const section of menu.querySelectorAll('[data-menu-group]')) {
				if (section.querySelector(':scope > button[role="menuitemradio"]') !== null) result.push(section)
			}
			return result
		}

		/**
		 * 设置一个分组的展开状态。
		 * @param {Element} section - `section[data-menu-group]`。
		 * @param {boolean} open - 是否展开。
		 */
		function setGroupOpen(section, open) {
			if (open) {
				section.removeAttribute('data-mg-collapsed')
				section.setAttribute('data-mg-open', '')
			} else {
				section.removeAttribute('data-mg-open')
				section.setAttribute('data-mg-collapsed', '')
			}
		}

		/**
		 * 展开菜单里的全部分组（键盘导航与搜索时使用）。
		 * @param {Element} menu - 菜单容器。
		 */
		function expandAllPickerGroups(menu) {
			for (const section of pickerGroups(menu)) setGroupOpen(section, true)
		}

		/**
		 * 把模型行里的「服务商 · 模型」拆成三段，供 CSS 弱化重复的服务商名。
		 *
		 * 分组标题已经写着服务商，行内再重复一次只是噪音；拆开后 `mg-provider`
		 * 与 `mg-sep` 由样式隐去，模型名本身获得全部注意力。拆分只在行文本确实
		 * 以「服务商 + 分隔符」开头时进行，其它形态（例如以模型 id 开头的长名）
		 * 原样保留。
		 * @param {Element} section - `section[data-menu-group]`。
		 * @returns {void}
		 */
		function splitProviderPrefix(section) {
			const heading = section.querySelector(':scope > [data-menu-group-heading]')
			const provider = heading?.textContent?.trim()
			if (provider === undefined || provider === '') return
			const prefix = `${provider} · `
			for (const button of section.querySelectorAll(':scope > button[role="menuitemradio"]')) {
				const copy = button.firstElementChild
				const label = copy?.firstElementChild
				if (label === null || label === undefined) continue
				const text = label.textContent ?? ''
				if (!text.startsWith(prefix)) continue
				const rest = text.slice(prefix.length)
				if (rest === '') continue
				const doc = label.ownerDocument
				const name = doc.createElement('span')
				name.className = 'mg-name'
				name.textContent = rest
				const sep = doc.createElement('span')
				sep.className = 'mg-sep'
				sep.textContent = '·'
				const providerTag = doc.createElement('span')
				providerTag.className = 'mg-provider'
				providerTag.textContent = provider
				label.textContent = ''
				label.append(providerTag, sep, name)
			}
		}

		/**
		 * 把探测结果写进模型菜单的每一行：可用显示「可用 · 128 ms」，失败显示「不可用」。
		 *
		 * 只在有结果时才加节点；没有结果的行保持官方原样。节点上带
		 * `data-mg-health` 指纹，状态没变就不重写，避免和 React 的
		 * reconciliation 反复拉扯。
		 * @param {Element} menu - `div[role="menu"]` 容器。
		 * @returns {void}
		 */
		function applyHealthBadges(menu) {
			for (const button of menu.querySelectorAll('button[role="menuitemradio"]')) {
				const label = button.querySelector('[data-model-id]')
				if (label === null || label === undefined) continue
				const provider = label.getAttribute('data-provider-id')
				const model = label.getAttribute('data-model-id')
				if (provider === null || model === null) continue
				const result = probeStore.get(`${provider}/${model}`)
				const existing = button.querySelector(':scope > .mg-health')
				if (result === undefined || result.status === 'running') {
					if (existing !== null) existing.remove()
					continue
				}
				const ok = result.status === 'ok'
				const latency = typeof result.latencyMs === 'number' ? ` · ${result.latencyMs} ms` : ''
				const text = ok ? `${HEALTH_LABEL.ok}${latency}` : `${HEALTH_LABEL.fail}${latency}`
				const fingerprint = `${ok ? 'ok' : 'fail'}:${result.latencyMs ?? ''}`
				if (existing !== null) {
					if (existing.dataset.mgHealth === fingerprint) continue
					existing.dataset.mgHealth = fingerprint
					existing.className = `mg-health mg-optionHealth ${ok ? 'mg-healthOk' : 'mg-healthFail'}`
					existing.textContent = text
					existing.title = ok ? (result.sample ?? '') : (result.error ?? '')
					continue
				}
				const doc = button.ownerDocument
				const badge = doc.createElement('span')
				badge.className = `mg-health mg-optionHealth ${ok ? 'mg-healthOk' : 'mg-healthFail'}`
				badge.dataset.mgHealth = fingerprint
				badge.textContent = text
				badge.title = ok ? (result.sample ?? '') : (result.error ?? '')
				const check = button.querySelector(':scope > .mg-check, :scope > span:last-child')
				if (check !== null && check !== undefined) button.insertBefore(badge, check)
				else button.append(badge)
			}
		}

		/**
		 * 增强一个模型菜单；结构不符合预期时静默跳过。
		 * @param {Element} menu - `div[role="menu"]` 容器。
		 * @returns {boolean} 是否完成了增强。
		 */
		function enhanceModelMenu(menu) {
			if (menu.dataset.mgEnhanced === '1') return false
			const sections = pickerGroups(menu)
			if (sections.length === 0) return false
			menu.dataset.mgEnhanced = '1'
			for (const section of sections) {
				// 当前选中模型所在分组默认展开，保证一眼能看到正在用的模型。
				const selected = section.querySelector(':scope > button[role="menuitemradio"][aria-checked="true"]') !== null
				setGroupOpen(section, selected)
				splitProviderPrefix(section)
			}
			// 点标题不能让搜索框失焦：官方在 blur 且 relatedTarget 不在菜单内时关闭菜单，
			// 而标题不是可聚焦元素，不阻止 mousedown 的默认行为就会整菜单关闭。
			menu.addEventListener(
				'mousedown',
				(event) => {
					const raw = event.target
					const target = raw !== null && raw.nodeType === 1 ? raw : raw?.parentElement
					if (target === null || target === undefined || typeof target.closest !== 'function') return
					if (target.closest('[data-menu-group-heading]') === null) return
					event.preventDefault()
					event.stopPropagation()
				},
				true,
			)
			menu.addEventListener(
				'click',
				(event) => {
					// target 可能是文本节点（直接点标题文字时），向上取到元素。
					const raw = event.target
					const target = raw !== null && raw.nodeType === 1 ? raw : raw?.parentElement
					if (target === null || target === undefined || typeof target.closest !== 'function') return
					const heading = target.closest('[data-menu-group-heading]')
					if (heading === null || !menu.contains(heading)) return
					const section = heading.closest('[data-menu-group]')
					if (section === null) return
					// 点击标题只切换折叠，不触发任何选择动作。
					setGroupOpen(section, section.hasAttribute('data-mg-collapsed'))
				},
				true,
			)
			// 键盘导航前先全部展开：官方用 itemRefs 做焦点移动，隐藏项无法聚焦。
			menu.addEventListener('keydown', () => expandAllPickerGroups(menu), true)
			const input = menu.querySelector('input')
			if (input !== null) input.addEventListener('input', () => expandAllPickerGroups(menu), true)
			return true
		}

		/**
		 * 安装模型菜单增强器。
		 * @param {Document} doc - 浏览器文档。
		 * @param {() => boolean} enabled - 当前是否启用（读取设置快照）。
		 * @returns {() => void} 卸载函数。
		 */
		function installPickerEnhancer(doc, enabled) {
			const Observer = doc.defaultView?.MutationObserver
			if (Observer === undefined || doc.body === null || doc.body === undefined) {
				return () => {}
			}
			const cssSelector = 'style[data-plugin-css=' + JSON.stringify(PICKER_CSS_ID) + ']'
			const existing = doc.querySelector(cssSelector)
			if (existing === null) {
				const tag = doc.createElement('style')
				tag.dataset.plugin = '@local/dsh-model-guard'
				tag.dataset.pluginCss = PICKER_CSS_ID
				tag.textContent = PICKER_CSS
				doc.head.appendChild(tag)
			} else if (existing.textContent !== PICKER_CSS) {
				// 插件热更新后旧样式可能还挂在页面上：内容不同就地替换，免得必须整页刷新。
				existing.textContent = PICKER_CSS
			}
			const scan = () => {
				if (!enabled()) return
				for (const menu of doc.querySelectorAll('div[role="menu"]')) {
					// 用模型项 id 形态（`…-model-<n>`）确认这是模型菜单，而非其它下拉。
					if (menu.querySelector('button[id*="-model-"]') === null) continue
					enhanceModelMenu(menu)
					applyHealthBadges(menu)
				}
			}
			scan()
			let scheduled = false
			const observer = new Observer((records) => {
				if (scheduled) return
				const relevant = records.some((record) => {
					for (const node of record.addedNodes) if (node.nodeType === 1) return true
					return false
				})
				if (!relevant) return
				scheduled = true
				// 合并同一帧内的多次变更（流式输出时 DOM 变动很频繁）。
				setTimeout(() => {
					scheduled = false
					scan()
				}, 0)
			})
			observer.observe(doc.body, { childList: true, subtree: true })
			const unsubscribe = probeStore.subscribe(scan)
			return () => {
				observer.disconnect()
				unsubscribe()
			}
		}
		//#endregion

		//#region 目录存储
		/**
		 * 会话模型目录的快照存储。
		 *
		 * 读取 Host 的 `session.modelCatalog()`（已被本插件的 Host 半边过滤与排序），
		 * 因此这里列出的是「可实际选用」的模型、且顺序即选择器顺序；被禁用的服务商
		 * 整体不在其中，所以另用 `listProviders()` 补齐，保证已禁用的服务商仍能重新启用。
		 */
		class CatalogStore {
			/** @param {object} ctx - 客户端插件上下文。 */
			constructor(ctx) {
				this.ctx = ctx
				this.state = {
					status: 'idle',
					groups: [],
					providers: [],
					error: null,
					// 记忆最近一次成功读取的模型名与显示顺序：被禁用的模型会被 Host
					// 过滤掉，必须靠它把行补回来，否则禁用后就再也无法启用。
					known: { names: new Map(), order: new Map() },
				}
				this.listeners = new Set()
				this.loading = undefined
			}

			/** @returns {object} 当前快照（引用稳定）。 */
			getSnapshot = () => this.state

			/**
			 * 订阅快照变化。
			 * @param {() => void} listener - 变化回调。
			 * @returns {() => void} 取消订阅。
			 */
			subscribe = (listener) => {
				this.listeners.add(listener)
				return () => {
					this.listeners.delete(listener)
				}
			}

			/** @param {object} next - 新快照。 */
			publish(next) {
				this.state = next
				for (const listener of this.listeners) listener()
			}

			/**
			 * 记录本次目录里的模型名与每个服务商的模型顺序，供下次补回被禁用的行。
			 * @param {readonly object[]} groups - 本次目录分组。
			 */
			remember(groups) {
				const names = new Map(this.state.known.names)
				const order = new Map(this.state.known.order)
				for (const group of groups) {
					const ids = []
					for (const model of group.models ?? []) {
						const entry = `${group.id}/${model.id}`
						names.set(entry, model.name)
						ids.push(model.id)
					}
					order.set(group.id, ids)
				}
				return { names, order }
			}

			/**
			 * 读取一次目录；并发调用合并为一次在途请求。
			 *
			 * **已有数据时不切换到 `loading`**：那会让列表整块被替换成一行提示，
			 * 页面高度骤降、滚动位置被拉回顶部（每次点开关都会触发一次刷新）。
			 * @returns {Promise<void>} 读取完成后 settle。
			 */
			load() {
				if (this.loading !== undefined) return this.loading
				const hasData = this.state.groups.length > 0
				this.publish({ ...this.state, status: hasData ? 'ready' : 'loading', error: null })
				this.loading = Promise.resolve()
					.then(async () => {
						const [catalogResponse, providersResponse] = await Promise.all([
							this.ctx.remote.session.modelCatalog(),
							this.ctx.remote.llm.listProviders(),
						])
						const catalog = unwrap(catalogResponse)
						const providers = unwrap(providersResponse)
						const groups = Array.isArray(catalog?.groups) ? catalog.groups : []
						this.publish({
							status: 'ready',
							groups,
							providers: Array.isArray(providers)
								? providers.map((provider) => ({ id: provider.id, name: provider.name ?? provider.id }))
								: [],
							error: null,
							known: this.remember(groups),
						})
					})
					.catch((error) => {
						// 刷新失败时保留上一份数据，只记录错误，避免列表被清空。
						this.publish({ ...this.state, status: this.state.groups.length > 0 ? 'ready' : 'error', error })
					})
					.then(() => {
						this.loading = undefined
					})
				return this.loading
			}
		}
		//#endregion

		//#region 页面
		/**
		 * 模型禁用与排序设置页。
		 *
		 * props 由槽位约定注入：`hooks` 的每个 key 转成 `use<PascalKey>(selector)`，
		 * 其余字段按原样传入。
		 * @param {object} props - 槽位注入的 hooks、动作与本地化函数。
		 * @returns {object} 页面元素。
		 */
		function ModelGuardSection(props) {
			const { useForm, useCatalog, writeField, loadCatalog, t } = props
			const form = useForm((snapshot) => snapshot)
			const catalog = useCatalog((snapshot) => snapshot)
			const [query, setQuery] = react.useState('')
			const [notice, setNotice] = react.useState(null)
			// 默认全部收起：只记住「被展开」的服务商，未记录即收起。
			const [expanded, setExpanded] = react.useState(() => new Set())

			const disabledModels = react.useMemo(() => new Set(readList(form, 'disabledModels')), [form])
			const disabledProviders = react.useMemo(() => new Set(readList(form, 'disabledProviders')), [form])
			const providerOrder = react.useMemo(() => readList(form, 'providerOrder'), [form])
			const modelOrder = react.useMemo(() => readList(form, 'modelOrder'), [form])
			const priorityModels = react.useMemo(() => readList(form, 'priorityModels'), [form])
			const providerSort = readStrategy(form, 'providerSort')
			const modelSort = readStrategy(form, 'modelSort')
			const pickerCollapse = form?.value?.collapsePickerGroups !== false
			const writable = form?.writable === true
			const formReady = form?.status === 'ready'
			const editable = writable && formReady

			// 首次渲染时读一次目录；未打开过的页面不在后台拉取。
			react.useEffect(() => {
				if (catalog?.status === 'idle') loadCatalog()
			}, [catalog?.status, loadCatalog])

			const catalogGroups = catalog?.groups ?? []
			const catalogProviders = catalog?.providers ?? []
			const known = catalog?.known

			// 服务商清单 = 目录里的服务商 ∪ 已知 provider ∪ 已禁用的服务商
			// （被整体禁用的服务商不会出现在目录里，必须靠后两者补回来才能重新启用）。
			//
			// 模型行同理：Host 会把被禁用的模型从 `listModels()` 里滤掉，所以它们不会
			// 出现在目录里；这里用上次成功读取时记住的名字与位置把它们补回，
			// 否则用户禁用之后就再也点不到那一行、无法重新启用。
			const providerRows = react.useMemo(() => {
				const byId = new Map()
				for (const group of catalogGroups) {
					byId.set(group.id, { id: group.id, name: group.name ?? group.id, models: [...(group.models ?? [])] })
				}
				for (const provider of catalogProviders) {
					if (!byId.has(provider.id)) byId.set(provider.id, { id: provider.id, name: provider.name, models: [] })
				}
				for (const id of disabledProviders) {
					if (!byId.has(id)) byId.set(id, { id, name: id, models: [] })
				}

				if (disabledModels.size > 0) {
					for (const entry of disabledModels) {
						const slash = entry.indexOf('/')
						if (slash <= 0) continue
						const providerId = entry.slice(0, slash)
						const modelId = entry.slice(slash + 1)
						const row = byId.get(providerId)
						// 服务商本身不在清单里（或被整体禁用）时无需补行。
						if (row === undefined || disabledProviders.has(providerId)) continue
						if (row.models.some((model) => model.id === modelId)) continue
						const name = known?.names?.get(entry) ?? modelId
						// 按上次记住的顺序插入，避免行在列表里跳位置。
						const remembered = known?.order?.get(providerId) ?? []
						const rank = remembered.indexOf(modelId)
						let at = row.models.length
						if (rank >= 0) {
							for (let index = 0; index < row.models.length; index++) {
								const other = remembered.indexOf(row.models[index].id)
								if (other > rank || other < 0) {
									at = index
									break
								}
							}
						}
						row.models.splice(at, 0, { id: modelId, name })
					}
				}
				return [...byId.values()]
			}, [catalogGroups, catalogProviders, disabledProviders, disabledModels, known])

			const needle = query.trim().toLowerCase()
			const visibleProviders = react.useMemo(() => {
				if (needle === '') return providerRows
				return providerRows
					.map((provider) => ({
						...provider,
						models: provider.models.filter(
							(model) => model.name.toLowerCase().includes(needle) || model.id.toLowerCase().includes(needle),
						),
					}))
					.filter(
						(provider) =>
							provider.models.length > 0 ||
							provider.name.toLowerCase().includes(needle) ||
							provider.id.toLowerCase().includes(needle),
					)
			}, [providerRows, needle])

			const write = react.useCallback(
				async (field, value) => {
					setNotice(null)
					let accepted = false
					try {
						accepted = await writeField(field, value)
					} catch (_error) {}
					setNotice(accepted ? 'saved' : 'saveFailed')
				},
				[writeField],
			)

			const toggleModel = (provider, model) => {
				const entry = entryOf(provider, model)
				const next = disabledModels.has(entry)
					? [...disabledModels].filter((item) => item !== entry)
					: [...disabledModels, entry]
				write('disabledModels', next)
			}

			const toggleProvider = (provider) => {
				const next = disabledProviders.has(provider)
					? [...disabledProviders].filter((item) => item !== provider)
					: [...disabledProviders, provider]
				write('disabledProviders', next)
			}

			/**
			 * 切换「优先」标记；新标记追加到列表末尾，即优先级最低的优先模型。
			 * @param {string} providerId - provider id。
			 * @param {string} modelId - 模型 id。
			 * @returns {void}
			 */
			const togglePriority = (providerId, modelId) => {
				const entry = entryOf(providerId, modelId)
				write('priorityModels', priorityModels.includes(entry)
					? priorityModels.filter((item) => item !== entry)
					: [...priorityModels, entry])
			}

			/** 移动服务商；总是写回完整顺序。 */
			const moveProvider = (providerId, delta) => {
				const ids = providerRows.map((row) => row.id)
				const full = normalizeOrder(providerOrder, ids)
				const from = full.indexOf(providerId)
				if (from < 0) return
				const to = delta === 'top' ? 0 : from + delta
				write('providerOrder', moveItem(full, from, to))
			}

			/** 移动模型；总是写回该服务商的完整模型顺序。 */
			const moveModel = (providerId, modelId, delta) => {
				const provider = providerRows.find((row) => row.id === providerId)
				if (provider === undefined) return
				const ids = provider.models.map((model) => entryOf(providerId, model.id))
				const scoped = modelOrder.filter((entry) => entry.startsWith(`${providerId}/`))
				const full = normalizeOrder(scoped, ids)
				const from = full.indexOf(entryOf(providerId, modelId))
				if (from < 0) return
				const to = delta === 'top' ? 0 : from + delta
				const moved = moveItem(full, from, to)
				// 只替换本服务商那段，保留其他服务商的既有顺序。
				const others = modelOrder.filter((entry) => !entry.startsWith(`${providerId}/`))
				write('modelOrder', [...others, ...moved])
			}

			const resetOrder = () => {
				setNotice(null)
				Promise.resolve()
					.then(() => writeField('providerOrder', []))
					.then((ok1) =>
						writeField('modelOrder', []).then((ok2) => {
							setNotice(ok1 !== false && ok2 !== false ? 'saved' : 'saveFailed')
						}),
					)
					.catch(() => setNotice('saveFailed'))
			}

			//#region 模型可用性探测
			// 结果统一放在 probeStore 里：对话输入框的模型菜单读同一份数据，
			// 保证设置页「测」完，选择器里立刻能看到可用性与延迟。
			const [, forceProbe] = react.useState(0)
			const [probing, setProbing] = react.useState(false)
			const [probeUnsupported, setProbeUnsupported] = react.useState(false)
			react.useEffect(() => probeStore.subscribe(() => forceProbe((value) => value + 1)), [])
			const probe = Object.fromEntries(probeStore.map)

			// 探测参数读自设置表单（Host 侧同样会夹到合法区间，这里只做展示与请求透传）。
			const probeConcurrency = react.useMemo(() => {
				const raw = Number(form?.value?.probeConcurrency)
				if (!Number.isFinite(raw)) return 3
				return Math.min(PROBE_MAX_CONCURRENCY, Math.max(PROBE_MIN_CONCURRENCY, Math.round(raw)))
			}, [form])
			const probeTimeoutMs = react.useMemo(() => {
				const raw = Number(form?.value?.probeTimeoutMs)
				if (!Number.isFinite(raw)) return 10000
				return Math.min(60000, Math.max(1000, Math.round(raw)))
			}, [form])

			// 默认模型：Host 侧 agentDefaultModel 的真实值（不是本插件的配置）。
			const [defaultSelection, setDefaultSelection] = react.useState(null)
			const [defaultUnsupported, setDefaultUnsupported] = react.useState(false)
			const [defaultBusy, setDefaultBusy] = react.useState(false)
			const [defaultNotice, setDefaultNotice] = react.useState(null)
			const [defaultPick, setDefaultPick] = react.useState('')

			const loadDefault = react.useCallback(async () => {
				try {
					const response = await fetch(DEFAULT_ENDPOINT, { method: 'GET' })
					if (response.status === 404 || response.status === 405 || response.status === 501) {
						setDefaultUnsupported(true)
						return
					}
					if (!response.ok) throw new Error(`HTTP ${response.status}`)
					const payload = await response.json()
					setDefaultUnsupported(false)
					setDefaultSelection(payload?.provider && payload?.model
						? { provider: payload.provider, model: payload.model }
						: null)
				} catch (_error) {
					setDefaultUnsupported(true)
				}
			}, [])

			react.useEffect(() => { loadDefault() }, [loadDefault])
			// Host 的默认值回来后同步下拉框（用户自己改过的选择不覆盖）。
			react.useEffect(() => {
				if (defaultSelection === null) return
				setDefaultPick(entryOf(defaultSelection.provider, defaultSelection.model))
			}, [defaultSelection])

			const applyDefault = react.useCallback(async (target) => {
				if (defaultBusy) return
				setDefaultBusy(true)
				setDefaultNotice(null)
				try {
					const response = await fetch(DEFAULT_ENDPOINT, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ provider: target.provider, model: target.model }),
					})
					if (response.status === 404 || response.status === 405 || response.status === 501) {
						setDefaultUnsupported(true)
						return
					}
					const payload = await response.json().catch(() => ({}))
					if (!response.ok) throw new Error(payload?.message ?? payload?.error ?? `HTTP ${response.status}`)
					setDefaultSelection({ provider: target.provider, model: target.model })
					setDefaultNotice({ kind: 'ok', key: 'defaultModelSaved', params: { name: target.label ?? target.model } })
				} catch (error) {
					setDefaultNotice({ kind: 'error', key: 'defaultModelFailed', params: { message: error?.message ?? String(error) } })
				} finally {
					setDefaultBusy(false)
				}
			}, [defaultBusy])

			const applyProbe = react.useCallback((updates) => {
				probeStore.setMany(updates)
			}, [])

			/**
			 * 探测一批模型。
			 *
			 * 分片发送而不是一次性发完：单片内并发由 Host 控制（3 路），片与片之间
			 * 串行，结果边到边刷新，长列表不会让用户干等一个几十秒的请求。
			 * @param {{ provider: string, model: string }[]} targets - 待探测模型。
			 * @returns {Promise<void>} 全部完成后 settle。
			 */
			const runProbe = react.useCallback(
				async (targets) => {
					if (targets.length === 0 || probing) return
					setProbing(true)
					// 每片 = 并发 × 2：既能让结果边到边刷新，又不会发出过多小请求。
					const batchSize = Math.max(2, probeConcurrency * 2)
					applyProbe(targets.map((target) => [entryOf(target.provider, target.model), { status: 'running' }]))
					try {
						for (let index = 0; index < targets.length; index += batchSize) {
							const slice = targets.slice(index, index + batchSize)
							let payload
							try {
								const response = await fetch(PROBE_ENDPOINT, {
									method: 'POST',
									headers: { 'content-type': 'application/json' },
									body: JSON.stringify({ items: slice, concurrency: probeConcurrency, timeoutMs: probeTimeoutMs }),
								})
								if (response.status === 404 || response.status === 405) {
									setProbeUnsupported(true)
									applyProbe(slice.map((target) => [entryOf(target.provider, target.model), { status: 'unsupported' }]))
									return
								}
								if (!response.ok) throw new Error(`HTTP ${response.status}`)
								payload = await response.json()
							} catch (error) {
								const message = error?.message ?? String(error)
								applyProbe(slice.map((target) => [entryOf(target.provider, target.model), { status: 'fail', error: message }]))
								continue
							}
							const results = Array.isArray(payload?.results) ? payload.results : []
							applyProbe(
								results.map((result) => [
									entryOf(result.provider, result.model),
									result.ok
										? { status: 'ok', latencyMs: result.latencyMs, sample: result.sample }
										: { status: 'fail', latencyMs: result.latencyMs, error: result.error, code: result.code },
								]),
							)
						}
					} finally {
						setProbing(false)
					}
				},
				[applyProbe, probing, probeConcurrency, probeTimeoutMs],
			)

			/** 可探测的模型：跳过被整体禁用的服务商（它们的模型不参与选择）。 */
			const probeTargets = react.useMemo(() => {
				const targets = []
				for (const provider of providerRows) {
					if (disabledProviders.has(provider.id)) continue
					for (const model of provider.models) targets.push({ provider: provider.id, model: model.id })
				}
				return targets
			}, [providerRows, disabledProviders])

			/**
			 * 统计一组模型的探测状态。
			 * @param {{ provider: string, model: string }[]} targets - 待统计模型。
			 * @returns {{ ok: number, fail: number, running: number, total: number }} 统计结果。
			 */
			const summarize = (targets) => {
				let ok = 0
				let fail = 0
				let running = 0
				for (const target of targets) {
					const result = probe[entryOf(target.provider, target.model)]
					if (result === undefined) continue
					if (result.status === 'ok') ok += 1
					else if (result.status === 'running') running += 1
					else if (result.status === 'fail') fail += 1
				}
				return { ok, fail, running, total: targets.length }
			}

			const probeStats = summarize(probeTargets)

			/** 已有结果（可用 + 不可用）的条数，用于「可用 x/y」的 y。 */
			const probed = probeStats.ok + probeStats.fail

			/**
			 * 渲染一条探测结果的状态标签。
			 * @param {{ status: string, latencyMs?: number, error?: string, sample?: string } | undefined} result - 探测结果。
			 * @returns {object | null} 标签元素；未探测时为 null。
			 */
			const healthChip = (result) => {
				if (result === undefined) return null
				if (result.status === 'running') {
					return jsx.jsxs('span', {
						className: 'mg-health mg-healthBusy',
						children: [jsx.jsx('span', { className: 'mg-healthDot', 'aria-hidden': 'true' }), t('probing')],
					})
				}
				if (result.status === 'ok') {
					const suffix = typeof result.latencyMs === 'number' ? ` · ${result.latencyMs} ms` : ''
					return jsx.jsxs('span', {
						className: 'mg-health mg-healthOk',
						title: result.sample ?? '',
						children: [jsx.jsx('span', { className: 'mg-healthDot', 'aria-hidden': 'true' }), `${t('probeOk')}${suffix}`],
					})
				}
				if (result.status === 'fail') {
					return jsx.jsxs('span', {
						className: 'mg-health mg-healthFail',
						title: result.error ?? '',
						children: [
							jsx.jsx('span', { className: 'mg-healthDot', 'aria-hidden': 'true' }),
							typeof result.latencyMs === 'number' && result.latencyMs > 0
								? `${t('probeFail')} · ${result.latencyMs} ms`
								: t('probeFail'),
						],
					})
				}
				return null
			}
			//#endregion

			// 首次读取就失败时才整页报错；刷新失败保留已有列表（错误由下方 notice 呈现）。
			if (catalog?.status === 'error' && catalogGroups.length === 0) {
				return jsx.jsxs('section', {
					className: 'mg-section',
					children: [
						jsx.jsx('h2', { className: 'mg-title', children: t('nav') }),
						jsx.jsx('p', { className: 'mg-intro', children: t('loadFailed') }),
						jsx.jsx(primitives.Button, { variant: 'outline', onClick: () => loadCatalog(), children: t('retry') }),
					],
				})
			}

			// 默认可选模型：跳过被整体禁用的服务商，以及被单独禁用的模型。
			const defaultOptions = providerRows
				.map((provider) => ({
					provider,
					models: disabledProviders.has(provider.id)
						? []
						: provider.models.filter((model) => !disabledModels.has(entryOf(provider.id, model.id))),
				}))
				.filter((group) => group.models.length > 0)
			const defaultEntry = defaultSelection === null ? '' : entryOf(defaultSelection.provider, defaultSelection.model)
			const labelOfModel = (providerId, modelId) => {
				const provider = providerRows.find((row) => row.id === providerId)
				const model = provider?.models.find((item) => item.id === modelId)
				return model?.name ?? `${providerId}/${modelId}`
			}
			const defaultBar = jsx.jsxs('div', {
				className: 'mg-defaultBar',
				children: [
					jsx.jsxs('label', {
						className: 'mg-sortField mg-defaultField',
						children: [
							t('defaultModelLabel'),
							jsx.jsxs('select', {
								className: 'mg-select mg-defaultSelect',
								value: defaultPick,
								disabled: defaultUnsupported || defaultOptions.length === 0,
								onChange: (event) => {
									setDefaultPick(event.target.value)
									setDefaultNotice(null)
								},
								children: [
									defaultEntry === '' ? jsx.jsx('option', { value: '', children: '—' }) : null,
									...defaultOptions.map(({ provider, models }) =>
										jsx.jsx(
											'optgroup',
											{
												label: provider.name,
												children: models.map((model) =>
													jsx.jsx(
														'option',
														{ value: entryOf(provider.id, model.id), children: model.name },
														`default-${provider.id}-${model.id}`,
													),
												),
											},
											`default-group-${provider.id}`,
										),
									),
								],
							}),
						],
					}),
					jsx.jsx('button', {
						type: 'button',
						className: 'mg-probe',
						disabled: defaultBusy || defaultUnsupported || defaultPick === '' || defaultPick === defaultEntry,
						onClick: () => {
							const slash = defaultPick.indexOf('/')
							if (slash <= 0) return
							const providerId = defaultPick.slice(0, slash)
							const modelId = defaultPick.slice(slash + 1)
							applyDefault({ provider: providerId, model: modelId, label: labelOfModel(providerId, modelId) })
						},
						children: defaultBusy ? t('defaultModelApplying') : t('defaultModelApply'),
					}),
					jsx.jsx('span', {
						className: 'mg-defaultNow',
						children: defaultUnsupported
							? t('defaultModelUnsupported')
							: defaultNotice !== null
								? t(defaultNotice.key, defaultNotice.params)
								: defaultEntry === ''
									? t('defaultModelHint')
									: `${t('defaultModelLabel')}: ${labelOfModel(defaultSelection.provider, defaultSelection.model)}`,
					}),
				],
			})

			const sortBar = jsx.jsxs('div', {
				className: 'mg-sortBar',
				children: [
					jsx.jsxs('label', {
						className: 'mg-sortField',
						children: [
							t('providerSortLabel'),
							jsx.jsxs('select', {
								className: 'mg-select',
								value: providerSort,
								disabled: !editable,
								onChange: (event) => write('providerSort', event.target.value),
								children: [
									jsx.jsx('option', { value: 'natural', children: t('sortNatural') }),
									jsx.jsx('option', { value: 'name', children: t('sortName') }),
								],
							}),
						],
					}),
					jsx.jsxs('label', {
						className: 'mg-sortField',
						children: [
							t('modelSortLabel'),
							jsx.jsxs('select', {
								className: 'mg-select',
								value: modelSort,
								disabled: !editable,
								onChange: (event) => write('modelSort', event.target.value),
								children: [
									jsx.jsx('option', { value: 'natural', children: t('sortNatural') }),
									jsx.jsx('option', { value: 'name', children: t('sortName') }),
								],
							}),
						],
					}),
					jsx.jsxs('label', {
						className: 'mg-sortField',
						children: [
							jsx.jsx(primitives.Switch, {
								checked: pickerCollapse,
								label: t('pickerCollapse'),
								disabled: !editable,
								onChange: () => write('collapsePickerGroups', !pickerCollapse),
							}),
							t('pickerCollapse'),
						],
					}),
					jsx.jsxs('label', {
						className: 'mg-sortField',
						children: [
							t('probeConcurrencyLabel'),
							jsx.jsx('select', {
								className: 'mg-select',
								value: String(probeConcurrency),
								disabled: !editable,
								onChange: (event) => write('probeConcurrency', Number(event.target.value)),
								children: [1, 2, 3, 4, 6, 8].map((value) =>
									jsx.jsx('option', { value: String(value), children: String(value) }, 'concurrency-' + value),
								),
							}),
						],
					}),
					jsx.jsxs('label', {
						className: 'mg-sortField',
						children: [
							t('probeTimeoutLabel'),
							jsx.jsx('select', {
								className: 'mg-select',
								value: String(probeTimeoutMs),
								disabled: !editable,
								onChange: (event) => write('probeTimeoutMs', Number(event.target.value)),
								children: PROBE_TIMEOUT_CHOICES.map((value) =>
									jsx.jsx('option', { value: String(value), children: Math.round(value / 1000) + ' s' }, 'timeout-' + value),
								),
							}),
						],
					}),
					jsx.jsx('button', {
						type: 'button',
						className: 'mg-reset',
						onClick: () => setExpanded((previous) => {
							// 全部已展开时改为全部收起，否则全部展开。
							const allOpen = providerRows.length > 0 && providerRows.every((row) => previous.has(row.id))
							return allOpen ? new Set() : new Set(providerRows.map((row) => row.id))
						}),
						children: providerRows.length > 0 && providerRows.every((row) => expanded.has(row.id))
							? t('collapseAll')
							: t('expandAll'),
					}),
					jsx.jsx('button', {
						type: 'button',
						className: 'mg-reset',
						disabled: !editable || (providerOrder.length === 0 && modelOrder.length === 0),
						onClick: resetOrder,
						children: t('resetOrder'),
					}),
					jsx.jsx('p', { className: 'mg-sortHint', children: t('sortHint') }),
					jsx.jsx('p', { className: 'mg-sortHint', children: t('priorityHint') }),
				],
			})

			// 只有「一次都没读到过」才显示加载态；已有数据时的刷新保留列表，
			// 否则每次点开关都会让列表塌成一行、把滚动位置弹回顶部。
			const loading = (catalog?.status === 'loading' || catalog?.status === 'idle') && catalogGroups.length === 0
			const body = loading
				? jsx.jsx('p', { className: 'mg-empty', children: t('loading') })
				: visibleProviders.length === 0
					? jsx.jsx('p', { className: 'mg-empty', children: providerRows.length === 0 ? t('empty') : t('noMatch') })
					: visibleProviders.map((provider) => {
							const providerOff = disabledProviders.has(provider.id)
							const providerIndex = providerRows.findIndex((row) => row.id === provider.id)
							// 搜索时只隐藏移动按钮，避免在过滤后的列表里误判首尾。
							const searching = needle !== ''
							// 本组的探测目标与状态小计（用于标题右侧的「可用 x/y」）。
							const groupTargets = providerOff
								? []
								: provider.models.map((model) => ({ provider: provider.id, model: model.id }))
							const groupStats = summarize(groupTargets)
							// 搜索时自动展开，否则结果会被收起的分组藏起来。
							const open = searching || expanded.has(provider.id)
							const toggle = () => {
								setExpanded((previous) => {
									const next = new Set(previous)
									if (next.has(provider.id)) next.delete(provider.id)
									else next.add(provider.id)
									return next
								})
							}
							return jsx.jsxs(
								'div',
								{
									className: 'mg-group',
									children: [
										jsx.jsxs('div', {
											className: 'mg-groupHead',
											children: [
												jsx.jsx('h3', {
													className: 'mg-groupTitle',
													children: jsx.jsxs('button', {
														type: 'button',
														className: 'mg-groupToggle',
														'aria-expanded': open,
														'aria-label': `${open ? t('collapse') : t('expand')} ${provider.name}`,
														title: open ? t('collapse') : t('expand'),
														onClick: toggle,
														children: [
															jsx.jsx('span', {
																className: `mg-caret${open ? ' mg-caretOpen' : ''}`,
																'aria-hidden': 'true',
																children: '▶',
															}),
															jsx.jsx('span', { className: 'mg-groupName', children: provider.name }),
															jsx.jsx('span', {
																className: 'mg-groupMeta',
																children: providerOff
																	? t('providerTag')
																	: t('modelTotal', { count: provider.models.length }),
															}),
															groupStats.ok + groupStats.fail === 0
																? null
																: jsx.jsx('span', {
																		className: 'mg-health mg-groupHealth ' + (groupStats.fail === 0 ? 'mg-healthOk' : groupStats.ok === 0 ? 'mg-healthFail' : 'mg-healthBusy'),
																		children: groupStats.ok + '/' + (groupStats.ok + groupStats.fail),
																	}),
														],
													}),
												}),
												jsx.jsxs('div', {
													className: 'mg-groupActions',
													children: [
														jsx.jsx('button', {
															type: 'button',
															className: 'mg-probe mg-probeGroup',
															title: t('probeProviderAria', { provider: provider.name }),
															'aria-label': t('probeProviderAria', { provider: provider.name }),
															disabled: probing || providerOff || provider.models.length === 0,
															onClick: () => runProbe(groupTargets),
															children: t('probeProvider'),
														}),
														jsx.jsx('button', {
															type: 'button',
															className: 'mg-move',
															title: t('moveTop'),
															'aria-label': `${t('moveTop')} ${provider.name}`,
															disabled: !editable || searching || providerIndex <= 0,
															onClick: () => moveProvider(provider.id, 'top'),
															children: '⤒',
														}),
														jsx.jsx('button', {
															type: 'button',
															className: 'mg-move',
															title: t('moveUp'),
															'aria-label': `${t('moveUp')} ${provider.name}`,
															disabled: !editable || searching || providerIndex <= 0,
															onClick: () => moveProvider(provider.id, -1),
															children: '↑',
														}),
														jsx.jsx('button', {
															type: 'button',
															className: 'mg-move',
															title: t('moveDown'),
															'aria-label': `${t('moveDown')} ${provider.name}`,
															disabled: !editable || searching || providerIndex < 0 || providerIndex >= providerRows.length - 1,
															onClick: () => moveProvider(provider.id, 1),
															children: '↓',
														}),
														jsx.jsx('span', { className: 'mg-switchLabel', children: t('disableProvider') }),
														jsx.jsx(primitives.Switch, {
															checked: !providerOff,
															label: `${providerOff ? t('enableProvider') : t('disableProvider')} ${provider.name}`,
															disabled: !editable,
															onChange: () => toggleProvider(provider.id),
														}),
													],
												}),
											],
										}),
										providerOff
											? jsx.jsx('p', {
													className: 'mg-hint',
													children: t('hiddenByProvider', { count: provider.models.length }),
												})
											: null,
										providerOff || provider.models.length === 0 || !open
											? null
											: jsx.jsx('ul', {
													className: 'mg-list',
													children: provider.models.map((model, modelIndex) => {
														const entry = entryOf(provider.id, model.id)
														const modelOff = disabledModels.has(entry)
														const prioritized = priorityModels.includes(entry)
														return jsx.jsxs(
															'li',
															{
																className: `mg-row${modelOff ? ' mg-rowDisabled' : ''}`,
																children: [
																	jsx.jsxs('div', {
																		className: 'mg-moveGroup',
																		children: [
																			jsx.jsx('button', {
																				type: 'button',
																				className: `mg-priority${prioritized ? ' mg-priorityOn' : ''}`,
																				title: prioritized ? t('priorityOn') : t('priority'),
																				'aria-label': `${prioritized ? t('priorityOn') : t('priority')} ${model.name}`,
																				'aria-pressed': prioritized,
																				disabled: !editable,
																				onClick: () => togglePriority(provider.id, model.id),
																				children: prioritized ? '★' : '☆',
																			}),
																			jsx.jsx('button', {
																				type: 'button',
																				className: 'mg-move',
																				title: t('moveTop'),
																				'aria-label': `${t('moveTop')} ${model.name}`,
																				disabled: !editable || searching || modelIndex <= 0,
																				onClick: () => moveModel(provider.id, model.id, 'top'),
																				children: '⤒',
																			}),
																			jsx.jsx('button', {
																				type: 'button',
																				className: 'mg-move',
																				title: t('moveUp'),
																				'aria-label': `${t('moveUp')} ${model.name}`,
																				disabled: !editable || searching || modelIndex <= 0,
																				onClick: () => moveModel(provider.id, model.id, -1),
																				children: '↑',
																			}),
																			jsx.jsx('button', {
																				type: 'button',
																				className: 'mg-move',
																				title: t('moveDown'),
																				'aria-label': `${t('moveDown')} ${model.name}`,
																				disabled: !editable || searching || modelIndex >= provider.models.length - 1,
																				onClick: () => moveModel(provider.id, model.id, 1),
																				children: '↓',
																			}),
																		],
																	}),
																	jsx.jsxs('div', {
																		className: 'mg-model',
																		children: [
																			jsx.jsx('span', { className: 'mg-modelName', children: model.name }),
																			jsx.jsx('span', { className: 'mg-modelId', children: entry }),
																		],
																	}),
																	healthChip(probe[entry]),
																	prioritized
																		? jsx.jsx('span', { className: 'mg-tag mg-tagPriority', children: t('priorityTag') })
																		: null,
																	modelOff
																		? jsx.jsx('span', { className: 'mg-tag mg-tagWarn', children: t('disabledTag') })
																		: null,
																	jsx.jsx('button', {
																		type: 'button',
																		className: 'mg-probe',
																		title: t('probeAria', { name: model.name }),
																		'aria-label': t('probeAria', { name: model.name }),
																		disabled: probing,
																		onClick: () => runProbe([{ provider: provider.id, model: model.id }]),
																		children: t('probe'),
																	}),
																	jsx.jsx(primitives.Switch, {
																		checked: !modelOff,
																		label: `${modelOff ? t('enable') : t('disable')} ${model.name}`,
																		disabled: !editable,
																		onChange: () => toggleModel(provider.id, model.id),
																	}),
																],
															},
															entry,
														)
													}),
												}),
									],
								},
								provider.id,
							)
						})

			return jsx.jsxs('section', {
				className: 'mg-section',
				children: [
					jsx.jsx('h2', { className: 'mg-title', children: t('nav') }),
					jsx.jsx('p', { className: 'mg-intro', children: t('intro') }),
					writable ? null : jsx.jsx('p', { className: 'mg-notice mg-noticeError', children: t('unavailable') }),
					jsx.jsxs('div', {
						className: 'mg-toolbar',
						children: [
							jsx.jsx('input', {
								className: 'mg-search',
								type: 'search',
								value: query,
								placeholder: t('search'),
								'aria-label': t('search'),
								onChange: (event) => setQuery(event.target.value),
							}),
							jsx.jsx('span', {
								className: 'mg-count',
								children: t('counts', { models: disabledModels.size, providers: disabledProviders.size }),
							}),
							jsx.jsx('button', {
								type: 'button',
								className: 'mg-probe',
								disabled: probing || probeTargets.length === 0,
								onClick: () => runProbe(probeTargets),
								children: probing ? t('probing') : t('probeAll'),
							}),
						],
					}),
					sortBar,
					defaultBar,
					jsx.jsxs('div', {
						className: 'mg-probeBar',
						children: [
							jsx.jsx('span', {
								className: 'mg-probeSummary',
								children: probeUnsupported
									? t('probeUnsupported')
									: probed === 0
										? t('probeHint')
										: t('probeSummary', { ok: probeStats.ok, total: probed }),
							}),
							probeStats.running > 0
								? jsx.jsxs('span', {
										className: 'mg-health mg-healthBusy',
										children: [
											jsx.jsx('span', { className: 'mg-healthDot', 'aria-hidden': 'true' }),
											t('probing'),
										],
									})
								: null,
						],
					}),
					notice === null
						? null
						: jsx.jsx('p', {
								className: `mg-notice ${notice === 'saved' ? 'mg-noticeOk' : 'mg-noticeError'}`,
								children: t(notice),
							}),
					body,
				],
			})
		}
		//#endregion

		//#region 插件
		/** 本插件依赖的客户端服务。 */
		const inject = ['slots', 'locale', 'remote', 'remote.session', 'remote.llm', 'configForms']

		/** Host 侧插件行 id，同时也是 settings 命名空间。 */
		const NAMESPACE = 'model-guard'

		/**
		 * 注册模型禁用与排序设置页。
		 * @param {object} ctx - 客户端插件上下文。
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'model-guard: 文案')

			const form = ctx.configForms.get(NAMESPACE)
			const catalog = new CatalogStore(ctx)
			const t = ctx.locale.bind(NS)
			HEALTH_LABEL.ok = t('probeOk')
			HEALTH_LABEL.fail = t('probeFail')

			// 对话输入框的模型菜单增强：默认收起服务商分组（可在设置页关闭）。
			if (typeof document !== 'undefined') {
				ctx.effect(
					() =>
						installPickerEnhancer(document, () => form.getSnapshot()?.value?.collapsePickerGroups !== false),
					'model-guard: 对话模型菜单默认收起',
				)
			}

			// `hooks` 的每个 key 会被槽位转成 `use<PascalKey>(selector)` prop；
			// 其余字段按原样作为 prop 传入组件。
			const face = () => ({
				hooks: { form, catalog },
				writeField: (field, value) => form.set(field, value),
				loadCatalog: () => catalog.load(),
				t,
			})

			ctx.effect(() => {
				const refresh = () => {
					if (catalog.getSnapshot().status === 'idle') return
					catalog.load()
				}
				const disposers = [
					ctx.remote.$on('llm/adapters-updated', refresh),
					ctx.remote.$on('settings/document-updated', refresh),
					ctx.on('connection/reset', refresh),
				]
				return () => {
					for (const dispose of disposers) dispose()
				}
			}, 'model-guard: 推送失效')

			ctx.effect(() =>
				ctx.configForms.whileServed([NAMESPACE], () =>
					ctx.slots.inject('settings.section', () =>
						ctx.slots.register(
							{
								name: 'settings.section',
								id: NAMESPACE,
								order: 30,
								label: () => t('nav'),
								locale: NS,
								inject: face,
							},
							ModelGuardSection,
						),
					),
				),
			)
		}
		//#endregion

		exports.apply = apply
		exports.inject = inject
		return module.exports
	},
})
