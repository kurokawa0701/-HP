/**
 * Cloudflare Pages Function
 * お問い合わせ / 採用エントリーの受信エンドポイント
 *
 *  1. フォーム送信(POST)を受け取り
 *  2. D1データベースに保存
 *  3. 管理者へ通知メール(添付ファイル対応)
 *  4. 申込者へ自動返信メール
 *
 * 必要なバインディング / 環境変数（Cloudflareダッシュボードで設定）:
 *   DB             … D1データベース (binding名: DB)
 *   RESUME_BUCKET  … R2バケット (任意・履歴書を保存する場合のみ)
 *   RESEND_API_KEY … メール送信APIキー (Resend)         [Secret]
 *   FROM_EMAIL     … 送信元。例: 株式会社エンピ <noreply@example.jp>
 *   ADMIN_EMAIL    … 通知の宛先(担当者)。カンマ区切りで複数可
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { data, file } = await parseBody(request);

    // --- スパム対策(ハニーポット) : botが埋めた場合は成功を装って破棄 ---
    if (data.website) return json({ ok: true });

    // --- バリデーション ---
    if (!data.name || !isEmail(data.email)) {
      return json({ ok: false, error: '必須項目が未入力、またはメール形式が不正です。' }, 400);
    }
    if (file && file.size > MAX_FILE_BYTES) {
      return json({ ok: false, error: 'ファイルサイズが大きすぎます（5MBまで）。' }, 400);
    }

    const formType = data.formType === 'recruit' ? 'recruit' : 'contact';
    const createdAt = new Date().toISOString();

    // --- D1へ保存 ---
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO submissions
           (form_type, name, email, tel, company, category, position, message, resume_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        formType,
        str(data.name),
        str(data.email),
        str(data.tel),
        str(data.company),
        str(data.category),
        str(data.position),
        str(data.message || data.freetext),
        file ? file.name : '',
        createdAt
      ).run();
    }

    // --- 履歴書をR2へ保存(任意) ---
    if (file && env.RESUME_BUCKET) {
      const key = `resumes/${Date.now()}_${sanitize(file.name)}`;
      await env.RESUME_BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });
    }

    // --- メール送信 ---
    if (env.RESEND_API_KEY && env.FROM_EMAIL) {
      const attachment = file ? await toAttachment(file) : null;
      // 管理者への通知(返信先は申込者本人)
      if (env.ADMIN_EMAIL) {
        await sendMail(env, {
          to: env.ADMIN_EMAIL.split(',').map(s => s.trim()),
          replyTo: data.email,
          subject: adminSubject(formType, data),
          html: adminHtml(formType, data, createdAt, !!file),
          attachments: attachment ? [attachment] : [],
        });
      }
      // 申込者への自動返信
      await sendMail(env, {
        to: [data.email],
        replyTo: env.ADMIN_EMAIL ? env.ADMIN_EMAIL.split(',')[0].trim() : undefined,
        subject: replySubject(formType),
        html: replyHtml(formType, data),
      });
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: 'サーバー側でエラーが発生しました。' }, 500);
  }
}

/* ---------- リクエスト解析 ---------- */
async function parseBody(request) {
  const ct = request.headers.get('content-type') || '';
  const data = {};
  let file = null;

  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    for (const [k, v] of form.entries()) {
      if (typeof File !== 'undefined' && v instanceof File) {
        if (v.size > 0) file = v;
      } else {
        data[k] = v;
      }
    }
  } else if (ct.includes('application/json')) {
    Object.assign(data, await request.json());
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) data[k] = v;
  }
  return { data, file };
}

/* ---------- メール送信(Resend) ---------- */
async function sendMail(env, { to, replyTo, subject, html, attachments }) {
  const payload = { from: env.FROM_EMAIL, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  if (attachments && attachments.length) payload.attachments = attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('mail send failed: ' + (await res.text()));
  }
}

async function toAttachment(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
  }
  return { filename: file.name, content: btoa(binary) };
}

