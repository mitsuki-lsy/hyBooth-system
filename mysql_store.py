import json
import os
import sys
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse


RELATIONAL_TABLES = [
    "expo_reviews",
    "expo_profile_rentals",
    "expo_profile_badges",
    "expo_profiles",
    "expo_payments",
    "expo_order_booths",
    "expo_orders",
    "expo_customer_lead_attachments",
    "expo_customer_leads",
    "expo_change_requests",
    "expo_notifications",
    "expo_audit_logs",
    "expo_activity_areas",
    "expo_obstacles",
    "expo_booths",
    "expo_attachments",
    "expo_companies",
    "expo_event_roles",
    "expo_users",
    "expo_departments",
    "expo_maps",
    "expo_events",
    "expo_event_categories",
]


def load_pymysql():
    try:
        import pymysql
        if not hasattr(pymysql, "connect"):
            module_path = getattr(pymysql, "__file__", "unknown location")
            raise RuntimeError(f"PyMySQL 安装异常，当前加载的是 {module_path}，但缺少 connect()")
        return pymysql
    except ModuleNotFoundError as exc:
        raise RuntimeError("缺少 MySQL 驱动 PyMySQL，请先运行 python -m pip install -r requirements.txt") from exc


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def quote_identifier(value, label="identifier"):
    text = str(value or "").strip()
    if not text or not all(ch.isalnum() or ch in {"_", "$", "-"} for ch in text):
        raise RuntimeError(f"{label} 只能包含字母、数字、下划线、短横线或 $")
    return f"`{text.replace('`', '``')}`"


def config_from_env():
    config = {
        "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.environ.get("MYSQL_PORT", "3306")),
        "user": os.environ.get("MYSQL_USER", "root"),
        "password": os.environ.get("MYSQL_PASSWORD", ""),
        "database": os.environ.get("MYSQL_DATABASE", ""),
        "ssl": None,
    }

    url_value = os.environ.get("DATABASE_URL", "").strip()
    if url_value:
        parsed = urlparse(url_value)
        config["host"] = parsed.hostname or config["host"]
        config["port"] = int(parsed.port or config["port"])
        config["user"] = unquote(parsed.username or config["user"])
        config["password"] = unquote(parsed.password or config["password"])
        config["database"] = unquote((parsed.path or "").lstrip("/")) or config["database"]

    if env_bool("MYSQL_SSL"):
        config["ssl"] = {}
    if os.environ.get("MYSQL_SSL_CA"):
        with open(os.environ["MYSQL_SSL_CA"], "r", encoding="utf-8") as file:
            config["ssl"] = {"ca": file.read()}

    if not config["database"]:
        raise RuntimeError("请配置 MYSQL_DATABASE 或 DATABASE_URL")
    if not config["user"]:
        raise RuntimeError("请配置 MYSQL_USER 或 DATABASE_URL")
    return config


def json_text(value):
    return json.dumps(value if value is not None else None, ensure_ascii=False, separators=(",", ":"))


