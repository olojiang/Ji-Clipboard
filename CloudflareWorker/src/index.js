// Cloudflare Worker - GitHub OAuth + KV 存储
// 环境变量: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 头 - 必须指定具体域名，不能是 *，因为使用了 credentials
    const origin = request.headers.get('Origin') || env.FRONTEND_URL;
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || 'https://olojiang.github.io',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GitHub OAuth 登录入口
      if (path === '/auth/github') {
        return handleGitHubAuth(request, env, corsHeaders);
      }

      // GitHub OAuth 回调
      if (path === '/auth/callback') {
        return handleGitHubCallback(request, env, corsHeaders);
      }

      // 获取当前用户信息
      if (path === '/api/me') {
        return handleGetMe(request, env, corsHeaders);
      }

      // 登出
      if (path === '/api/logout') {
        return handleLogout(request, env, corsHeaders);
      }

      // 保存剪贴板数据
      if (path === '/api/clipboard' && request.method === 'POST') {
        return handleSaveClipboard(request, env, corsHeaders);
      }

      // 获取剪贴板数据（支持 path 和 query 两种方式）
      if (path === '/api/clipboard' || path.startsWith('/api/clipboard/')) {
        return handleGetClipboard(request, env, corsHeaders);
      }

      // 获取我的分享列表
      if (path === '/api/my-shares') {
        return handleGetMyShares(request, env, corsHeaders);
      }

      // 剪贴板项目 API
      if (path === '/api/clipboard-items') {
        if (request.method === 'GET') {
          return handleGetClipboardItems(request, env, corsHeaders);
        }
        if (request.method === 'POST') {
          return handleAddClipboardItem(request, env, corsHeaders);
        }
      }

      if (path.startsWith('/api/clipboard-items/')) {
        if (request.method === 'DELETE') {
          return handleDeleteClipboardItem(request, env, corsHeaders);
        }
        if (request.method === 'PUT') {
          return handleRestoreClipboardItem(request, env, corsHeaders);
        }
      }

      // 分享 API
      if (path === '/api/shares') {
        if (request.method === 'GET') {
          return handleGetMySharesList(request, env, corsHeaders);
        }
        if (request.method === 'POST') {
          return handleCreateShare(request, env, corsHeaders);
        }
      }

      if (path.startsWith('/api/shares/')) {
        if (request.method === 'GET') {
          return handleGetShare(request, env, corsHeaders);
        }
        if (request.method === 'DELETE') {
          return handleDeleteShare(request, env, corsHeaders);
        }
      }

      // 图片上传 API
      if (path === '/api/upload-image' && request.method === 'POST') {
        return handleUploadImage(request, env, corsHeaders);
      }

      // 文件上传 API
      if (path === '/api/upload-file' && request.method === 'POST') {
        return handleUploadFile(request, env, corsHeaders);
      }

      // 存储管理 API
      if (path === '/api/storage' && request.method === 'GET') {
        return handleGetStorageInfo(request, env, corsHeaders);
      }

      // ========== 管理员 API ==========
      // 获取所有分享（管理员）
      if (path === '/api/admin/shares' && request.method === 'GET') {
        return handleAdminGetAllShares(request, env, corsHeaders);
      }

      // 获取所有用户存储统计（管理员）
      if (path === '/api/admin/storage-stats' && request.method === 'GET') {
        return handleAdminGetStorageStats(request, env, corsHeaders);
      }

      // 删除任意分享（管理员）
      if (path.startsWith('/api/admin/shares/') && request.method === 'DELETE') {
        return handleAdminDeleteShare(request, env, corsHeaders);
      }

      if (path.startsWith('/api/images/') && request.method === 'DELETE') {
        return handleDeleteImage(request, env, corsHeaders);
      }

      // 图片访问代理（解决 R2 401 问题）
      if (path.startsWith('/api/images/') && request.method === 'GET') {
        return handleGetImage(request, env, corsHeaders);
      }

      // 文件访问和删除 API
      if (path.startsWith('/api/files/') && request.method === 'GET') {
        return handleGetFile(request, env, corsHeaders);
      }

      if (path.startsWith('/api/files/') && request.method === 'DELETE') {
        return handleDeleteFile(request, env, corsHeaders);
      }

      return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal Server Error' }, 500, corsHeaders);
    }
  },
};

