

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

    const imageUrl = `${env.IMAGES_PUBLIC_URL}/${fileName}`;

    const imageInfo = {
      id: `${timestamp}-${randomStr}`,
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
    const storage = storageData ? JSON.parse(storageData) : { totalSize: 0, images: [] };
    
    const MAX_STORAGE = 200 * 1024 * 1024;

    return jsonResponse({
      totalSize: storage.totalSize,
      maxSize: MAX_STORAGE,
      images: storage.images,
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