def json_value(value, default):
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def int_or_none(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except Exception:
        return None


def float_value(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def bool_int(value):
    return 1 if bool(value) else 0


def bool_value(value):
    return bool(int(value or 0))


def extra_json(row, known):
    return {key: value for key, value in (row or {}).items() if key not in known}


def merge_extra(row, extra):
    merged = dict(json_value(extra, {}) or {})
    merged.update({key: value for key, value in row.items() if value is not None})
    return merged


def connect_without_database(pymysql, config):
    return pymysql.connect(
        host=config["host"],
        port=config["port"],
        user=config["user"],
        password=config["password"],
        charset="utf8mb4",
        use_unicode=True,
        init_command="SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        autocommit=True,
        connect_timeout=10,
        ssl=config["ssl"],
    )


def connect_database(pymysql, config):
    return pymysql.connect(
        host=config["host"],
        port=config["port"],
        user=config["user"],
        password=config["password"],
        database=config["database"],
        charset="utf8mb4",
        use_unicode=True,
        init_command="SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        autocommit=True,
        connect_timeout=10,
        ssl=config["ssl"],
        cursorclass=pymysql.cursors.DictCursor,
    )


def ensure_schema(pymysql, config):
    database = quote_identifier(config["database"], "MYSQL_DATABASE")
    if os.environ.get("MYSQL_CREATE_DATABASE", "1") != "0":
        conn = connect_without_database(pymysql, config)
        try:
            with conn.cursor() as cur:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        finally:
            conn.close()

    conn = connect_database(pymysql, config)
    with conn.cursor() as cur:
        create_schema(cur)
    return conn


def create_schema(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS app_meta (
          state_key VARCHAR(64) NOT NULL PRIMARY KEY,
          state_value LONGTEXT NOT NULL,
          updated_at DATETIME(3) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_event_categories (
          name VARCHAR(191) NOT NULL PRIMARY KEY,
          sort_order INT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_events (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          start_date VARCHAR(32) NOT NULL DEFAULT '',
          end_date VARCHAR(32) NOT NULL DEFAULT '',
          location VARCHAR(255) NOT NULL DEFAULT '',
          category VARCHAR(191) NOT NULL DEFAULT '',
          linked_event_id VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          INDEX idx_event_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_maps (
          event_id VARCHAR(64) NOT NULL PRIMARY KEY,
          width INT NOT NULL DEFAULT 1680,
          height INT NOT NULL DEFAULT 980,
          scale_px_per_meter DOUBLE NOT NULL DEFAULT 16,
          background_attachment_id INT NULL,
          background_name VARCHAR(255) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_departments (
          id INT NOT NULL PRIMARY KEY,
          name VARCHAR(191) NOT NULL,
          extra_json LONGTEXT NULL,
          INDEX idx_department_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_users (
          id INT NOT NULL PRIMARY KEY,
          username VARCHAR(191) NOT NULL,
          password_hash VARCHAR(128) NOT NULL,
          display_name VARCHAR(191) NOT NULL,
          role VARCHAR(32) NOT NULL,
          department_id INT NULL,
          active TINYINT(1) NOT NULL DEFAULT 1,
          company_id INT NULL,
          order_id INT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          last_login_at VARCHAR(64) NULL,
          extra_json LONGTEXT NULL,
          UNIQUE KEY uk_user_username (username),
          INDEX idx_user_role (role),
          INDEX idx_user_department (department_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_event_roles (
          event_id VARCHAR(64) NOT NULL,
          user_id INT NOT NULL,
          role VARCHAR(32) NOT NULL,
          PRIMARY KEY (event_id, user_id),
          INDEX idx_event_role_user (user_id),
          INDEX idx_event_role_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_companies (
          id INT NOT NULL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          short_name VARCHAR(255) NOT NULL DEFAULT '',
          contact_name VARCHAR(191) NOT NULL DEFAULT '',
          phone VARCHAR(64) NOT NULL DEFAULT '',
          email VARCHAR(191) NOT NULL DEFAULT '',
          address VARCHAR(500) NOT NULL DEFAULT '',
          tax_no VARCHAR(128) NOT NULL DEFAULT '',
          location_type VARCHAR(32) NOT NULL DEFAULT 'domestic',
          country_region VARCHAR(191) NOT NULL DEFAULT '',
          province VARCHAR(191) NOT NULL DEFAULT '',
          city VARCHAR(191) NOT NULL DEFAULT '',
          owner_sales_id INT NULL,
          notes TEXT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          INDEX idx_company_name (name),
          INDEX idx_company_tax_no (tax_no),
          INDEX idx_company_owner (owner_sales_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_attachments (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL DEFAULT '',
          file_name VARCHAR(255) NOT NULL DEFAULT '',
          mime_type VARCHAR(191) NOT NULL DEFAULT '',
          size BIGINT NOT NULL DEFAULT 0,
          storage_name VARCHAR(255) NOT NULL DEFAULT '',
          category VARCHAR(64) NOT NULL DEFAULT '',
          uploaded_by INT NULL,
          order_id INT NULL,
          company_id INT NULL,
          lead_id INT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          INDEX idx_attachment_event (event_id),
          INDEX idx_attachment_order (order_id),
          INDEX idx_attachment_company (company_id),
          INDEX idx_attachment_lead (lead_id),
          INDEX idx_attachment_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_booths (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL,
          booth_no VARCHAR(191) NOT NULL,
          x DOUBLE NOT NULL DEFAULT 0,
          y DOUBLE NOT NULL DEFAULT 0,
          width DOUBLE NOT NULL DEFAULT 0,
          height DOUBLE NOT NULL DEFAULT 0,
          area DOUBLE NOT NULL DEFAULT 0,
          width_m DOUBLE NOT NULL DEFAULT 0,
          depth_m DOUBLE NOT NULL DEFAULT 0,
          hall VARCHAR(191) NOT NULL DEFAULT '',
          zone VARCHAR(191) NOT NULL DEFAULT '',
          attr VARCHAR(32) NOT NULL DEFAULT 'standard',
          price DOUBLE NOT NULL DEFAULT 0,
          status VARCHAR(32) NOT NULL DEFAULT 'available',
          order_id INT NULL,
          reserved_at VARCHAR(64) NULL,
          reserved_by INT NULL,
          updated_at VARCHAR(64) NULL,
          obstacle_area DOUBLE NOT NULL DEFAULT 0,
          billable_area DOUBLE NOT NULL DEFAULT 0,
          extra_json LONGTEXT NULL,
          INDEX idx_booth_event (event_id),
          INDEX idx_booth_event_no (event_id, booth_no),
          INDEX idx_booth_status (status),
          INDEX idx_booth_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_obstacles (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL,
          type VARCHAR(32) NOT NULL,
          shape VARCHAR(32) NOT NULL DEFAULT 'rect',
          booth_id INT NULL,
          label VARCHAR(191) NOT NULL DEFAULT '',
          x DOUBLE NOT NULL DEFAULT 0,
          y DOUBLE NOT NULL DEFAULT 0,
          width DOUBLE NOT NULL DEFAULT 0,
          height DOUBLE NOT NULL DEFAULT 0,
          width_m DOUBLE NOT NULL DEFAULT 0,
          depth_m DOUBLE NOT NULL DEFAULT 0,
          area DOUBLE NOT NULL DEFAULT 0,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          updated_at VARCHAR(64) NULL,
          extra_json LONGTEXT NULL,
          INDEX idx_obstacle_event (event_id),
          INDEX idx_obstacle_booth (booth_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_activity_areas (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL,
          name VARCHAR(191) NOT NULL DEFAULT '',
          x DOUBLE NOT NULL DEFAULT 0,
          y DOUBLE NOT NULL DEFAULT 0,
          width DOUBLE NOT NULL DEFAULT 0,
          height DOUBLE NOT NULL DEFAULT 0,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          updated_at VARCHAR(64) NULL,
          extra_json LONGTEXT NULL,
          INDEX idx_activity_area_event (event_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_customer_leads (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL,
          company_id INT NOT NULL,
          customer_type VARCHAR(32) NOT NULL DEFAULT 'new',
          status VARCHAR(32) NOT NULL DEFAULT 'protected',
          owner_sales_id INT NULL,
          protected_until VARCHAR(64) NULL,
          source_order_id INT NULL,
          source_event_name VARCHAR(255) NOT NULL DEFAULT '',
          source_amount DOUBLE NOT NULL DEFAULT 0,
          contract_review_status VARCHAR(32) NOT NULL DEFAULT 'none',
          contract_reviewed_by INT NULL,
          contract_reviewed_at VARCHAR(64) NULL,
          contract_review_remark TEXT NULL,
          voucher_review_status VARCHAR(32) NOT NULL DEFAULT 'none',
          voucher_reviewed_by INT NULL,
          voucher_reviewed_at VARCHAR(64) NULL,
          voucher_review_remark TEXT NULL,
          voucher_due_at VARCHAR(64) NULL,
          public_reason TEXT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          claimed_at VARCHAR(64) NULL,
          released_at VARCHAR(64) NULL,
          converted_at VARCHAR(64) NULL,
          extra_json LONGTEXT NULL,
          INDEX idx_lead_event (event_id),
          INDEX idx_lead_company (company_id),
          INDEX idx_lead_owner (owner_sales_id),
          INDEX idx_lead_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_customer_lead_attachments (
          lead_id INT NOT NULL,
          attachment_type VARCHAR(32) NOT NULL,
          attachment_id INT NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          PRIMARY KEY (lead_id, attachment_type, attachment_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_orders (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL,
          event_name VARCHAR(255) NOT NULL DEFAULT '',
          order_no VARCHAR(64) NOT NULL,
          type VARCHAR(32) NOT NULL,
          title VARCHAR(255) NOT NULL DEFAULT '',
          company_id INT NOT NULL,
          salesperson_id INT NOT NULL,
          original_amount DOUBLE NOT NULL DEFAULT 0,
          discount_rule_id VARCHAR(64) NOT NULL DEFAULT '',
          discount_reason VARCHAR(255) NOT NULL DEFAULT '',
          discount_amount DOUBLE NOT NULL DEFAULT 0,
          total_amount DOUBLE NOT NULL DEFAULT 0,
          paid_approved_amount DOUBLE NOT NULL DEFAULT 0,
          deposit_required DOUBLE NOT NULL DEFAULT 0,
          status VARCHAR(32) NOT NULL,
          details TEXT NULL,
          attachments_json LONGTEXT NULL,
          contract_attachments_json LONGTEXT NULL,
          invoice_attachments_json LONGTEXT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          reserve_expires_at VARCHAR(64) NULL,
          enterprise_user_id INT NULL,
          enterprise_account_issued_at VARCHAR(64) NULL,
          released_at VARCHAR(64) NULL,
          release_reason TEXT NULL,
          cancelled_at VARCHAR(64) NULL,
          cancel_reason TEXT NULL,
          updated_at VARCHAR(64) NULL,
          extra_json LONGTEXT NULL,
          UNIQUE KEY uk_order_no (order_no),
          INDEX idx_order_event (event_id),
          INDEX idx_order_company (company_id),
          INDEX idx_order_salesperson (salesperson_id),
          INDEX idx_order_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_order_booths (
          order_id INT NOT NULL,
          booth_id INT NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          booth_snapshot_json LONGTEXT NULL,
          PRIMARY KEY (order_id, sort_order),
          INDEX idx_order_booth_booth (booth_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_payments (
          id INT NOT NULL PRIMARY KEY,
          order_id INT NOT NULL,
          amount DOUBLE NOT NULL DEFAULT 0,
          paid_at VARCHAR(64) NOT NULL DEFAULT '',
          payer VARCHAR(191) NOT NULL DEFAULT '',
          voucher_attachment_id INT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          remark TEXT NULL,
          created_by INT NULL,
          reviewed_by INT NULL,
          reviewed_at VARCHAR(64) NULL,
          review_remark TEXT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          INDEX idx_payment_order (order_id),
          INDEX idx_payment_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_profiles (
          id INT NOT NULL PRIMARY KEY,
          order_id INT NOT NULL,
          company_id INT NOT NULL,
          catalog_json LONGTEXT NULL,
          fascia_default_name VARCHAR(255) NOT NULL DEFAULT '',
          fascia_requested_name VARCHAR(255) NOT NULL DEFAULT '',
          fascia_status VARCHAR(32) NOT NULL DEFAULT 'default',
          fascia_review_remark TEXT NULL,
          fascia_reviewed_by INT NULL,
          fascia_reviewed_at VARCHAR(64) NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          updated_at VARCHAR(64) NULL,
          extra_json LONGTEXT NULL,
          UNIQUE KEY uk_profile_order (order_id),
          INDEX idx_profile_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_profile_badges (
          profile_id INT NOT NULL,
          badge_id VARCHAR(64) NOT NULL,
          name VARCHAR(191) NOT NULL DEFAULT '',
          phone VARCHAR(64) NOT NULL DEFAULT '',
          title VARCHAR(191) NOT NULL DEFAULT '',
          id_no VARCHAR(128) NOT NULL DEFAULT '',
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          PRIMARY KEY (profile_id, badge_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_profile_rentals (
          profile_id INT NOT NULL,
          rental_id VARCHAR(64) NOT NULL,
          furniture_id VARCHAR(64) NOT NULL DEFAULT '',
          furniture_name VARCHAR(191) NOT NULL DEFAULT '',
          qty INT NOT NULL DEFAULT 1,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          review_remark TEXT NULL,
          reviewed_by INT NULL,
          reviewed_at VARCHAR(64) NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          PRIMARY KEY (profile_id, rental_id),
          INDEX idx_rental_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_change_requests (
          id INT NOT NULL PRIMARY KEY,
          order_id INT NOT NULL,
          type VARCHAR(64) NOT NULL DEFAULT '',
          detail TEXT NULL,
          change_data_json LONGTEXT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          created_by INT NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          reviewed_by INT NULL,
          reviewed_at VARCHAR(64) NULL,
          review_remark TEXT NULL,
          applied_detail TEXT NULL,
          extra_json LONGTEXT NULL,
          INDEX idx_change_order (order_id),
          INDEX idx_change_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_notifications (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL DEFAULT '',
          user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL DEFAULT '',
          content TEXT NULL,
          read_at VARCHAR(64) NULL,
          created_at VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          INDEX idx_notification_user (user_id),
          INDEX idx_notification_event (event_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_audit_logs (
          id INT NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL DEFAULT '',
          at VARCHAR(64) NOT NULL DEFAULT '',
          user_id INT NULL,
          user_name VARCHAR(191) NOT NULL DEFAULT '',
          action VARCHAR(191) NOT NULL DEFAULT '',
          detail TEXT NULL,
          target_type VARCHAR(64) NOT NULL DEFAULT '',
          target_id VARCHAR(64) NOT NULL DEFAULT '',
          extra_json LONGTEXT NULL,
          INDEX idx_log_event (event_id),
          INDEX idx_log_target (target_type, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS expo_reviews (
          review_key VARCHAR(128) NOT NULL PRIMARY KEY,
          event_id VARCHAR(64) NOT NULL DEFAULT '',
          review_type VARCHAR(64) NOT NULL,
          target_table VARCHAR(64) NOT NULL,
          target_id VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL,
          reviewed_by INT NULL,
          reviewed_at VARCHAR(64) NULL,
          review_remark TEXT NULL,
          extra_json LONGTEXT NULL,
          INDEX idx_review_event (event_id),
          INDEX idx_review_status (status),
          INDEX idx_review_target (target_table, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def replace_rows(cur, table, columns, rows):
    cur.execute(f"DELETE FROM {quote_identifier(table)}")
    if not rows:
        return
    column_sql = ", ".join(quote_identifier(col) for col in columns)
    placeholder_sql = ", ".join(["%s"] * len(columns))
    cur.executemany(
        f"INSERT INTO {quote_identifier(table)} ({column_sql}) VALUES ({placeholder_sql})",
        rows,
    )


def read_legacy_app_state(cur):
    try:
        cur.execute("SELECT state_value FROM app_state WHERE state_key = %s LIMIT 1", ("main",))
        row = cur.fetchone()
        return row["state_value"] if row else ""
    except Exception:
        return ""


def read_state(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT state_value FROM app_meta WHERE state_key = %s LIMIT 1", ("main",))
        meta_row = cur.fetchone()
        if not meta_row:
            legacy = read_legacy_app_state(cur)
            if legacy:
                return legacy
            return ""

        meta = json_value(meta_row["state_value"], {})
        db = {
            "nextIds": meta.get("nextIds") or {},
            "settings": meta.get("settings") or {},
            "map": meta.get("map") or {},
            "maps": {},
            "users": [],
            "sessions": meta.get("sessions") or {},
            "eventRoles": [],
            "customerLeads": [],
            "booths": [],
            "obstacles": [],
            "activityAreas": [],
            "companies": [],
            "orders": [],
            "payments": [],
            "profiles": [],
            "attachments": [],
            "changeRequests": [],
            "notifications": [],
            "logs": [],
            "workdayCalendar": meta.get("workdayCalendar") or {},
        }

        cur.execute("SELECT * FROM expo_event_categories ORDER BY sort_order, name")
        db["settings"]["eventCategories"] = [row["name"] for row in cur.fetchall()]

        cur.execute("SELECT * FROM expo_events ORDER BY id")
        events = []
        for row in cur.fetchall():
            item = merge_extra({
                "id": row["id"],
                "name": row["name"],
                "startDate": row["start_date"],
                "endDate": row["end_date"],
                "location": row["location"],
                "category": row["category"],
                "linkedEventId": row["linked_event_id"],
            }, row.get("extra_json"))
            events.append(item)
        db["settings"]["events"] = events
        current_event = db["settings"].get("event") or {}
        current_id = current_event.get("id")
        db["settings"]["event"] = next((event for event in events if event["id"] == current_id), events[0] if events else current_event)

        cur.execute("SELECT * FROM expo_maps ORDER BY event_id")
        for row in cur.fetchall():
            db["maps"][row["event_id"]] = merge_extra({
                "width": int(row["width"] or 0),
                "height": int(row["height"] or 0),
                "scalePxPerMeter": float_value(row["scale_px_per_meter"]),
                "backgroundAttachmentId": row["background_attachment_id"],
                "backgroundName": row["background_name"],
            }, row.get("extra_json"))
        if db["settings"]["event"].get("id") in db["maps"]:
            db["map"] = db["maps"][db["settings"]["event"]["id"]]

        cur.execute("SELECT * FROM expo_departments ORDER BY id")
        db["settings"]["departments"] = [
            merge_extra({"id": int(row["id"]), "name": row["name"]}, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_users ORDER BY id")
        db["users"] = [
            merge_extra({
                "id": int(row["id"]),
                "username": row["username"],
                "passwordHash": row["password_hash"],
                "displayName": row["display_name"],
                "role": row["role"],
                "departmentId": row["department_id"],
                "active": bool_value(row["active"]),
                "companyId": row["company_id"],
                "orderId": row["order_id"],
                "createdAt": row["created_at"],
                "lastLoginAt": row["last_login_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_event_roles ORDER BY event_id, user_id")
        db["eventRoles"] = [{"eventId": row["event_id"], "userId": int(row["user_id"]), "role": row["role"]} for row in cur.fetchall()]

        cur.execute("SELECT * FROM expo_companies ORDER BY id")
        db["companies"] = [
            merge_extra({
                "id": int(row["id"]),
                "name": row["name"],
                "shortName": row["short_name"],
                "contactName": row["contact_name"],
                "phone": row["phone"],
                "email": row["email"],
                "address": row["address"],
                "taxNo": row["tax_no"],
                "locationType": row["location_type"],
                "countryRegion": row["country_region"],
                "province": row["province"],
                "city": row["city"],
                "ownerSalesId": row["owner_sales_id"],
                "notes": row["notes"] or "",
                "createdAt": row["created_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_attachments ORDER BY id")
        db["attachments"] = [
            merge_extra({
                "id": int(row["id"]),
                "eventId": row["event_id"],
                "fileName": row["file_name"],
                "mimeType": row["mime_type"],
                "size": int(row["size"] or 0),
                "storageName": row["storage_name"],
                "category": row["category"],
                "uploadedBy": row["uploaded_by"],
                "orderId": row["order_id"],
                "companyId": row["company_id"],
                "leadId": row["lead_id"],
                "createdAt": row["created_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_booths ORDER BY id")
        db["booths"] = [
            merge_extra({
                "id": int(row["id"]),
                "eventId": row["event_id"],
                "boothNo": row["booth_no"],
                "x": float_value(row["x"]),
                "y": float_value(row["y"]),
                "width": float_value(row["width"]),
                "height": float_value(row["height"]),
                "area": float_value(row["area"]),
                "widthM": float_value(row["width_m"]),
                "depthM": float_value(row["depth_m"]),
                "hall": row["hall"],
                "zone": row["zone"],
                "attr": row["attr"],
                "price": float_value(row["price"]),
                "status": row["status"],
                "orderId": row["order_id"],
                "reservedAt": row["reserved_at"],
                "reservedBy": row["reserved_by"],
                "updatedAt": row["updated_at"],
                "obstacleArea": float_value(row["obstacle_area"]),
                "billableArea": float_value(row["billable_area"]),
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_obstacles ORDER BY id")
        db["obstacles"] = [
            merge_extra({
                "id": int(row["id"]),
                "eventId": row["event_id"],
                "type": row["type"],
                "shape": row["shape"],
                "boothId": row["booth_id"],
                "label": row["label"],
                "x": float_value(row["x"]),
                "y": float_value(row["y"]),
                "width": float_value(row["width"]),
                "height": float_value(row["height"]),
                "widthM": float_value(row["width_m"]),
                "depthM": float_value(row["depth_m"]),
                "area": float_value(row["area"]),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_activity_areas ORDER BY id")
        db["activityAreas"] = [
            merge_extra({
                "id": int(row["id"]),
                "eventId": row["event_id"],
                "name": row["name"],
                "x": float_value(row["x"]),
                "y": float_value(row["y"]),
                "width": float_value(row["width"]),
                "height": float_value(row["height"]),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        lead_attachments = {}
        cur.execute("SELECT * FROM expo_customer_lead_attachments ORDER BY lead_id, attachment_type, sort_order")
        for row in cur.fetchall():
            lead_attachments.setdefault(int(row["lead_id"]), {}).setdefault(row["attachment_type"], []).append(int(row["attachment_id"]))

        cur.execute("SELECT * FROM expo_customer_leads ORDER BY id")
        for row in cur.fetchall():
            lead_id = int(row["id"])
            item = merge_extra({
                "id": lead_id,
                "eventId": row["event_id"],
                "companyId": int(row["company_id"]),
                "customerType": row["customer_type"],
                "status": row["status"],
                "ownerSalesId": row["owner_sales_id"],
                "protectedUntil": row["protected_until"],
                "sourceOrderId": row["source_order_id"],
                "sourceEventName": row["source_event_name"],
                "sourceAmount": float_value(row["source_amount"]),
                "contractAttachmentIds": lead_attachments.get(lead_id, {}).get("contract", []),
                "voucherAttachmentIds": lead_attachments.get(lead_id, {}).get("voucher", []),
                "contractReviewStatus": row["contract_review_status"],
                "contractReviewedBy": row["contract_reviewed_by"],
                "contractReviewedAt": row["contract_reviewed_at"],
                "contractReviewRemark": row["contract_review_remark"] or "",
                "voucherReviewStatus": row["voucher_review_status"],
                "voucherReviewedBy": row["voucher_reviewed_by"],
                "voucherReviewedAt": row["voucher_reviewed_at"],
                "voucherReviewRemark": row["voucher_review_remark"] or "",
                "voucherDueAt": row["voucher_due_at"],
                "publicReason": row["public_reason"] or "",
                "createdAt": row["created_at"],
                "claimedAt": row["claimed_at"],
                "releasedAt": row["released_at"],
                "convertedAt": row["converted_at"],
            }, row.get("extra_json"))
            db["customerLeads"].append(item)

        order_booths = {}
        cur.execute("SELECT * FROM expo_order_booths ORDER BY order_id, sort_order")
        for row in cur.fetchall():
            order_id = int(row["order_id"])
            order_booths.setdefault(order_id, {"ids": [], "snapshots": []})
            order_booths[order_id]["ids"].append(int(row["booth_id"]))
            order_booths[order_id]["snapshots"].append(json_value(row["booth_snapshot_json"], {}))

        cur.execute("SELECT * FROM expo_orders ORDER BY id")
        for row in cur.fetchall():
            order_id = int(row["id"])
            booth_data = order_booths.get(order_id, {"ids": [], "snapshots": []})
            db["orders"].append(merge_extra({
                "id": order_id,
                "eventId": row["event_id"],
                "eventName": row["event_name"],
                "orderNo": row["order_no"],
                "type": row["type"],
                "title": row["title"],
                "companyId": int(row["company_id"]),
                "salespersonId": int(row["salesperson_id"]),
                "boothIds": booth_data["ids"],
                "boothSnapshot": booth_data["snapshots"],
                "originalAmount": float_value(row["original_amount"]),
                "discountRuleId": row["discount_rule_id"],
                "discountReason": row["discount_reason"],
                "discountAmount": float_value(row["discount_amount"]),
                "totalAmount": float_value(row["total_amount"]),
                "paidApprovedAmount": float_value(row["paid_approved_amount"]),
                "depositRequired": float_value(row["deposit_required"]),
                "status": row["status"],
                "details": row["details"] or "",
                "attachments": json_value(row["attachments_json"], []),
                "contractAttachments": json_value(row["contract_attachments_json"], []),
                "invoiceAttachments": json_value(row["invoice_attachments_json"], []),
                "createdAt": row["created_at"],
                "reserveExpiresAt": row["reserve_expires_at"],
                "enterpriseUserId": row["enterprise_user_id"],
                "enterpriseAccountIssuedAt": row["enterprise_account_issued_at"],
                "releasedAt": row["released_at"],
                "releaseReason": row["release_reason"] or "",
                "cancelledAt": row["cancelled_at"],
                "cancelReason": row["cancel_reason"] or "",
                "updatedAt": row["updated_at"],
            }, row.get("extra_json")))

        cur.execute("SELECT * FROM expo_payments ORDER BY id")
        db["payments"] = [
            merge_extra({
                "id": int(row["id"]),
                "orderId": int(row["order_id"]),
                "amount": float_value(row["amount"]),
                "paidAt": row["paid_at"],
                "payer": row["payer"],
                "voucherAttachmentId": row["voucher_attachment_id"],
                "status": row["status"],
                "remark": row["remark"] or "",
                "createdBy": row["created_by"],
                "reviewedBy": row["reviewed_by"],
                "reviewedAt": row["reviewed_at"],
                "reviewRemark": row["review_remark"] or "",
                "createdAt": row["created_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        badges = {}
        cur.execute("SELECT * FROM expo_profile_badges ORDER BY profile_id, created_at, badge_id")
        for row in cur.fetchall():
            badges.setdefault(int(row["profile_id"]), []).append(merge_extra({
                "id": row["badge_id"],
                "name": row["name"],
                "phone": row["phone"],
                "title": row["title"],
                "idNo": row["id_no"],
                "createdAt": row["created_at"],
            }, row.get("extra_json")))
        rentals = {}
        cur.execute("SELECT * FROM expo_profile_rentals ORDER BY profile_id, created_at, rental_id")
        for row in cur.fetchall():
            rentals.setdefault(int(row["profile_id"]), []).append(merge_extra({
                "id": row["rental_id"],
                "furnitureId": row["furniture_id"],
                "furnitureName": row["furniture_name"],
                "qty": int(row["qty"] or 1),
                "status": row["status"],
                "reviewRemark": row["review_remark"] or "",
                "reviewedBy": row["reviewed_by"],
                "reviewedAt": row["reviewed_at"],
                "createdAt": row["created_at"],
            }, row.get("extra_json")))
        cur.execute("SELECT * FROM expo_profiles ORDER BY id")
        for row in cur.fetchall():
            profile_id = int(row["id"])
            db["profiles"].append(merge_extra({
                "id": profile_id,
                "orderId": int(row["order_id"]),
                "companyId": int(row["company_id"]),
                "catalog": json_value(row["catalog_json"], {}),
                "badges": badges.get(profile_id, []),
                "fascia": {
                    "defaultName": row["fascia_default_name"],
                    "requestedName": row["fascia_requested_name"],
                    "status": row["fascia_status"],
                    "reviewRemark": row["fascia_review_remark"] or "",
                    "reviewedBy": row["fascia_reviewed_by"],
                    "reviewedAt": row["fascia_reviewed_at"],
                },
                "rentals": rentals.get(profile_id, []),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }, row.get("extra_json")))

        cur.execute("SELECT * FROM expo_change_requests ORDER BY id")
        db["changeRequests"] = [
            merge_extra({
                "id": int(row["id"]),
                "orderId": int(row["order_id"]),
                "type": row["type"],
                "detail": row["detail"] or "",
                "changeData": json_value(row["change_data_json"], {}),
                "status": row["status"],
                "createdBy": row["created_by"],
                "createdAt": row["created_at"],
                "reviewedBy": row["reviewed_by"],
                "reviewedAt": row["reviewed_at"],
                "reviewRemark": row["review_remark"] or "",
                "appliedDetail": row["applied_detail"] or "",
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_notifications ORDER BY id")
        db["notifications"] = [
            merge_extra({
                "id": int(row["id"]),
                "eventId": row["event_id"],
                "userId": int(row["user_id"]),
                "title": row["title"],
                "content": row["content"] or "",
                "readAt": row["read_at"],
                "createdAt": row["created_at"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]

        cur.execute("SELECT * FROM expo_audit_logs ORDER BY id")
        db["logs"] = [
            merge_extra({
                "id": int(row["id"]),
                "eventId": row["event_id"],
                "at": row["at"],
                "userId": row["user_id"],
                "userName": row["user_name"],
                "action": row["action"],
                "detail": row["detail"] or "",
                "targetType": row["target_type"],
                "targetId": row["target_id"],
            }, row.get("extra_json"))
            for row in cur.fetchall()
        ]
        return json_text(db)


def write_state(conn, raw):
    db = json.loads(raw)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    conn.autocommit(False)
    try:
        with conn.cursor() as cur:
            for table in RELATIONAL_TABLES:
                cur.execute(f"DELETE FROM {quote_identifier(table)}")

            settings = dict(db.get("settings") or {})
            events = settings.get("events") or ([settings.get("event")] if settings.get("event") else [])
            categories = settings.get("eventCategories") or []
            departments = settings.get("departments") or []
            meta_settings = dict(settings)
            meta_settings.pop("events", None)
            meta_settings.pop("eventCategories", None)
            meta_settings.pop("departments", None)
            meta = {
                "nextIds": db.get("nextIds") or {},
                "settings": meta_settings,
                "map": db.get("map") or {},
                "sessions": db.get("sessions") or {},
                "workdayCalendar": db.get("workdayCalendar") or {},
            }
            replace_rows(cur, "app_meta", ["state_key", "state_value", "updated_at"], [("main", json_text(meta), now)])

            replace_rows(cur, "expo_event_categories", ["name", "sort_order"], [
                (str(name or "").strip(), index)
                for index, name in enumerate(categories)
                if str(name or "").strip()
            ])
            replace_rows(cur, "expo_events", ["id", "name", "start_date", "end_date", "location", "category", "linked_event_id", "extra_json"], [
                (
                    str(event.get("id") or "").strip(),
                    str(event.get("name") or "").strip(),
                    event.get("startDate") or "",
                    event.get("endDate") or "",
                    event.get("location") or "",
                    event.get("category") or "",
                    event.get("linkedEventId") or "",
                    json_text(extra_json(event, {"id", "name", "startDate", "endDate", "location", "category", "linkedEventId"})),
                )
                for event in events
                if event and str(event.get("id") or "").strip()
            ])

            maps = db.get("maps") or {}
            if db.get("map") and settings.get("event", {}).get("id") and settings.get("event", {}).get("id") not in maps:
                maps = {**maps, settings["event"]["id"]: db["map"]}
            replace_rows(cur, "expo_maps", ["event_id", "width", "height", "scale_px_per_meter", "background_attachment_id", "background_name", "extra_json"], [
                (
                    event_id,
                    int(config.get("width") or 1680),
                    int(config.get("height") or 980),
                    float_value(config.get("scalePxPerMeter", 16)),
                    int_or_none(config.get("backgroundAttachmentId")),
                    config.get("backgroundName") or "",
                    json_text(extra_json(config, {"width", "height", "scalePxPerMeter", "backgroundAttachmentId", "backgroundName"})),
                )
                for event_id, config in maps.items()
            ])

            replace_rows(cur, "expo_departments", ["id", "name", "extra_json"], [
                (int(dept.get("id") or 0), dept.get("name") or "", json_text(extra_json(dept, {"id", "name"})))
                for dept in departments
                if int_or_none(dept.get("id"))
            ])
            replace_rows(cur, "expo_users", ["id", "username", "password_hash", "display_name", "role", "department_id", "active", "company_id", "order_id", "created_at", "last_login_at", "extra_json"], [
                (
                    int(user.get("id") or 0),
                    user.get("username") or "",
                    user.get("passwordHash") or "",
                    user.get("displayName") or "",
                    user.get("role") or "sales",
                    int_or_none(user.get("departmentId")),
                    bool_int(user.get("active", True)),
                    int_or_none(user.get("companyId")),
                    int_or_none(user.get("orderId")),
                    user.get("createdAt") or "",
                    user.get("lastLoginAt"),
                    json_text(extra_json(user, {"id", "username", "passwordHash", "displayName", "role", "departmentId", "active", "companyId", "orderId", "createdAt", "lastLoginAt"})),
                )
                for user in db.get("users", [])
                if int_or_none(user.get("id"))
            ])
            replace_rows(cur, "expo_event_roles", ["event_id", "user_id", "role"], [
                (row.get("eventId") or "", int(row.get("userId") or 0), row.get("role") or "")
                for row in db.get("eventRoles", [])
                if row.get("eventId") and int_or_none(row.get("userId")) and row.get("role")
            ])

            replace_rows(cur, "expo_companies", ["id", "name", "short_name", "contact_name", "phone", "email", "address", "tax_no", "location_type", "country_region", "province", "city", "owner_sales_id", "notes", "created_at", "extra_json"], [
                (
                    int(company.get("id") or 0),
                    company.get("name") or "",
                    company.get("shortName") or "",
                    company.get("contactName") or "",
                    company.get("phone") or "",
                    company.get("email") or "",
                    company.get("address") or "",
                    company.get("taxNo") or "",
                    company.get("locationType") or "domestic",
                    company.get("countryRegion") or "",
                    company.get("province") or "",
                    company.get("city") or "",
                    int_or_none(company.get("ownerSalesId")),
                    company.get("notes") or "",
                    company.get("createdAt") or "",
                    json_text(extra_json(company, {"id", "name", "shortName", "contactName", "phone", "email", "address", "taxNo", "locationType", "countryRegion", "province", "city", "ownerSalesId", "notes", "createdAt"})),
                )
                for company in db.get("companies", [])
                if int_or_none(company.get("id"))
            ])

            replace_rows(cur, "expo_attachments", ["id", "event_id", "file_name", "mime_type", "size", "storage_name", "category", "uploaded_by", "order_id", "company_id", "lead_id", "created_at", "extra_json"], [
                (
                    int(attachment.get("id") or 0),
                    attachment.get("eventId") or "",
                    attachment.get("fileName") or "",
                    attachment.get("mimeType") or "",
                    int(attachment.get("size") or 0),
                    attachment.get("storageName") or "",
                    attachment.get("category") or "",
                    int_or_none(attachment.get("uploadedBy")),
                    int_or_none(attachment.get("orderId")),
                    int_or_none(attachment.get("companyId")),
                    int_or_none(attachment.get("leadId")),
                    attachment.get("createdAt") or "",
                    json_text(extra_json(attachment, {"id", "eventId", "fileName", "mimeType", "size", "storageName", "category", "uploadedBy", "orderId", "companyId", "leadId", "createdAt"})),
                )
                for attachment in db.get("attachments", [])
                if int_or_none(attachment.get("id"))
            ])

            replace_rows(cur, "expo_booths", ["id", "event_id", "booth_no", "x", "y", "width", "height", "area", "width_m", "depth_m", "hall", "zone", "attr", "price", "status", "order_id", "reserved_at", "reserved_by", "updated_at", "obstacle_area", "billable_area", "extra_json"], [
                (
                    int(booth.get("id") or 0),
                    booth.get("eventId") or settings.get("event", {}).get("id", ""),
                    booth.get("boothNo") or "",
                    float_value(booth.get("x")),
                    float_value(booth.get("y")),
                    float_value(booth.get("width")),
                    float_value(booth.get("height")),
                    float_value(booth.get("area")),
                    float_value(booth.get("widthM")),
                    float_value(booth.get("depthM")),
                    booth.get("hall") or "",
                    booth.get("zone") or "",
                    booth.get("attr") or "standard",
                    float_value(booth.get("price")),
                    booth.get("status") or "available",
                    int_or_none(booth.get("orderId")),
                    booth.get("reservedAt"),
                    int_or_none(booth.get("reservedBy")),
                    booth.get("updatedAt"),
                    float_value(booth.get("obstacleArea")),
                    float_value(booth.get("billableArea")),
                    json_text(extra_json(booth, {"id", "eventId", "boothNo", "x", "y", "width", "height", "area", "widthM", "depthM", "hall", "zone", "attr", "price", "status", "orderId", "reservedAt", "reservedBy", "updatedAt", "obstacleArea", "billableArea"})),
                )
                for booth in db.get("booths", [])
                if int_or_none(booth.get("id"))
            ])
            replace_rows(cur, "expo_obstacles", ["id", "event_id", "type", "shape", "booth_id", "label", "x", "y", "width", "height", "width_m", "depth_m", "area", "created_at", "updated_at", "extra_json"], [
                (
                    int(obstacle.get("id") or 0),
                    obstacle.get("eventId") or settings.get("event", {}).get("id", ""),
                    obstacle.get("type") or "external",
                    obstacle.get("shape") or "rect",
                    int_or_none(obstacle.get("boothId")),
                    obstacle.get("label") or "",
                    float_value(obstacle.get("x")),
                    float_value(obstacle.get("y")),
                    float_value(obstacle.get("width")),
                    float_value(obstacle.get("height")),
                    float_value(obstacle.get("widthM")),
                    float_value(obstacle.get("depthM")),
                    float_value(obstacle.get("area")),
                    obstacle.get("createdAt") or "",
                    obstacle.get("updatedAt"),
                    json_text(extra_json(obstacle, {"id", "eventId", "type", "shape", "boothId", "label", "x", "y", "width", "height", "widthM", "depthM", "area", "createdAt", "updatedAt"})),
                )
                for obstacle in db.get("obstacles", [])
                if int_or_none(obstacle.get("id"))
            ])
            replace_rows(cur, "expo_activity_areas", ["id", "event_id", "name", "x", "y", "width", "height", "created_at", "updated_at", "extra_json"], [
                (
                    int(area.get("id") or 0),
                    area.get("eventId") or settings.get("event", {}).get("id", ""),
                    area.get("name") or "",
                    float_value(area.get("x")),
                    float_value(area.get("y")),
                    float_value(area.get("width")),
                    float_value(area.get("height")),
                    area.get("createdAt") or "",
                    area.get("updatedAt"),
                    json_text(extra_json(area, {"id", "eventId", "name", "x", "y", "width", "height", "createdAt", "updatedAt"})),
                )
                for area in db.get("activityAreas", [])
                if int_or_none(area.get("id"))
            ])

            replace_rows(cur, "expo_customer_leads", ["id", "event_id", "company_id", "customer_type", "status", "owner_sales_id", "protected_until", "source_order_id", "source_event_name", "source_amount", "contract_review_status", "contract_reviewed_by", "contract_reviewed_at", "contract_review_remark", "voucher_review_status", "voucher_reviewed_by", "voucher_reviewed_at", "voucher_review_remark", "voucher_due_at", "public_reason", "created_at", "claimed_at", "released_at", "converted_at", "extra_json"], [
                (
                    int(lead.get("id") or 0),
                    lead.get("eventId") or "",
                    int(lead.get("companyId") or 0),
                    lead.get("customerType") or "new",
                    lead.get("status") or "protected",
                    int_or_none(lead.get("ownerSalesId")),
                    lead.get("protectedUntil"),
                    int_or_none(lead.get("sourceOrderId")),
                    lead.get("sourceEventName") or "",
                    float_value(lead.get("sourceAmount")),
                    lead.get("contractReviewStatus") or "none",
                    int_or_none(lead.get("contractReviewedBy")),
                    lead.get("contractReviewedAt"),
                    lead.get("contractReviewRemark") or "",
                    lead.get("voucherReviewStatus") or "none",
                    int_or_none(lead.get("voucherReviewedBy")),
                    lead.get("voucherReviewedAt"),
                    lead.get("voucherReviewRemark") or "",
                    lead.get("voucherDueAt"),
                    lead.get("publicReason") or "",
                    lead.get("createdAt") or "",
                    lead.get("claimedAt"),
                    lead.get("releasedAt"),
                    lead.get("convertedAt"),
                    json_text(extra_json(lead, {"id", "eventId", "companyId", "customerType", "status", "ownerSalesId", "protectedUntil", "sourceOrderId", "sourceEventName", "sourceAmount", "contractAttachmentIds", "voucherAttachmentIds", "contractReviewStatus", "contractReviewedBy", "contractReviewedAt", "contractReviewRemark", "voucherReviewStatus", "voucherReviewedBy", "voucherReviewedAt", "voucherReviewRemark", "voucherDueAt", "publicReason", "createdAt", "claimedAt", "releasedAt", "convertedAt"})),
                )
                for lead in db.get("customerLeads", [])
                if int_or_none(lead.get("id")) and int_or_none(lead.get("companyId"))
            ])
            lead_attachment_rows = []
            for lead in db.get("customerLeads", []):
                lead_id = int_or_none(lead.get("id"))
                if not lead_id:
                    continue
                for index, attachment_id in enumerate(lead.get("contractAttachmentIds") or []):
                    lead_attachment_rows.append((lead_id, "contract", int(attachment_id), index))
                for index, attachment_id in enumerate(lead.get("voucherAttachmentIds") or []):
                    lead_attachment_rows.append((lead_id, "voucher", int(attachment_id), index))
            replace_rows(cur, "expo_customer_lead_attachments", ["lead_id", "attachment_type", "attachment_id", "sort_order"], lead_attachment_rows)

            replace_rows(cur, "expo_orders", ["id", "event_id", "event_name", "order_no", "type", "title", "company_id", "salesperson_id", "original_amount", "discount_rule_id", "discount_reason", "discount_amount", "total_amount", "paid_approved_amount", "deposit_required", "status", "details", "attachments_json", "contract_attachments_json", "invoice_attachments_json", "created_at", "reserve_expires_at", "enterprise_user_id", "enterprise_account_issued_at", "released_at", "release_reason", "cancelled_at", "cancel_reason", "updated_at", "extra_json"], [
                (
                    int(order.get("id") or 0),
                    order.get("eventId") or "",
                    order.get("eventName") or "",
                    order.get("orderNo") or "",
                    order.get("type") or "booth",
                    order.get("title") or "",
                    int(order.get("companyId") or 0),
                    int(order.get("salespersonId") or 0),
                    float_value(order.get("originalAmount")),
                    order.get("discountRuleId") or "",
                    order.get("discountReason") or "",
                    float_value(order.get("discountAmount")),
                    float_value(order.get("totalAmount")),
                    float_value(order.get("paidApprovedAmount")),
                    float_value(order.get("depositRequired")),
                    order.get("status") or "reserved",
                    order.get("details") or "",
                    json_text(order.get("attachments") or []),
                    json_text(order.get("contractAttachments") or []),
                    json_text(order.get("invoiceAttachments") or []),
                    order.get("createdAt") or "",
                    order.get("reserveExpiresAt"),
                    int_or_none(order.get("enterpriseUserId")),
                    order.get("enterpriseAccountIssuedAt"),
                    order.get("releasedAt"),
                    order.get("releaseReason") or "",
                    order.get("cancelledAt"),
                    order.get("cancelReason") or "",
                    order.get("updatedAt"),
                    json_text(extra_json(order, {"id", "eventId", "eventName", "orderNo", "type", "title", "companyId", "salespersonId", "boothIds", "boothSnapshot", "originalAmount", "discountRuleId", "discountReason", "discountAmount", "totalAmount", "paidApprovedAmount", "depositRequired", "status", "details", "attachments", "contractAttachments", "invoiceAttachments", "createdAt", "reserveExpiresAt", "enterpriseUserId", "enterpriseAccountIssuedAt", "releasedAt", "releaseReason", "cancelledAt", "cancelReason", "updatedAt"})),
                )
                for order in db.get("orders", [])
                if int_or_none(order.get("id")) and int_or_none(order.get("companyId")) and int_or_none(order.get("salespersonId"))
            ])
            order_booth_rows = []
            for order in db.get("orders", []):
                order_id = int_or_none(order.get("id"))
                if not order_id:
                    continue
                booth_ids = order.get("boothIds") or []
                snapshots = order.get("boothSnapshot") or []
                for index, booth_id in enumerate(booth_ids):
                    snapshot = snapshots[index] if index < len(snapshots) else {}
                    order_booth_rows.append((order_id, int(booth_id), index, json_text(snapshot)))
            replace_rows(cur, "expo_order_booths", ["order_id", "booth_id", "sort_order", "booth_snapshot_json"], order_booth_rows)

            replace_rows(cur, "expo_payments", ["id", "order_id", "amount", "paid_at", "payer", "voucher_attachment_id", "status", "remark", "created_by", "reviewed_by", "reviewed_at", "review_remark", "created_at", "extra_json"], [
                (
                    int(payment.get("id") or 0),
                    int(payment.get("orderId") or 0),
                    float_value(payment.get("amount")),
                    payment.get("paidAt") or "",
                    payment.get("payer") or "",
                    int_or_none(payment.get("voucherAttachmentId")),
                    payment.get("status") or "pending",
                    payment.get("remark") or "",
                    int_or_none(payment.get("createdBy")),
                    int_or_none(payment.get("reviewedBy")),
                    payment.get("reviewedAt"),
                    payment.get("reviewRemark") or "",
                    payment.get("createdAt") or "",
                    json_text(extra_json(payment, {"id", "orderId", "amount", "paidAt", "payer", "voucherAttachmentId", "status", "remark", "createdBy", "reviewedBy", "reviewedAt", "reviewRemark", "createdAt"})),
                )
                for payment in db.get("payments", [])
                if int_or_none(payment.get("id")) and int_or_none(payment.get("orderId"))
            ])

            profile_rows, badge_rows, rental_rows = [], [], []
            for profile in db.get("profiles", []):
                profile_id = int_or_none(profile.get("id"))
                if not profile_id:
                    continue
                fascia = profile.get("fascia") or {}
                profile_rows.append((
                    profile_id,
                    int(profile.get("orderId") or 0),
                    int(profile.get("companyId") or 0),
                    json_text(profile.get("catalog") or {}),
                    fascia.get("defaultName") or "",
                    fascia.get("requestedName") or "",
                    fascia.get("status") or "default",
                    fascia.get("reviewRemark") or "",
                    int_or_none(fascia.get("reviewedBy")),
                    fascia.get("reviewedAt"),
                    profile.get("createdAt") or "",
                    profile.get("updatedAt"),
                    json_text(extra_json(profile, {"id", "orderId", "companyId", "catalog", "badges", "fascia", "rentals", "createdAt", "updatedAt"})),
                ))
                for badge in profile.get("badges") or []:
                    badge_rows.append((
                        profile_id,
                        badge.get("id") or "",
                        badge.get("name") or "",
                        badge.get("phone") or "",
                        badge.get("title") or "",
                        badge.get("idNo") or "",
                        badge.get("createdAt") or "",
                        json_text(extra_json(badge, {"id", "name", "phone", "title", "idNo", "createdAt"})),
                    ))
                for rental in profile.get("rentals") or []:
                    rental_rows.append((
                        profile_id,
                        rental.get("id") or "",
                        rental.get("furnitureId") or "",
                        rental.get("furnitureName") or "",
                        int(rental.get("qty") or 1),
                        rental.get("status") or "pending",
                        rental.get("reviewRemark") or "",
                        int_or_none(rental.get("reviewedBy")),
                        rental.get("reviewedAt"),
                        rental.get("createdAt") or "",
                        json_text(extra_json(rental, {"id", "furnitureId", "furnitureName", "qty", "status", "reviewRemark", "reviewedBy", "reviewedAt", "createdAt"})),
                    ))
            replace_rows(cur, "expo_profiles", ["id", "order_id", "company_id", "catalog_json", "fascia_default_name", "fascia_requested_name", "fascia_status", "fascia_review_remark", "fascia_reviewed_by", "fascia_reviewed_at", "created_at", "updated_at", "extra_json"], profile_rows)
            replace_rows(cur, "expo_profile_badges", ["profile_id", "badge_id", "name", "phone", "title", "id_no", "created_at", "extra_json"], badge_rows)
            replace_rows(cur, "expo_profile_rentals", ["profile_id", "rental_id", "furniture_id", "furniture_name", "qty", "status", "review_remark", "reviewed_by", "reviewed_at", "created_at", "extra_json"], rental_rows)

            replace_rows(cur, "expo_change_requests", ["id", "order_id", "type", "detail", "change_data_json", "status", "created_by", "created_at", "reviewed_by", "reviewed_at", "review_remark", "applied_detail", "extra_json"], [
                (
                    int(request.get("id") or 0),
                    int(request.get("orderId") or 0),
                    request.get("type") or "",
                    request.get("detail") or "",
                    json_text(request.get("changeData") or {}),
                    request.get("status") or "pending",
                    int_or_none(request.get("createdBy")),
                    request.get("createdAt") or "",
                    int_or_none(request.get("reviewedBy")),
                    request.get("reviewedAt"),
                    request.get("reviewRemark") or "",
                    request.get("appliedDetail") or "",
                    json_text(extra_json(request, {"id", "orderId", "type", "detail", "changeData", "status", "createdBy", "createdAt", "reviewedBy", "reviewedAt", "reviewRemark", "appliedDetail"})),
                )
                for request in db.get("changeRequests", [])
                if int_or_none(request.get("id")) and int_or_none(request.get("orderId"))
            ])
            replace_rows(cur, "expo_notifications", ["id", "event_id", "user_id", "title", "content", "read_at", "created_at", "extra_json"], [
                (
                    int(notification.get("id") or 0),
                    notification.get("eventId") or "",
                    int(notification.get("userId") or 0),
                    notification.get("title") or "",
                    notification.get("content") or "",
                    notification.get("readAt"),
                    notification.get("createdAt") or "",
                    json_text(extra_json(notification, {"id", "eventId", "userId", "title", "content", "readAt", "createdAt"})),
                )
                for notification in db.get("notifications", [])
                if int_or_none(notification.get("id")) and int_or_none(notification.get("userId"))
            ])
            replace_rows(cur, "expo_audit_logs", ["id", "event_id", "at", "user_id", "user_name", "action", "detail", "target_type", "target_id", "extra_json"], [
                (
                    int(log.get("id") or 0),
                    log.get("eventId") or "",
                    log.get("at") or "",
                    int_or_none(log.get("userId")),
                    log.get("userName") or "",
                    log.get("action") or "",
                    log.get("detail") or "",
                    log.get("targetType") or "",
                    str(log.get("targetId") or ""),
                    json_text(extra_json(log, {"id", "eventId", "at", "userId", "userName", "action", "detail", "targetType", "targetId"})),
                )
                for log in db.get("logs", [])
                if int_or_none(log.get("id"))
            ])
            replace_rows(cur, "expo_reviews", ["review_key", "event_id", "review_type", "target_table", "target_id", "status", "reviewed_by", "reviewed_at", "review_remark", "extra_json"], build_review_rows(db))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.autocommit(True)


def build_review_rows(db):
    orders_by_id = {order.get("id"): order for order in db.get("orders", [])}
    profiles_by_id = {profile.get("id"): profile for profile in db.get("profiles", [])}
    rows = []
    for lead in db.get("customerLeads", []):
        if lead.get("contractReviewStatus") and lead.get("contractReviewStatus") != "none":
            rows.append((
                f"lead-contract:{lead.get('id')}",
                lead.get("eventId") or "",
                "customer_contract",
                "expo_customer_leads",
                str(lead.get("id")),
                lead.get("contractReviewStatus"),
                int_or_none(lead.get("contractReviewedBy")),
                lead.get("contractReviewedAt"),
                lead.get("contractReviewRemark") or "",
                json_text({"companyId": lead.get("companyId")}),
            ))
        if lead.get("voucherReviewStatus") and lead.get("voucherReviewStatus") != "none":
            rows.append((
                f"lead-voucher:{lead.get('id')}",
                lead.get("eventId") or "",
                "customer_voucher",
                "expo_customer_leads",
                str(lead.get("id")),
                lead.get("voucherReviewStatus"),
                int_or_none(lead.get("voucherReviewedBy")),
                lead.get("voucherReviewedAt"),
                lead.get("voucherReviewRemark") or "",
                json_text({"companyId": lead.get("companyId")}),
            ))
    for payment in db.get("payments", []):
        order = orders_by_id.get(payment.get("orderId")) or {}
        rows.append((
            f"payment:{payment.get('id')}",
            order.get("eventId") or "",
            "payment",
            "expo_payments",
            str(payment.get("id")),
            payment.get("status") or "pending",
            int_or_none(payment.get("reviewedBy")),
            payment.get("reviewedAt"),
            payment.get("reviewRemark") or "",
            json_text({"orderId": payment.get("orderId"), "amount": payment.get("amount")}),
        ))
    for profile in db.get("profiles", []):
        order = orders_by_id.get(profile.get("orderId")) or {}
        fascia = profile.get("fascia") or {}
        if fascia.get("status") and fascia.get("status") not in {"default", "none"}:
            rows.append((
                f"fascia:{profile.get('id')}",
                order.get("eventId") or "",
                "fascia",
                "expo_profiles",
                str(profile.get("id")),
                fascia.get("status"),
                int_or_none(fascia.get("reviewedBy")),
                fascia.get("reviewedAt"),
                fascia.get("reviewRemark") or "",
                json_text({"orderId": profile.get("orderId")}),
            ))
        for rental in profile.get("rentals") or []:
            rows.append((
                f"rental:{profile.get('id')}:{rental.get('id')}",
                order.get("eventId") or "",
                "furniture_rental",
                "expo_profile_rentals",
                str(rental.get("id")),
                rental.get("status") or "pending",
                int_or_none(rental.get("reviewedBy")),
                rental.get("reviewedAt"),
                rental.get("reviewRemark") or "",
                json_text({"profileId": profile.get("id"), "orderId": profile.get("orderId")}),
            ))
    for request in db.get("changeRequests", []):
        order = orders_by_id.get(request.get("orderId")) or {}
        rows.append((
            f"change:{request.get('id')}",
            order.get("eventId") or "",
            "order_change",
            "expo_change_requests",
            str(request.get("id")),
            request.get("status") or "pending",
            int_or_none(request.get("reviewedBy")),
            request.get("reviewedAt"),
            request.get("reviewRemark") or "",
            json_text({"orderId": request.get("orderId"), "type": request.get("type")}),
        ))
    return rows


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in {"init", "read", "write"}:
        print("usage: mysql_store.py <init|read|write>", file=sys.stderr)
        sys.exit(2)

    command = sys.argv[1]
    pymysql = load_pymysql()
    config = config_from_env()
    conn = ensure_schema(pymysql, config)
    try:
        if command == "init":
            print("ok")
            return
        if command == "read":
            print(read_state(conn), end="")
            return
        payload = sys.stdin.read()
        payload = payload.encode("utf-8", "replace").decode("utf-8", "replace")
        write_state(conn, payload)
        print("ok")
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
