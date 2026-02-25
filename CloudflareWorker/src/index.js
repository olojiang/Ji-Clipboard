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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  const items = clipboardData ? JSON.parse(clipboardData) : [];
  
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
  const { content } = body;

  if (!content || !content.trim()) {
    return jsonResponse({ error: 'Content is required' }, 400, corsHeaders);
  }

  // 从 KV 获取现有的剪贴板列表
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  const items = existingData ? JSON.parse(existingData) : [];
  
  // 添加新项目
  items.push({
    content: content.trim(),
    createdAt: Date.now(),
  });
  
  // 保存回 KV（7天过期）
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return jsonResponse({
    success: true,
    item: {
      content: content.trim(),
      createdAt: Date.now(),
    }
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
  const items = existingData ? JSON.parse(existingData) : [];
  
  if (index < 0 || index >= items.length) {
    return jsonResponse({ error: 'Index out of range' }, 404, corsHeaders);
  }
  
  // 删除项目
  items.splice(index, 1);
  
  // 保存回 KV
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60,
  });

  return jsonResponse({
    success: true,
  }, 200, corsHeaders);
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

// 辅助函数：生成随机字符串
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
