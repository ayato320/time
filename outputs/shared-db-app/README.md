# 研究室ステータスボード 共有DB版

ログインなしで、同じURLを開いた全員が同じメンバー状態を確認・更新できます。

## 起動方法

```powershell
cd C:\Users\ayato\Documents\Codex\2026-06-09\or-or-web\outputs\shared-db-app
npm start
```

起動後、このPCでは次のURLを開きます。

```text
http://localhost:3000
```

研究室内の別PCやスマホから見る場合は、サーバーを起動したPCのIPアドレスを使います。

```text
http://<サーバーPCのIPアドレス>:3000
```

## データ保存場所

メンバー情報は次のファイルに保存されます。

```text
data/members.json
```

このファイルを消すと、初期サンプルメンバーに戻ります。
