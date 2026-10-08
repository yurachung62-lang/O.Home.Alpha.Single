'use client';
// 푸시 알림 켜기 (추가 기능) — 기기마다 이 페이지에서 한 번 「이 기기에서 알림 받기」를 누른다.
// 켜 두면 홈을 닫아 둬도 사이트 알림(역극 새 메시지·댓글·메모·다이어리…)이 휴대폰·PC 알림으로도 온다.
// 어떤 알림을 받을지는 지금까지처럼 상단 종 → 알림 설정의 항목별 스위치를 따른다.
//
// 구독 정보는 Supabase의 push_subs 표에 「내 것」으로 저장된다 (push_subscribe 함수 — push-setup.sql로 만든다).
import React, { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/auth';
import { loadServerConfig, serverConfig } from '@/lib/serverConfig';
import { pushNotif } from '@/lib/notifStore';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

type State = 'checking' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'no-server';

const toKey = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

async function supa(): Promise<SupabaseClient | null> {
  const cfg = serverConfig() ?? await loadServerConfig();
  if (!cfg || cfg.kind !== 'supabase') return null;
  const { createBrowserClient } = await import('@supabase/ssr');
  return createBrowserClient(cfg.url.replace(/\/$/, ''), cfg.anonKey);
}

export default function PushPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!(await supa())) { setState('no-server'); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState(ios && !standalone ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? 'on' : 'off');
  }, []);
  useEffect(() => { void check(); }, [check]);

  const turnOn = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
      const { publicKey } = await (await fetch('/api/push', { cache: 'no-store' })).json() as { publicKey: string };
      if (!publicKey) { toast('서버에 푸시 키가 아직 없습니다 — Vercel 환경변수를 확인해 주세요'); return; }
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const sb = await supa();
      const { error } = await sb!.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      if (error) { toast(`저장 실패 — ${error.message}`); return; }
      setState('on');
      toast('이 기기에서 알림을 받습니다');
    } catch (e) {
      toast(`알림을 켜지 못했습니다 — ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const sb = await supa();
        await sb?.rpc('push_unsubscribe', { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState('off');
      toast('이 기기의 알림을 껐습니다');
    } finally { setBusy(false); }
  };

  const test = () => {
    if (!user) return;
    pushNotif({ type: 'rp', toUserId: user.id, href: '/push', title: '푸시 알림 테스트', body: '이 알림이 보이면 성공이에요' });
    toast('테스트 알림을 보냈습니다 — 몇 초 안에 와야 해요');
  };

  const msg: Record<State, string> = {
    checking: '확인 중…',
    unsupported: '이 브라우저는 푸시 알림을 지원하지 않습니다. 크롬·엣지·사파리 최신 버전에서 열어 주세요.',
    'ios-install': '아이폰·아이패드는 사파리에서 공유 버튼 → 「홈 화면에 추가」로 설치한 뒤, 그 아이콘으로 홈을 열어 이 페이지에 다시 와 주세요.',
    denied: '이 브라우저에서 이 사이트의 알림이 차단되어 있습니다. 주소창 왼쪽 자물쇠(사이트 정보) → 알림 → 허용으로 바꾼 뒤 새로고침해 주세요.',
    off: '이 기기는 아직 알림을 받지 않습니다.',
    on: '이 기기에서 알림을 받는 중입니다.',
    'no-server': '데이터베이스(Supabase)에 연결된 홈에서만 쓸 수 있습니다.',
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>PUSH</PageTitle>
        <p>홈을 닫아 둬도 새 알림을 휴대폰·PC 알림으로 받기 — 기기마다 한 번씩 켜 주세요</p>
      </div>
      <div className="panel" style={{ maxWidth: 560, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}>
        {!user ? (
          <p style={{ margin: 0 }}>로그인 후 이용할 수 있습니다.</p>
        ) : (
          <>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{msg[state]}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {state === 'off' && (
                <button className="btn btn-dark" disabled={busy} onClick={turnOn}>이 기기에서 알림 받기</button>
              )}
              {state === 'on' && (
                <>
                  <button className="btn btn-dark" disabled={busy} onClick={test}>테스트 알림 보내기</button>
                  <button className="btn btn-ghost" disabled={busy} onClick={turnOff}>이 기기 알림 끄기</button>
                </>
              )}
            </div>
            <p className="hint" style={{ margin: 0, lineHeight: 1.6 }}>
              어떤 알림을 받을지는 상단 종 아이콘의 알림 설정 스위치를 따릅니다.
              PC는 브라우저가 켜져 있어야(창은 닫아도 됨) 알림이 옵니다.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
