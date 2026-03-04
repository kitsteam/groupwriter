/* eslint-disable @typescript-eslint/unbound-method */
import { IncomingMessage, ServerResponse } from "http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { checkRateLimit } from "./rateLimiter";

const buildRequest = (ip: string): IncomingMessage => {
  const request = mock<IncomingMessage>();
  request.headers = {};
  request.socket = { remoteAddress: ip } as never;
  return request;
};

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows requests within the limit", () => {
    const request = buildRequest("1.1.1.1");
    const response = mock<ServerResponse<IncomingMessage>>();

    const result = checkRateLimit(request, response, 3, 1000);

    expect(result).toBe(true);
    expect(response.writeHead).not.toHaveBeenCalled();
  });

  it("blocks requests exceeding the limit", () => {
    const request = buildRequest("2.2.2.2");
    const response = mock<ServerResponse<IncomingMessage>>();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(request, response, 3, 1000);
    }

    const blocked = checkRateLimit(request, response, 3, 1000);

    expect(blocked).toBe(false);
    expect(response.writeHead).toHaveBeenCalledWith(429, {
      "Content-Type": "text/json",
      "Retry-After": expect.any(String) as string,
    });
  });

  it("resets the counter after the window expires", () => {
    const request = buildRequest("3.3.3.3");
    const response = mock<ServerResponse<IncomingMessage>>();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(request, response, 3, 1000);
    }

    vi.advanceTimersByTime(1001);

    const result = checkRateLimit(request, response, 3, 1000);
    expect(result).toBe(true);
  });

  it("tracks different IPs independently", () => {
    const responseA = mock<ServerResponse<IncomingMessage>>();
    const responseB = mock<ServerResponse<IncomingMessage>>();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(buildRequest("4.4.4.4"), responseA, 3, 1000);
    }

    const result = checkRateLimit(buildRequest("5.5.5.5"), responseB, 3, 1000);
    expect(result).toBe(true);
  });

  it("uses rightmost X-Forwarded-For entry", () => {
    const request = buildRequest("127.0.0.1");
    request.headers["x-forwarded-for"] = "spoofed, 6.6.6.6";
    const response = mock<ServerResponse<IncomingMessage>>();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(request, response, 3, 1000);
    }

    // A request with different rightmost XFF should not be blocked
    const request2 = buildRequest("127.0.0.1");
    request2.headers["x-forwarded-for"] = "spoofed, 7.7.7.7";
    const response2 = mock<ServerResponse<IncomingMessage>>();

    expect(checkRateLimit(request2, response2, 3, 1000)).toBe(true);
  });
});
