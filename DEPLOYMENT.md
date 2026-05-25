# 部署说明

这个项目是一个 Node.js Web 应用，后端会调用 Python 数据层脚本读写数据库。正式部署建议使用 MySQL。

## 1. 服务器环境要求

- Node.js 18 或更高版本
- Python 3.10 或更高版本
- MySQL 8.x
- PM2 或 systemd 这类进程管理工具
- Nginx，建议用于反向代理和 HTTPS

## 2. 拉取代码并安装依赖

```bash
git clone https://github.com/mitsuki-lsy/hyBooth-system.git
cd hyBooth-system
npm install
python3 -m pip install -r requirements.txt -t .python_deps
```

如果服务器上 `python3` 不在默认路径，先确认 Python 路径：

```bash
which python3
```

后面需要把这个路径写到 `data/mysql-app.env` 的 `PYTHON_BIN`。

## 3. 创建 MySQL 数据库和用户

登录 MySQL：

```bash
mysql -u root -p
```

执行：

```sql
CREATE DATABASE IF NOT EXISTS expo_sales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'expo_sales_app'@'localhost' IDENTIFIED BY '请替换成强密码';
GRANT ALL PRIVILEGES ON expo_sales.* TO 'expo_sales_app'@'localhost';
FLUSH PRIVILEGES;
```

生产环境不建议直接使用 MySQL 的 `root` 用户跑应用，建议使用上面的专用账号。

## 4. 配置数据库连接

复制示例配置：

```bash
cp data/mysql-app.env.example data/mysql-app.env
```

编辑 `data/mysql-app.env`：

```bash
vim data/mysql-app.env
```

示例内容：

```env
DB_DRIVER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=expo_sales_app
MYSQL_PASSWORD=请替换成强密码
MYSQL_DATABASE=expo_sales
PYTHONPATH=/opt/hyBooth-system/.python_deps
PYTHON_BIN=/usr/bin/python3
```

注意：

- `data/mysql-app.env` 包含数据库密码，不要提交到 GitHub
- `.gitignore` 已经忽略了这个文件
- `PYTHONPATH` 要改成服务器上的项目实际路径
- `PYTHON_BIN` 要改成服务器上的 Python 实际路径

## 5. 初始化或迁移数据

如果是全新的空数据库，执行：

```bash
npm run mysql:init
```

如果要把本地 SQLite 数据迁移到服务器 MySQL，需要先把本地 `data/expo_sales.db` 复制到服务器项目的 `data/expo_sales.db`，然后执行：

```bash
npm run migrate:mysql
```

迁移成功后会输出用户、订单、展位、附件等数据数量。

## 6. 启动项目

先临时启动测试：

```bash
npm start
```

如果启动成功，日志里应该看到：

```text
Database driver: mysql
```

浏览器访问：

```text
http://服务器IP:3000
```

## 7. 使用 PM2 常驻运行

安装 PM2：

```bash
npm install -g pm2
```

启动服务：

```bash
pm2 start server.js --name hybooth-system
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 status
pm2 logs hybooth-system
pm2 restart hybooth-system
pm2 stop hybooth-system
```

## 8. 配置 Nginx 反向代理

示例配置：

```nginx
server {
    listen 80;
    server_name 你的域名或服务器IP;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

修改后检查并重载：

```bash
nginx -t
systemctl reload nginx
```

## 9. 需要持久化的目录

下面这些文件或目录不要在部署时随便删除：

```text
data/mysql-app.env
storage/uploads
```

`storage/uploads` 存放用户上传的图片、PDF 等附件。如果后续使用 Docker 或自动化发布，需要把它挂载成持久化目录。

## 10. 不应该提交到 GitHub 的内容

```text
data/mysql-app.env
data/expo_sales.db
data/*.bak*
storage/uploads/*
.python_deps/
node_modules/
*.log
```

这些内容要么包含密码，要么是本地数据或运行产物。
