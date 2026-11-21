import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ZodValidationException } from "nestjs-zod";
import type { Request, Response } from "express";
import type { ZodIssue } from "zod";

// Mirrors ApiErrorBody in packages/types (the backend does not depend on that
// package at runtime, so the shape is repeated here; the e2e test pins it).
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "MAINTENANCE"
  | "FEATURE_DISABLED"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fields?: { path: string; message: string }[];
  requestId?: string;
  maintenance?: true;
  feature?: string;
}

const GENERIC_INTERNAL = "Something went wrong on our side. Please try again later.";
const VALIDATION_MESSAGE = "Some of the information you entered is not valid.";

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "VALIDATION_FAILED";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL_ERROR";
  }
}

function fieldsFromIssues(issues: ZodIssue[]) {
  // One entry per failing path: the first message is the most relevant one.
  const seen = new Map<string, string>();
  for (const i of issues) {
    const path = i.path.join(".");
    if (!seen.has(path)) seen.set(path, i.message);
  }
  return [...seen].map(([path, message]) => ({ path, message }));
}

// The single place every error leaves the API. 4xx keep the message the code
// throwing them chose (those are written for users); anything 5xx, unknown or
// database-originated is replaced by a generic message and logged server-side only.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: unknown }>();
    const requestId = this.requestId(req);

    const body = this.build(exception);
    if (requestId) body.requestId = requestId;

    if (body.statusCode >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${req.method} ${req.originalUrl?.split("?")[0]} -> ${body.statusCode} [req ${requestId ?? "-"}] ${err.message}`,
        err.stack,
      );
    }

    if (res.headersSent) return;
    res.status(body.statusCode).json(body);
  }

  private requestId(req: Request & { id?: unknown }): string | undefined {
    if (req.id !== undefined && req.id !== null && req.id !== "") return String(req.id);
    const h = req.headers?.["x-request-id"];
    return typeof h === "string" && h.length <= 100 ? h : undefined;
  }

  private build(exception: unknown): ErrorBody {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as { issues?: ZodIssue[] };
      return {
        statusCode: 400,
        code: "VALIDATION_FAILED",
        message: VALIDATION_MESSAGE,
        fields: fieldsFromIssues(zodError.issues ?? []),
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttp(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return { statusCode: 409, code: "CONFLICT", message: "That value is already in use." };
      }
      if (exception.code === "P2025" || exception.code === "P2001") {
        return { statusCode: 404, code: "NOT_FOUND", message: "We could not find what you asked for." };
      }
      if (exception.code === "P2003") {
        return { statusCode: 409, code: "CONFLICT", message: "This item is linked to other data and cannot be changed that way." };
      }
    }

    return { statusCode: 500, code: "INTERNAL_ERROR", message: GENERIC_INTERNAL };
  }

  private fromHttp(exception: HttpException): ErrorBody {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

    if (status >= 500) {
      if (status === 503 && obj.maintenance === true) {
        return {
          statusCode: 503,
          code: "MAINTENANCE",
          message: typeof obj.message === "string" ? obj.message : "PacketPulse is under maintenance.",
          maintenance: true,
        };
      }
      return { statusCode: status, code: "INTERNAL_ERROR", message: GENERIC_INTERNAL };
    }

    // Message may be a string, or an array (Nest's built-in ValidationPipe style).
    let message: string;
    let fields: { path: string; message: string }[] | undefined;
    if (typeof raw === "string") message = raw;
    else if (Array.isArray(obj.message)) {
      message = VALIDATION_MESSAGE;
      fields = (obj.message as unknown[]).map((m) => ({ path: "", message: String(m) }));
    } else if (typeof obj.message === "string") message = obj.message;
    else message = exception.message;

    const code = status === 422 ? "VALIDATION_FAILED" : codeForStatus(status);
    const out: ErrorBody = { statusCode: status, code, message };
    if (status === 403 && obj.featureDisabled === true) {
      out.code = "FEATURE_DISABLED";
      if (typeof obj.feature === "string") out.feature = obj.feature;
    }
    if (fields) {
      out.fields = fields;
      out.code = "VALIDATION_FAILED";
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) out.code = "RATE_LIMITED";
    return out;
  }
}
