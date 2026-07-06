# CPA Auth File Importer

作者：Victor ferline  
主页：https://linux.do/u/victor_ferline/summary  
仓库：https://github.com/maya1900/cpa-auth-importer

## 文件

- `cpa-auth-importer.html`：浏览器页面版，可批量导入认证 JSON 文件并管理已导入账号。
- `batch-import-auth-files.mjs`：Node.js 命令行版，适合脚本化批量导入。

## 页面版使用

直接打开 `cpa-auth-importer.html`，填写 CPA URL 和管理密钥后使用。

默认 CPA URL 为 `http://localhost:3000`，页面内没有内置个人域名或密钥。

导入前会先读取 CPA 已有账号列表。列表中已存在的同名认证文件会标记为“跳过”，不会再次上传。

如果某个文件上传失败，工具会标记该文件为“跳过”并继续处理后续文件；批量上传失败时会自动降级为逐个文件重试。

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
