export async function api(action, method = "GET", body) {
  const response = await fetch("/api/cloud?action=" + action, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Bulut hizmetine ulaşılamadı. Yayındaki site üzerinden deneyin.",
    );
  }
  if (!response.ok) {
    const error = new Error(data.error || "Bulut isteği başarısız.");
    error.status = response.status;
    throw error;
  }
  return data;
}

// GET state answers guests with { user: null }. Where a signed-in account is
// required, treat that the same as an expired session.
export function requireUser(result) {
  if (result?.user) return result;
  const error = new Error("Oturumun süresi doldu. Yeniden giriş yap.");
  error.status = 401;
  throw error;
}
