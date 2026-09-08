import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '시험감독 편성실',
  description: '중학교 시험감독을 조건에 맞게 자동 편성하고 점검하는 교무부 업무 도구',
  metadataBase: new URL('https://exam-supervision-planner.leebyongj598693.chatgpt.site'),
  openGraph: {
    title: '시험감독 편성실',
    description: '조건은 꼼꼼하게, 편성은 한 번에.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '시험감독 편성실' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '시험감독 편성실',
    description: '조건은 꼼꼼하게, 편성은 한 번에.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
