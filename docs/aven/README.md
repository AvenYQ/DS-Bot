# Aven 定制版：交接与变更记录

这里放 fork（`AvenYQ/DS-Bot`）自己的项目文档，与上游 `Fei2411/DS-Bot` 的 `docs/` 分开，避免和上游文档混在一起。

## 先读这个

- [交接文档](./交接文档.md)：这个 fork 是什么、Aven 的工作规矩、分支与发版流程、已经做过哪些改动、测试环境。**接手前先读完。**
- [值房图插件需求说明](./值房图插件需求说明.md)：小朝廷值房图这个功能想要什么。
- [修复截图](./修复截图)：早期侧栏与输出物卡片问题的改前改后对比。

## 变更记录

| 日期 | 提交 | 内容 |
| --- | --- | --- |
| 2026-10-31 | `1686f30` | [值房图动效、印章时机与侧栏拖拽](../plans/2026-10-31-aven-seals-court-board-drag.md)，发布 `0.2.4-aven.4` |
| 2026-10-30 | `3124bac` | 加入小朝廷值房图，替换默认对话入口 |
| 2026-10-30 | `b2d181b` | 新 App 图标：宣纸上的朱红印章气泡 |

新的一次改动就在 `docs/plans/` 里加一篇同格式的说明，并在上表补一行。

## 怎么改、怎么发

```sh
cd ~/DS-Bot
git checkout aven/dev
cd ds-bot && npm test && npm run build && node scripts/build-client.mjs --check && npm run lint
```

改完提交到 `aven/dev`，合并进 `aven/custom` 再 push，GitHub Actions 会自动升版本号、跑测试、在 Apple 芯片机器上构建并发布 release。细节和已知坑见交接文档第四节。