// GitHub OAuth 登录
async function handleGitHubAuth(request, env, corsHeaders) {
  const state = generateRandomString(32);

  // 存储 state 到 KV（5分钟过期）
  await env.AUTH_KV.put(`state:${state}`, '1', { expirationTtl: 300 });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(env.WORKER_URL + '/auth/callback')}&` +
    `state=${state}&` +
    `scope=user:email`;

  return Response.redirect(githubAuthUrl, 302);
}

// GitHub OAuth 回调
async function handleGitHubCallback(request, env, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state' }, 400, corsHeaders);
  }

  // 验证 state
  const stateValid = await env.AUTH_KV.get(`state:${state}`);
  if (!stateValid) {
    return jsonResponse({ error: 'Invalid or expired state' }, 400, corsHeaders);
  }
  await env.AUTH_KV.delete(`state:${state}`);

  // 交换 code 获取 access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: env.WORKER_URL + '/auth/callback',
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return jsonResponse({ error: tokenData.error_description }, 400, corsHeaders);
  }

  // 获取 GitHub 用户信息
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'User-Agent': 'Ji-Clipboard',
    },
  });

  const githubUser = await userResponse.json();

  // 生成 session ID
  const sessionId = generateRandomString(32);

  // 检查该用户是否已有会话，如果有则删除旧会话
  const existingSessionId = await env.AUTH_KV.get(`user_session:${githubUser.id}`);
  if (existingSessionId) {
    await env.AUTH_KV.delete(`session:${existingSessionId}`);
  }

  // 存储用户会话到 KV（30天过期）
  const sessionData = {
    userId: githubUser.id,
    login: githubUser.login,
    name: githubUser.name,
    avatar: githubUser.avatar_url,
    email: githubUser.email,
    createdAt: Date.now(),
  };

  await env.AUTH_KV.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: 30 * 24 * 60 * 60, // 30天
  });

  // 存储用户ID到会话的映射
  await env.AUTH_KV.put(`user_session:${githubUser.id}`, sessionId, {
    expirationTtl: 30 * 24 * 60 * 60, // 30天
  });

  // 设置 Cookie 并重定向回前端
  // 使用 SameSite=None 因为 Worker 和前端是不同域名
  const redirectUrl = new URL(env.FRONTEND_URL || '/');

  // 添加 hash 跳转到"我的"标签页
  redirectUrl.hash = 'profile';

  // 将 session ID 添加到 URL 参数（用于 iOS Safari 等限制第三方 cookie 的浏览器）
  redirectUrl.searchParams.set('session', sessionId);

  // 同时设置 cookie（用于支持第三方 cookie 的浏览器）
  const newCookie = `session_id=${sessionId}; HttpOnly; Secure; SameSite=None; Max-Age=${30 * 24 * 60 * 60}; Path=/; Domain=olojiang.workers.dev`;

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': redirectUrl.toString(),
      'Set-Cookie': newCookie,
    },
  });
}

// 获取当前用户信息
async function handleGetMe(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session（用于 iOS Safari 等限制第三方 cookie 的浏览器）
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  const allCookies = request.headers.get('Cookie');

  console.log('=== GetMe Debug ===');
  console.log('Session from URL:', url.searchParams.get('session'));
  console.log('Session from Cookie:', getCookie(request, 'session_id'));
  console.log('Final sessionId:', sessionId);

  if (!sessionId) {
    console.log('No sessionId found');
    return jsonResponse({
      loggedIn: false,
      debug: {
        reason: 'no_session_id',
        allCookies: allCookies
      }
    }, 200, corsHeaders);
  }

  try {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);

    if (!sessionData) {
      console.log('Session not found in KV for sessionId:', sessionId);
      return jsonResponse({
        loggedIn: false,
        debug: {
          reason: 'session_not_found',
          sessionId: sessionId
        }
      }, 200, corsHeaders);
    }

    const user = JSON.parse(sessionData);
    console.log('User found:', user.login);
    return jsonResponse({
      loggedIn: true,
      user: {
        id: user.userId,
        login: user.login,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
      },
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Error in handleGetMe:', error);
    return jsonResponse({
      loggedIn: false,
      error: 'Server error',
      debug: { message: error.message }
    }, 500, corsHeaders);
  }
}

// 登出
async function handleLogout(request, env, corsHeaders) {
  const sessionId = getCookie(request, 'session_id');

  if (sessionId) {
    await env.AUTH_KV.delete(`session:${sessionId}`);
  }

  return jsonResponse({ success: true }, 200, {
    ...corsHeaders,
    'Set-Cookie': `session_id=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`,
  });
}

// 保存剪贴板数据
async function handleSaveClipboard(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  const body = await request.json();
  const { content, type = 'text', expireHours = 24 } = body;

  if (!content) {
    return jsonResponse({ error: 'Content is required' }, 400, corsHeaders);
  }

  // 生成5位提取码
  const code = await generateUniqueCode(env);

  const clipboardData = {
    code,
    content,
    type,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + expireHours * 60 * 60 * 1000,
  };

  await env.CLIPBOARD_KV.put(`clip:${code}`, JSON.stringify(clipboardData), {
    expirationTtl: expireHours * 60 * 60,
  });

  // 保存到用户分享列表
  const userSharesKey = `user_shares:${userId}`;
  const existingShares = await env.CLIPBOARD_KV.get(userSharesKey);
  const shareCodes = existingShares ? JSON.parse(existingShares) : [];
  shareCodes.push(code);
  await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(shareCodes), {
    expirationTtl: 7 * 24 * 60 * 60, // 7天
  });

  return jsonResponse({
    success: true,
    code,
    expiresAt: clipboardData.expiresAt,
  }, 200, corsHeaders);
}

// 获取剪贴板数据
async function handleGetClipboard(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 支持两种方式：path parameter 和 query parameter
  let code = url.searchParams.get('code');

  // 如果没有 query parameter，尝试从 path 获取
  if (!code) {
    code = url.pathname.split('/').pop();
  }

  if (!code || code.length !== 5) {
    return jsonResponse({ error: 'Invalid code' }, 400, corsHeaders);
  }

  const data = await env.CLIPBOARD_KV.get(`clip:${code}`);

  if (!data) {
    return jsonResponse({ error: 'Not found or expired' }, 404, corsHeaders);
  }

  const clipboard = JSON.parse(data);

  // 检查是否过期
  if (Date.now() > clipboard.expiresAt) {
    await env.CLIPBOARD_KV.delete(`clip:${code}`);
    return jsonResponse({ error: 'Expired' }, 410, corsHeaders);
  }

  return jsonResponse({
    code: clipboard.code,
    content: clipboard.content,
    type: clipboard.type,
    createdAt: clipboard.createdAt,
    expiresAt: clipboard.expiresAt,
  }, 200, corsHeaders);
}

// 获取我的分享列表
async function handleGetMyShares(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  // 从 KV 中列出所有该用户的分享
  // 注意：Cloudflare KV 不支持按前缀列出，我们需要存储用户分享列表
  const userSharesKey = `user_shares:${userId}`;
  const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
  const shareCodes = sharesData ? JSON.parse(sharesData) : [];

  // 获取每个分享的详细信息
  const shares = [];
  for (const code of shareCodes) {
    const clipData = await env.CLIPBOARD_KV.get(`clip:${code}`);
    if (clipData) {
      const clip = JSON.parse(clipData);
      shares.push({
        code: clip.code,
        content: clip.content.substring(0, 100) + (clip.content.length > 100 ? '...' : ''), // 截断内容
        type: clip.type,
        createdAt: clip.createdAt,
        expiresAt: clip.expiresAt,
      });
    }
  }

  // 按创建时间倒序排列
  shares.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({
    shares,
  }, 200, corsHeaders);
}

// 获取用户的剪贴板项目列表
async function handleGetClipboardItems(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  // 从 KV 获取用户的剪贴板列表
  const userClipboardKey = `user_clipboard:${userId}`;
  const clipboardData = await env.CLIPBOARD_KV.get(userClipboardKey);
  let items = clipboardData ? JSON.parse(clipboardData) : [];

  // 为旧数据添加 type 字段（从内容推断）
  items = items.map(item => {
    if (!item.type) {
      // 如果内容以 [ 开头且包含 http，可能是图片数组
      if (item.content && item.content.startsWith('[') && item.content.includes('http')) {
        item.type = 'image';
      } else if (item.content && item.content.startsWith('{') && item.content.includes('"id"') && item.content.includes('"filename"')) {
        // 如果内容以 { 开头且包含 id 和 filename，可能是文件
        item.type = 'file';
      } else {
        item.type = 'text';
      }
    }
    return item;
  });

  // 按创建时间倒序排列
  items.sort((a, b) => b.createdAt - a.createdAt);

  return jsonResponse({
    items,
  }, 200, corsHeaders);
}

// 添加剪贴板项目
async function handleAddClipboardItem(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  const body = await request.json();
  const { content, type } = body;

  if (!content || !content.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400, corsHeaders);
  }

  // 从 KV 获取现有的剪贴板列表
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  const items = existingData ? JSON.parse(existingData) : [];

  // 添加新项目
  const newItem = {
    content: content.trim(),
    type: type || 'text',
    createdAt: Date.now(),
  };
  items.push(newItem);

  // 保存回 KV（7天过期）
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return jsonResponse({
    success: true,
    item: newItem
  }, 200, corsHeaders);
}

// 删除剪贴板项目
async function handleDeleteClipboardItem(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  // 获取索引
  const index = parseInt(url.pathname.split('/').pop());
  if (isNaN(index)) {
    return jsonResponse({ error: 'Invalid index' }, 400, corsHeaders);
  }

  // 从 KV 获取现有的剪贴板列表
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  let items = existingData ? JSON.parse(existingData) : [];

  // 为旧数据添加 type 字段（从内容推断）
  items = items.map(item => {
    if (!item.type) {
      // 如果内容以 [ 开头且包含 http，可能是图片数组
      if (item.content && item.content.startsWith('[') && item.content.includes('http')) {
        item.type = 'image';
      } else if (item.content && item.content.startsWith('{') && item.content.includes('"id"') && item.content.includes('"filename"')) {
        // 如果内容以 { 开头且包含 id 和 filename，可能是文件
        item.type = 'file';
      } else {
        item.type = 'text';
      }
    }
    return item;
  });

  // 按创建时间倒序排列（与获取列表时保持一致）
  items.sort((a, b) => b.createdAt - a.createdAt);

  if (index < 0 || index >= items.length) {
    return jsonResponse({ error: 'Index out of range' }, 404, corsHeaders);
  }

  // 获取要删除的项目
  const itemToDelete = items[index];
  console.log('[handleDeleteClipboardItem] 准备删除项目', { index, type: itemToDelete.type, content: itemToDelete.content?.substring(0, 100) });

  // 如果项目是图片或文件类型，删除对应的存储资源
  if (itemToDelete.type === 'image' || itemToDelete.type === 'file') {
    console.log('[handleDeleteClipboardItem] 检测到图片/文件类型，准备删除存储资源');
    try {
      await deleteStorageResources(itemToDelete, userId, env);
    } catch (error) {
      console.error('[handleDeleteClipboardItem] 删除存储资源失败:', error);
      // 继续删除剪贴板项目，即使存储资源删除失败
    }
  } else {
    console.log('[handleDeleteClipboardItem] 文本类型，无需删除存储资源');
  }

  // 删除项目
  items.splice(index, 1);

  // 保存回 KV（保持原始顺序，不按时间排序）
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return jsonResponse({
    success: true,
  }, 200, corsHeaders);
}

// 辅助函数：删除剪贴板项目关联的存储资源
async function deleteStorageResources(item, userId, env) {
  console.log('[deleteStorageResources] 开始删除存储资源', { type: item.type, content: item.content?.substring(0, 100) });
  
  const userStorageKey = `user_storage:${userId}`;
  const storageData = await env.CLIPBOARD_KV.get(userStorageKey);

  if (!storageData) {
    console.log('[deleteStorageResources] 未找到存储数据');
    return;
  }

  const storage = JSON.parse(storageData);
  console.log('[deleteStorageResources] 存储数据', { 
    totalSize: storage.totalSize, 
    imagesCount: storage.images?.length,
    filesCount: storage.files?.length 
  });

  if (item.type === 'image') {
    // 解析图片内容，获取图片 ID 列表
    let imageIds = [];
    try {
      const parsed = JSON.parse(item.content);
      console.log('[deleteStorageResources] 解析图片内容', parsed);
      if (Array.isArray(parsed)) {
        // 从 URL 中提取图片 ID
        imageIds = parsed.map(url => {
          console.log('[deleteStorageResources] 处理图片 URL', url);
          // 支持多种 URL 格式：
          // /api/images/xxx
          // /api/images/xxx?session=yyy
          // https://xxx.r2.dev/xxx
          const match = url.match(/\/api\/images\/([^\/\?]+)/);
          if (match) {
            console.log('[deleteStorageResources] 提取到图片 ID', match[1]);
            return match[1];
          }
          // 尝试从 r2.dev URL 中提取
          const r2Match = url.match(/\/([^\/]+)\/[^\/]+$/);
          if (r2Match) {
            console.log('[deleteStorageResources] 从 R2 URL 提取到图片 ID', r2Match[1]);
            return r2Match[1];
          }
          console.log('[deleteStorageResources] 无法从 URL 提取图片 ID');
          return null;
        }).filter(id => id !== null);
      }
    } catch (e) {
      console.error('[deleteStorageResources] 解析图片内容失败:', e);
      return;
    }

    console.log('[deleteStorageResources] 提取到的图片 IDs', imageIds);
    console.log('[deleteStorageResources] 存储中的图片', storage.images?.map(img => img.id));

    // 删除匹配的图片
    if (imageIds.length > 0 && storage.images) {
      for (const imageId of imageIds) {
        const imageIndex = storage.images.findIndex(img => img.id === imageId);
        console.log(`[deleteStorageResources] 查找图片 ${imageId}, 索引: ${imageIndex}`);
        if (imageIndex !== -1) {
          const image = storage.images[imageIndex];
          // 从 R2 删除文件
          try {
            await env.IMAGES_BUCKET.delete(image.filename);
            console.log(`[deleteStorageResources] 已从 R2 删除图片 ${image.filename}`);
          } catch (e) {
            console.error('[deleteStorageResources] 从 R2 删除图片失败:', e);
          }
          // 更新存储统计
          storage.totalSize -= image.size;
          // 从列表中移除
          storage.images.splice(imageIndex, 1);
          console.log(`[deleteStorageResources] 已从存储列表移除图片 ${imageId}`);
        }
      }
      // 保存更新后的存储信息
      await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
        expirationTtl: 30 * 24 * 60 * 60,
      });
      console.log('[deleteStorageResources] 已更新存储信息');
    }
  } else if (item.type === 'file') {
    // 解析文件内容，获取文件 ID
    let fileId = null;
    try {
      const parsed = JSON.parse(item.content);
      console.log('[deleteStorageResources] 解析文件内容', parsed);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        fileId = parsed.id;
      }
    } catch (e) {
      console.error('[deleteStorageResources] 解析文件内容失败:', e);
      return;
    }

    console.log('[deleteStorageResources] 提取到的文件 ID', fileId);
    console.log('[deleteStorageResources] 存储中的文件', storage.files?.map(f => f.id));

    // 删除匹配的文件
    if (fileId && storage.files) {
      const fileIndex = storage.files.findIndex(f => f.id === fileId);
      console.log(`[deleteStorageResources] 查找文件 ${fileId}, 索引: ${fileIndex}`);
      if (fileIndex !== -1) {
        const file = storage.files[fileIndex];
        // 从 R2 删除文件
        try {
          await env.IMAGES_BUCKET.delete(file.filename);
          console.log(`[deleteStorageResources] 已从 R2 删除文件 ${file.filename}`);
        } catch (e) {
          console.error('[deleteStorageResources] 从 R2 删除文件失败:', e);
        }
        // 更新存储统计
        storage.totalSize -= file.size;
        // 从列表中移除
        storage.files.splice(fileIndex, 1);
        // 保存更新后的存储信息
        await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
          expirationTtl: 30 * 24 * 60 * 60,
        });
        console.log(`[deleteStorageResources] 已更新存储信息`);
      }
    }
  }
}

// 生成唯一的5位提取码
async function generateUniqueCode(env, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const exists = await env.CLIPBOARD_KV.get(`clip:${code}`);
    if (!exists) {
      return code;
    }
  }
  throw new Error('Failed to generate unique code');
}

// 恢复剪贴板项目到指定位置
async function handleRestoreClipboardItem(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  // 获取索引
  const index = parseInt(url.pathname.split('/').pop());
  if (isNaN(index)) {
    return jsonResponse({ error: 'Invalid index' }, 400, corsHeaders);
  }

  const body = await request.json();
  const { content, createdAt } = body;

  if (!content || !content.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400, corsHeaders);
  }

  // 从 KV 获取现有的剪贴板列表
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  const items = existingData ? JSON.parse(existingData) : [];

  // 在指定位置插入项目
  const itemToRestore = {
    content: content.trim(),
    createdAt: createdAt || Date.now(),
  };

  // 确保索引在有效范围内
  const insertIndex = Math.min(Math.max(0, index), items.length);
  items.splice(insertIndex, 0, itemToRestore);

  // 保存回 KV（7天过期）
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return jsonResponse({
    success: true,
    item: itemToRestore,
  }, 200, corsHeaders);
}
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 辅助函数：获取 Cookie
function getCookie(request, name) {
  const cookies = request.headers.get('Cookie');
  if (!cookies) return null;

  const match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// 辅助函数：JSON 响应
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

// ==================== 分享功能 API ====================

// 创建分享
async function handleCreateShare(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  let userLogin = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      const user = JSON.parse(sessionData);
      userId = user.userId;
      userLogin = user.login;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  const body = await request.json();
  const { content, type = 'text', fileInfo, visibility = 'public', expireHours = 24 } = body;

  if (!content || !content.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400, corsHeaders);
  }

  // 生成5位分享码
  const shareCode = await generateUniqueShareCode(env);

  // 计算过期时间
  const now = Date.now();
  const expiresAt = now + expireHours * 60 * 60 * 1000;

  // 创建分享数据
  const shareData = {
    id: shareCode,
    content: content.trim(),
    type: type || 'text',
    fileInfo: fileInfo || null,
    visibility, // 'public' | 'authenticated' | 'private'
    ownerId: userId,
    ownerLogin: userLogin,
    createdAt: now,
    expiresAt,
  };

  // 保存到 KV
  await env.CLIPBOARD_KV.put(`share:${shareCode}`, JSON.stringify(shareData), {
    expirationTtl: expireHours * 60 * 60,
  });

  // 保存到用户的分享列表
  const userSharesKey = `user_shares_list:${userId}`;
  const existingShares = await env.CLIPBOARD_KV.get(userSharesKey);
  const shares = existingShares ? JSON.parse(existingShares) : [];
  shares.push({
    id: shareCode,
    content: content.trim().substring(0, 100) + (content.length > 100 ? '...' : ''),
    type: type || 'text',
    visibility,
    createdAt: now,
    expiresAt,
  });
  await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(shares), {
    expirationTtl: 30 * 24 * 60 * 60, // 30天
  });

  // 使用参数形式的分享链接（适配 GitHub Pages）
  const shareUrl = `${env.FRONTEND_URL}/?share=${shareCode}`;

  return jsonResponse({
    success: true,
    share: {
      id: shareCode,
      content: content.trim(),
      visibility,
      createdAt: now,
      expiresAt,
      shareUrl: shareUrl,
    },
  }, 200, corsHeaders);
}

// 生成唯一的5位分享码
async function generateUniqueShareCode(env, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const exists = await env.CLIPBOARD_KV.get(`share:${code}`);
    if (!exists) {
      return code;
    }
  }
  throw new Error('Failed to generate unique share code');
}

// 获取分享内容
async function handleGetShare(request, env, corsHeaders) {
  const url = new URL(request.url);
  // 支持从 query 参数获取分享码（适配 GitHub Pages）
  let shareId = url.searchParams.get('share');

  // 如果没有 query 参数，尝试从 path 获取
  if (!shareId) {
    shareId = url.pathname.split('/').pop();
  }

  if (!shareId) {
    return jsonResponse({ error: 'Share ID is required' }, 400, corsHeaders);
  }

  // 获取分享数据
  const shareData = await env.CLIPBOARD_KV.get(`share:${shareId}`);
  if (!shareData) {
    return jsonResponse({ error: 'Share not found or expired' }, 404, corsHeaders);
  }

  const share = JSON.parse(shareData);

  // 检查是否过期
  if (Date.now() > share.expiresAt) {
    await env.CLIPBOARD_KV.delete(`share:${shareId}`);
    return jsonResponse({ error: 'Share expired' }, 410, corsHeaders);
  }

  // 权限检查
  if (share.visibility === 'private') {
    // 仅自己可查看，需要登录并验证身份
    let sessionId = url.searchParams.get('session');
    if (!sessionId) {
      sessionId = getCookie(request, 'session_id');
    }

    let userId = null;
    if (sessionId) {
      const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
      if (sessionData) {
        userId = JSON.parse(sessionData).userId;
      }
    }

    if (!userId || userId !== share.ownerId) {
      return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders);
    }
  } else if (share.visibility === 'authenticated') {
    // 登录用户可查看
    let sessionId = url.searchParams.get('session');
    if (!sessionId) {
      sessionId = getCookie(request, 'session_id');
    }

    let userId = null;
    if (sessionId) {
      const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
      if (sessionData) {
        userId = JSON.parse(sessionData).userId;
      }
    }

    if (!userId) {
      return jsonResponse({ error: 'Login required' }, 401, corsHeaders);
    }
  }
  // public: 任何人可访问，无需检查

  // 推断类型（兼容旧分享）
  let shareType = share.type;
  if (!shareType) {
    if (share.content && share.content.startsWith('[') && share.content.includes('http')) {
      shareType = 'image';
    } else if (share.fileInfo) {
      shareType = 'file';
    } else {
      shareType = 'text';
    }
  }

  return jsonResponse({
    id: share.id,
    content: share.content,
    type: shareType,
    fileInfo: share.fileInfo || null,
    visibility: share.visibility,
    ownerLogin: share.ownerLogin,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
  }, 200, corsHeaders);
}

// 获取我的分享列表
async function handleGetMySharesList(request, env, corsHeaders) {
  const url = new URL(request.url);

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  // 获取用户的分享列表
  const userSharesKey = `user_shares_list:${userId}`;
  const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
  const shares = sharesData ? JSON.parse(sharesData) : [];

  // 过滤掉已过期的分享
  const now = Date.now();
  const validShares = shares.filter(s => s.expiresAt > now);

  // 如果有过期分享被过滤，更新列表
  if (validShares.length !== shares.length) {
    await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(validShares), {
      expirationTtl: 30 * 24 * 60 * 60,
    });
  }

  return jsonResponse({
    shares: validShares,
  }, 200, corsHeaders);
}

// 删除分享
async function handleDeleteShare(request, env, corsHeaders) {
  const url = new URL(request.url);
  const shareId = url.pathname.split('/').pop();

  // 优先从 URL 参数获取 session
  let sessionId = url.searchParams.get('session');

  // 如果没有，从 cookie 获取
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;

  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  // 检查是否登录
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  // 获取分享数据验证所有权
  const shareData = await env.CLIPBOARD_KV.get(`share:${shareId}`);
  if (!shareData) {
    return jsonResponse({ error: 'Share not found' }, 404, corsHeaders);
  }

  const share = JSON.parse(shareData);
  if (share.ownerId !== userId) {
    return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders);
  }

  // 删除分享
  await env.CLIPBOARD_KV.delete(`share:${shareId}`);

  // 从用户分享列表中移除
  const userSharesKey = `user_shares_list:${userId}`;
  const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
  if (sharesData) {
    const shares = JSON.parse(sharesData);
    const updatedShares = shares.filter(s => s.id !== shareId);
    await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(updatedShares), {
      expirationTtl: 30 * 24 * 60 * 60,
    });
  }

  return jsonResponse({
    success: true,
  }, 200, corsHeaders);
}

// ==================== 图片上传和存储管理 API ====================

// 上传图片到 R2
async function handleUploadImage(request, env, corsHeaders) {
  const url = new URL(request.url);

  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [] };

    const MAX_STORAGE = 200 * 1024 * 1024;
    if (storage.totalSize >= MAX_STORAGE) {
      return jsonResponse({ error: 'Storage limit exceeded. Max 200MB.' }, 400, corsHeaders);
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!file) {
      return jsonResponse({ error: 'No image file provided' }, 400, corsHeaders);
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: 'File size exceeds 5MB limit' }, 400, corsHeaders);
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${timestamp}-${randomStr}.${fileExt}`;

    await env.IMAGES_BUCKET.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });

    // 使用 Worker 代理地址，避免 R2 401 问题
    const imageId = `${timestamp}-${randomStr}`;
    const imageUrl = `${env.WORKER_URL}/api/images/${imageId}`;

    const imageInfo = {
      id: imageId,
      url: imageUrl,
      filename: fileName,
      size: file.size,
      createdAt: timestamp,
    };

    storage.images.push(imageInfo);
    storage.totalSize += file.size;

    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    return jsonResponse({
      success: true,
      image: imageInfo,
      totalSize: storage.totalSize,
      maxSize: MAX_STORAGE,
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Upload image error:', error);
    return jsonResponse({ error: 'Upload failed: ' + error.message }, 500, corsHeaders);
  }
}

