"""Local LOOMOS shop prototype. Production requires HTTPS, deployment and payment integration."""

import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from html import escape as html_escape
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape as xml_escape
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("LOOMOS_DATA_DIR", ROOT / ".local"))
SESSIONS = {}
ATTEMPTS = {}
PACKETA_PENDING = set()
LOCK = threading.Lock()
SESSION_SECONDS = 8 * 60 * 60
PRODUCT_TEMPLATE = ROOT / "produkty/_sablona.html"
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; "
    "img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; "
    "base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
)
# Packeta (Zásilkovna). The API password is a secret: only ever read it from the environment.
PACKETA_ORIGIN = "https://widget.packeta.com"
# Resend e-mail. RESEND_API_KEY is a secret: only ever read it from the environment.
RESEND_API_URL = os.environ.get("RESEND_API_URL", "https://api.resend.com/emails")
MAIL_FROM = os.environ.get("MAIL_FROM", "LOOMOS <objednavky@loomos.cz>")
SHOP_EMAIL = os.environ.get("SHOP_EMAIL", "info@loomos.cz")
PACKETA_API_URL = os.environ.get(
    "PACKETA_API_URL", "https://www.zasilkovna.cz/api/rest"
)
CHECKOUT_CSP = CSP.replace(
    "script-src 'self'", f"script-src 'self' {PACKETA_ORIGIN}"
).replace("frame-src 'none'", f"frame-src {PACKETA_ORIGIN}")
STATUSES = ("nova", "vyrizuje-se", "dokoncena", "zrusena")


def connect():
    db = sqlite3.connect(DATA / "shop.sqlite3", timeout=10)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    with connect() as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
        )
        db.execute(
            "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL)"
        )
        db.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY)")
        if not db.execute("SELECT 1 FROM meta WHERE key='seeded'").fetchone():
            for p in json.loads((ROOT / "data/products.json").read_text()):
                db.execute(
                    "INSERT OR IGNORE INTO products VALUES (?,?)",
                    (p["id"], json.dumps(p, ensure_ascii=False)),
                )
            db.execute("INSERT INTO meta VALUES ('seeded')")
        # Versioned catalog update requested by the owner; historical order snapshots stay intact.
        if not db.execute("SELECT 1 FROM meta WHERE key='six-scents-v1'").fetchone():
            for legacy in ("amber-tobacco", "sandalwood-leather", "fig-wild-berry"):
                row = db.execute(
                    "SELECT payload FROM products WHERE id=?", (legacy,)
                ).fetchone()
                if row:
                    item = json.loads(row["payload"])
                    item["active"] = False
                    db.execute(
                        "UPDATE products SET payload=? WHERE id=?",
                        (json.dumps(item, ensure_ascii=False), legacy),
                    )
            for item in json.loads((ROOT / "data/products.json").read_text()):
                db.execute(
                    "INSERT OR IGNORE INTO products VALUES (?,?)",
                    (item["id"], json.dumps(item, ensure_ascii=False)),
                )
            db.execute("INSERT INTO meta VALUES ('six-scents-v1')")
        if not db.execute("SELECT 1 FROM meta WHERE key='scents-sizes-v1'").fetchone():
            for item in json.loads((ROOT / "data/products.json").read_text()):
                row = db.execute(
                    "SELECT payload FROM products WHERE id=?", (item["id"],)
                ).fetchone()
                if row:
                    saved = json.loads(row["payload"])
                    if "variants" not in saved:
                        saved.update(
                            price=249, price_provisional=True, variants=item["variants"]
                        )
                        db.execute(
                            "UPDATE products SET payload=? WHERE id=?",
                            (json.dumps(saved, ensure_ascii=False), item["id"]),
                        )
            db.execute("INSERT INTO meta VALUES ('scents-sizes-v1')")
    os.chmod(DATA / "shop.sqlite3", 0o600)


def catalog(db, include_hidden=False):
    products = [
        json.loads(r["payload"])
        for r in db.execute("SELECT payload FROM products ORDER BY rowid")
    ]
    return products if include_hidden else [p for p in products if p["active"]]


