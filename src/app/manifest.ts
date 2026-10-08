// 홈 화면에 앱처럼 설치 (추가 기능 — 푸시 알림용). 아이폰은 이게 있어야 「홈 화면에 추가」한 앱에서 알림을 받는다.
// 앱 이름·아이콘은 환경설정의 「브라우저 탭 제목」·「브라우저 탭 아이콘」을 그대로 따른다 (비우면 기본값).
import type { MetadataRoute } from 'next';
import { siteMeta } from '@/lib/siteMeta';

export const revalidate = 300;   // 설정을 바꾸면 5분 안에 반영

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { title, favicon } = await siteMeta();
  const name = (title || 'O.HOME').replace(/\s*—\s*개인홈$/, '') || 'O.HOME';
  const ext = favicon?.split('?')[0].split('.').pop()?.toLowerCase();
  const type = ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : ext === 'ico' ? 'image/x-icon' : 'image/png';
  return {
    name,
    short_name: name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1d1f24',
    theme_color: '#1d1f24',
    icons: favicon
      ? [
          { src: favicon, sizes: '512x512', type, purpose: 'any' },
          { src: favicon, sizes: '192x192', type, purpose: 'any' },
        ]
      : [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