// 获取存储信息
async function handleGetStorageInfo(request, env, corsHeaders) {
  const url = new URL(request.url);

  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [], files: [] };

    // 确保 files 数组存在
    if (!storage.files) {
      storage.files = [];
    }

    const MAX_STORAGE = 200 * 1024 * 1024;

    // 转换旧图片 URL 为新的 Worker 代理 URL
    const updatedImages = storage.images.map(img => {
      // 如果 URL 是旧的 R2 格式，转换为新的 Worker 代理格式
      if (img.url && img.url.includes('r2.dev')) {
        return {
          ...img,
          url: `${env.WORKER_URL}/api/images/${img.id}`
        };
      }
      return img;
    });

    return jsonResponse({
      totalSize: storage.totalSize,
      maxSize: MAX_STORAGE,
      images: updatedImages,
      files: storage.files,
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Get storage info error:', error);
    return jsonResponse({ error: 'Failed to get storage info' }, 500, corsHeaders);
  }
}

// 删除图片
async function handleDeleteImage(request, env, corsHeaders) {
  const url = new URL(request.url);
  const imageId = url.pathname.split('/').pop();

  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);

    if (!storageData) {
      return jsonResponse({ error: 'Image not found' }, 404, corsHeaders);
    }

    const storage = JSON.parse(storageData);
    const imageIndex = storage.images.findIndex(img => img.id === imageId);

    if (imageIndex === -1) {
      return jsonResponse({ error: 'Image not found' }, 404, corsHeaders);
    }

    const image = storage.images[imageIndex];
    await env.IMAGES_BUCKET.delete(image.filename);

    storage.totalSize -= image.size;
    storage.images.splice(imageIndex, 1);

    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    return jsonResponse({ success: true, totalSize: storage.totalSize }, 200, corsHeaders);

  } catch (error) {
    console.error('Delete image error:', error);
    return jsonResponse({ error: 'Delete failed: ' + error.message }, 500, corsHeaders);
  }
}
// 获取图片（代理 R2 访问）
async function handleGetImage(request, env, corsHeaders) {
  const url = new URL(request.url);
  const imageId = url.pathname.split('/').pop();

  // 从 URL 参数获取用户信息（用于验证权限）
  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  try {
    // 构建图片文件名（需要 userId 前缀）
    let fileName;

    if (userId) {
      // 已登录用户，从自己存储中查找
      const userStorageKey = `user_storage:${userId}`;
      const storageData = await env.CLIPBOARD_KV.get(userStorageKey);

      if (storageData) {
        const storage = JSON.parse(storageData);
        const image = storage.images.find(img => img.id === imageId);
        if (image) {
          fileName = image.filename;
        }
      }
    }

    // 如果没有找到，尝试直接访问（用于分享的图片）
    if (!fileName) {
      // 从所有用户存储中查找（简化处理，实际可能需要更好的方案）
      fileName = await findImageFileName(env, imageId);
    }

    if (!fileName) {
      return jsonResponse({ error: 'Image not found' }, 404, corsHeaders);
    }

    // 从 R2 获取图片
    const object = await env.IMAGES_BUCKET.get(fileName);

    if (!object) {
      return jsonResponse({ error: 'Image not found' }, 404, corsHeaders);
    }

    // 返回图片数据
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*'); // 允许所有来源访问图片
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(object.body, { headers });

  } catch (error) {
    console.error('Get image error:', error);
    return jsonResponse({ error: 'Failed to get image' }, 500, corsHeaders);
  }
}

