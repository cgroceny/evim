// Administrator CLI only. Excluded from deployments; no public provisioning endpoint.
import { list } from "@vercel/blob";
import { randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { username } from "../server/cloud.js";
import { blobRepo } from "../server/blob-repo.js";
import { newAccessCode } from "../server/access-code.js";

const [mode = "list", nameArg, out] = process.argv.slice(2);
if (mode === "list") {
  const page = await list({ prefix: "accounts/", limit: 50 });
  const accounts = [];
  for (const item of page.blobs) {
    const record = await blobRepo.read(item.pathname);
    if (record) accounts.push({ username: record.value.username, createdAt: record.value.createdAt });
  }
  console.log(JSON.stringify({ accounts, hasMore: page.hasMore }));
} else if (["create", "renew"].includes(mode)) {
  const name = username(nameArg);
  const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (!out || !isAbsolute(out) || resolve(out).toLowerCase().startsWith(project.toLowerCase() + sep))
    throw new Error("Credential receipt must be an absolute path outside the deployed project.");
  const path = "accounts/" + createHash("sha256").update(name).digest("hex") + ".json";
  const previous = await blobRepo.read(path);
  if (mode === "create" && previous) throw new Error("Account already exists; no change made.");
  if (mode === "renew" && !previous) throw new Error("Account does not exist; no change made.");
  const access = newAccessCode();
  const account = {
    ...(previous?.value ?? { id: randomUUID(), username: name, password: null, recoveryHash: null, createdAt: Date.now() }),
    version: (previous?.value.version || 0) + 1,
    sessions: [],
    accessCode: access.credential,
  };
  // Save the receipt first so a filesystem failure cannot strand a newly created account.
  await writeFile(out, `evim — Kişisel erişim bilgileri\n\nAdres: https://home.cemgocen.com\nYedek adres: https://evim-control.vercel.app\nKullanıcı adı: ${name}\nErişim kodu: ${access.code}\nGeçerlilik: ${new Date(access.credential.expiresAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\nGiriş yap → Kodla giriş yolunu kullanın. Aynı bilgiler telefon ve bilgisayarda aynı ev düzenini açar.\nBu kod hesabınıza tam erişim verir; paylaşmayın. Kod yalnız sunucuda özetiyle saklanır.\nİlk girişte gösterilen kurtarma anahtarını da güvenli bir yerde saklayın.\nKodu Hesap & ayarlar → Hesap güvenliği bölümünden yenileyebilirsiniz.\n`, { flag: "wx", mode: 0o600 });
  await blobRepo.write(path, account, previous?.etag ?? null);
  console.log(JSON.stringify({ username: name, operation: mode, expiresAt: access.credential.expiresAt, receipt: out }));
} else throw new Error("Use list, create <username> <receipt-path>, or renew <username> <receipt-path>.");
