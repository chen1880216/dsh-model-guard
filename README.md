# dsh-model-guard

DSH（DeepSeek Harness）插件：**禁用模型 / 服务商**，并**自定义模型选择器的显示顺序**。

被禁用的模型或服务商不会出现在对话的模型选择器里，也无法被选中或提交；排序决定选择器里服务商的先后，以及每个服务商内部模型的先后。

本开源项目已链接并认可 [LINUX DO](https://linux.do) 社区。

## 功能

- **禁用单个模型**：勾掉后它从模型选择器消失，且 Host 侧拒绝选中/提交该模型。
- **禁用整个服务商**：该 provider 的全部模型一并隐藏，连分组都不再出现。
- **两级排序**：
  - 手工顺序：每个服务商、每个模型都有「置顶 / 上移 / 下移」。
  - 自动顺序：可选「按名称」排列未被手工调整过的项。
  - 规则恒为 **显式顺序 > 回退策略 > 原顺序**，未列出的新模型自动排在后面，模型增减无需重写配置。
- 全部设置改完**即时生效**，不需要重启 DSH。

## 截图 / 位置

安装后，在 DSH 的 **设置 → 模型禁用与排序** 中使用。

## 安装

要求 DSH `0.2.x`（`@deepseek-ai/dsh`），Node `>=22`。

```bash
# 从本仓库目录安装到 web profile
dsh plugin --profile web add /path/to/dsh-model-guard
```

`dsh plugin add` 会把包写进 profile 的 `dependencies` 与 `dsh.profile.bundles`，随后 HMR 自动组合。

若你像本机一样用 `link:` 方式安装，profile 的 `package.json` 需要同时出现在两处：

```jsonc
{
  "dependencies": { "@local/dsh-model-guard": "link:/path/to/dsh-model-guard" },
  "dsh": { "profile": { "bundles": [ /* … */, "@local/dsh-model-guard" ] } }
}
```

> **`link:` 安装必须声明 `peerDependencies`**（本包已声明 `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`）。
> DSH 的 `ResolutionRouter.routeLinked()` 只对「在祖先 `node_modules` 里被声明为 peer」的裸包名走 interception 路由，
> 否则退回 Node 原生解析、从插件目录向上找不到 DSH 安装目录里的包，直接 `ERR_MODULE_NOT_FOUND`。

### 生效时机

`dsh-hmr` 监视 profile 的 `cordis.patch.yml`、`$DSH_HOME/cordis.patch.yml` 与 profile `package.json` 的 `bundles`。
前两者按**内容**比较，所以只 `touch` 不触发重组合——改内容才会。

## 配置

全部字段可在设置页编辑，也可直接写进 profile 的 `cordis.patch.yml`：

```yaml
- id: model-guard
  config:
    disabledModels: []      # "provider/model"，禁用单个模型
    disabledProviders: []   # provider id，禁用整个服务商
    providerOrder: []       # 服务商显示顺序（id 列表）
    modelOrder: []          # 模型显示顺序（"provider/model" 列表）
    providerSort: natural   # natural | name
    modelSort: natural      # natural | name
```

这些字段都是 `volatile()`，改动即时生效。

## 实现要点

不改动 DSH 已发布的包，而是作为 profile 层 bundle，在 `internal/get` waterfall 上拦截对 `llm` 服务的属性读取，
返回一个缓存的 `Proxy`，覆盖 `listModels()` 与 `listProviders()` 做过滤与重排；其余成员原样透传并 `bind` 回真实实例。

选这两个方法是因为 GUI 目录（`buildModelCatalog`）与提交校验（`modelAvailable` → `selectModel` / `requireModel`）
都只经它们取目录——过滤一处即可同时挡住「显示」与「选择/提交」，重排一处即可决定选择器顺序。
核心路由不复用该目录，所以本插件是**纯减法 + 重排**：不新增模型、不改路由，`resolveCallConfig()` / `stream()` 仍走原始实例。

## 已知限制

- **`deepseek-account` 与 `deepseek-official` 的顺序无法调整**：客户端 `orderModelProviders()` 无条件把这两个排在最前，
  Host 侧怎么排都压不过。页面的排序说明里已写明。
- **已在会话中选中的模型被禁用后不会自动回退**：菜单里消失、显示 fallback 标签，发消息时才报
  `session/model-unavailable`，需要手动另选一个。
- **只收窄人的选择面，不阻断内部调用**：已被 subagent、compaction 等组件显式指定的模型仍能运行。
- 依赖 `internal/get` 这个带 `internal` 前缀的 waterfall，它不是公开契约。DSH 大版本升级后若菜单不再隐藏/顺序不再跟随设置，
  说明该事件签名变了。
- 排序是纯显示层重排，**不影响默认模型**（默认模型由 profile 的 `agent-default-model` 行决定）。

## 许可

本项目采用 [MIT License](LICENSE) 开源。