// 辅助函数：在所有用户存储中查找图片
async function findImageFileName(env, imageId) {
  // 列出所有用户存储键
  const list = await env.CLIPBOARD_KV.list({ prefix: 'user_storage:' });

  for (const key of list.keys) {
    const storageData = await env.CLIPBOARD_KV.get(key.name);
    if (storageData) {
      const storage = JSON.parse(storageData);
      const image = storage.images.find(img => img.id === imageId);
      if (image) {
        return image.filename;
      }
    }
  }

  return null;
}
// 上传文件到 R2（支持任意文件类型，最大 50MB）
async function handleUploadFile(request, env, corsHeaders) {
  const url = new URL(request.url);

  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [], files: [] };

    // 确保 files 数组存在
    if (!storage.files) {
      storage.files = [];
    }

    const MAX_STORAGE = 200 * 1024 * 1024;
    if (storage.totalSize >= MAX_STORAGE) {
      return jsonResponse({ error: 'Storage limit exceeded. Max 200MB.' }, 400, corsHeaders);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return jsonResponse({ error: 'No file provided' }, 400, corsHeaders);
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: 'File size exceeds 50MB limit' }, 400, corsHeaders);
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileExt = file.name.split('.').pop() || 'bin';
    const fileName = `${userId}/files/${timestamp}-${randomStr}.${fileExt}`;

    await env.IMAGES_BUCKET.put(fileName, file.stream(), {
      httpMetadata: { 
        contentType: file.type || 'application/octet-stream',
        contentDisposition: `attachment; filename="${file.name}"`
      },
    });

    // 使用 Worker 代理地址
    const fileId = `${timestamp}-${randomStr}`;
    const fileUrl = `${env.WORKER_URL}/api/files/${fileId}`;

    const fileInfo = {
      id: fileId,
      url: fileUrl,
      filename: fileName,
      originalName: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      createdAt: timestamp,
    };

    storage.files.push(fileInfo);
    storage.totalSize += file.size;

    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    return jsonResponse({
      success: true,
      file: fileInfo,
      totalSize: storage.totalSize,
      maxSize: MAX_STORAGE,
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Upload file error:', error);
    return jsonResponse({ error: 'Upload failed: ' + error.message }, 500, corsHeaders);
  }
}

