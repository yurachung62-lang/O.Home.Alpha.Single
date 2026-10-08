// 푸시 알림 발송 (추가 기능) — 앱처럼 휴대폰·PC에 알림을 띄운다.
//
// 흐름: 알림(notifications) 행이 서버에 새로 생기면 Supabase의 트리거(push_on_notif)가
// 받는 사람의 기기 구독 목록과 함께 이 주소로 POST 한다 → 여기서 각 기기의 푸시 서버로 보낸다.
// 외부 패키지 없이 Web Push 표준을 직접 구현했다 (lib/webPush.ts).
//
// Vercel 환경변수 (Settings → Environment Variables)
//   VAPID_PUBLIC_KEY   공개 키 (base64url)
//   VAPID_PRIVATE_KEY  비밀 키 (base64url) — 절대 공개하지 말 것
//   PUSH_SECRET        Supabase 트리거와 맞춘 비밀 문자열 — 아무나 이 주소로 알림을 쏘지 못하게
import { encryptPayload, vapidHeader, type PushSub } from '@/lib/webPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 기기가 구독할 때 쓰는 공개 키 */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  return Response.json({ publicKey }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const secret = process.env.PUSH_SECRET;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !pub || !priv) return new Response('push not configured', { status: 500 });
  if (req.headers.get('x-push-secret') !== secret) return new Response('forbidden', { status: 403 });

  let body: { n?: Record<string, unknown>; subs?: PushSub[] };
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const n = body.n ?? {};
  const subs = Array.isArray(body.subs) ? body.subs : [];

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const message = Buffer.from(JSON.stringify({
    title: str(n.title, 120) || '새 알림',
    body: str(n.body, 200),
    href: str(n.href, 300) || '/',
    tag: `${str(n.type, 20)}:${str(n.href, 300)}:${str(n.title, 120)}`,
  }));
  const subject = new URL(req.url).origin;

  const results = await Promise.all(subs.map(async s => {
    try {
      if (!s?.endpoint?.startsWith('https://')) return 'skip';
      const res = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          Authorization: vapidHeader(s.endpoint, pub, priv, subject),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: '86400',
          Urgency: 'high',
        },
        body: new Uint8Array(encryptPayload(message, s.p256dh, s.auth)),
      });
      return String(res.status);
    } catch (e) {
      return `error: ${(e as Error).message}`;
    }
  }));
  return Response.json({ sent: results });
}
