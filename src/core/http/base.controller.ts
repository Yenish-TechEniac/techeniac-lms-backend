import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export abstract class BaseController {
  protected sendSuccess<T>(res: Response, data: T, status: number = StatusCodes.OK): void {
    res.status(status).json({ success: true, data });
  }

  protected sendCreated<T>(res: Response, data: T): void {
    this.sendSuccess(res, data, StatusCodes.CREATED);
  }

  protected sendPaginated<T>(
    res: Response,
    items: T[],
    page: number,
    limit: number,
    total: number,
  ): void {
    res.status(StatusCodes.OK).json({
      success: true,
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  protected sendNoContent(res: Response): void {
    res.status(StatusCodes.NO_CONTENT).send();
  }

  protected sendMessage(res: Response, message: string, status: number = StatusCodes.OK): void {
    res.status(status).json({ success: true, message });
  }

  protected sendFile(res: Response, buffer: Buffer, filename: string, contentType: string): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