// 获取文件（支持下载）
async function handleGetFile(request, env, corsHeaders) {
  const url = new URL(request.url);
  const fileId = url.pathname.split('/').pop();

  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  try {
    // 构建文件名
    let fileName = null;
    let originalName = null;

    if (userId) {
      // 已登录用户，从自己存储中查找
      const userStorageKey = `user_storage:${userId}`;
      const storageData = await env.CLIPBOARD_KV.get(userStorageKey);

      if (storageData) {
        const storage = JSON.parse(storageData);
        const file = storage.files?.find(f => f.id === fileId);
        if (file) {
          fileName = file.filename;
          originalName = file.originalName;
        }
      }
    }

    // 如果没有找到，尝试从所有用户存储中查找
    if (!fileName) {
      const list = await env.CLIPBOARD_KV.list({ prefix: 'user_storage:' });
      for (const key of list.keys) {
        const storageData = await env.CLIPBOARD_KV.get(key.name);
        if (storageData) {
          const storage = JSON.parse(storageData);
          const file = storage.files?.find(f => f.id === fileId);
          if (file) {
            fileName = file.filename;
            originalName = file.originalName;
            break;
          }
        }
      }
    }

    if (!fileName) {
      return jsonResponse({ error: 'File not found' }, 404, corsHeaders);
    }

    // 从 R2 获取文件
    const object = await env.IMAGES_BUCKET.get(fileName);

    if (!object) {
      return jsonResponse({ error: 'File not found' }, 404, corsHeaders);
    }

    // 返回文件数据，支持下载
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Cache-Control', 'public, max-age=86400');
    
    // 设置下载文件名
    if (originalName) {
      headers.set('Content-Disposition', `attachment; filename="${originalName}"`);
    }

    return new Response(object.body, { headers });

  } catch (error) {
    console.error('Get file error:', error);
    return jsonResponse({ error: 'Failed to get file' }, 500, corsHeaders);
  }
}

