# CPA Auth File Importer

作者：Victor ferline  
主页：https://linux.do/u/victor_ferline/summary  
仓库：https://github.com/maya1900/cpa-auth-importer

## 文件

- `src/`：Vue SPA 源码，包含批量导入、账号管理、额度读取、异常清理和 ZIP 导出。
- `index.html` / `vite.config.js`：Vite 入口与配置。
- `cpa-auth-importer.html`：旧版单文件页面，保留作备用。
- `batch-import-auth-files.mjs`：Node.js 命令行版，适合脚本化批量导入。

## 页面版使用

安装依赖并启动本地页面：

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址，填写 CPA URL 和管理密钥后使用。

页面顶部显示的版本号会自动读取 `package.json` 的 `version` 字段。

页面路由：

- `/#/import`：批量导入
- `/#/accounts`：账号管理

默认 CPA URL 为 `http://localhost:3000`，页面内没有内置个人域名或密钥。

导入前会先读取 CPA 已有账号列表。列表中已存在的同名认证文件会标记为“跳过”，不会再次上传。

如果某个文件上传失败，工具会标记该文件为“跳过”并继续处理后续文件；批量上传失败时会自动降级为逐个文件重试。

账号管理中可以并发读取账号额度、停止读取、并发批量删除账号，也可以清理异常账号或额度读取失败账号。

批量参数默认值：导入每批 `50`，额度并发 `10`，删除/导出并发 `6`，删除每批 `50`。这些值会在点击对应操作时读取；如果浏览器中保存的还是旧默认值，页面会自动升级到新的默认值。

“导出选中账号 ZIP”会导出账号列表中当前勾选的账号，不要求先刷新额度。虚拟账号不可勾选，也不会进入导出包。

填写过的 CPA URL、管理密钥、API 密钥和导入设置会保存在浏览器 `localStorage` 中，方便下次打开继续使用。点击页面里的“恢复默认”会清理这些本地保存的信息。

## CLI 使用

```bash
CPA_MANAGEMENT_KEY='your-key' node batch-import-auth-files.mjs ./auth-files -r
```

自定义服务地址：

```bash
node batch-import-auth-files.mjs --key 'your-key' --base http://localhost:3000 ./a.json ./more
```

查看完整参数：

```bash
node batch-import-auth-files.mjs --help
```

## 许可证

MIT License，Copyright (c) 2026 maya1900。
