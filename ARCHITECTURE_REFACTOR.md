# 数据库架构重构计划

## 当前问题
1. 分享内容以字符串形式存储，难以解析和渲染
2. 剪贴板内容变化后，分享不会同步更新
3. 多分享格式依赖字符串分割，容易出错

## 新架构

### 1. 剪贴板项 (ClipboardItem)
```javascript
// KV Key: clipboard_item:{uuid}
{
  id: "uuid-v4",              // 唯一标识
  userId: "github-user-id",    // 所有者
  content: "string",           // 内容
  type: "text|image|file",     // 类型
  createdAt: timestamp,
  updatedAt: timestamp,        // 更新时间
  isDeleted: false             // 软删除标记
}

// 用户的剪贴板列表（只存储 UUID 引用）
// KV Key: user_clipboard_refs:{userId}
[
  "uuid-1",
  "uuid-2",
  "uuid-3"
]
```

### 2. 分享 (Share)
```javascript
// KV Key: share:{shareId}
{
  id: "5-digit-code",          // 分享码
  userId: "github-user-id",    // 创建者
  itemIds: ["uuid-1", "uuid-2"], // 引用的剪贴板 UUID 数组
  visibility: "public|private",
  createdAt: timestamp,
  expiresAt: timestamp
}

// 用户的分享列表
// KV Key: user_shares_list:{userId}
[
  {
    id: "5-digit-code",
    itemCount: 2,              // 引用的剪贴板数量
    visibility: "public",
    createdAt: timestamp,
    expiresAt: timestamp
  }
]
```

## API 变更

### 新增 API
1. `GET /api/clipboard-items/:uuid` - 通过 UUID 获取剪贴板项
2. `PUT /api/clipboard-items/:uuid` - 更新剪贴板项

### 修改 API
1. `GET /api/clipboard-items` - 返回完整剪贴板项（而非仅内容）
2. `POST /api/clipboard-items` - 创建带 UUID 的剪贴板项
3. `DELETE /api/clipboard-items/:uuid` - 软删除
4. `POST /api/shares` - 接收 itemIds 数组而非 content 字符串
5. `GET /api/shares/:id` - 返回分享及引用的剪贴板项详情

## 迁移策略
1. 保持现有数据兼容（读取时兼容旧格式）
2. 新创建的剪贴板使用 UUID 格式
3. 逐步迁移旧数据

## 前端变更
1. 剪贴板列表显示使用 item.id 作为 key
2. 分享创建时传递 itemIds 数组
3. 分享详情通过 UUID 获取每个剪贴板项