// 删除文件
async function handleDeleteFile(request, env, corsHeaders) {
  const url = new URL(request.url);
  const fileId = url.pathname.split('/').pop();

  let sessionId = url.searchParams.get('session');
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }

  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }

  if (!userId) {
    return jsonResponse({ error: 'Unauthorized. Please login first.' }, 401, corsHeaders);
  }

  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);

    if (!storageData) {
      return jsonResponse({ error: 'File not found' }, 404, corsHeaders);
    }

    const storage = JSON.parse(storageData);
    if (!storage.files) {
      return jsonResponse({ error: 'File not found' }, 404, corsHeaders);
    }

    const fileIndex = storage.files.findIndex(f => f.id === fileId);

    if (fileIndex === -1) {
      return jsonResponse({ error: 'File not found' }, 404, corsHeaders);
    }

    const file = storage.files[fileIndex];
    await env.IMAGES_BUCKET.delete(file.filename);

    storage.totalSize -= file.size;
    storage.files.splice(fileIndex, 1);

    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    return jsonResponse({ success: true, totalSize: storage.totalSize }, 200, corsHeaders);

  } catch (error) {
    console.error('Delete file error:', error);
    return jsonResponse({ error: 'Delete failed: ' + error.message }, 500, corsHeaders);
  }
}

