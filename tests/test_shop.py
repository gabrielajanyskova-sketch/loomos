import http.client
import importlib.util
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import time
import unittest
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

spec = importlib.util.spec_from_file_location(
    "shop", Path(__file__).resolve().parents[1] / "server.py"
)
shop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shop)


class ShopTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        shop.DATA = Path(cls.temp.name)
        cls.password = secrets.token_urlsafe(24)
        cls.old_password = os.environ.get("LOOMOS_ADMIN_PASSWORD")
        os.environ["LOOMOS_ADMIN_PASSWORD"] = cls.password
        shop.initialize()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), shop.Handler)
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()
        if cls.old_password is None:
            os.environ.pop("LOOMOS_ADMIN_PASSWORD", None)
        else:
            os.environ["LOOMOS_ADMIN_PASSWORD"] = cls.old_password

    def request(self, method, path, data=None, cookie=None, origin=None):
        c = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {"Origin": origin or self.origin}
        if cookie:
            headers["Cookie"] = cookie
        if data is not None:
            headers["Content-Type"] = "application/json"
        c.request(method, path, json.dumps(data) if data is not None else None, headers)
        r = c.getresponse()
        status, cookie_header = r.status, r.getheader("Set-Cookie")
        raw = r.read()
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            body = raw
        c.close()
        return status, body, cookie_header

    def login(self):
        status, _, cookie = self.request(
            "POST", "/api/admin/login", {"password": self.password}
        )
        self.assertEqual(status, 200)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        return cookie.split(";")[0]

    def order(self, **updates):
        data = dict(
            request_id=str(uuid.uuid4()),
            name="Testovací zákazník",
            email="test@example.com",
            phone="123456789",
            shipping="pickup",
            test_ack="on",
            items=[{"id": "okurka-zazvor-mata", "qty": 2}],
        )
        data.update(updates)
        return data

    def test_catalog_and_private_files(self):
        status, products, _ = self.request("GET", "/api/products")
        self.assertEqual(status, 200)
        self.assertEqual(len(products), 6)
        for path in [
            "/server.py",
            "/.local/shop.sqlite3",
            "/.git/config",
            "/package.json",
            "/tests/test_shop.py",
            "/assets/css/..",
            "/assets/../server.py",
        ]:
            self.assertEqual(self.request("GET", path)[0], 404, path)
        self.assertEqual(self.request("GET", "/api/admin/orders")[0], 401)

    def test_login_logout_and_origin(self):
        self.assertEqual(
            self.request("POST", "/api/admin/login", {"password": "wrong"})[0], 401
        )
        self.assertEqual(
            self.request(
                "POST",
                "/api/admin/login",
                {"password": self.password},
                origin="https://other.example",
            )[0],
            403,
        )
        cookie = self.login()
        self.assertTrue(
            self.request("GET", "/api/admin/session", cookie=cookie)[1]["authenticated"]
        )
        self.assertEqual(
            self.request("POST", "/api/admin/logout", {}, cookie=cookie)[0], 200
        )
        self.assertEqual(
            self.request("GET", "/api/admin/orders", cookie=cookie)[0], 401
        )

    def test_order_pricing_idempotency_and_admin(self):
        order = self.order(
            price=1, total=1, shipping="zasilkovna", pickup_point="Testovací výdejna"
        )
        status, result, _ = self.request("POST", "/api/orders", order)
        self.assertEqual(status, 201)
        again = self.request("POST", "/api/orders", order)
        self.assertEqual(again[0], 200)
        self.assertEqual(again[1]["number"], result["number"])
        cookie = self.login()
        orders = self.request("GET", "/api/admin/orders", cookie=cookie)[1]
        saved = next(o for o in orders if o["number"] == result["number"])
        self.assertEqual(saved["total"], 2 * 249 + 79)
        self.assertTrue(saved["test_mode"])
        self.assertEqual(
            self.request(
                "POST",
                "/api/admin/order-status",
                {"number": saved["number"], "status": "vyrizuje-se"},
                cookie=cookie,
            )[0],
            200,
        )
        orders = self.request("GET", "/api/admin/orders", cookie=cookie)[1]
        self.assertEqual(
            next(o for o in orders if o["number"] == saved["number"])["status"],
            "vyrizuje-se",
        )

    def test_packeta_point_and_packet_creation(self):
        bad = self.order(
            shipping="zasilkovna", pickup_point="X", packeta_point_id="1;2"
        )
        self.assertEqual(self.request("POST", "/api/orders", bad)[0], 400)
        order = self.order(
            shipping="zasilkovna", pickup_point="Z-BOX Praha", packeta_point_id="12345"
        )
        status, result, _ = self.request("POST", "/api/orders", order)
        self.assertEqual(status, 201)
        cookie = self.login()
        call = {"number": result["number"], "weight": 0.5}
        old = os.environ.pop("PACKETA_API_PASSWORD", None)
        self.assertEqual(
            self.request("POST", "/api/admin/packeta-packet", call, cookie=cookie)[0],
            503,
        )
        received = []

        class Fake(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append(self.rfile.read(int(self.headers["Content-Length"])))
                body = (
                    b"<response><status>ok</status><result><id>987</id>"
                    b"<barcode>Z987</barcode><barcodeText>Z 987</barcodeText>"
                    b"</result></response>"
                )
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        fake = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=fake.serve_forever, daemon=True).start()
        old_url = shop.PACKETA_API_URL
        shop.PACKETA_API_URL = f"http://127.0.0.1:{fake.server_port}/"
        os.environ["PACKETA_API_PASSWORD"] = "secret<&>"
        try:
            status, packet, _ = self.request(
                "POST", "/api/admin/packeta-packet", call, cookie=cookie
            )
            self.assertEqual(status, 201)
            self.assertEqual(packet["barcode"], "Z 987")
            self.assertIn(
                b"<apiPassword>secret&lt;&amp;&gt;</apiPassword>", received[0]
            )
            self.assertIn(b"<addressId>12345</addressId>", received[0])
            self.assertIn(b"<surname>z\xc3\xa1kazn\xc3\xadk</surname>", received[0])
            self.assertEqual(
                self.request("POST", "/api/admin/packeta-packet", call, cookie=cookie)[
                    0
                ],
                409,
            )
            orders = self.request("GET", "/api/admin/orders", cookie=cookie)[1]
            saved = next(o for o in orders if o["number"] == result["number"])
            self.assertEqual(saved["packeta"]["id"], "987")
            self.assertNotIn("secret", json.dumps(orders))
        finally:
            fake.shutdown()
            fake.server_close()
            shop.PACKETA_API_URL = old_url
            os.environ.pop("PACKETA_API_PASSWORD", None)
            if old is not None:
                os.environ["PACKETA_API_PASSWORD"] = old

    def test_order_emails_via_resend(self):
        received = []

        class Fake(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append(
                    (
                        dict(self.headers),
                        json.loads(
                            self.rfile.read(int(self.headers["Content-Length"]))
                        ),
                    )
                )
                self.send_response(200)
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, *args):
                pass

        fake = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=fake.serve_forever, daemon=True).start()
        old_url = shop.RESEND_API_URL
        shop.RESEND_API_URL = f"http://127.0.0.1:{fake.server_port}/"
        os.environ["RESEND_API_KEY"] = "re_test"
        try:
            order = self.order(name="Jana <b>Nová</b>", note="<script>")
            status, result, _ = self.request("POST", "/api/orders", order)
            self.assertEqual(status, 201)
            self.request("POST", "/api/orders", order)  # replay must not resend
            deadline = time.time() + 5
            while len(received) < 2 and time.time() < deadline:
                time.sleep(0.05)
            time.sleep(0.2)
            self.assertEqual(len(received), 2)
            headers, customer = next(
                r for r in received if r[1]["to"] == ["test@example.com"]
            )
            self.assertEqual(headers["Authorization"], "Bearer re_test")
            self.assertIn(result["number"], customer["subject"])
            self.assertIn("&lt;b&gt;", customer["html"])
            self.assertNotIn("<b>", customer["html"])
            self.assertIn("zkušební", customer["text"])
            shop_mail = next(r[1] for r in received if r[1]["to"] == ["info@loomos.cz"])
            self.assertEqual(shop_mail["reply_to"], "test@example.com")
            self.assertNotIn("<script>", shop_mail["html"])
        finally:
            fake.shutdown()
            fake.server_close()
            shop.RESEND_API_URL = old_url
            os.environ.pop("RESEND_API_KEY", None)

    def test_two_sizes_use_server_prices(self):
        data = self.order(
            items=[
                {"id": "okurka-zazvor-mata", "variant": "mala", "qty": 1},
                {"id": "okurka-zazvor-mata", "variant": "velka", "qty": 1, "price": 1},
            ]
        )
        status, result, _ = self.request("POST", "/api/orders", data)
        self.assertEqual(status, 201)
        cookie = self.login()
        saved = next(
            o
            for o in self.request("GET", "/api/admin/orders", cookie=cookie)[1]
            if o["number"] == result["number"]
        )
        self.assertEqual(saved["total"], 249 + 349)
        self.assertEqual([i["variant"] for i in saved["items"]], ["mala", "velka"])
        self.assertEqual(
            self.request(
                "POST",
                "/api/orders",
                self.order(
                    items=[{"id": "okurka-zazvor-mata", "variant": "neznama", "qty": 1}]
                ),
            )[0],
            400,
        )

    def test_reject_invalid_orders(self):
        for items in [
            [],
            [{"id": "okurka-zazvor-mata", "qty": 0}],
            [{"id": "okurka-zazvor-mata", "qty": 21}],
            [{"id": "okurka-zazvor-mata", "qty": True}],
            [{"id": "missing", "qty": 1}],
            [{"id": "okurka-zazvor-mata", "qty": 1}] * 2,
        ]:
            self.assertEqual(
                self.request("POST", "/api/orders", self.order(items=items))[0], 400
            )
        self.assertEqual(
            self.request("POST", "/api/orders", self.order(test_ack=""))[0], 400
        )
        self.assertEqual(
            self.request("POST", "/api/orders", self.order(email="invalid"))[0], 400
        )

    def test_product_edit_visibility_new_page_and_persistence(self):
        cookie = self.login()
        p = dict(
            id="test-vanilka",
            name="Test Vanilka",
            subtitle="Test",
            notes="Vanilka",
            description="Testovací produkt",
            price=123,
            active=False,
        )
        self.assertEqual(self.request("POST", "/api/admin/products", p)[0], 401)
        self.assertEqual(
            self.request("POST", "/api/admin/products", p, cookie=cookie)[0], 200
        )
        self.assertFalse(
            any(i["id"] == p["id"] for i in self.request("GET", "/api/products")[1])
        )
        p["active"] = True
        self.assertEqual(
            self.request("POST", "/api/admin/products", p, cookie=cookie)[0], 200
        )
        self.assertEqual(self.request("GET", "/produkty/test-vanilka.html")[0], 200)
        shop.initialize()
        with shop.connect() as db:
            saved = next(i for i in shop.catalog(db) if i["id"] == p["id"])
            self.assertEqual(saved["price"], 123)
        p["active"] = False
        self.request("POST", "/api/admin/products", p, cookie=cookie)
        p["price"] = -5
        self.assertEqual(
            self.request("POST", "/api/admin/products", p, cookie=cookie)[0], 400
        )


if __name__ == "__main__":
    unittest.main()
