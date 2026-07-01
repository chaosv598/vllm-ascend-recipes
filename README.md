# vLLM-Ascend Recipes

在 Ascend NPU 上部署任何大模型 — 社区维护的 vllm-ascend 部署指南。

选模型、选硬件、复制 `vllm serve` 命令即可运行。覆盖 Atlas 800 A2/A3 等 NPU 硬件。

## 本地开发

```bash
pnpm install
pnpm dev
```

浏览器访问 `http://localhost:4321`。

## 构建

```bash
pnpm build
```

构建产物在 `dist/` 目录。

## 添加新模型

1. 在 `models/{provider}/` 下创建 `{model-name}.yaml` 文件
2. 按照 schema 填写模型信息（参考 `models/Qwen/Qwen3-30B-A3B.yaml`）
3. 运行校验：`pnpm validate`
4. 本地预览：`pnpm dev`

### YAML Schema 说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `hf_id` | 是 | HuggingFace 模型 ID |
| `title` | 是 | 模型显示名称 |
| `provider` | 是 | 提供商名称 |
| `description` | 是 | 简短描述 |
| `architecture` | 是 | `dense` 或 `moe` |
| `parameters` | 是 | 参数量 |
| `active_parameters` | MoE 必填 | 激活参数量 |
| `context_length` | 是 | 原生上下文长度 |
| `modality` | 是 | 模态（text/multimodal/audio/image） |
| `updated` | 是 | 更新日期 |
| `overview` | 是 | 模型概述 |
| `weight_download` | 是 | 权重下载（支持多版本多来源） |
| `quantization` | 否 | 量化指南 |
| `prerequisites` | 否 | 前置条件 |
| `env_setup` | 是 | 环境准备（pip 和/或 container） |
| `scenarios` | 是 | 部署场景（级联选择：NPU→精度→部署模式） |
| `performance_accuracy` | 否 | 精度评测 |
| `performance_benchmark` | 否 | 性能评测 |
| `references` | 是 | 参考链接 |

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

需要在仓库 Settings → Pages 中设置 Source 为 GitHub Actions。
