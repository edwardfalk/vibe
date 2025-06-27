// packages/api/src/TicketRouter.js

import { DebugLogger } from '../../tooling/src/DebugLogger.js';

export class TicketRouter {
  constructor(ticketService, logger) {
    this.ticketService = ticketService;
    this.logger = logger;
  }

  async handle(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    this.logger.info(`[Router] ${method} ${pathname}`);

    try {
      if (method === 'OPTIONS') {
        return this.handleCors();
      }

      const response = await this.route(request, pathname, method);

      // Add CORS headers to actual responses
      const corsResponse = new Response(response.body, response);
      corsResponse.headers.set('Access-Control-Allow-Origin', '*');
      corsResponse.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PATCH, DELETE, OPTIONS, HEAD'
      );
      corsResponse.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );

      return corsResponse;
    } catch (error) {
      this.logger.error(`[Router] Error`, error);
      const status = error.statusCode || 500;
      const body = JSON.stringify({
        error: error.message || 'Internal Server Error',
      });
      return new Response(body, {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  handleCors() {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PATCH, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  async route(request, pathname, method) {
    if (pathname === '/api/health' && method === 'HEAD') {
      return new Response(null, { status: 200 });
    }

    if (pathname === '/api/logs' && method === 'POST') {
      try {
        const body = await request.json();
        console.dir(body, { depth: null });
        const { level, message, stack } = body;
        console.log(
          `[REMOTE LOG] level=${level} message=${message} stack=${stack}`
        );
        const logMsg = `[${level || 'info'}] ${message}`;
        DebugLogger.log(logMsg, stack ? { stack } : undefined);
        return new Response(null, { status: 204 });
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Malformed log payload' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (pathname.startsWith('/api/tickets')) {
      const idMatch = pathname.match(/^\/api\/tickets\/(.+)$/);
      const id = idMatch ? idMatch[1] : null;

      if (id) {
        switch (method) {
          case 'GET':
            return this.jsonResponse(await this.ticketService.get(id));
          case 'PATCH':
            try {
              const body = await request.json();
              return this.jsonResponse(
                await this.ticketService.update(id, body)
              );
            } catch (e) {
              if (e instanceof SyntaxError) {
                throw { statusCode: 400, message: 'Malformed JSON' };
              }
              throw e;
            }
          case 'DELETE':
            return this.jsonResponse(await this.ticketService.remove(id), 204);
          default:
            throw { statusCode: 405, message: 'Method Not Allowed' };
        }
      } else {
        switch (method) {
          case 'GET':
            const url = new URL(request.url);
            const queryParams = Object.fromEntries(url.searchParams.entries());
            return this.jsonResponse(
              await this.ticketService.list(queryParams)
            );
          case 'POST':
            try {
              const body = await request.json();
              return this.jsonResponse(
                await this.ticketService.create(body),
                201
              );
            } catch (e) {
              if (e instanceof SyntaxError) {
                throw { statusCode: 400, message: 'Malformed JSON' };
              }
              throw e;
            }
          default:
            throw { statusCode: 405, message: 'Method Not Allowed' };
        }
      }
    }

    throw { statusCode: 404, message: 'Not Found' };
  }

  jsonResponse(data, status = 200) {
    if (status === 204) {
      return new Response(null, { status });
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
