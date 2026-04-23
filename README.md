# 인테리어 공사 공유 플랫폼

Next.js 14 + Supabase(PostgreSQL/Auth/Storage/Realtime) + Vercel 로 구성된 인테리어 공사 공유 플랫폼입니다. 사업자(관리자)와 고객이 같은 프로젝트를 보면서 일정·비용·자재 결정·스위치/콘센트 스펙을 공유합니다.

## 🚀 실제 휴대폰에서 접속하기 (5단계 배포 가이드)

### 1) Supabase 프로젝트 만들기

1. https://supabase.com 에 가입 후 **New Project** 클릭
2. 프로젝트 이름/비밀번호(DB)/리전(가까운 서울 권장) 지정, 생성까지 1~2분 대기
3. 좌측 메뉴 **Project Settings → API** 에서 다음 세 값을 복사해 둡니다:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (🚨 비공개) → `SUPABASE_SERVICE_ROLE_KEY`

### 2) 데이터베이스 스키마 적용

Supabase 대시보드의 **SQL Editor** 에서 새 쿼리 탭을 열고, 이 저장소의 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 **Run**. 9개 테이블 + RLS 정책 + 트리거 + Storage 버킷(`attachments`) 이 한 번에 생성됩니다.

> 이미 `supabase` CLI 를 쓰신다면 `supabase link --project-ref <id>` 후 `supabase db push` 로도 적용됩니다.

### 3) 이 저장소를 GitHub 에 올리기

```bash
cd /Users/a60157119/object_go
git add -A && git commit -m "init: interior share platform"
# GitHub 에서 새 저장소를 하나 만든 뒤
git remote add origin git@github.com:<아이디>/<저장소>.git
git branch -M main
git push -u origin main
```

### 4) Vercel 배포

1. https://vercel.com 에 가입 → **Add New → Project** → GitHub 저장소를 Import
2. Framework Preset: **Next.js** (자동 감지)
3. **Environment Variables** 에 다음 네 개 추가:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 1) 단계에서 복사한 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (🚨 Secret) |
   | `NEXT_PUBLIC_APP_URL` | 배포 예정 도메인 (예: `https://interior-share.vercel.app`) |

4. **Deploy** 클릭. 2~3분 뒤 배포 URL 이 나옵니다. 이 URL 을 휴대폰 브라우저에서 열면 바로 PWA 로 사용 가능합니다.

### 5) 관리자 계정 만들기 (최초 1회)

1. Supabase 대시보드 → **Authentication → Users → Add user → Create new user**
   - Email: 원하시는 관리자 이메일
   - Password: 원하시는 비밀번호
   - **Auto Confirm User** 체크
2. **SQL Editor** 에서 아래를 실행해 그 계정을 관리자로 승격:

   ```sql
   update public.profiles set role = 'admin' where email = 'YOUR@EMAIL.com';
   ```

3. 배포 URL 의 `/login` 에서 방금 만든 관리자 계정으로 로그인 → `/admin` 에서 고객 계정을 만들고 프로젝트를 연결하면 끝.

## 📱 휴대폰 홈 화면에 추가 (PWA)

- 배포된 URL 을 아이폰 Safari 에서 연 뒤 `공유 → 홈 화면에 추가`
- 안드로이드 Chrome 에서는 `메뉴 → 앱 설치` 로 설치 가능합니다.

## 로컬 개발

```bash
cp .env.local.example .env.local
# .env.local 에 Supabase 키 채우기
npm install
npm run dev
```

로컬에서도 같은 Supabase 인스턴스를 씁니다. Vercel 과 키를 동일하게 유지하세요.

## 폴더 구조

```
app/
  (auth)/          # /login, /set-password
  (client)/        # /project/[id]/... (고객·관리자 공용 실제 업무 화면)
  (admin)/         # /admin, /admin/project/[id], /admin/clients
  api/             # REST API Routes (projects, schedules, costs, decisions, specs, comments, attachments, admin/clients)
components/        # DonutChart, BottomNav, FileUpload, CommentThread, StatusBadge 등
lib/supabase/      # client / server / middleware (쿠키 기반 세션)
lib/types/         # Profile, Project, Schedule, CostItem, Decision, SwitchSpec, Attachment, Comment
lib/utils.ts       # 날짜·금액 포맷 헬퍼
supabase/migrations/0001_init.sql   # 전체 스키마 + RLS + Storage 정책
supabase/seed.sql  # 선택: 관리자 승격 SQL 예시
public/manifest.json + icons/       # PWA
middleware.ts      # 세션 검증 / 미인증시 /login 으로 리다이렉트
```

## 주요 기능 (스펙 v1.0 대응)

- ✅ Supabase Auth (이메일+비밀번호) · 최초 로그인 시 비밀번호 변경 강제
- ✅ 9개 테이블 + 전체 RLS 정책 (고객은 자기 프로젝트만, 관리자는 전체)
- ✅ 고객 홈 대시보드: 예산/일정 진행 도넛, D-day, 이번 주 공사, 긴급 결정 알림, 최근 업데이트
- ✅ 공사 일정: 카드/상태 필터, 요청사항(실시간 댓글), 사진 첨부, 관리자 인라인 편집
- ✅ 결정 필요 항목: 옵션 선택, 제품 링크, 기한 D-day, 메모, 사진, 완료 항목 접기
- ✅ 세부 내역서: 공종 그룹 + 펼침, 상세 패널, 메모·사진, 총합계 바, 검색
- ✅ 스위치·콘센트 스펙: 스위치/콘센트 탭, 공간별 그룹, 상태(예정/발주/설치), 제품 링크
- ✅ 관리자: 프로젝트 생성/편집/삭제, 고객 계정 생성 + 임시 비밀번호, 비밀번호 재설정 메일
- ✅ Supabase Realtime: 일정/결정/내역/스펙/댓글 변경 즉시 반영
- ✅ Supabase Storage: 사진 업로드 (10MB 제한, 썸네일 400px transform)
- ✅ PWA: manifest, 모바일 안전 영역(safe-area-inset), 하단 탭바

## 보안 노트

- `SUPABASE_SERVICE_ROLE_KEY` 는 서버 런타임(API Routes) 에서만 사용합니다. 클라이언트 번들에는 포함되지 않습니다.
- 관리자 전용 API 는 `requireAdmin()` 가드로 서버에서 role 을 검증합니다.
- 마지막 방어선으로 PostgreSQL RLS 가 모든 테이블에 걸려 있습니다.
- 이미지 업로드는 MIME 검증 + 10MB 제한.

## 개발할지 고민 중인 섹션

스펙 문서의 **8번 (스위치·콘센트 실제 스펙 시드 데이터)** 는 아직 삽입하지 않았습니다. 필요해지면 `supabase/seed.sql` 에 해당 데이터를 추가하고 관리자 페이지에서 프로젝트별로 복제해 사용하실 수 있도록 하거나, 별도 "템플릿 스펙" 기능을 얹을 수 있습니다.
