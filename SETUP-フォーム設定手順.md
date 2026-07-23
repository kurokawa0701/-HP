# お問い合わせ・採用フォーム 設定手順（Cloudflare）

このサイトのお問い合わせ／採用エントリーフォームは、送信されると
**① データベースに保存**し、**② 担当者へ通知メール**、**③ 申込者へ自動返信メール**を送ります。

実装済みのファイル:

- `functions/api/submit.js` … 送信を受け取るサーバー処理（Cloudflare Pages Function）
- `schema.sql` … 保存用データベースの定義
- `wrangler.toml` … Cloudflare設定
- フォーム本体（`contact.html` / `recruit.html`）と `js/main.js` … 実送信に対応済み

動かすには、Cloudflare側で以下の設定が必要です（初回のみ）。

---

## 1. 前提

- サイトを **Cloudflare Pages** で公開していること
- PC に `npm` と Cloudflare の CLI「wrangler」が入っていること
  ```
  npm install -g wrangler
  wrangler login
  ```

## 2. データベース（D1）を作成

```
wrangler d1 create enpi_inquiries
```

実行すると `database_id = "xxxxxxxx-...."` が表示されます。
この値を `wrangler.toml` の `<YOUR_D1_DATABASE_ID>` に貼り付けてください。

続いてテーブルを作成します。

```
wrangler d1 execute enpi_inquiries --remote --file=./schema.sql
```

## 3. メール送信サービス（Resend）を用意

Cloudflare 自体はメールを送れないため、送信APIを使います。ここでは無料枠のある **Resend** を使う手順です。

1. https://resend.com にサインアップ
2. 「Domains」で自社ドメイン（例: `enpi-group.jp`）を追加し、表示される DNS レコードを Cloudflare の DNS に登録して認証
3. 「API Keys」でキーを発行（`re_xxxxx`）

※ SendGrid / Amazon SES など他のサービスでも可能です。その場合は `functions/api/submit.js` の `sendMail` 関数の送信先URL・形式を差し替えます。ご希望あれば対応します。

## 4. 環境変数・シークレットを設定

Cloudflare ダッシュボード → 対象の Pages プロジェクト → **Settings → Environment variables** で、
**Production（本番）** に以下を追加します（`RESEND_API_KEY` は「Encrypt/Secret」にする）。

| 変数名 | 値の例 | 説明 |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx` | Resend の APIキー（シークレット） |
| `FROM_EMAIL` | `株式会社エンピ <noreply@enpi-group.jp>` | 送信元。**Resendで認証したドメイン**のアドレス |
| `ADMIN_EMAIL` | `kazuma.kurokawa@oneness-group.jp` | 通知の受信先。カンマ区切りで複数可 |

## 5.（任意）履歴書ファイルをサーバー保存したい場合

初期状態では、履歴書は**通知メールに添付**されて担当者に届きます（保存はメール側）。
サーバー上にも保存したい場合は R2 を使います。

```
wrangler r2 bucket create enpi-resumes
```

そのうえで `wrangler.toml` の R2 部分のコメントアウト（`#`）を外してください。

## 6. デプロイ

```
wrangler pages deploy .
```

（GitHub 連携で自動デプロイしている場合は、変更を push すれば反映されます）

---

## 保存された問い合わせを見る

```
# 直近の受信一覧
wrangler d1 execute enpi_inquiries --remote --command="SELECT id, created_at, form_type, name, email FROM submissions ORDER BY id DESC LIMIT 50"
```

CSV で書き出したい、管理画面で一覧表示したい、などのご要望があれば追加で実装できます。

---

## 動作の確認ポイント

- フォーム送信後、緑のメッセージが出れば成功、赤いメッセージは失敗（設定を再確認）
- 迷惑メール判定を避けるため、`FROM_EMAIL` は必ず Resend で認証済みのドメインにしてください
- 添付ファイルは 5MB まで（`functions/api/submit.js` の `MAX_FILE_BYTES` で変更可）

## 注意

- `RESEND_API_KEY` などのシークレットは、GitHub 等に公開しないでください（`wrangler.toml` には書かず、ダッシュボードのシークレットで管理する構成にしています）。
- ローカルの簡易確認は `wrangler pages dev .` で行えますが、メール送信・D1 は本番設定が必要です。
