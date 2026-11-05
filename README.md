# dsh-model-guard

DSH（DeepSeek Harness）插件：**禁用模型 / 服务商**，并**自定义模型选择器的显示顺序**。

**简体中文** | [English](#english)

本开源项目已链接并认可 [LINUX DO](https://linux.do) 社区。

---

## 中文

被禁用的模型或服务商不会出现在对话的模型选择器里，也无法被选中或提交；排序决定选择器里服务商的先后，以及每个服务商内部模型的先后。

### 功能

- **禁用单个模型**：勾掉后它从模型选择器消失，且 Host 侧拒绝选中/提交该模型。
- **禁用整个服务商**：该 provider 的全部模型一并隐藏，连分组都不再出现。
- **两级排序**：
  - 手工顺序：每个服务商、每个模型都有「置顶 / 上移 / 下移」。
  - 自动顺序：可选「按名称」排列未被手工调整过的项。
  - 规则恒为 **显式顺序 > 回退策略 > 原顺序**，未列出的新模型自动排在后面，模型增减无需重写配置。
- **对话模型菜单默认收起**：输入框的模型菜单里，服务商分组默认收起，点击服务商名称展开；搜索或键盘操作会自动展开。
- **优先模型（★）**：把模型标记为优先后，它始终排在其服务商的最前面，不受「置顶 / 上移 / 下移」影响；多个优先模型按标记顺序排列。
- **可用性测试**：设置页每行有「测试」、工具栏有「测试全部」，向模型发一条极小的 ping 请求，显示 **可用 / 不可用 + 延迟(ms)**；失败时鼠标悬停可看具体原因（如鉴权失败、限流、模型不存在）。结果存在 localStorage（键 `model-guard:probe-results:v1`，保留 7 天），刷新页面、开新标签页都还在，不必为了看一眼再测一次；每行悬停可看「测得于 HH:MM」。测试会消耗个位数 token。
- **选择器里直接看结果**：对话输入框的模型菜单不提供测试按钮，只把设置页测出来的可用性、延迟与**测试时间**显示在模型名右侧（如 `可用 · 128 ms · 18:26`，悬停看完整原因）。
- **分组级测试与并发/超时**：每个服务商的标题右侧有「测试本组」，一次测完该服务商全部模型，并在标题上显示「可用/已测」小计；排序栏可调**探测并发（1–8）**与**探测超时（5/10/20/30 s，默认 10 s）**。
- **设置默认模型**：设置页顶部「默认模型」下拉按服务商分组列出可选模型，点「设为默认」即写入 profile 的 `agent-default-model` 条目——新会话默认用它，重启后仍生效（走 Host 的 `agentDefaultModel.saveSelection()`，不是另存一份影子配置）。
- **菜单视觉重排**：分组标题带箭头与分组分割线，模型行与标题文字左缘对齐；选中项用左侧强调条 + 品牌色底标出；行内与分组标题重复的「服务商 · 」前缀拆分后隐去，只留模型名。纯 CSS + DOM 增强，不改官方组件。
- 全部设置改完**即时生效**，不需要重启 DSH。

### 使用位置

安装后，在 DSH 的 **设置 → 模型禁用与排序** 中使用。

### 安装

要求 DSH `0.2.x`（`@deepseek-ai/dsh`），Node `>=22`。

```bash
# 从本仓库目录安装到 web profile
dsh plugin --profile web add /path/to/dsh-model-guard
```

`dsh plugin add` 会把包写进 profile 的 `dependencies` 与 `dsh.profile.bundles`，随后 HMR 自动组合。

若用 `link:` 方式安装，profile 的 `package.json` 需要同时出现在两处：

```jsonc
{
  "dependencies": { "@local/dsh-model-guard": "link:/path/to/dsh-model-guard" },
  "dsh": { "profile": { "bundles": [ /* … */, "@local/dsh-model-guard" ] } }
}
```

> **`link:` 安装必须声明 `peerDependencies`**（本包已声明 `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`）。
> DSH 的 `ResolutionRouter.routeLinked()` 只对「在祖先 `node_modules` 里被声明为 peer」的裸包名走 interception 路由，
> 否则退回 Node 原生解析、从插件目录向上找不到 DSH 安装目录里的包，直接 `ERR_MODULE_NOT_FOUND`。

#### 生效时机

`dsh-hmr` 监视 profile 的 `cordis.patch.yml`、`$DSH_HOME/cordis.patch.yml` 与 profile `package.json` 的 `bundles`。
前两者按**内容**比较，所以只 `touch` 不触发重组合——改内容才会。

### 配置

全部字段可在设置页编辑，也可直接写进 profile 的 `cordis.patch.yml`：

```yaml
- id: model-guard
  config:
    disabledModels: []      # "provider/model"，禁用单个模型
    disabledProviders: []   # provider id，禁用整个服务商
    providerOrder: []       # 服务商显示顺序（id 列表）
    modelOrder: []          # 模型显示顺序（"provider/model" 列表）
    priorityModels: []      # 优先模型（"provider/model" 列表），顺序即优先级
    probeConcurrency: 3     # 探测并发（1–8）
    probeTimeoutMs: 10000   # 单个模型的探测超时（毫秒，1000–60000）
    providerSort: natural   # natural | name
    modelSort: natural      # natural | name
    collapsePickerGroups: true   # 对话模型菜单是否默认收起服务商分组
```

这些字段都是 `volatile()`，改动即时生效。

### 实现要点

不改动 DSH 已发布的包，而是作为 profile 层 bundle，在 `internal/get` waterfall 上拦截对 `llm` 服务的属性读取，
返回一个缓存的 `Proxy`，覆盖 `listModels()` 与 `listProviders()` 做过滤与重排；其余成员原样透传并 `bind` 回真实实例。

选这两个方法是因为 GUI 目录（`buildModelCatalog`）与提交校验（`modelAvailable` → `selectModel` / `requireModel`）
都只经它们取目录——过滤一处即可同时挡住「显示」与「选择/提交」，重排一处即可决定选择器顺序。
核心路由不复用该目录，所以本插件是**纯减法 + 重排**：不新增模型、不改路由，`resolveCallConfig()` / `stream()` 仍走原始实例。

对话输入框的模型菜单（`conversation.input.model`）由官方 `dsh-client-ui-model-selection` 渲染，组件未导出且安装包只读，因此「默认收起」走**纯 DOM 增强**：
官方 `MenuGroup` 的输出带稳定语义钩子（`section[data-menu-group]`、`[data-menu-group-heading]`、直接子级 `button[role="menuitemradio"]`），
增强器只在这些元素上切换属性，收起效果由 CSS 完成，不插入任何节点，也不依赖 hash 过的 class 名。

### 探测端点

可用性测试走同源 HTTP 端点 `POST /api/model-guard/probe`（由 Host 半边在 `ctx.webServer` 上注册的精确路由，优先于 `/api` 前缀桥）：

```bash
curl -X POST http://127.0.0.1:3080/api/model-guard/probe \
  -H 'content-type: application/json' \
  -d '{"items":[{"provider":"magpie","model":"group/wb-v41"}]}'
# → {"results":[{"provider":"magpie","model":"group/wb-v41","ok":true,"latencyMs":1425}],"timeoutMs":20000}
```

- 请求体 `{ items: [{provider, model}], concurrency?, timeoutMs? }`；单次最多 200 个模型；默认超时 **10 s**、默认并发 **3**（都可在设置页改，请求体也会被夹到 1000–60000 ms / 1–8）。
- 只接受同源请求（校验 `Origin` 的 host 与 `Host` 一致），跨站返回 403；非 POST 返回 405。
- 探测链路与真实对话一致：`llm.prepareCall()` → `call.stream()`，所以凭据、路由、重试策略都是生产路径；
  失败时返回 `LlmFailure.code`（如 `UNKNOWN_MODEL`、`AUTH`、`RATE_LIMIT`）与 `message`。

为什么要单开 HTTP 路由而不是新增 Remote 命名空间：Remote 的命名空间与参数描述由 Typert 代码生成器产出，
第三方插件无法在运行时注册；`webServer.register()` 是公开的精确路由入口，且精确路由优先命中，不必改动 `/api` 桥。

### 默认模型端点

```bash
curl -s http://127.0.0.1:3080/api/model-guard/default           # → {"provider":"magpie","model":"group/wb-v41"}
curl -s -X POST http://127.0.0.1:3080/api/model-guard/default \
  -H 'content-type: application/json' \
  -d '{"provider":"magpie","model":"group/wb-v41"}'             # → {"ok":true,...}
```

- GET 读 Host 的 `agentDefaultModel.currentSelection()`；POST 走 `saveSelection()` → `configEditor` → 写回 profile 的
  `agent-default-model` 条目，因此**持久化**，重启后仍生效。
- 同一个模型重复提交会保留原有 `reasoningEffort`；换模型则不保留（可能对该模型不合法）。
- 缺少 `agentDefaultModel` 或 `configEditor` 时返回 501，前端据此显示「当前环境不支持」——不会出现「提示成功但没写」。

### 已知限制

- **`deepseek-account` 与 `deepseek-official` 的顺序无法调整**：客户端 `orderModelProviders()` 无条件把这两个排在最前，
  Host 侧怎么排都压不过。页面的排序说明里已写明。
- **已在会话中选中的模型被禁用后不会自动回退**：菜单里消失、显示 fallback 标签，发消息时才报
  `session/model-unavailable`，需要手动另选一个。
- **只收窄人的选择面，不阻断内部调用**：已被 subagent、compaction 等组件显式指定的模型仍能运行。
- 依赖 `internal/get` 这个带 `internal` 前缀的 waterfall，它不是公开契约。DSH 大版本升级后若菜单不再隐藏/顺序不再跟随设置，
  说明该事件签名变了。
- 排序是纯显示层重排；**默认模型由 profile 的 `agent-default-model` 行决定**，设置页的「默认模型」只是调用该服务的 `saveSelection()`，两者不共用同一份存储。

### 许可

本项目采用 [MIT License](LICENSE) 开源。

---

<a id="english"></a>

## English

A DSH (DeepSeek Harness) plugin that **disables models / providers** and **customizes the order** in which they appear in the model picker.

A disabled model or provider is hidden from the conversation model picker and can neither be selected nor submitted. Ordering decides the sequence of providers in that picker, and of the models inside each provider.

This open-source project is linked to and endorses the [LINUX DO](https://linux.do) community.

### Features

- **Disable a single model**: once unchecked, it disappears from the picker and the Host rejects selecting or submitting it.
- **Disable a whole provider**: every model of that provider is hidden, and its group no longer appears at all.
- **Two-level ordering**:
  - Manual order: every provider and every model has "move to top / move up / move down".
  - Automatic order: optionally sort items you have not moved manually "by name".
  - The rule is always **explicit order > fallback strategy > original order**, so newly added models land at the end automatically — no need to rewrite the config when models come and go.
- **Chat model menu starts collapsed**: in the composer's model menu, provider groups are collapsed by default — click a provider name to expand it; searching or using the keyboard expands everything.
- **Priority models (★)**: mark a model as priority and it always sorts first inside its provider, regardless of move-to-top/up/down; multiple priority models keep the order you marked them.
- **Availability probe**: each row has **Test** and the toolbar has **Test all**. A probe sends one tiny ping to the model and reports **available / unavailable plus latency (ms)**; hover a failure to see the reason (auth, rate limit, unknown model). Results persist in localStorage (key `model-guard:probe-results:v1`, kept for 7 days), so a refresh or a new tab still shows them — no need to re-probe just to look. Hover a row to see "tested at HH:MM". A probe costs a handful of tokens.
- **Results inside the picker**: the composer's model menu has no test button; it only shows the availability, latency and **test time** measured on the settings page, next to each model name (e.g. `available · 128 ms · 18:26`; hover for the full reason).
- **Per-provider testing plus tunable concurrency/timeout**: each provider header has **Test group** (probes every model of that provider and shows an `ok/tested` tally next to the title); the sort bar exposes **probe concurrency (1–8)** and **probe timeout (5/10/20/30 s, default 10 s)**.
- **Default model**: the **Default model** dropdown at the top of the page groups models by provider; **Set as default** writes the profile's `agent-default-model` entry through the Host's `agentDefaultModel.saveSelection()`, so new sessions use it and it survives restarts — no shadow copy in this plugin.
- **Picker visual polish**: group headings carry a chevron and group dividers, model rows align with the heading text, and the selected row is marked with a left accent bar plus a brand tint. The "Provider · " prefix that duplicates the group heading is split out and hidden, leaving just the model name. Pure CSS + DOM enhancement — the upstream component is untouched.
- All settings take effect **immediately**, with no DSH restart.

### Where to find it

After installation, open **Settings → Models & ordering** in DSH.

### Installation

Requires DSH `0.2.x` (`@deepseek-ai/dsh`) and Node `>=22`.

```bash
# Install from this repository's directory into the web profile
dsh plugin --profile web add /path/to/dsh-model-guard
```

`dsh plugin add` writes the package into the profile's `dependencies` and `dsh.profile.bundles`, after which HMR composes it automatically.

If you install it as a `link:` dependency, the profile's `package.json` must list it in both places:

```jsonc
{
  "dependencies": { "@local/dsh-model-guard": "link:/path/to/dsh-model-guard" },
  "dsh": { "profile": { "bundles": [ /* … */, "@local/dsh-model-guard" ] } }
}
```

> **A `link:` install must declare `peerDependencies`** (this package declares `@deepseek-ai/cordis` and `@deepseek-ai/schemastery`).
> DSH's `ResolutionRouter.routeLinked()` only routes bare package names through interception when the ancestor `node_modules`
> declares them as a peer; otherwise resolution falls back to native Node lookup, which cannot find the packages inside the DSH
> installation directory when walking up from the plugin directory, resulting in `ERR_MODULE_NOT_FOUND`.

#### When changes take effect

`dsh-hmr` watches the profile's `cordis.patch.yml`, `$DSH_HOME/cordis.patch.yml`, and the `bundles` field of the profile's `package.json`.
The first two are compared **by content**, so a bare `touch` does not trigger recomposition — the content must change.

### Configuration

Every field is editable in the settings page, or directly in the profile's `cordis.patch.yml`:

```yaml
- id: model-guard
  config:
    disabledModels: []      # "provider/model" — disable a single model
    disabledProviders: []   # provider id — disable a whole provider
    providerOrder: []       # provider display order (list of ids)
    modelOrder: []          # model display order (list of "provider/model")
    providerSort: natural   # natural | name
    modelSort: natural      # natural | name
    collapsePickerGroups: true   # collapse provider groups in the chat model menu
```

All of these fields are `volatile()`, so changes apply immediately.

### Implementation notes

Rather than modifying the published DSH packages, this plugin ships as a profile-layer bundle that intercepts property reads of
the `llm` service on the `internal/get` waterfall. It returns a cached `Proxy` overriding `listModels()` and `listProviders()`
to filter and reorder; every other member is passed through and bound back to the real instance.

These two methods are the interception points because both the GUI catalog (`buildModelCatalog`) and the submission check
(`modelAvailable` → `selectModel` / `requireModel`) read the catalog only through them — filtering in one place covers both
"display" and "select/submit", and reordering in one place decides the picker's order. Core routing does not reuse that catalog,
so this plugin is a **pure subtraction + reordering**: it adds no models, changes no routes, and `resolveCallConfig()` / `stream()`
still go through the original instance.

The composer's model menu (`conversation.input.model`) is rendered by the official `dsh-client-ui-model-selection`, whose component is not
exported and whose package is read-only, so "collapsed by default" is implemented as a **pure DOM enhancement**: the official `MenuGroup`
output carries stable semantic hooks (`section[data-menu-group]`, `[data-menu-group-heading]`, direct-child `button[role="menuitemradio"]`),
and the enhancer only toggles attributes on those elements — collapsing is done in CSS, no nodes are inserted and no hashed class names are used.

### Known limitations

- **The order of `deepseek-account` and `deepseek-official` cannot be changed**: the client's `orderModelProviders()` unconditionally
  puts those two first, and no Host-side ordering can override it. The settings page states this as well.
- **A model already selected in a session does not fall back automatically when disabled**: it disappears from the menu and shows a
  fallback label; `session/model-unavailable` is only raised when you send a message, so you need to pick another model manually.
- **It narrows the human's choices without blocking internal calls**: models explicitly requested by subagents, compaction, and other
  components still run.
- It relies on the `internal/get` waterfall (note the `internal` prefix), which is not a public contract. If a major DSH upgrade
  leaves the menu unfiltered or the order no longer following the settings, that event's signature has changed.
- Ordering is a display-layer rearrangement only and **does not affect the default model** (the default is set by the profile's
  `agent-default-model` row).

### License

Released under the [MIT License](LICENSE).
