export interface Env {
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		// API endpoint to get current time
		if (url.pathname === '/api/time' && request.method === 'GET') {
			const now = new Date();
			const timeData = {
				timestamp: now.toISOString(),
				unixTime: Math.floor(now.getTime() / 1000),
				formatted: now.toLocaleString('zh-CN', {
					timeZone: 'Asia/Shanghai',
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				}),
				timezone: 'Asia/Shanghai',
			};

			return new Response(JSON.stringify(timeData), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

		// Health check endpoint
		if (url.pathname === '/api/health' && request.method === 'GET') {
			return new Response(JSON.stringify({ status: 'ok', service: 'ji-clipboard-worker' }), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

		// Default response
		return new Response(JSON.stringify({ 
			message: 'Ji-Clipboard Worker API',
			endpoints: ['/api/time', '/api/health']
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		});
	},
};
