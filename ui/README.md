# COZY UI (React + Vite)

## 로컬 실행

1. 환경변수 파일 준비
   - `ui/.env.example`를 참고해 `ui/.env` 생성
2. 의존성 설치
   - `npm install`
3. 개발 서버 실행
   - `npm run dev`

기본 API 주소는 `http://localhost:4000`입니다.

## Render 배포 (Static Site)

- Service Type: `Static Site`
- Root Directory: `ui`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

필수 환경변수:

- `VITE_API_BASE_URL=https://<your-backend-service>.onrender.com`

## 테스트

- 단위 + 통합 테스트: `npm run test`
