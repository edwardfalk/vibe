// packages/api/src/TicketService.js

class HttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class TicketService {
  constructor(ticketCore, logger) {
    this.core = ticketCore;
    this.logger = logger;
  }

  async list(query) {
    this.logger.info(
      `[Service] Listing tickets with query: ${JSON.stringify(query)}`
    );
    try {
      const options = {
        type: query.type || undefined,
        status: query.status || undefined,
        focus: query.focus === 'true',
        limit: query.limit ? parseInt(query.limit, 10) : 100,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      };
      return await this.core.listTickets(options);
    } catch (e) {
      this.logger.error('[Service] List failed', e);
      throw new HttpError('Failed to list tickets', 500);
    }
  }

  async create(ticketData) {
    this.logger.info(`[Service] Creating ticket...`);
    this.logger.info(
      `[Service] Incoming ticketData: ${JSON.stringify(ticketData)}`
    );
    // Id genereras och valideras i core.ensureMeta
    try {
      await this.core.ensureMeta(ticketData, true);
      // Prevent duplicates (efter att id genererats i core)
      try {
        await this.core.readTicket(ticketData.id);
        // If it reaches here, the ticket exists
        throw new HttpError(
          `Ticket with ID ${ticketData.id} already exists.`,
          400
        );
      } catch (e) {
        if (!e.message.includes('not found')) {
          // re-throw if it's not the "not found" error we expect
          throw e;
        }
        // All good, ticket does not exist
      }

      const written = await this.core.writeTicket(ticketData);
      this.logger.info(`[Service] Created ticket ${written.id}`);
      return written;
    } catch (e) {
      this.logger.error('[Service] Create failed', e);
      this.logger.error(
        `[Service] Create failed details: ${e && e.stack ? e.stack : e}`
      );
      throw new HttpError(e.message, e.statusCode || 400);
    }
  }

  async get(id) {
    this.logger.info(`[Service] Getting ticket ${id}`);
    try {
      return await this.core.readTicket(id);
    } catch (e) {
      this.logger.error(`[Service] Get failed for ${id}`, e);
      throw new HttpError(`Ticket ${id} not found`, 404);
    }
  }

  async update(id, updates) {
    this.logger.info(`[Service] Updating ticket ${id}`);
    const originalTicket = await this.core.readTicket(id);
    const updatedTicket = { ...originalTicket };

    const allowedFields = [
      'type',
      'title',
      'status',
      'tags',
      'checklist',
      'artifacts',
      'relatedTickets',
      'slug',
      'description',
    ];

    const changes = [];
    for (const key in updates) {
      if (
        Object.prototype.hasOwnProperty.call(updates, key) &&
        allowedFields.includes(key)
      ) {
        const oldValue = originalTicket[key];
        const newValue = updates[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({ field: key, oldValue, newValue });
        }
        updatedTicket[key] = newValue;
      }
    }

    if (changes.length > 0) {
      this.core.addHistoryEntry(updatedTicket, 'updated', { changes });
    }

    await this.core.ensureMeta(updatedTicket, false);
    const written = await this.core.writeTicket(updatedTicket);
    this.logger.info(`[Service] Updated ticket ${written.id}`);
    return written;
  }

  async remove(id) {
    this.logger.info(`[Service] Deleting ticket ${id}`);
    return await this.core.deleteTicket(id);
  }
}
