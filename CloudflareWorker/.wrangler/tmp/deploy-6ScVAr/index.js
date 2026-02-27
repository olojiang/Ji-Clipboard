var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin") || env.FRONTEND_URL;
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin || "https://olojiang.github.io",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path === "/auth/github") {
        return handleGitHubAuth(request, env, corsHeaders);
      }
      if (path === "/auth/callback") {
        return handleGitHubCallback(request, env, corsHeaders);
      }
      if (path === "/api/me") {
        return handleGetMe(request, env, corsHeaders);
      }
      if (path === "/api/logout") {
        return handleLogout(request, env, corsHeaders);
      }
      if (path === "/api/clipboard" && request.method === "POST") {
        return handleSaveClipboard(request, env, corsHeaders);
      }
      if (path === "/api/clipboard" || path.startsWith("/api/clipboard/")) {
        return handleGetClipboard(request, env, corsHeaders);
      }
      if (path === "/api/my-shares") {
        return handleGetMyShares(request, env, corsHeaders);
      }
      if (path === "/api/clipboard-items") {
        if (request.method === "GET") {
          return handleGetClipboardItems(request, env, corsHeaders);
        }
        if (request.method === "POST") {
          return handleAddClipboardItem(request, env, corsHeaders);
        }
      }
      if (path.startsWith("/api/clipboard-items/")) {
        if (request.method === "DELETE") {
          return handleDeleteClipboardItem(request, env, corsHeaders);
        }
        if (request.method === "PUT") {
          return handleRestoreClipboardItem(request, env, corsHeaders);
        }
      }
      if (path === "/api/shares") {
        if (request.method === "GET") {
          return handleGetMySharesList(request, env, corsHeaders);
        }
        if (request.method === "POST") {
          return handleCreateShare(request, env, corsHeaders);
        }
      }
      if (path.startsWith("/api/shares/")) {
        if (request.method === "GET") {
          return handleGetShare(request, env, corsHeaders);
        }
        if (request.method === "DELETE") {
          return handleDeleteShare(request, env, corsHeaders);
        }
      }
      if (path === "/api/upload-image" && request.method === "POST") {
        return handleUploadImage(request, env, corsHeaders);
      }
      if (path === "/api/upload-file" && request.method === "POST") {
        return handleUploadFile(request, env, corsHeaders);
      }
      if (path === "/api/storage" && request.method === "GET") {
        return handleGetStorageInfo(request, env, corsHeaders);
      }
      if (path === "/api/admin/shares" && request.method === "GET") {
        return handleAdminGetAllShares(request, env, corsHeaders);
      }
      if (path === "/api/admin/storage-stats" && request.method === "GET") {
        return handleAdminGetStorageStats(request, env, corsHeaders);
      }
      if (path.startsWith("/api/admin/shares/") && request.method === "DELETE") {
        return handleAdminDeleteShare(request, env, corsHeaders);
      }
      if (path.startsWith("/api/admin/users/") && request.method === "GET") {
        return handleAdminGetUserDetail(request, env, corsHeaders);
      }
      if (path.startsWith("/api/images/") && request.method === "DELETE") {
        return handleDeleteImage(request, env, corsHeaders);
      }
      if (path.startsWith("/api/images/") && request.method === "GET") {
        return handleGetImage(request, env, corsHeaders);
      }
      if (path.startsWith("/api/files/") && request.method === "GET") {
        return handleGetFile(request, env, corsHeaders);
      }
      if (path.startsWith("/api/files/") && request.method === "DELETE") {
        return handleDeleteFile(request, env, corsHeaders);
      }
      return jsonResponse({ error: "Not Found" }, 404, corsHeaders);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse({ error: "Internal Server Error" }, 500, corsHeaders);
    }
  }
};
async function handleGitHubAuth(request, env, corsHeaders) {
  const state = generateRandomString(32);
  await env.AUTH_KV.put(`state:${state}`, "1", { expirationTtl: 300 });
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(env.WORKER_URL + "/auth/callback")}&state=${state}&scope=user:email`;
  return Response.redirect(githubAuthUrl, 302);
}
__name(handleGitHubAuth, "handleGitHubAuth");
async function handleGitHubCallback(request, env, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return jsonResponse({ error: "Missing code or state" }, 400, corsHeaders);
  }
  const stateValid = await env.AUTH_KV.get(`state:${state}`);
  if (!stateValid) {
    return jsonResponse({ error: "Invalid or expired state" }, 400, corsHeaders);
  }
  await env.AUTH_KV.delete(`state:${state}`);
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.WORKER_URL + "/auth/callback"
    })
  });
  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    return jsonResponse({ error: tokenData.error_description }, 400, corsHeaders);
  }
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "User-Agent": "Ji-Clipboard"
    }
  });
  const githubUser = await userResponse.json();
  const sessionId = generateRandomString(32);
  const existingSessionId = await env.AUTH_KV.get(`user_session:${githubUser.id}`);
  if (existingSessionId) {
    await env.AUTH_KV.delete(`session:${existingSessionId}`);
  }
  const sessionData = {
    userId: githubUser.id,
    login: githubUser.login,
    name: githubUser.name,
    avatar: githubUser.avatar_url,
    email: githubUser.email,
    createdAt: Date.now()
  };
  await env.AUTH_KV.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: 30 * 24 * 60 * 60
    // 30天
  });
  await env.AUTH_KV.put(`user_session:${githubUser.id}`, sessionId, {
    expirationTtl: 30 * 24 * 60 * 60
    // 30天
  });
  const redirectUrl = new URL(env.FRONTEND_URL || "/");
  redirectUrl.hash = "profile";
  redirectUrl.searchParams.set("session", sessionId);
  const newCookie = `session_id=${sessionId}; HttpOnly; Secure; SameSite=None; Max-Age=${30 * 24 * 60 * 60}; Path=/; Domain=olojiang.workers.dev`;
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      "Location": redirectUrl.toString(),
      "Set-Cookie": newCookie
    }
  });
}
__name(handleGitHubCallback, "handleGitHubCallback");
async function handleGetMe(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  const allCookies = request.headers.get("Cookie");
  console.log("=== GetMe Debug ===");
  console.log("Session from URL:", url.searchParams.get("session"));
  console.log("Session from Cookie:", getCookie(request, "session_id"));
  console.log("Final sessionId:", sessionId);
  if (!sessionId) {
    console.log("No sessionId found");
    return jsonResponse({
      loggedIn: false,
      debug: {
        reason: "no_session_id",
        allCookies
      }
    }, 200, corsHeaders);
  }
  try {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (!sessionData) {
      console.log("Session not found in KV for sessionId:", sessionId);
      return jsonResponse({
        loggedIn: false,
        debug: {
          reason: "session_not_found",
          sessionId
        }
      }, 200, corsHeaders);
    }
    const user = JSON.parse(sessionData);
    console.log("User found:", user.login);
    return jsonResponse({
      loggedIn: true,
      user: {
        id: user.userId,
        login: user.login,
        name: user.name,
        avatar: user.avatar,
        email: user.email
      }
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Error in handleGetMe:", error);
    return jsonResponse({
      loggedIn: false,
      error: "Server error",
      debug: { message: error.message }
    }, 500, corsHeaders);
  }
}
__name(handleGetMe, "handleGetMe");
async function handleLogout(request, env, corsHeaders) {
  const sessionId = getCookie(request, "session_id");
  if (sessionId) {
    await env.AUTH_KV.delete(`session:${sessionId}`);
  }
  return jsonResponse({ success: true }, 200, {
    ...corsHeaders,
    "Set-Cookie": `session_id=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`
  });
}
__name(handleLogout, "handleLogout");
async function handleSaveClipboard(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const body = await request.json();
  const { content, type = "text", expireHours = 24 } = body;
  if (!content) {
    return jsonResponse({ error: "Content is required" }, 400, corsHeaders);
  }
  const code = await generateUniqueCode(env);
  const clipboardData = {
    code,
    content,
    type,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + expireHours * 60 * 60 * 1e3
  };
  await env.CLIPBOARD_KV.put(`clip:${code}`, JSON.stringify(clipboardData), {
    expirationTtl: expireHours * 60 * 60
  });
  const userSharesKey = `user_shares:${userId}`;
  const existingShares = await env.CLIPBOARD_KV.get(userSharesKey);
  const shareCodes = existingShares ? JSON.parse(existingShares) : [];
  shareCodes.push(code);
  await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(shareCodes), {
    expirationTtl: 7 * 24 * 60 * 60
    // 7天
  });
  return jsonResponse({
    success: true,
    code,
    expiresAt: clipboardData.expiresAt
  }, 200, corsHeaders);
}
__name(handleSaveClipboard, "handleSaveClipboard");
async function handleGetClipboard(request, env, corsHeaders) {
  const url = new URL(request.url);
  let code = url.searchParams.get("code");
  if (!code) {
    code = url.pathname.split("/").pop();
  }
  if (!code || code.length !== 5) {
    return jsonResponse({ error: "Invalid code" }, 400, corsHeaders);
  }
  const data = await env.CLIPBOARD_KV.get(`clip:${code}`);
  if (!data) {
    return jsonResponse({ error: "Not found or expired" }, 404, corsHeaders);
  }
  const clipboard = JSON.parse(data);
  if (Date.now() > clipboard.expiresAt) {
    await env.CLIPBOARD_KV.delete(`clip:${code}`);
    return jsonResponse({ error: "Expired" }, 410, corsHeaders);
  }
  return jsonResponse({
    code: clipboard.code,
    content: clipboard.content,
    type: clipboard.type,
    createdAt: clipboard.createdAt,
    expiresAt: clipboard.expiresAt
  }, 200, corsHeaders);
}
__name(handleGetClipboard, "handleGetClipboard");
async function handleGetMyShares(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const userSharesKey = `user_shares:${userId}`;
  const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
  const shareCodes = sharesData ? JSON.parse(sharesData) : [];
  const shares = [];
  for (const code of shareCodes) {
    const clipData = await env.CLIPBOARD_KV.get(`clip:${code}`);
    if (clipData) {
      const clip = JSON.parse(clipData);
      shares.push({
        code: clip.code,
        content: clip.content.substring(0, 100) + (clip.content.length > 100 ? "..." : ""),
        // 截断内容
        type: clip.type,
        createdAt: clip.createdAt,
        expiresAt: clip.expiresAt
      });
    }
  }
  shares.sort((a, b) => b.createdAt - a.createdAt);
  return jsonResponse({
    shares
  }, 200, corsHeaders);
}
__name(handleGetMyShares, "handleGetMyShares");
async function handleGetClipboardItems(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const userClipboardKey = `user_clipboard:${userId}`;
  const clipboardData = await env.CLIPBOARD_KV.get(userClipboardKey);
  let items = clipboardData ? JSON.parse(clipboardData) : [];
  items = items.map((item) => {
    if (!item.type) {
      if (item.content && item.content.startsWith("[") && item.content.includes("http")) {
        item.type = "image";
      } else if (item.content && item.content.startsWith("{") && item.content.includes('"id"') && item.content.includes('"filename"')) {
        item.type = "file";
      } else {
        item.type = "text";
      }
    }
    return item;
  });
  items.sort((a, b) => b.createdAt - a.createdAt);
  return jsonResponse({
    items
  }, 200, corsHeaders);
}
__name(handleGetClipboardItems, "handleGetClipboardItems");
async function handleAddClipboardItem(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const body = await request.json();
  const { content, type } = body;
  if (!content || !content.trim()) {
    return jsonResponse({ error: "Content is required" }, 400, corsHeaders);
  }
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  const items = existingData ? JSON.parse(existingData) : [];
  const newItem = {
    content: content.trim(),
    type: type || "text",
    createdAt: Date.now()
  };
  items.push(newItem);
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60
  });
  return jsonResponse({
    success: true,
    item: newItem
  }, 200, corsHeaders);
}
__name(handleAddClipboardItem, "handleAddClipboardItem");
async function handleDeleteClipboardItem(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const index = parseInt(url.pathname.split("/").pop());
  if (isNaN(index)) {
    return jsonResponse({ error: "Invalid index" }, 400, corsHeaders);
  }
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  let items = existingData ? JSON.parse(existingData) : [];
  items = items.map((item) => {
    if (!item.type) {
      if (item.content && item.content.startsWith("[") && item.content.includes("http")) {
        item.type = "image";
      } else if (item.content && item.content.startsWith("{") && item.content.includes('"id"') && item.content.includes('"filename"')) {
        item.type = "file";
      } else {
        item.type = "text";
      }
    }
    return item;
  });
  items.sort((a, b) => b.createdAt - a.createdAt);
  if (index < 0 || index >= items.length) {
    return jsonResponse({ error: "Index out of range" }, 404, corsHeaders);
  }
  const itemToDelete = items[index];
  console.log("[handleDeleteClipboardItem] \u51C6\u5907\u5220\u9664\u9879\u76EE", { index, type: itemToDelete.type, content: itemToDelete.content?.substring(0, 100) });
  if (itemToDelete.type === "image" || itemToDelete.type === "file") {
    console.log("[handleDeleteClipboardItem] \u68C0\u6D4B\u5230\u56FE\u7247/\u6587\u4EF6\u7C7B\u578B\uFF0C\u51C6\u5907\u5220\u9664\u5B58\u50A8\u8D44\u6E90");
    try {
      await deleteStorageResources(itemToDelete, userId, env);
    } catch (error) {
      console.error("[handleDeleteClipboardItem] \u5220\u9664\u5B58\u50A8\u8D44\u6E90\u5931\u8D25:", error);
    }
  } else {
    console.log("[handleDeleteClipboardItem] \u6587\u672C\u7C7B\u578B\uFF0C\u65E0\u9700\u5220\u9664\u5B58\u50A8\u8D44\u6E90");
  }
  items.splice(index, 1);
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60
  });
  return jsonResponse({
    success: true
  }, 200, corsHeaders);
}
__name(handleDeleteClipboardItem, "handleDeleteClipboardItem");
async function deleteStorageResources(item, userId, env) {
  console.log("[deleteStorageResources] \u5F00\u59CB\u5220\u9664\u5B58\u50A8\u8D44\u6E90", { type: item.type, content: item.content?.substring(0, 100) });
  const userStorageKey = `user_storage:${userId}`;
  const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
  if (!storageData) {
    console.log("[deleteStorageResources] \u672A\u627E\u5230\u5B58\u50A8\u6570\u636E");
    return;
  }
  const storage = JSON.parse(storageData);
  console.log("[deleteStorageResources] \u5B58\u50A8\u6570\u636E", {
    totalSize: storage.totalSize,
    imagesCount: storage.images?.length,
    filesCount: storage.files?.length
  });
  if (item.type === "image") {
    let imageIds = [];
    try {
      const parsed = JSON.parse(item.content);
      console.log("[deleteStorageResources] \u89E3\u6790\u56FE\u7247\u5185\u5BB9", parsed);
      if (Array.isArray(parsed)) {
        imageIds = parsed.map((url) => {
          console.log("[deleteStorageResources] \u5904\u7406\u56FE\u7247 URL", url);
          const match = url.match(/\/api\/images\/([^\/\?]+)/);
          if (match) {
            console.log("[deleteStorageResources] \u63D0\u53D6\u5230\u56FE\u7247 ID", match[1]);
            return match[1];
          }
          const r2Match = url.match(/\/([^\/]+)\/[^\/]+$/);
          if (r2Match) {
            console.log("[deleteStorageResources] \u4ECE R2 URL \u63D0\u53D6\u5230\u56FE\u7247 ID", r2Match[1]);
            return r2Match[1];
          }
          console.log("[deleteStorageResources] \u65E0\u6CD5\u4ECE URL \u63D0\u53D6\u56FE\u7247 ID");
          return null;
        }).filter((id) => id !== null);
      }
    } catch (e) {
      console.error("[deleteStorageResources] \u89E3\u6790\u56FE\u7247\u5185\u5BB9\u5931\u8D25:", e);
      return;
    }
    console.log("[deleteStorageResources] \u63D0\u53D6\u5230\u7684\u56FE\u7247 IDs", imageIds);
    console.log("[deleteStorageResources] \u5B58\u50A8\u4E2D\u7684\u56FE\u7247", storage.images?.map((img) => img.id));
    if (imageIds.length > 0 && storage.images) {
      for (const imageId of imageIds) {
        const imageIndex = storage.images.findIndex((img) => img.id === imageId);
        console.log(`[deleteStorageResources] \u67E5\u627E\u56FE\u7247 ${imageId}, \u7D22\u5F15: ${imageIndex}`);
        if (imageIndex !== -1) {
          const image = storage.images[imageIndex];
          try {
            await env.IMAGES_BUCKET.delete(image.filename);
            console.log(`[deleteStorageResources] \u5DF2\u4ECE R2 \u5220\u9664\u56FE\u7247 ${image.filename}`);
          } catch (e) {
            console.error("[deleteStorageResources] \u4ECE R2 \u5220\u9664\u56FE\u7247\u5931\u8D25:", e);
          }
          storage.totalSize -= image.size;
          storage.images.splice(imageIndex, 1);
          console.log(`[deleteStorageResources] \u5DF2\u4ECE\u5B58\u50A8\u5217\u8868\u79FB\u9664\u56FE\u7247 ${imageId}`);
        }
      }
      await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
        expirationTtl: 30 * 24 * 60 * 60
      });
      console.log("[deleteStorageResources] \u5DF2\u66F4\u65B0\u5B58\u50A8\u4FE1\u606F");
    }
  } else if (item.type === "file") {
    let fileId = null;
    try {
      const parsed = JSON.parse(item.content);
      console.log("[deleteStorageResources] \u89E3\u6790\u6587\u4EF6\u5185\u5BB9", parsed);
      if (parsed && typeof parsed === "object" && parsed.id) {
        fileId = parsed.id;
      }
    } catch (e) {
      console.error("[deleteStorageResources] \u89E3\u6790\u6587\u4EF6\u5185\u5BB9\u5931\u8D25:", e);
      return;
    }
    console.log("[deleteStorageResources] \u63D0\u53D6\u5230\u7684\u6587\u4EF6 ID", fileId);
    console.log("[deleteStorageResources] \u5B58\u50A8\u4E2D\u7684\u6587\u4EF6", storage.files?.map((f) => f.id));
    if (fileId && storage.files) {
      const fileIndex = storage.files.findIndex((f) => f.id === fileId);
      console.log(`[deleteStorageResources] \u67E5\u627E\u6587\u4EF6 ${fileId}, \u7D22\u5F15: ${fileIndex}`);
      if (fileIndex !== -1) {
        const file = storage.files[fileIndex];
        try {
          await env.IMAGES_BUCKET.delete(file.filename);
          console.log(`[deleteStorageResources] \u5DF2\u4ECE R2 \u5220\u9664\u6587\u4EF6 ${file.filename}`);
        } catch (e) {
          console.error("[deleteStorageResources] \u4ECE R2 \u5220\u9664\u6587\u4EF6\u5931\u8D25:", e);
        }
        storage.totalSize -= file.size;
        storage.files.splice(fileIndex, 1);
        await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
          expirationTtl: 30 * 24 * 60 * 60
        });
        console.log(`[deleteStorageResources] \u5DF2\u66F4\u65B0\u5B58\u50A8\u4FE1\u606F`);
      }
    }
  }
}
__name(deleteStorageResources, "deleteStorageResources");
async function generateUniqueCode(env, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = Math.floor(1e4 + Math.random() * 9e4).toString();
    const exists = await env.CLIPBOARD_KV.get(`clip:${code}`);
    if (!exists) {
      return code;
    }
  }
  throw new Error("Failed to generate unique code");
}
__name(generateUniqueCode, "generateUniqueCode");
async function handleRestoreClipboardItem(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const index = parseInt(url.pathname.split("/").pop());
  if (isNaN(index)) {
    return jsonResponse({ error: "Invalid index" }, 400, corsHeaders);
  }
  const body = await request.json();
  const { content, createdAt } = body;
  if (!content || !content.trim()) {
    return jsonResponse({ error: "Content is required" }, 400, corsHeaders);
  }
  const userClipboardKey = `user_clipboard:${userId}`;
  const existingData = await env.CLIPBOARD_KV.get(userClipboardKey);
  const items = existingData ? JSON.parse(existingData) : [];
  const itemToRestore = {
    content: content.trim(),
    createdAt: createdAt || Date.now()
  };
  const insertIndex = Math.min(Math.max(0, index), items.length);
  items.splice(insertIndex, 0, itemToRestore);
  await env.CLIPBOARD_KV.put(userClipboardKey, JSON.stringify(items), {
    expirationTtl: 7 * 24 * 60 * 60
  });
  return jsonResponse({
    success: true,
    item: itemToRestore
  }, 200, corsHeaders);
}
__name(handleRestoreClipboardItem, "handleRestoreClipboardItem");
function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
__name(generateRandomString, "generateRandomString");
function getCookie(request, name) {
  const cookies = request.headers.get("Cookie");
  if (!cookies)
    return null;
  const match = cookies.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
__name(getCookie, "getCookie");
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function handleCreateShare(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
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
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const body = await request.json();
  const { content, type = "text", fileInfo, visibility = "public", expireHours = 24 } = body;
  if (!content || !content.trim()) {
    return jsonResponse({ error: "Content is required" }, 400, corsHeaders);
  }
  const shareCode = await generateUniqueShareCode(env);
  const now = Date.now();
  const expiresAt = now + expireHours * 60 * 60 * 1e3;
  const shareData = {
    id: shareCode,
    content: content.trim(),
    type: type || "text",
    fileInfo: fileInfo || null,
    visibility,
    // 'public' | 'authenticated' | 'private'
    ownerId: userId,
    ownerLogin: userLogin,
    createdAt: now,
    expiresAt
  };
  await env.CLIPBOARD_KV.put(`share:${shareCode}`, JSON.stringify(shareData), {
    expirationTtl: expireHours * 60 * 60
  });
  const userSharesKey = `user_shares_list:${userId}`;
  const existingShares = await env.CLIPBOARD_KV.get(userSharesKey);
  const shares = existingShares ? JSON.parse(existingShares) : [];
  shares.push({
    id: shareCode,
    content: content.trim().substring(0, 100) + (content.length > 100 ? "..." : ""),
    type: type || "text",
    visibility,
    createdAt: now,
    expiresAt
  });
  await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(shares), {
    expirationTtl: 30 * 24 * 60 * 60
    // 30天
  });
  const shareUrl = `${env.FRONTEND_URL}/?share=${shareCode}`;
  return jsonResponse({
    success: true,
    share: {
      id: shareCode,
      content: content.trim(),
      visibility,
      createdAt: now,
      expiresAt,
      shareUrl
    }
  }, 200, corsHeaders);
}
__name(handleCreateShare, "handleCreateShare");
async function generateUniqueShareCode(env, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = Math.floor(1e4 + Math.random() * 9e4).toString();
    const exists = await env.CLIPBOARD_KV.get(`share:${code}`);
    if (!exists) {
      return code;
    }
  }
  throw new Error("Failed to generate unique share code");
}
__name(generateUniqueShareCode, "generateUniqueShareCode");
async function handleGetShare(request, env, corsHeaders) {
  const url = new URL(request.url);
  let shareId = url.searchParams.get("share");
  if (!shareId) {
    shareId = url.pathname.split("/").pop();
  }
  if (!shareId) {
    return jsonResponse({ error: "Share ID is required" }, 400, corsHeaders);
  }
  const shareData = await env.CLIPBOARD_KV.get(`share:${shareId}`);
  if (!shareData) {
    return jsonResponse({ error: "Share not found or expired" }, 404, corsHeaders);
  }
  const share = JSON.parse(shareData);
  if (Date.now() > share.expiresAt) {
    await env.CLIPBOARD_KV.delete(`share:${shareId}`);
    return jsonResponse({ error: "Share expired" }, 410, corsHeaders);
  }
  if (share.visibility === "private") {
    let sessionId = url.searchParams.get("session");
    if (!sessionId) {
      sessionId = getCookie(request, "session_id");
    }
    let userId = null;
    if (sessionId) {
      const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
      if (sessionData) {
        userId = JSON.parse(sessionData).userId;
      }
    }
    if (!userId || userId !== share.ownerId) {
      return jsonResponse({ error: "Unauthorized" }, 403, corsHeaders);
    }
  } else if (share.visibility === "authenticated") {
    let sessionId = url.searchParams.get("session");
    if (!sessionId) {
      sessionId = getCookie(request, "session_id");
    }
    let userId = null;
    if (sessionId) {
      const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
      if (sessionData) {
        userId = JSON.parse(sessionData).userId;
      }
    }
    if (!userId) {
      return jsonResponse({ error: "Login required" }, 401, corsHeaders);
    }
  }
  let shareType = share.type;
  if (!shareType) {
    if (share.content && share.content.startsWith("[") && share.content.includes("http")) {
      shareType = "image";
    } else if (share.fileInfo) {
      shareType = "file";
    } else {
      shareType = "text";
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
    expiresAt: share.expiresAt
  }, 200, corsHeaders);
}
__name(handleGetShare, "handleGetShare");
async function handleGetMySharesList(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const userSharesKey = `user_shares_list:${userId}`;
  const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
  const shares = sharesData ? JSON.parse(sharesData) : [];
  const now = Date.now();
  const validShares = shares.filter((s) => s.expiresAt > now);
  if (validShares.length !== shares.length) {
    await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(validShares), {
      expirationTtl: 30 * 24 * 60 * 60
    });
  }
  return jsonResponse({
    shares: validShares
  }, 200, corsHeaders);
}
__name(handleGetMySharesList, "handleGetMySharesList");
async function handleDeleteShare(request, env, corsHeaders) {
  const url = new URL(request.url);
  const shareId = url.pathname.split("/").pop();
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  const shareData = await env.CLIPBOARD_KV.get(`share:${shareId}`);
  if (!shareData) {
    return jsonResponse({ error: "Share not found" }, 404, corsHeaders);
  }
  const share = JSON.parse(shareData);
  if (share.ownerId !== userId) {
    return jsonResponse({ error: "Unauthorized" }, 403, corsHeaders);
  }
  await env.CLIPBOARD_KV.delete(`share:${shareId}`);
  const userSharesKey = `user_shares_list:${userId}`;
  const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
  if (sharesData) {
    const shares = JSON.parse(sharesData);
    const updatedShares = shares.filter((s) => s.id !== shareId);
    await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(updatedShares), {
      expirationTtl: 30 * 24 * 60 * 60
    });
  }
  return jsonResponse({
    success: true
  }, 200, corsHeaders);
}
__name(handleDeleteShare, "handleDeleteShare");
async function handleUploadImage(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [] };
    const MAX_STORAGE = 200 * 1024 * 1024;
    if (storage.totalSize >= MAX_STORAGE) {
      return jsonResponse({ error: "Storage limit exceeded. Max 200MB." }, 400, corsHeaders);
    }
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file) {
      return jsonResponse({ error: "No image file provided" }, 400, corsHeaders);
    }
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: "File size exceeds 5MB limit" }, 400, corsHeaders);
    }
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${userId}/${timestamp}-${randomStr}.${fileExt}`;
    await env.IMAGES_BUCKET.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type || "image/jpeg" }
    });
    const imageId = `${timestamp}-${randomStr}`;
    const imageUrl = `${env.WORKER_URL}/api/images/${imageId}`;
    const imageInfo = {
      id: imageId,
      url: imageUrl,
      filename: fileName,
      size: file.size,
      createdAt: timestamp
    };
    storage.images.push(imageInfo);
    storage.totalSize += file.size;
    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    return jsonResponse({
      success: true,
      image: imageInfo,
      totalSize: storage.totalSize,
      maxSize: MAX_STORAGE
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Upload image error:", error);
    return jsonResponse({ error: "Upload failed: " + error.message }, 500, corsHeaders);
  }
}
__name(handleUploadImage, "handleUploadImage");
async function handleGetStorageInfo(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [], files: [] };
    if (!storage.files) {
      storage.files = [];
    }
    const MAX_STORAGE = 200 * 1024 * 1024;
    const updatedImages = storage.images.map((img) => {
      if (img.url && img.url.includes("r2.dev")) {
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
      files: storage.files
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Get storage info error:", error);
    return jsonResponse({ error: "Failed to get storage info" }, 500, corsHeaders);
  }
}
__name(handleGetStorageInfo, "handleGetStorageInfo");
async function handleDeleteImage(request, env, corsHeaders) {
  const url = new URL(request.url);
  const imageId = url.pathname.split("/").pop();
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    if (!storageData) {
      return jsonResponse({ error: "Image not found" }, 404, corsHeaders);
    }
    const storage = JSON.parse(storageData);
    const imageIndex = storage.images.findIndex((img) => img.id === imageId);
    if (imageIndex === -1) {
      return jsonResponse({ error: "Image not found" }, 404, corsHeaders);
    }
    const image = storage.images[imageIndex];
    await env.IMAGES_BUCKET.delete(image.filename);
    storage.totalSize -= image.size;
    storage.images.splice(imageIndex, 1);
    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    return jsonResponse({ success: true, totalSize: storage.totalSize }, 200, corsHeaders);
  } catch (error) {
    console.error("Delete image error:", error);
    return jsonResponse({ error: "Delete failed: " + error.message }, 500, corsHeaders);
  }
}
__name(handleDeleteImage, "handleDeleteImage");
async function handleGetImage(request, env, corsHeaders) {
  const url = new URL(request.url);
  const imageId = url.pathname.split("/").pop();
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  try {
    let fileName;
    if (userId) {
      const userStorageKey = `user_storage:${userId}`;
      const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
      if (storageData) {
        const storage = JSON.parse(storageData);
        const image = storage.images.find((img) => img.id === imageId);
        if (image) {
          fileName = image.filename;
        }
      }
    }
    if (!fileName) {
      fileName = await findImageFileName(env, imageId);
    }
    if (!fileName) {
      return jsonResponse({ error: "Image not found" }, 404, corsHeaders);
    }
    const object = await env.IMAGES_BUCKET.get(fileName);
    if (!object) {
      return jsonResponse({ error: "Image not found" }, 404, corsHeaders);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Get image error:", error);
    return jsonResponse({ error: "Failed to get image" }, 500, corsHeaders);
  }
}
__name(handleGetImage, "handleGetImage");
async function findImageFileName(env, imageId) {
  const list = await env.CLIPBOARD_KV.list({ prefix: "user_storage:" });
  for (const key of list.keys) {
    const storageData = await env.CLIPBOARD_KV.get(key.name);
    if (storageData) {
      const storage = JSON.parse(storageData);
      const image = storage.images.find((img) => img.id === imageId);
      if (image) {
        return image.filename;
      }
    }
  }
  return null;
}
__name(findImageFileName, "findImageFileName");
async function handleUploadFile(request, env, corsHeaders) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [], files: [] };
    if (!storage.files) {
      storage.files = [];
    }
    const MAX_STORAGE = 200 * 1024 * 1024;
    if (storage.totalSize >= MAX_STORAGE) {
      return jsonResponse({ error: "Storage limit exceeded. Max 200MB." }, 400, corsHeaders);
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400, corsHeaders);
    }
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: "File size exceeds 50MB limit" }, 400, corsHeaders);
    }
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${userId}/files/${timestamp}-${randomStr}.${fileExt}`;
    await env.IMAGES_BUCKET.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
        contentDisposition: `attachment; filename="${file.name}"`
      }
    });
    const fileId = `${timestamp}-${randomStr}`;
    const fileUrl = `${env.WORKER_URL}/api/files/${fileId}`;
    const fileInfo = {
      id: fileId,
      url: fileUrl,
      filename: fileName,
      originalName: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      createdAt: timestamp
    };
    storage.files.push(fileInfo);
    storage.totalSize += file.size;
    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    return jsonResponse({
      success: true,
      file: fileInfo,
      totalSize: storage.totalSize,
      maxSize: MAX_STORAGE
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Upload file error:", error);
    return jsonResponse({ error: "Upload failed: " + error.message }, 500, corsHeaders);
  }
}
__name(handleUploadFile, "handleUploadFile");
async function handleGetFile(request, env, corsHeaders) {
  const url = new URL(request.url);
  const fileId = url.pathname.split("/").pop();
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  try {
    let fileName = null;
    let originalName = null;
    if (userId) {
      const userStorageKey = `user_storage:${userId}`;
      const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
      if (storageData) {
        const storage = JSON.parse(storageData);
        const file = storage.files?.find((f) => f.id === fileId);
        if (file) {
          fileName = file.filename;
          originalName = file.originalName;
        }
      }
    }
    if (!fileName) {
      const list = await env.CLIPBOARD_KV.list({ prefix: "user_storage:" });
      for (const key of list.keys) {
        const storageData = await env.CLIPBOARD_KV.get(key.name);
        if (storageData) {
          const storage = JSON.parse(storageData);
          const file = storage.files?.find((f) => f.id === fileId);
          if (file) {
            fileName = file.filename;
            originalName = file.originalName;
            break;
          }
        }
      }
    }
    if (!fileName) {
      return jsonResponse({ error: "File not found" }, 404, corsHeaders);
    }
    const object = await env.IMAGES_BUCKET.get(fileName);
    if (!object) {
      return jsonResponse({ error: "File not found" }, 404, corsHeaders);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Cache-Control", "public, max-age=86400");
    if (originalName) {
      headers.set("Content-Disposition", `attachment; filename="${originalName}"`);
    }
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Get file error:", error);
    return jsonResponse({ error: "Failed to get file" }, 500, corsHeaders);
  }
}
__name(handleGetFile, "handleGetFile");
async function handleDeleteFile(request, env, corsHeaders) {
  const url = new URL(request.url);
  const fileId = url.pathname.split("/").pop();
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
  }
  let userId = null;
  if (sessionId) {
    const sessionData = await env.AUTH_KV.get(`session:${sessionId}`);
    if (sessionData) {
      userId = JSON.parse(sessionData).userId;
    }
  }
  if (!userId) {
    return jsonResponse({ error: "Unauthorized. Please login first." }, 401, corsHeaders);
  }
  try {
    const userStorageKey = `user_storage:${userId}`;
    const storageData = await env.CLIPBOARD_KV.get(userStorageKey);
    if (!storageData) {
      return jsonResponse({ error: "File not found" }, 404, corsHeaders);
    }
    const storage = JSON.parse(storageData);
    if (!storage.files) {
      return jsonResponse({ error: "File not found" }, 404, corsHeaders);
    }
    const fileIndex = storage.files.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) {
      return jsonResponse({ error: "File not found" }, 404, corsHeaders);
    }
    const file = storage.files[fileIndex];
    await env.IMAGES_BUCKET.delete(file.filename);
    storage.totalSize -= file.size;
    storage.files.splice(fileIndex, 1);
    await env.CLIPBOARD_KV.put(userStorageKey, JSON.stringify(storage), {
      expirationTtl: 30 * 24 * 60 * 60
    });
    return jsonResponse({ success: true, totalSize: storage.totalSize }, 200, corsHeaders);
  } catch (error) {
    console.error("Delete file error:", error);
    return jsonResponse({ error: "Delete failed: " + error.message }, 500, corsHeaders);
  }
}
__name(handleDeleteFile, "handleDeleteFile");
var ADMIN_USERS = ["PANDAJSR", "olojiang"];
function isAdmin(login) {
  return ADMIN_USERS.includes(login);
}
__name(isAdmin, "isAdmin");
async function getCurrentUser(request, env) {
  const url = new URL(request.url);
  let sessionId = url.searchParams.get("session");
  if (!sessionId) {
    sessionId = getCookie(request, "session_id");
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
__name(getCurrentUser, "getCurrentUser");
async function handleAdminGetAllShares(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: "Unauthorized" }, 403, corsHeaders);
    }
    const shares = [];
    const list = await env.CLIPBOARD_KV.list({ prefix: "share:" });
    for (const key of list.keys) {
      const shareData = await env.CLIPBOARD_KV.get(key.name);
      if (shareData) {
        const share = JSON.parse(shareData);
        shares.push({
          id: share.id,
          content: share.content.substring(0, 100) + (share.content.length > 100 ? "..." : ""),
          type: share.type || "text",
          visibility: share.visibility,
          ownerId: share.ownerId,
          ownerLogin: share.ownerLogin,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt
        });
      }
    }
    shares.sort((a, b) => b.createdAt - a.createdAt);
    return jsonResponse({ shares, total: shares.length }, 200, corsHeaders);
  } catch (error) {
    console.error("Admin get all shares error:", error);
    return jsonResponse({ error: "Internal Server Error" }, 500, corsHeaders);
  }
}
__name(handleAdminGetAllShares, "handleAdminGetAllShares");
async function handleAdminGetStorageStats(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: "Unauthorized" }, 403, corsHeaders);
    }
    const users = [];
    const list = await env.CLIPBOARD_KV.list({ prefix: "user_storage:" });
    let totalSize = 0;
    let totalImages = 0;
    let totalFiles = 0;
    for (const key of list.keys) {
      const storageData = await env.CLIPBOARD_KV.get(key.name);
      if (storageData) {
        try {
          const storage = JSON.parse(storageData);
          const userId = key.name.replace("user_storage:", "");
          const userInfoData = await env.CLIPBOARD_KV.get(`user_info:${userId}`);
          let userInfo = null;
          if (userInfoData) {
            try {
              userInfo = JSON.parse(userInfoData);
            } catch (e) {
              console.error("\u89E3\u6790\u7528\u6237\u4FE1\u606F\u5931\u8D25:", userId);
            }
          }
          const userTotalSize = Number(storage.totalSize) || 0;
          const userImagesCount = Number(storage.images?.length) || 0;
          const userFilesCount = Number(storage.files?.length) || 0;
          totalSize += userTotalSize;
          totalImages += userImagesCount;
          totalFiles += userFilesCount;
          users.push({
            userId: String(userId),
            userLogin: userInfo?.login || `\u7528\u6237${userId.substring(0, 8)}`,
            userAvatar: userInfo?.avatar_url || null,
            totalSize: userTotalSize,
            imagesCount: userImagesCount,
            filesCount: userFilesCount
          });
        } catch (e) {
          console.error("\u89E3\u6790\u7528\u6237\u5B58\u50A8\u6570\u636E\u5931\u8D25:", key.name, e);
        }
      }
    }
    users.sort((a, b) => b.totalSize - a.totalSize);
    const result = {
      users,
      summary: {
        totalUsers: users.length,
        totalSize: Number(totalSize),
        totalImages: Number(totalImages),
        totalFiles: Number(totalFiles)
      }
    };
    console.log("\u7BA1\u7406\u5458\u5B58\u50A8\u7EDF\u8BA1\u7ED3\u679C:", JSON.stringify(result));
    return jsonResponse(result, 200, corsHeaders);
  } catch (error) {
    console.error("Admin get storage stats error:", error);
    return jsonResponse({ error: "Internal Server Error" }, 500, corsHeaders);
  }
}
__name(handleAdminGetStorageStats, "handleAdminGetStorageStats");
async function handleAdminDeleteShare(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: "Unauthorized" }, 403, corsHeaders);
    }
    const url = new URL(request.url);
    const shareId = url.pathname.split("/").pop();
    const shareData = await env.CLIPBOARD_KV.get(`share:${shareId}`);
    if (!shareData) {
      return jsonResponse({ error: "Share not found" }, 404, corsHeaders);
    }
    const share = JSON.parse(shareData);
    await env.CLIPBOARD_KV.delete(`share:${shareId}`);
    const userSharesKey = `user_shares_list:${share.ownerId}`;
    const sharesData = await env.CLIPBOARD_KV.get(userSharesKey);
    if (sharesData) {
      const shares = JSON.parse(sharesData);
      const updatedShares = shares.filter((s) => s.id !== shareId);
      await env.CLIPBOARD_KV.put(userSharesKey, JSON.stringify(updatedShares), {
        expirationTtl: 30 * 24 * 60 * 60
      });
    }
    return jsonResponse({ success: true }, 200, corsHeaders);
  } catch (error) {
    console.error("Admin delete share error:", error);
    return jsonResponse({ error: "Internal Server Error" }, 500, corsHeaders);
  }
}
__name(handleAdminDeleteShare, "handleAdminDeleteShare");
async function handleAdminGetUserDetail(request, env, corsHeaders) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user || !isAdmin(user.login)) {
      return jsonResponse({ error: "Unauthorized" }, 403, corsHeaders);
    }
    const url = new URL(request.url);
    const userId = url.pathname.split("/").pop();
    const userInfoData = await env.CLIPBOARD_KV.get(`user_info:${userId}`);
    let userInfo = null;
    if (userInfoData) {
      try {
        userInfo = JSON.parse(userInfoData);
      } catch (e) {
        console.error("\u89E3\u6790\u7528\u6237\u4FE1\u606F\u5931\u8D25:", userId);
      }
    }
    const storageData = await env.CLIPBOARD_KV.get(`user_storage:${userId}`);
    let storage = { images: [], files: [], totalSize: 0 };
    if (storageData) {
      try {
        storage = JSON.parse(storageData);
      } catch (e) {
        console.error("\u89E3\u6790\u7528\u6237\u5B58\u50A8\u5931\u8D25:", userId);
      }
    }
    const sharesData = await env.CLIPBOARD_KV.get(`user_shares_list:${userId}`);
    let shares = [];
    if (sharesData) {
      try {
        shares = JSON.parse(sharesData);
      } catch (e) {
        console.error("\u89E3\u6790\u7528\u6237\u5206\u4EAB\u5931\u8D25:", userId);
      }
    }
    return jsonResponse({
      user: {
        userId,
        userLogin: userInfo?.login || `\u7528\u6237${userId.substring(0, 8)}`,
        userAvatar: userInfo?.avatar_url || null,
        userName: userInfo?.name || null,
        userEmail: userInfo?.email || null
      },
      storage: {
        totalSize: storage.totalSize || 0,
        imagesCount: storage.images?.length || 0,
        filesCount: storage.files?.length || 0,
        images: storage.images || [],
        files: storage.files || []
      },
      shares: shares || []
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Admin get user detail error:", error);
    return jsonResponse({ error: "Internal Server Error" }, 500, corsHeaders);
  }
}
__name(handleAdminGetUserDetail, "handleAdminGetUserDetail");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