// ========== 管理员功能 ==========

// 管理员用户名列表
const ADMIN_USERS = ['PANDAJSR', 'olojiang'];

// 检查是否为管理员
function isAdmin(login) {
  return ADMIN_USERS.includes(login);
}

// 获取当前登录用户
async function getCurrentUser(request, env) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get('session');
  
  if (!sessionId) {
    sessionId = getCookie(request, 'session_id');
  }
  
  if (!sessionId) {
    return null;
  }
  
  const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
  if (!sessionData) {
    return null;
  }
  
  return JSON.parse(sessionData);
}

// 管理员：获取所有分享
async function handleAdminGetAllShares(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders);
    }
    
    // 列出所有分享
    const shares = [];
    const list = await env.CLIPBOARD_KV.list({ prefix: 'share:' });
    
    for (const key of list.keys) {
      const shareData = await env.CLIPBOARD_KV.get(key.name);
      if (shareData) {
        const share = JSON.parse(shareData);
        shares.push({
          id: share.id,
          content: share.content.substring(0, 100) + (share.content.length > 100 ? '...' : ''),
          type: share.type || 'text',
          visibility: share.visibility,
          ownerId: share.ownerId,
          ownerLogin: share.ownerLogin,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
        });
      }
    }
    
    // 按创建时间倒序排列
    shares.sort((a, b) => b.createdAt - a.createdAt);
    
    return jsonResponse({ shares, total: shares.length }, 200, corsHeaders);
  } catch (error) {
    console.error('Admin get all shares error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500, corsHeaders);
  }
}

