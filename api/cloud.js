import { cloudService, HttpError } from "../server/cloud.js";
import { blobRepo } from "../server/blob-repo.js";
const cookie = "__Host-evim-session";
function tokenFrom(req) {
  return (
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookie + "="))
      ?.slice(cookie.length + 1) || ""
  );
}
function setCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${cookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token ? 604800 : 0}`,
  );
}
export function createHandler(getService) {
return async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Cookie");
  try {
    if (!["GET", "POST", "PUT"].includes(req.method))
      throw new HttpError(405, "Bu yöntem desteklenmiyor.");
    if (req.method !== "GET") {
      if (
        req.headers.origin !== `https://${req.headers.host}` ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        throw new HttpError(403, "İstek kaynağı doğrulanamadı.");
      if (JSON.stringify(req.body || {}).length > 512000)
        throw new HttpError(
          413,
          "Yedek veya düzen çok büyük (en fazla 500 KB).",
        );
    }
    const svc = getService(),
      action = req.query.action,
      token = tokenFrom(req),
      ip = (
        req.headers["x-vercel-forwarded-for"] ||
        req.headers["x-forwarded-for"] ||
        "unknown"
      )
        .split(",")[0]
        .trim();
    if (
      req.method === "POST" &&
      ["register", "login", "loginCode", "recover"].includes(action)
    ) {
      const result = await svc[action](req.body || {}, ip);
      setCookie(res, result.token);
      return res
        .status(200)
        .json({ user: result.user, recoveryCode: result.recoveryCode });
    }
    if (req.method === "POST" && action === "logout") {
      // Signing out must always clear this browser's cookie. An already
      // expired or revoked session counts as signed out.
      setCookie(res, "");
      if (token)
        try {
          await svc.logout(token);
        } catch (e) {
          if (e.status !== 401) throw e;
        }
      return res.status(200).json({ ok: true });
    }
    if (req.method === "POST" && action === "security") {
      const result = await svc.security(token, req.body || {});
      setCookie(res, result.token);
      return res
        .status(200)
        .json({ user: result.user, recoveryCode: result.recoveryCode, accessCode: result.accessCode });
    }
    if (req.method === "GET" && action === "session")
      return res.status(200).json({ user: await svc.session(token) });
    if (req.method === "GET" && action === "state")
      // No session cookie means a guest, not a failed login: answer without an error
      // so the first load stays quiet. A present but invalid cookie still gets 401.
      return res
        .status(200)
        .json(token ? await svc.load(token) : { user: null, state: null, revision: null });
    if (req.method === "PUT" && action === "state")
      return res.status(200).json(await svc.save(token, req.body || {}));
    throw new HttpError(404, "İşlem bulunamadı.");
  } catch (e) {
    // A delayed request with an old token must not erase a newly rotated session.
    // Logout explicitly clears the cookie; authentication still rejects invalid tokens.
    res.status(e.status || 503).json({
      error: e.status
        ? e.message
        : "Bulut hizmetine şu anda ulaşılamıyor. Değişikliklerinizi dışa aktarabilirsiniz.",
    });
  }
}
}
export default createHandler(() => cloudService(blobRepo, process.env.EVIM_AUTH_SECRET));
