import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";

// Centralizes cookie option handling so it isn't duplicated per controller method
// (the old app had this copy-pasted across auth.controller.js/auth.middleware.js, plan §4).
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  private get isProd() {
    return this.config.get<string>("NODE_ENV") === "production";
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: "lax",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Non-secret, non-httpOnly presence flag only — never trusted for access
    // control, exists purely so the frontend can cheaply show "logged in" UI
    // state without reading the real token (plan §6/§11).
    res.cookie("session_active", "true", {
      httpOnly: false,
      secure: this.isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
    res.clearCookie("session_active");
  }
}
