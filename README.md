# 展位销售管理系统 MVP

这是一个可本地运行的展位销售管理系统 MVP，覆盖管理员、业务员、企业账号三类角色的核心闭环：

- 展位底图与矩形展位管理，默认展位图为空白，由管理员上传底图后绘制；支持底图显示缩放、像素/米比例尺和按原图比例校正
- 标摊/光地价格规则、首款比例、预留有效工作日、预留释放规则
- 业务员创建展位订单/无展位订单，提交水单
- 订单录入时通过弹窗展位图选择展位，并支持按展位号搜索
- 管理员审核水单，达到首款比例后订单自动成交
- 成交展位订单生成企业账号
- 企业端填写会刊资料、参展证、楣板修改、展具增租
- 管理员自定义展具名称、尺寸、价格，并审核企业展具增租
- MySQL 数据库存储、数据看板、CSV 导出、附件权限下载、操作日志

## 运行

安装 Python MySQL 驱动后使用 Node.js 启动：

```bash
python -m pip install -r requirements.txt
node server.js
```

如果使用 Codex 自带运行时，可在本机运行：

```powershell
& "C:\Users\51475\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

打开：

```text
http://localhost:3000
```

## 默认账号

| 角色 | 账号 | 密码 |
|---|---|---|
| 超级管理员 | `admin` | `admin123` |
| 业务员 | `sales01` | `sales123` |
| 企业账号 | 成交订单后生成 | 系统弹出临时密码 |

## 数据与附件

- 生产数据库：MySQL
- 本地兼容数据库：`data/expo_sales.db`，仅在未配置 MySQL 时用于本地开发
- 本地附件目录：`storage/uploads`
- 首次启动时，如果当前数据库没有数据，系统会自动创建默认账号，展位图为空白。
- 预留有效期按“工作日”计算。后台可联网同步中国大陆节假日/调休数据，并落库缓存；同步失败时临时按周一到周五计算。

## MySQL 配置

MySQL 存储已拆为关系表：展会、展位、客户、客户保护、订单、订单展位明细、收款、企业展务、审核记录、附件、操作日志分别落在独立业务表中。系统配置、会话、工作日缓存等少量非核心状态存放在 `app_meta` 中。

PowerShell 示例：

```powershell
$env:DB_DRIVER="mysql"
$env:MYSQL_HOST="127.0.0.1"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="expo_user"
$env:MYSQL_PASSWORD="your_password"
$env:MYSQL_DATABASE="expo_sales"
python -m pip install -r requirements.txt
npm run mysql:init
npm run migrate:mysql
npm start
```

也可以使用连接串：

```powershell
$env:DB_DRIVER="mysql"
$env:DATABASE_URL="mysql://expo_user:your_password@127.0.0.1:3306/expo_sales"
```

如果 MySQL 已经有数据，迁移脚本会拒绝覆盖。确认要覆盖时再设置：

```powershell
$env:MIGRATE_OVERWRITE="1"
npm run migrate:mysql
```

## 生产化待办

- 在服务端业务层继续收敛事务边界，并给正式关系表补充更细的唯一索引和外键约束
- 对接阿里云 OSS/腾讯云 COS 等对象存储
- 接入短信或企业微信/钉钉提醒
- 使用 Nginx + HTTPS + 域名备案部署
- 增加真实 XLSX 导出和附件 ZIP 打包
- 增加更细粒度管理员权限、审计查询和数据库自动备份
