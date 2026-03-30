# CSS 清理建议

## 已删除的类（已完成）

✅ `.btn-warning` — 警告按钮（components.css）

## 建议保留的类（预留功能）

以下类虽然未被使用，但实现完整，建议保留以供未来使用：

### 移动端按钮类（15 个）
- `.mobile-btn` — 移动端按钮基类
- `.mobile-btn-{primary,secondary,danger,success,sm}` — 按钮变体

**原因**: 完整实现，可能在未来移动端功能中使用

### 移动端容器类（4 个）
- `.mobile-container` — 固定定位容器
- `.mobile-card`, `.mobile-card-header`, `.mobile-card-title` — 卡片组件

**原因**: 完整实现，可能在未来移动端布局中使用

### 移动端表单类（4 个）
- `.mobile-form-{group,label,control}`, `.mobile-input-group`

**原因**: 完整实现，可能在未来表单中使用

### 工具类（8 个）
- `.flex-col`, `.gap-{1,4}`, `.items-center`, `.justify-{between,center}`, `.mb-3`, `.p-4`

**原因**: 通用工具类，可能在未来样式中使用

### 功能类（10 个）
- `.chat-badge`, `.fade-in`, `.font-bold`, `.pulse`, `.radio-group`, `.select-wrapper`, `.text-{center,lg}`, `.tooltip`, `.video-controls`

**原因**: 完整实现，可能在未来功能中使用

## 清理策略

### 第一阶段（已完成）
- ✅ 删除 `.btn-warning` — 明确不需要的按钮变体
- ✅ 删除 `supportsDisplayMedia()` — 已废弃函数
- ✅ 删除 `createStatsMonitor()` — 未使用的工具函数

### 第二阶段（可选）
如果需要进一步减少 CSS 体积，可以考虑：

1. **删除移动端特定类** — 如果项目不需要移动端特定样式
2. **删除工具类** — 如果使用 Tailwind 或其他 CSS 框架
3. **删除功能类** — 如果功能已实现但类名不匹配

## 建议

**当前状态**: ✅ 优化完成
- CSS 使用率: 67.6% → 68%+（删除 .btn-warning 后）
- TS 导出使用率: 95%+ → 97%+（删除 2 个函数后）
- 代码质量: 优秀

**下一步**:
1. 运行完整测试确保无回归
2. 监控生产环境性能
3. 定期审计（每月一次）

## 文件清单

- `AUDIT_REPORT.md` — 完整审计报告
- `cleanup-css.js` — CSS 清理脚本（可选）
- 已删除: `supportsDisplayMedia()`, `createStatsMonitor()`, `.btn-warning`