def text(value, name, maxlen, required=True):
    if (
        not isinstance(value, str)
        or len(value) > maxlen
        or (required and not value.strip())
    ):
        raise ValueError(f"Zkontrolujte pole {name}.")
    return value.strip()


def czk(amount):
    return f"{amount:,}".replace(",", "\u00a0") + "\u00a0Kč"


def send_email(to, subject, lines, idempotency_key, reply_to=None):
    """Send a plain e-mail through Resend. Returns True on success; never raises."""
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        return False
    body = {
        "from": MAIL_FROM,
        "to": [to],
        "subject": subject,
        "text": "\n".join(lines),
        "html": '<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5">'
        + "<br>".join(html_escape(line) for line in lines)
        + "</div>",
    }
    if reply_to:
        body["reply_to"] = reply_to
    request = urllib.request.Request(
        RESEND_API_URL,
        data=json.dumps(body, ensure_ascii=False).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
            "User-Agent": "loomos-shop",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15):
            return True
    except (OSError, urllib.error.HTTPError) as error:
        # Log only the status, never the key, recipient or message content.
        print(f"E-mail {idempotency_key} failed: {getattr(error, 'code', 'network')}")
        return False


def send_order_emails(number, order):
    items = [
        f"{i['qty']}× {i['name']} — {czk(i['price'] * i['qty'])}"
        for i in order["items"]
    ]
    shipping = (
        "Zásilkovna — " + order["pickup_point"]
        if order["shipping"] == "zasilkovna"
        else "Osobní odběr"
    )
    summary = [
        f"Objednávka: {number}",
        "",
        *items,
        f"Doprava: {shipping} ({czk(order['shipping_price'])})",
        f"Celkem: {czk(order['total'])}",
    ]
    customer = order["customer"]
    test_note = (
        ["", "Jde o zkušební objednávku. Neproběhla platba ani expedice."]
        if order.get("test_mode")
        else []
    )
    send_email(
        customer["email"],
        f"Děkujeme za objednávku {number} | LOOMOS",
        [
            f"Dobrý den, {customer['name']},",
            "",
            "děkujeme za objednávku ručně vyráběných svíček LOOMOS.",
            *test_note,
            "",
            *summary,
            "",
            "S dotazy stačí odpovědět na tento e-mail.",
            "LOOMOS",
        ],
        f"order-{number}-customer",
        reply_to=SHOP_EMAIL,
    )
    send_email(
        SHOP_EMAIL,
        f"Nová objednávka {number}",
        [
            *summary,
            "",
            f"Zákazník: {customer['name']}",
            f"E-mail: {customer['email']}",
            f"Telefon: {customer['phone']}",
            f"Poznámka: {order.get('note') or '—'}",
            *test_note,
        ],
        f"order-{number}-shop",
        reply_to=customer["email"],
    )


