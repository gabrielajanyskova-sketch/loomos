/** API router for Cloudflare Pages Functions (functions/api/[[route]].js). */
import { database } from "./db.js";
import { HttpError, json } from "./http.js";
import * as shop from "./shop.js";
import * as account from "./account.js";
import * as admin from "./admin.js";
import * as workshop from "./workshop.js";

const routes = {
  "GET /api/products": (db) => shop.products(db),
  "POST /api/codes/check": shop.checkCode,
  "POST /api/orders": shop.createOrder,
  "GET /api/orders/view": shop.viewOrder,
  "GET /api/qr": shop.qrImage,

  "GET /api/account/me": account.me,
  "POST /api/account/register": account.register,
  "POST /api/account/login": account.login,
  "POST /api/account/logout": account.logout,
  "POST /api/account/update": account.update,
  "POST /api/account/password": account.changePassword,
  "POST /api/account/forgot": account.forgot,
  "POST /api/account/reset": account.reset,
  "GET /api/account/orders": account.myOrders,
  "POST /api/account/delete": account.deleteAccount,

  "GET /api/admin/session": admin.session,
  "POST /api/admin/login": admin.login,
  "POST /api/admin/logout": admin.logout,
};
const adminRoutes = {
  "GET /api/admin/overview": admin.overview,
  "GET /api/admin/orders": admin.orders,
  "POST /api/admin/order-status": admin.setStatus,
  "POST /api/admin/packeta-packet": admin.packet,
  "GET /api/admin/stock": admin.stock,
  "POST /api/admin/stock": admin.setStock,
  "GET /api/admin/customers": admin.customers,
  "POST /api/admin/customer": admin.customerAction,
  "GET /api/admin/codes": admin.codes,
  "POST /api/admin/codes": admin.saveCode,
  "POST /api/admin/codes/delete": admin.deleteCode,
  "GET /api/admin/workshop": workshop.overview,
  "POST /api/admin/workshop/settings": workshop.saveSettings,
  "POST /api/admin/workshop/jar": workshop.saveJar,
  "POST /api/admin/workshop/batch": workshop.saveBatch,
  "POST /api/admin/workshop/batch-done": workshop.finishBatch,
  "POST /api/admin/workshop/batch-delete": workshop.deleteBatch,
  "POST /api/admin/workshop/label": workshop.saveLabel,
  "POST /api/admin/workshop/wax": workshop.saveWax,
  "POST /api/admin/workshop/wick-test": workshop.saveWickTest,
  "POST /api/admin/workshop/wick-test-delete": workshop.deleteWickTest,
  "POST /api/admin/workshop/label-settings": workshop.saveLabelSettings,
};

export async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const key = `${request.method === "HEAD" ? "GET" : request.method} ${url.pathname.replace(/\/$/, "")}`;
  const route = routes[key] || adminRoutes[key];
  if (!route) {
    const known = [...Object.keys(routes), ...Object.keys(adminRoutes)].some(
      (k) => k.endsWith(" " + url.pathname.replace(/\/$/, "")),
    );
    return json(
      { error: known ? "Nepovolená metoda." : "Nenalezeno." },
      known ? 405 : 404,
    );
  }
  try {
    const db = await database(env);
    if (adminRoutes[key]) await admin.requireAdmin(db, request);
    return await route(db, request, env, ctx);
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error?.expose)
      return json({ error: error.expose }, error.status || 500);
    console.log(`API error on ${key}: ${error?.message || error}`);
    return json({ error: "Něco se nepovedlo. Zkuste to prosím znovu." }, 500);
  }
}
