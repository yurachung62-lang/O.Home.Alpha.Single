// 홈 화면에 앱처럼 설치 (추가 기능 — 푸시 알림용). 아이폰은 이게 있어야 「홈 화면에 추가」한 앱에서 알림을 받는다
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'O.HOME',
    short_name: 'O.HOME',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1d1f24',
    theme_color: '#1d1f24',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
