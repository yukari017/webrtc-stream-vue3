# 🔧 ICE Candidate 缓冲区优化报告

**问题**: 控制台警告 "pendingIceCandidates 超过上限 10，丢弃最旧的候选"  
**修复时间**: 2026-03-31 02:21 GMT+8  
**提交**: 53538f4

---

## 🔍 问题分析

### 根本原因

ICE Candidate 缓冲区大小设置过小（10），在网络不稳定时容易满：

```
ICE Candidate 到达速度 > 处理速度
  ↓
缓冲区满 (10 个)
  ↓
最旧的候选被丢弃
  ↓
控制台警告
```

### 为什么会发生？

1. **remoteDescription 未就绪** — 候选到达时，远端描述还没有设置
2. **候选快速到达** — 网络不稳定时，ICE 候选可能快速连续到达
3. **缓冲区太小** — 10 个候选的缓冲区不足以应对突发流量

### 影响

- ⚠️ 控制台警告，影响用户体验
- ⚠️ 丢弃的候选可能导致连接质量下降
- ⚠️ 没有自动清理机制，可能导致内存泄漏

---

## ✅ 优化方案

### 1. 增加缓冲区大小

```typescript
// 修改前
const MAX_PENDING_CANDIDATES = 10

// 修改后
const MAX_PENDING_CANDIDATES = 50
```

**效果**: 缓冲区容量增加 5 倍，应对突发流量的能力大幅提升

### 2. 添加超时清理

```typescript
// 新增常量
const PENDING_CANDIDATE_TIMEOUT_MS = 30_000

// 在 handleRemoteCandidate 中添加清理逻辑
const now = Date.now()

// 清理超时的候选（超过 30s 的丢弃）
pendingIceCandidates.value = pendingIceCandidates.value.filter(
  item => now - item.ts < PENDING_CANDIDATE_TIMEOUT_MS
)
```

**效果**: 自动清理过期候选，防止缓冲区长期占用内存

### 3. 改进日志

```typescript
// 修改前
console.warn(
  `pendingIceCandidates 超过上限 ${MAX_PENDING_CANDIDATES}，丢弃最旧的候选`
)

// 修改后
console.warn(
  `[ICE] pendingIceCandidates 超过上限 ${MAX_PENDING_CANDIDATES}，` +
  `丢弃最旧的候选 (age: ${now - dropped!.ts}ms)`
)
```

**效果**: 显示被丢弃候选的年龄，便于诊断网络问题

---

## 📊 优化前后对比

| 指标 | 优化前 | 优化后 | 改进 |
|---|---|---|---|
| 缓冲区大小 | 10 | 50 | **5 倍** ⬆️ |
| 超时清理 | 无 | 30s | **自动清理** ✅ |
| 日志信息 | 基础 | 详细 | **诊断友好** ✅ |
| 缓冲区溢出概率 | 高 | 低 | **显著降低** ⬇️ |

---

## 🧪 测试验证

```
Test Files: 2 passed (2)
Tests: 24 passed (24)
Duration: 1.40s
```

✅ 所有测试通过，无回归。

---

## 📝 修改文件

- `client/src/composables/useWebRTC.ts`
  - 增加 `MAX_PENDING_CANDIDATES`: 10 → 50
  - 新增 `PENDING_CANDIDATE_TIMEOUT_MS`: 30_000
  - 改进 `handleRemoteCandidate` 函数

---

## 🎯 关键改进

1. **缓冲区容量**: 10 → 50 (5 倍增加)
2. **自动清理**: 超过 30s 的候选自动丢弃
3. **诊断信息**: 显示被丢弃候选的年龄
4. **内存管理**: 防止缓冲区长期占用内存

---

## 💡 最佳实践

### 何时会触发警告？

- 网络不稳定，ICE 候选快速到达
- remoteDescription 设置延迟
- 信令服务器响应缓慢

### 如何进一步优化？

1. **监控缓冲区使用率** — 添加指标收集
2. **动态调整缓冲区大小** — 根据网络状况调整
3. **优化信令流程** — 加快 remoteDescription 设置

---

**优化完成！** 🎉

ICE Candidate 缓冲区现在能更好地应对网络不稳定的情况。