/* ---------- メール本文 ---------- */
function adminSubject(type, d) {
  return type === 'recruit'
    ? `【採用エントリー】${d.name} 様${d.position ? '（' + d.position + '）' : ''}`
    : `【お問い合わせ】${d.name} 様${d.category ? '（' + d.category + '）' : ''}`;
}

function adminHtml(type, d, createdAt, hasFile) {
  const rows = type === 'recruit'
    ? [
        ['希望職種', d.position],
        ['お名前', d.name],
        ['メールアドレス', d.email],
        ['電話番号', d.tel],
        ['自由記入', d.freetext || d.message],
        ['履歴書', hasFile ? '本メールに添付' : 'なし'],
      ]
    : [
        ['お問い合わせ種別', d.category],
        ['会社名', d.company],
        ['お名前', d.name],
        ['メールアドレス', d.email],
        ['電話番号', d.tel],
        ['お問い合わせ内容', d.message],
      ];
  return baseMail(
    (type === 'recruit' ? '採用エントリー' : 'お問い合わせ') + 'を受信しました',
    tableHtml(rows) +
      `<p style="color:#7A93A8;font-size:12px;margin-top:20px">受信日時: ${new Date(createdAt).toLocaleString('ja-JP')}</p>`
  );
}

function replySubject(type) {
  return type === 'recruit'
    ? '【株式会社エンピ】ご応募ありがとうございます'
    : '【株式会社エンピ】お問い合わせありがとうございます';
}

function replyHtml(type, d) {
  const body = type === 'recruit'
    ? `<p>${escapeHtml(d.name)} 様</p>
       <p>この度は株式会社エンピの採用にご応募いただき、誠にありがとうございます。<br>
       以下の内容でエントリーを受け付けいたしました。担当者が内容を確認のうえ、数日以内にご連絡いたします。</p>`
    : `<p>${escapeHtml(d.name)} 様</p>
       <p>この度は株式会社エンピへお問い合わせいただき、誠にありがとうございます。<br>
       以下の内容で受け付けいたしました。内容を確認のうえ、通常2営業日以内に担当者よりご連絡いたします。</p>`;
  const echo = type === 'recruit'
    ? tableHtml([['希望職種', d.position], ['お名前', d.name], ['メールアドレス', d.email]])
    : tableHtml([['お問い合わせ種別', d.category], ['お名前', d.name], ['お問い合わせ内容', d.message]]);
  return baseMail(
    'お問い合わせありがとうございます',
    body + echo +
      `<p style="margin-top:24px">※本メールは自動送信です。お心当たりのない場合は破棄してください。</p>
       <hr style="border:none;border-top:1px solid #EAF2F8;margin:24px 0">
       <p style="font-size:12px;color:#7A93A8">株式会社エンピ（ENPI Inc.）<br>
       〒335-0021 埼玉県戸田市大字新曽2220番地の1</p>`
  );
}

function baseMail(heading, inner) {
  return `<div style="font-family:'Hiragino Sans','Noto Sans JP',sans-serif;color:#1A2B3C;line-height:1.9;max-width:600px">
    <div style="background:#0068B7;color:#fff;padding:20px 28px;border-radius:12px 12px 0 0;font-weight:700;font-size:16px">${heading}</div>
    <div style="border:1px solid #EAF2F8;border-top:none;border-radius:0 0 12px 12px;padding:28px">${inner}</div>
  </div>`;
}

function tableHtml(rows) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
    rows.filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) =>
      `<tr>
         <th style="text-align:left;vertical-align:top;color:#7A93A8;font-weight:700;padding:10px 12px 10px 0;white-space:nowrap;width:130px">${escapeHtml(k)}</th>
         <td style="padding:10px 0;border-bottom:1px solid #EAF2F8">${escapeHtml(String(v)).replace(/\n/g, '<br>')}</td>
       </tr>`
    ).join('') +
    `</table>`;
}

/* ---------- ユーティリティ ---------- */
function isEmail(v) { return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function str(v) { return v == null ? '' : String(v); }
function sanitize(name) { return String(name).replace(/[^\w.\-]+/g, '_'); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
