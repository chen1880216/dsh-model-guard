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
`
		const TAG_ID = '@local/dsh-model-guard/section.css'
		if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}]`) === null) {
			const tag = document.createElement('style')
			tag.dataset.plugin = '@local/dsh-model-guard'
			tag.dataset.pluginCss = TAG_ID
			tag.textContent = CSS
			document.head.appendChild(tag)
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
				this.state = { status: 'idle', groups: [], providers: [], error: null }
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
			 * 读取一次目录；并发调用合并为一次在途请求。
			 * @returns {Promise<void>} 读取完成后 settle。
			 */
			load() {
				if (this.loading !== undefined) return this.loading
				this.publish({ ...this.state, status: 'loading', error: null })
				this.loading = Promise.resolve()
					.then(async () => {
						const [catalogResponse, providersResponse] = await Promise.all([
							this.ctx.remote.session.modelCatalog(),
							this.ctx.remote.llm.listProviders(),
						])
						const catalog = unwrap(catalogResponse)
						const providers = unwrap(providersResponse)
						this.publish({
							status: 'ready',
							groups: Array.isArray(catalog?.groups) ? catalog.groups : [],
							providers: Array.isArray(providers)
								? providers.map((provider) => ({ id: provider.id, name: provider.name ?? provider.id }))
								: [],
							error: null,
						})
					})
					.catch((error) => {
						this.publish({ status: 'error', groups: [], providers: [], error })
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

			const disabledModels = react.useMemo(() => new Set(readList(form, 'disabledModels')), [form])
			const disabledProviders = react.useMemo(() => new Set(readList(form, 'disabledProviders')), [form])
			const providerOrder = react.useMemo(() => readList(form, 'providerOrder'), [form])
			const modelOrder = react.useMemo(() => readList(form, 'modelOrder'), [form])
			const providerSort = readStrategy(form, 'providerSort')
			const modelSort = readStrategy(form, 'modelSort')
			const writable = form?.writable === true
			const formReady = form?.status === 'ready'
			const editable = writable && formReady

			// 首次渲染时读一次目录；未打开过的页面不在后台拉取。
			react.useEffect(() => {
				if (catalog?.status === 'idle') loadCatalog()
			}, [catalog?.status, loadCatalog])

			const catalogGroups = catalog?.groups ?? []
			const catalogProviders = catalog?.providers ?? []

			// 服务商清单 = 目录里的服务商 ∪ 已知 provider ∪ 已禁用的服务商
			// （被整体禁用的服务商不会出现在目录里，必须靠后两者补回来才能重新启用）。
			const providerRows = react.useMemo(() => {
				const byId = new Map()
				for (const group of catalogGroups) {
					byId.set(group.id, { id: group.id, name: group.name ?? group.id, models: group.models ?? [] })
				}
				for (const provider of catalogProviders) {
					if (!byId.has(provider.id)) byId.set(provider.id, { id: provider.id, name: provider.name, models: [] })
				}
				for (const id of disabledProviders) {
					if (!byId.has(id)) byId.set(id, { id, name: id, models: [] })
				}
				return [...byId.values()]
			}, [catalogGroups, catalogProviders, disabledProviders])

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

			if (catalog?.status === 'error') {
				return jsx.jsxs('section', {
					className: 'mg-section',
					children: [
						jsx.jsx('h2', { className: 'mg-title', children: t('nav') }),
						jsx.jsx('p', { className: 'mg-intro', children: t('loadFailed') }),
						jsx.jsx(primitives.Button, { variant: 'outline', onClick: () => loadCatalog(), children: t('retry') }),
					],
				})
			}

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
					jsx.jsx('button', {
						type: 'button',
						className: 'mg-reset',
						disabled: !editable || (providerOrder.length === 0 && modelOrder.length === 0),
						onClick: resetOrder,
						children: t('resetOrder'),
					}),
					jsx.jsx('p', { className: 'mg-sortHint', children: t('sortHint') }),
				],
			})

			const loading = catalog?.status === 'loading' || catalog?.status === 'idle'
			const body = loading
				? jsx.jsx('p', { className: 'mg-empty', children: t('loading') })
				: visibleProviders.length === 0
					? jsx.jsx('p', { className: 'mg-empty', children: providerRows.length === 0 ? t('empty') : t('noMatch') })
					: visibleProviders.map((provider) => {
							const providerOff = disabledProviders.has(provider.id)
							const providerIndex = providerRows.findIndex((row) => row.id === provider.id)
							// 搜索时只隐藏移动按钮，避免在过滤后的列表里误判首尾。
							const searching = needle !== ''
							return jsx.jsxs(
								'div',
								{
									className: 'mg-group',
									children: [
										jsx.jsxs('div', {
											className: 'mg-groupHead',
											children: [
												jsx.jsx('h3', { className: 'mg-groupName', children: provider.name }),
												jsx.jsx('span', {
													className: 'mg-groupMeta',
													children: providerOff
														? t('providerTag')
														: t('modelTotal', { count: provider.models.length }),
												}),
												jsx.jsxs('div', {
													className: 'mg-groupActions',
													children: [
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
										providerOff || provider.models.length === 0
											? null
											: jsx.jsx('ul', {
													className: 'mg-list',
													children: provider.models.map((model, modelIndex) => {
														const entry = entryOf(provider.id, model.id)
														const modelOff = disabledModels.has(entry)
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
																	modelOff
																		? jsx.jsx('span', { className: 'mg-tag mg-tagWarn', children: t('disabledTag') })
																		: null,
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
						],
					}),
					sortBar,
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
