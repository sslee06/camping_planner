# 🏕️ CAMPING PLANNER (캠핑 플래너)
> **날씨와 캠핑장 정보를 한 화면에서 연결하는 스마트 캠핑 계획 도우미**  
> 한국관광공사 고캠핑 API와 기상청 중기예보 API를 결합하여, 장소·일정·시설·날씨를 한 화면에서 빠르게 비교하고 캠핑 계획을 저장할 수 있는 웹 서비스입니다.

---

## 🔗 1. 프로젝트 필수 접속 주소 (Quick Links)

| 구분 | 접속 주소 (URL) | 설명 |
| :--- | :--- | :--- |
| **🌐 서비스 웹 주소 (Frontend)** | [https://camping-planner-본인주소.vercel.app](https://camping-planner-flax.vercel.app) | Vercel에 배포된 React 프론트엔드 웹 서비스 (PC/모바일 반응형 지원) |
| **⚙️ Swagger UI 주소 (Backend API)** | [https://camping-planner-api.onrender.com/docs](https://camping-planner-api.onrender.com/docs) | Render에 배포된 FastAPI 백엔드 API 문서 및 실시간 테스트 페이지 |
| **💻 GitHub 저장소 주소 (Source)** | [https://github.com/sslee06/camping_planner](https://github.com/sslee06/camping_planner) | 프론트엔드 및 백엔드 전체 소스 코드 저장소 |

---

## 🎯 2. 해결하려는 문제 및 데이터 활용 기획 시나리오

### 1) 해결하려는 문제 (Pain Points)
1. **정보 분산:** 캠핑장 정보를 찾는 플랫폼과 기상청 날씨 앱을 각각 따로 검색해야 하는 번거로움이 있습니다.
2. **일정 판단 어려움:** 날짜별 강수확률과 최저·최고기온을 캠핑 일정에 맞춰 일일이 대조하고 해석하기 어렵습니다.
3. **비교 불편:** 부대시설(전기, 온수, 무선인터넷), 반려동물 동반 가능 여부, 예약 링크를 날씨 조건과 한 번에 비교하기 어렵습니다.

### 2) 데이터 활용 기획 시나리오 (Core User Flow)
* **Step 1. 조건 입력:** 사용자가 희망 지역(또는 반경 좌표), 캠핑 유형(자동차야영장, 글램핑, 카라반 등), 확인 일정을 선택합니다.
* **Step 2. 공간-기상 매핑 및 후보 탐색:** 백엔드(FastAPI)가 고캠핑 API로 주변 캠핑장을 조회한 뒤, 캠핑장 주소(`addr1`)를 Supabase의 `weather_region_map` 테이블과 매핑하여 기상청 예보구역 코드(`regId`)로 자동 변환합니다.
* **Step 3. 예보 결합 및 계획 확정:** 기상청 중기육상예보(강수확률·날씨) 및 중기기온(최저·최고기온) 데이터를 단일 JSON으로 정규화하여 카드 UI로 제공하며, 사용자는 마음에 드는 캠핑장을 찜(`favorites`)하거나 당시 날씨 스냅샷과 함께 일정(`camp_plans`)으로 저장합니다.

---

## 🏗️ 3. 서비스 아키텍처 및 기술 스택

클라이언트, API 서버, 데이터베이스를 분리한 3-Tier 배포 구조를 채택하여 외부 API Key가 브라우저에 노출되지 않도록 보안을 강화하고, 서버 계층에서 데이터 결합·캐싱·영속 저장을 수행합니다.

```text
[Vercel · Client (React)] 
   │  1. 검색 조건 전송 / 캠핑장·날씨 통합 카드 UI 및 통계 차트 표시
   ▼
[Render · API Server (FastAPI)] 
   │  2. API Key 보안 보관 / 고캠핑 API + 기상청 중기예보 API 비동기 호출 및 응답 정규화
   ▼
[Supabase · Database (PostgreSQL)] 
      3. 지역 ↔ regId 매핑 조회 / 캠핑장 데이터 캐싱(camp_cache) / 일정·즐겨찾기 영속 저장