// 管理员：获取所有用户存储统计
async function handleAdminGetStorageStats(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders);
    }
    
    // 列出所有用户存储
    const users = [];
    const list = await env.CLIPBOARD_KV.list({ prefix: 'user_storage:' });
    
    let totalSize = 0;
    let totalImages = 0;
    let totalFiles = 0;
    
    for (const key of list.keys) {
      const storageData = await env.CLIPBOARD_KV.get(key.name);
      if (storageData) {
        try {
          const storage = JSON.parse(storageData);
          const userId = key.name.replace('user_storage:', '');
          
          // 确保所有字段都是数字
          const userTotalSize = Number(storage.totalSize) || 0;
          const userImagesCount = Number(storage.images?.length) || 0;
          const userFilesCount = Number(storage.files?.length) || 0;
          
          totalSize += userTotalSize;
          totalImages += userImagesCount;
          totalFiles += userFilesCount;
          
          users.push({
            userId: String(userId),
            totalSize: userTotalSize,
            imagesCount: userImagesCount,
            filesCount: userFilesCount,
          });
        } catch (e) {
          console.error('解析用户存储数据失败:', key.name, e);
          // 跳过这个用户的数据
        }
      }
    }
    
    // 按存储大小倒序排列
    users.sort((a, b) => b.totalSize - a.totalSize);
    
    const result = {
      users,
      summary: {
        totalUsers: users.length,
        totalSize: Number(totalSize),
        totalImages: Number(totalImages),
        totalFiles: Number(totalFiles),
      }
    };
    
    console.log('管理员存储统计结果:', JSON.stringify(result));
    
    return jsonResponse(result, 200, corsHeaders);
  } catch (error) {
    console.error('Admin get storage stats error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500, corsHeaders);
  }
}

// 管理员：删除任意分享
async function handleAdminDeleteShare(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: 'Unauthorized' }, 403, corsHeaders);
    }
    
    const url = new URL(request.url);
    const shareId = url.pathname.split('/').pop();
    
    // 获取分享数据
    const shareData = await env.CLIPBOARD_KV.get(`share:${shareId}`);
    if (!shareData) {
      return jsonResponse({ error: 'Share not found' }, 404, corsHeaders);
    }
    
    const share = JSON.parse(shareData);
    
    // 删除分享
    await env.CLIPBOARD_KV.delete(`share:${shareId}`);
    
    // 从用户分享列表中移除
    const userSharesKey = `user_shares_list:${share.ownerId}`;
    const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
    if (sharesData) {
      const shares = JSON.parse(sharesData);
      const updatedShares = shares.filter(s => s.id !== shareId);
      await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(updatedShares), {
        expirationTtl: 30 * 24 * 60 * 60,
      });
    }
    
    return jsonResponse({ success: true }, 200, corsHeaders);
  } catch (error) {
    console.error('Admin delete share error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500, corsHeaders);
  }
}