class Handler(SimpleHTTPRequestHandler):
    server_version = "LOOMOS"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        checkout = urlsplit(self.path).path in ("/pokladna", "/pokladna.html")
        self.send_header("Content-Security-Policy", CHECKOUT_CSP if checkout else CSP)
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if self.path.startswith("/api/") or self.path.startswith("/admin"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Never log request bodies, credentials or query strings.
        print(
            f'{self.command} {urlsplit(self.path).path} {args[1] if len(args)>1 else ""}',
            flush=True,
        )

    def respond(self, code, data, cookie=None):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        if not getattr(self, "_head_only", False):
            self.wfile.write(raw)

    def body(self):
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            raise ValueError("Je vyžadován JSON.")
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= 32768:
            raise ValueError("Požadavek má nepovolenou velikost.")
        body = json.loads(self.rfile.read(length))
        if not isinstance(body, dict):
            raise ValueError("Neplatný požadavek.")
        return body

    def same_origin(self):
        origin = self.headers.get("Origin")
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return False
        if not origin:
            return self.headers.get("Sec-Fetch-Site") in ("same-origin", "none")
        parsed = urlsplit(origin)
        return parsed.scheme in ("http", "https") and parsed.netloc == self.headers.get(
            "Host"
        )

    def session_id(self):
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            return cookie["loomos_session"].value if "loomos_session" in cookie else ""
        except Exception:
            return ""

    def authenticated(self):
        token = self.session_id()
        with LOCK:
            current = time.time()
            expired = [key for key, value in SESSIONS.items() if value < current]
            for key in expired:
                del SESSIONS[key]
            return token in SESSIONS

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ("/obchod", "/kosik", "/pokladna", "/velkoobchod") or re.fullmatch(
            r"/produkty/[a-z0-9-]+", path
        ):
            self.path = path + ".html"
            path = self.path
        if path == "/api/products":
            with connect() as db:
                return self.respond(200, catalog(db))
        if path == "/api/admin/session":
            return self.respond(
                200,
                {
                    "authenticated": self.authenticated(),
                    "configured": bool(os.environ.get("LOOMOS_ADMIN_PASSWORD")),
                    "packeta": bool(os.environ.get("PACKETA_API_PASSWORD")),
                    "test_mode": True,
                },
            )
        if path.startswith("/api/admin/"):
            if not self.authenticated():
                return self.respond(401, {"error": "Přihlaste se do administrace."})
            with connect() as db:
                if path == "/api/admin/products":
                    return self.respond(200, catalog(db, True))
                if path == "/api/admin/orders":
                    orders = [
                        dict(
                            json.loads(r["payload"]),
                            number=r["id"],
                            created=r["created"],
                            status=r["status"],
                        )
                        for r in db.execute(
                            "SELECT * FROM orders ORDER BY created DESC, rowid DESC"
                        )
                    ]
                    return self.respond(200, orders)
            return self.respond(404, {"error": "Nenalezeno."})
        if path.startswith("/api/"):
            return self.respond(404, {"error": "Nenalezeno."})
        # Only explicitly public files are served. Never expose DB, source, tests or dotfiles.
        decoded = unquote(path)
        if decoded == "/admin":
            self.send_response(302)
            self.send_header("Location", "/admin/")
            self.end_headers()
            return
        if decoded == "/":
            self.path = "/index.html"
        elif decoded == "/admin/":
            self.path = "/admin/index.html"
        elif re.fullmatch(r"/produkty/[a-z0-9-]+\.html", decoded):
            candidate = ROOT / decoded.lstrip("/")
            if not candidate.exists():
                # Newly created products share the existing product detail template.
                product_id = Path(decoded).stem
                with connect() as db:
                    exists = any(p["id"] == product_id for p in catalog(db))
                if exists:
                    content = PRODUCT_TEMPLATE.read_text().replace(
                        "__PRODUCT_ID__", product_id
                    )
                    raw = content.encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(raw)))
                    self.end_headers()
                    if not getattr(self, "_head_only", False):
                        self.wfile.write(raw)
                    return
        elif not (
            decoded
            in (
                "/index.html",
                "/obchod.html",
                "/kosik.html",
                "/pokladna.html",
                "/velkoobchod.html",
                "/admin/index.html",
                "/data/products.json",
            )
            or re.fullmatch(r"/assets/(css|js|img|fonts)/[a-zA-Z0-9_.-]+", decoded)
        ):
            return self.respond(404, {"error": "Nenalezeno."})
        public_file = (ROOT / unquote(urlsplit(self.path).path).lstrip("/")).resolve()
        if not public_file.is_relative_to(ROOT) or not public_file.is_file():
            return self.respond(404, {"error": "Nenalezeno."})
        return super().do_GET()

    def do_HEAD(self):
        self._head_only = True
        return self.do_GET()

    def copyfile(self, source, outputfile):
        if not getattr(self, "_head_only", False):
            super().copyfile(source, outputfile)

    def do_POST(self):
        self.connection.settimeout(10)
        if not self.same_origin():
            return self.respond(
                403, {"error": "Požadavek musí pocházet z tohoto e-shopu."}
            )
        try:
            data = self.body()
            path = urlsplit(self.path).path
            if path == "/api/admin/login":
                return self.login(data)
            if path == "/api/admin/logout":
                with LOCK:
                    SESSIONS.pop(self.session_id(), None)
                return self.respond(
                    200,
                    {"ok": True},
                    "loomos_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0",
                )
            if path.startswith("/api/admin/"):
                if not self.authenticated():
                    return self.respond(401, {"error": "Přihlaste se do administrace."})
                if path == "/api/admin/products":
                    return self.save_product(data)
                if path == "/api/admin/packeta-packet":
                    return self.packeta_packet(data)
                if path == "/api/admin/order-status":
                    number = text(data.get("number"), "objednávka", 50)
                    status = data.get("status")
                    if status not in STATUSES:
                        raise ValueError("Neplatný stav objednávky.")
                    with connect() as db:
                        cursor = db.execute(
                            "UPDATE orders SET status=? WHERE id=?", (status, number)
                        )
                        if not cursor.rowcount:
                            return self.respond(
                                404, {"error": "Objednávka neexistuje."}
                            )
                    return self.respond(200, {"ok": True})
            if path == "/api/orders":
                return self.place_order(data)
            return self.respond(404, {"error": "Nenalezeno."})
        except (ValueError, TypeError, KeyError, AttributeError, RecursionError):
            return self.respond(
                400,
                {
                    "error": "Zkontrolujte vyplněné údaje, dostupnost produktů a zvolené množství."
                },
            )
        except (TimeoutError, OSError):
            return self.respond(
                408, {"error": "Vypršel čas požadavku. Zkuste to znovu."}
            )
        except sqlite3.Error:
            return self.respond(
                503, {"error": "Data teď nelze uložit. Zkuste to znovu."}
            )

    def login(self, data):
        expected = os.environ.get("LOOMOS_ADMIN_PASSWORD")
        if not expected:
            return self.respond(
                503,
                {
                    "error": "Nejdřív nastavte LOOMOS_ADMIN_PASSWORD při spuštění serveru."
                },
            )
        addr = self.client_address[0]
        now = time.time()
        with LOCK:
            for key in list(ATTEMPTS):
                if not ATTEMPTS[key] or now - ATTEMPTS[key][-1] >= 300:
                    del ATTEMPTS[key]
            if addr not in ATTEMPTS and len(ATTEMPTS) >= 10000:
                return self.respond(
                    429, {"error": "Přihlášení nyní nelze dokončit. Zkuste to později."}
                )
            recent = [t for t in ATTEMPTS.get(addr, []) if now - t < 300]
            ATTEMPTS[addr] = recent
            if len(recent) >= 10:
                return self.respond(
                    429, {"error": "Příliš mnoho pokusů. Zkuste to za 5 minut."}
                )
            recent.append(now)
        password = data.get("password", "")
        if not isinstance(password, str) or not hmac.compare_digest(
            hashlib.sha256(password.encode()).digest(),
            hashlib.sha256(expected.encode()).digest(),
        ):
            return self.respond(401, {"error": "Nesprávné heslo."})
        token = secrets.token_urlsafe(32)
        with LOCK:
            for key in list(SESSIONS):
                if SESSIONS[key] < now:
                    del SESSIONS[key]
            if len(SESSIONS) >= 1024:
                oldest = min(SESSIONS, key=SESSIONS.get)
                del SESSIONS[oldest]
            old = self.session_id()
            SESSIONS.pop(old, None)
            SESSIONS[token] = now + SESSION_SECONDS
            ATTEMPTS.pop(addr, None)
        secure = "; Secure" if os.environ.get("LOOMOS_SECURE_COOKIES") == "1" else ""
        return self.respond(
            200,
            {"ok": True},
            f"loomos_session={token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age={SESSION_SECONDS}{secure}",
        )

    def save_product(self, data):
        product_id = text(data.get("id"), "ID", 70)
        if not re.fullmatch("[a-z0-9]+(?:-[a-z0-9]+)*", product_id):
            raise ValueError("Neplatné ID.")
        price = data.get("price")
        if price is not None and (type(price) is not int or not 1 <= price <= 100000):
            raise ValueError("Neplatná cena.")
        if type(data.get("active")) is not bool:
            raise ValueError("Neplatná viditelnost.")
        p = dict(
            id=product_id,
            name=text(data.get("name"), "název", 120),
            subtitle=text(data.get("subtitle", ""), "podtitul", 200, False),
            notes=text(data.get("notes", ""), "vonné tóny", 200, False),
            description=text(data.get("description", ""), "popis", 3000, False),
            price=price,
            category="svicky",
            active=data["active"],
        )
        variants = data.get("variants", [])
        if not isinstance(variants, list) or len(variants) > 2:
            raise ValueError("Neplatné velikosti.")
        if variants:
            if [v.get("id") for v in variants if isinstance(v, dict)] != [
                "mala",
                "velka",
            ]:
                raise ValueError("Neplatné velikosti.")
            for variant in variants:
                if (
                    type(variant.get("price")) is not int
                    or not 1 <= variant["price"] <= 100000
                ):
                    raise ValueError("Neplatná cena velikosti.")
            p["variants"] = [
                dict(
                    id=v["id"],
                    name="Malá" if v["id"] == "mala" else "Velká",
                    price=v["price"],
                )
                for v in variants
            ]
            p["price"] = min(v["price"] for v in variants)
            p["price_provisional"] = data.get("price_provisional") is True
        with connect() as db:
            db.execute(
                "INSERT INTO products VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
                (product_id, json.dumps(p, ensure_ascii=False)),
            )
        return self.respond(200, p)

    def packeta_packet(self, data):
        number = text(data.get("number"), "objednávka", 50)
        with LOCK:
            if number in PACKETA_PENDING:
                return self.respond(409, {"error": "Zásilka se právě vytváří."})
            PACKETA_PENDING.add(number)
        try:
            return self.create_packet(number, data)
        finally:
            with LOCK:
                PACKETA_PENDING.discard(number)

    def create_packet(self, number, data):
        password = os.environ.get("PACKETA_API_PASSWORD")
        if not password:
            return self.respond(
                503, {"error": "Na serveru není nastavené PACKETA_API_PASSWORD."}
            )
        weight = data.get("weight")
        if type(weight) not in (int, float) or not 0 < weight <= 15:
            raise ValueError("Neplatná hmotnost.")
        with connect() as db:
            row = db.execute(
                "SELECT payload FROM orders WHERE id=?", (number,)
            ).fetchone()
        if not row:
            return self.respond(404, {"error": "Objednávka neexistuje."})
        order = json.loads(row["payload"])
        if order.get("packeta"):
            return self.respond(409, {"error": "Zásilka už byla vytvořena."})
        if order.get("shipping") != "zasilkovna" or not order.get("packeta_point_id"):
            return self.respond(
                400, {"error": "Objednávka nemá výdejní místo vybrané na mapě."}
            )
        customer = order["customer"]
        first, _, last = customer["name"].strip().rpartition(" ")
        attributes = {
            "number": number,
            "name": first or last,
            "surname": last,
            "email": customer["email"],
            "phone": customer["phone"],
            "addressId": order["packeta_point_id"],
            "value": order["total"],
            "cod": 0,
            "weight": round(weight, 3),
            "eshop": os.environ.get("PACKETA_SENDER", ""),
        }
        fields = "".join(
            f"<{k}>{xml_escape(str(v))}</{k}>" for k, v in attributes.items() if v != ""
        )
        request = urllib.request.Request(
            PACKETA_API_URL,
            data=(
                "<createPacket>"
                f"<apiPassword>{xml_escape(password)}</apiPassword>"
                f"<packetAttributes>{fields}</packetAttributes>"
                "</createPacket>"
            ).encode(),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                reply = ET.fromstring(response.read(65536))
        except (OSError, ET.ParseError):
            return self.respond(
                502, {"error": "Zásilkovna teď neodpovídá. Zkuste to znovu."}
            )
        if reply.findtext("status") != "ok":
            detail = (
                " ".join(
                    t.strip() for t in reply.find("detail").itertext() if t.strip()
                )
                if reply.find("detail") is not None
                else ""
            )
            message = reply.findtext("string") or "Zásilku se nepodařilo vytvořit."
            return self.respond(
                400, {"error": f"Zásilkovna: {message} {detail}".strip()[:500]}
            )
        packet = dict(
            id=reply.findtext("result/id") or "",
            barcode=reply.findtext("result/barcodeText")
            or reply.findtext("result/barcode")
            or "",
        )
        with connect() as db:
            current = json.loads(
                db.execute(
                    "SELECT payload FROM orders WHERE id=?", (number,)
                ).fetchone()["payload"]
            )
            current["packeta"] = packet
            db.execute(
                "UPDATE orders SET payload=? WHERE id=?",
                (json.dumps(current, ensure_ascii=False), number),
            )
        return self.respond(201, packet)

    def place_order(self, data):
        request_id = text(data.get("request_id"), "identifikátor", 80)
        if not re.fullmatch("[a-f0-9-]{36}", request_id):
            raise ValueError("Neplatný identifikátor.")
        customer = {
            k: text(data.get(k), k, n)
            for k, n in [("name", 120), ("email", 200), ("phone", 40)]
        }
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", customer["email"]):
            raise ValueError("Neplatný e-mail.")
        shipping = data.get("shipping")
        if shipping not in ("pickup", "zasilkovna") or data.get("test_ack") != "on":
            raise ValueError("Zkontrolujte dopravu.")
        point = text(
            data.get("pickup_point", ""), "výdejní místo", 200, shipping == "zasilkovna"
        )
        point_id = ""
        if shipping == "zasilkovna":
            point_id = text(
                data.get("packeta_point_id", ""), "výdejní místo", 10, False
            )
            if point_id and not re.fullmatch(r"[0-9]{1,10}", point_id):
                raise ValueError("Neplatné výdejní místo.")
        note = text(data.get("note", ""), "poznámka", 1000, False)
        items = data.get("items")
        if not isinstance(items, list) or not 1 <= len(items) <= 50:
            raise ValueError("Prázdná objednávka.")
        with connect() as db:
            db.execute("BEGIN IMMEDIATE")
            prior = db.execute(
                "SELECT id FROM orders WHERE request_id=?", (request_id,)
            ).fetchone()
            if prior:
                return self.respond(200, {"number": prior["id"], "test_mode": True})
            available = {p["id"]: p for p in catalog(db)}
            seen = set()
            snapshot = []
            for item in items:
                if not isinstance(item, dict):
                    raise ValueError("Neplatná položka.")
                pid = item.get("id")
                qty = item.get("qty")
                if (
                    not isinstance(pid, str)
                    or pid not in available
                    or type(qty) is not int
                    or not 1 <= qty <= 20
                ):
                    raise ValueError("Neplatná položka nebo množství.")
                p = available[pid]
                variant_id = item.get("variant", "mala" if p.get("variants") else "")
                if not isinstance(variant_id, str) or (pid, variant_id) in seen:
                    raise ValueError("Neplatná varianta.")
                seen.add((pid, variant_id))
                selected = next(
                    (v for v in p.get("variants", []) if v["id"] == variant_id), None
                )
                if p.get("variants") and selected is None:
                    raise ValueError("Neplatná velikost.")
                p = dict(p)
                if selected:
                    p.update(
                        price=selected["price"],
                        name=p["name"] + " — " + selected["name"],
                    )
                if type(p.get("price")) is not int or p["price"] <= 0:
                    raise ValueError("Cena produktu zatím není stanovená.")
                snapshot.append(
                    dict(
                        id=pid,
                        variant=variant_id,
                        name=p["name"],
                        price=p["price"],
                        qty=qty,
                    )
                )
            shipping_price = 79 if shipping == "zasilkovna" else 0
            payload = dict(
                customer=customer,
                items=snapshot,
                shipping=shipping,
                pickup_point=point,
                packeta_point_id=point_id,
                shipping_price=shipping_price,
                note=note,
                total=sum(i["price"] * i["qty"] for i in snapshot) + shipping_price,
                test_mode=True,
            )
            number = (
                "TEST-" + time.strftime("%Y%m%d") + "-" + secrets.token_hex(4).upper()
            )
            db.execute(
                "INSERT INTO orders VALUES (?,?,?,?,?)",
                (
                    number,
                    request_id,
                    int(time.time()),
                    "nova",
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
        threading.Thread(
            target=send_order_emails, args=(number, payload), daemon=True
        ).start()
        return self.respond(201, {"number": number, "test_mode": True})


if __name__ == "__main__":
    initialize()
    host = os.environ.get("LOOMOS_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(
        f"LOOMOS development server on {host}:{server.server_port}; checkout is TEST ONLY",
        flush=True,
    )
    server.serve_forever()
