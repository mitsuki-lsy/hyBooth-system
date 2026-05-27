import json
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SQLITE_DB = ROOT / "data" / "expo_sales.db"
MYSQL_EXE = Path("C:/mysql/bin/mysql.exe")
MYSQL_ARGS = [
    str(MYSQL_EXE),
    "--default-character-set=utf8mb4",
    "--host=127.0.0.1",
    "--port=3306",
    "--user=expo_sales_app",
    "--password=ExpoApp-40G1KI5HdAOoVcyIPL8JA289n3xSRtf2",
    "--database=expo_sales",
    "--batch",
    "--raw",
    "--skip-column-names",
]


def mysql_query(sql):
    result = subprocess.run(
        MYSQL_ARGS + [f"--execute={sql}"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        encoding="utf-8",
    )
    return result.stdout


def mysql_exec(sql):
    subprocess.run(
        MYSQL_ARGS + ["--binary-mode"],
        input=sql,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        encoding="utf-8",
    )


def sql_str(value):
    return "'" + str(value or "").replace("\\", "\\\\").replace("'", "''") + "'"


def sql_int(value):
    try:
        return str(int(value))
    except Exception:
        return "0"


def sql_json(value):
    return sql_str(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def read_sqlite_db():
    conn = sqlite3.connect(SQLITE_DB)
    try:
        row = conn.execute(
            "SELECT state_value FROM app_state WHERE state_key = ?", ("main",)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise RuntimeError("SQLite 主库没有 app_state/main")
    return json.loads(row[0])


def read_mysql_meta():
    raw = mysql_query("SELECT state_value FROM app_meta WHERE state_key='main' LIMIT 1")
    raw = raw.strip()
    return json.loads(raw) if raw else {}


def build_meta(sqlite_db, mysql_meta):
    settings = dict(sqlite_db.get("settings") or {})
    settings.pop("events", None)
    settings.pop("eventCategories", None)
    settings.pop("departments", None)
    return {
        "nextIds": mysql_meta.get("nextIds") or sqlite_db.get("nextIds") or {},
        "settings": settings,
        "map": sqlite_db.get("map") or {},
        "sessions": mysql_meta.get("sessions") or sqlite_db.get("sessions") or {},
        "workdayCalendar": sqlite_db.get("workdayCalendar") or {},
    }


def main():
    sqlite_db = read_sqlite_db()
    mysql_meta = read_mysql_meta()
    meta = build_meta(sqlite_db, mysql_meta)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    lines = ["SET NAMES utf8mb4;"]
    lines.append(
        "UPDATE app_meta SET state_value="
        + sql_str(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
        + ", updated_at="
        + sql_str(now)
        + " WHERE state_key='main';"
    )

    for user in sqlite_db.get("users", []):
        lines.append(
            "UPDATE expo_users SET display_name="
            + sql_str(user.get("displayName"))
            + " WHERE id="
            + sql_int(user.get("id"))
            + ";"
        )

    events = sqlite_db.get("settings", {}).get("events") or [
        sqlite_db.get("settings", {}).get("event", {})
    ]
    for event in events:
        if not event or not event.get("id"):
            continue
        lines.append(
            "UPDATE expo_events SET name="
            + sql_str(event.get("name"))
            + ", location="
            + sql_str(event.get("location"))
            + ", category="
            + sql_str(event.get("category"))
            + " WHERE id="
            + sql_str(event.get("id"))
            + ";"
        )

    for company in sqlite_db.get("companies", []):
        lines.append(
            "UPDATE expo_companies SET name="
            + sql_str(company.get("name"))
            + ", short_name="
            + sql_str(company.get("shortName"))
            + ", contact_name="
            + sql_str(company.get("contactName"))
            + ", address="
            + sql_str(company.get("address"))
            + ", country_region="
            + sql_str(company.get("countryRegion"))
            + ", province="
            + sql_str(company.get("province"))
            + ", city="
            + sql_str(company.get("city"))
            + ", notes="
            + sql_str(company.get("notes"))
            + " WHERE id="
            + sql_int(company.get("id"))
            + ";"
        )

    for attachment in sqlite_db.get("attachments", []):
        lines.append(
            "UPDATE expo_attachments SET file_name="
            + sql_str(attachment.get("fileName"))
            + " WHERE id="
            + sql_int(attachment.get("id"))
            + ";"
        )

    for booth in sqlite_db.get("booths", []):
        lines.append(
            "UPDATE expo_booths SET booth_no="
            + sql_str(booth.get("boothNo"))
            + ", hall="
            + sql_str(booth.get("hall"))
            + ", zone="
            + sql_str(booth.get("zone"))
            + ", attr="
            + sql_str(booth.get("attr"))
            + " WHERE id="
            + sql_int(booth.get("id"))
            + ";"
        )

    for obstacle in sqlite_db.get("obstacles", []):
        lines.append(
            "UPDATE expo_obstacles SET label="
            + sql_str(obstacle.get("label"))
            + " WHERE id="
            + sql_int(obstacle.get("id"))
            + ";"
        )

    for order in sqlite_db.get("orders", []):
        lines.append(
            "UPDATE expo_orders SET event_name="
            + sql_str(order.get("eventName"))
            + ", title="
            + sql_str(order.get("title"))
            + ", details="
            + sql_str(order.get("details"))
            + ", release_reason="
            + sql_str(order.get("releaseReason"))
            + ", cancel_reason="
            + sql_str(order.get("cancelReason"))
            + " WHERE id="
            + sql_int(order.get("id"))
            + ";"
        )
        booth_ids = order.get("boothIds") or []
        snapshots = order.get("boothSnapshot") or []
        for index, booth_id in enumerate(booth_ids):
            snapshot = snapshots[index] if index < len(snapshots) else {}
            lines.append(
                "UPDATE expo_order_booths SET booth_snapshot_json="
                + sql_json(snapshot)
                + " WHERE order_id="
                + sql_int(order.get("id"))
                + " AND booth_id="
                + sql_int(booth_id)
                + ";"
            )

    for notification in sqlite_db.get("notifications", []):
        lines.append(
            "UPDATE expo_notifications SET title="
            + sql_str(notification.get("title"))
            + ", content="
            + sql_str(notification.get("content"))
            + " WHERE id="
            + sql_int(notification.get("id"))
            + ";"
        )

    for profile in sqlite_db.get("profiles", []):
        fascia = profile.get("fascia") or {}
        lines.append(
            "UPDATE expo_profiles SET fascia_default_name="
            + sql_str(fascia.get("defaultName"))
            + ", fascia_requested_name="
            + sql_str(fascia.get("requestedName"))
            + ", fascia_review_remark="
            + sql_str(fascia.get("reviewRemark"))
            + " WHERE id="
            + sql_int(profile.get("id"))
            + ";"
        )
        for rental in profile.get("rentals") or []:
            lines.append(
                "UPDATE expo_profile_rentals SET furniture_name="
                + sql_str(rental.get("furnitureName"))
                + ", review_remark="
                + sql_str(rental.get("reviewRemark"))
                + " WHERE profile_id="
                + sql_int(profile.get("id"))
                + " AND rental_id="
                + sql_str(rental.get("id"))
                + ";"
            )

    # These rows no longer exist in the current SQLite state, but their correct
    # values can be reconstructed from stable app rules and current IDs.
    lines.append(
        "UPDATE expo_notifications SET content="
        + sql_str("流程自检测试企业20260521093704 已通过")
        + " WHERE id=14 AND content LIKE '%?%';"
    )
    lines.append(
        "UPDATE expo_change_requests SET type="
        + sql_str("更换展位")
        + ", detail="
        + sql_str("更换展位：1002 -> 1003")
        + ", applied_detail="
        + sql_str("ORD202600005 已更换为 1003")
        + " WHERE id=3 AND (type LIKE '%?%' OR detail LIKE '%?%' OR applied_detail LIKE '%?%');"
    )
    lines.append(
        "UPDATE expo_order_booths SET booth_snapshot_json="
        + sql_json({
            "id": 80,
            "boothNo": "1003",
            "area": 9,
            "obstacleArea": 0,
            "billableArea": 9,
            "hall": "1号馆",
            "zone": "面料家纺辅料",
            "attr": "standard",
            "price": 13500,
        })
        + " WHERE order_id=4 AND booth_id=80 AND booth_snapshot_json LIKE '%?%';"
    )
    lines.append(
        "UPDATE expo_profile_rentals SET furniture_name="
        + sql_str("电源插座")
        + " WHERE furniture_id='power' AND furniture_name LIKE '%?%';"
    )
    lines.append(
        "UPDATE expo_profile_rentals SET furniture_name="
        + sql_str("咨询桌")
        + " WHERE furniture_id='table' AND furniture_name LIKE '%?%';"
    )
    lines.append(
        "UPDATE expo_reviews SET extra_json="
        + sql_json({"orderId": 4, "type": "更换展位"})
        + " WHERE review_key='change:3' AND extra_json LIKE '%?%';"
    )

    maps = sqlite_db.get("maps") or {
        sqlite_db.get("settings", {}).get("event", {}).get("id", "0001"): sqlite_db.get("map", {})
    }
    for event_id, config in maps.items():
        lines.append(
            "UPDATE expo_maps SET background_name="
            + sql_str(config.get("backgroundName"))
            + " WHERE event_id="
            + sql_str(event_id)
            + ";"
        )

    for index, name in enumerate(sqlite_db.get("settings", {}).get("eventCategories") or []):
        lines.append(
            "UPDATE expo_event_categories SET name="
            + sql_str(name)
            + " WHERE sort_order="
            + sql_int(index)
            + ";"
        )

    sql = "\n".join(lines) + "\n"
    (ROOT / "data" / "question-garbled-repair.sql").write_text(sql, encoding="utf-8")
    mysql_exec(sql)
    print(f"repaired {len(lines) - 1} update statements")


if __name__ == "__main__":
    main()
