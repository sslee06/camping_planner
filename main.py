import os
from datetime import datetime, timedelta
from typing import List, Optional
import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# 앞서 만든 database.py에서 함수 가져오기
from database import (
    supabase,
    get_weather_reg_ids,
    upsert_camp_cache,
    add_favorite,
    create_camp_plan,
)

load_dotenv()

GOCAMPING_API_KEY = os.getenv("GOCAMPING_API_KEY", "")
KMA_API_KEY = os.getenv("KMA_API_KEY", "")

app = FastAPI(
    title="🏕️ 캠핑 플래너 API 서버 (Camping Planner API)",
    description="한국관광공사 고캠핑 API와 기상청 중기예보 API를 결합하여 캠핑장 정보와 날씨를 한 화면에서 제공하는 백엔드 API입니다.",
    version="1.0.0",
)

# 프론트엔드(React/Vercel) 연동을 위한 CORS 전체 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================
# 1. Pydantic 데이터 모델 (Swagger UI 및 API 설명 문서 자동 생성용)
# ==========================================================
class LocationModel(BaseModel):
    lat: float = Field(..., description="위도 (mapY)")
    lng: float = Field(..., description="경도 (mapX)")

class CampgroundModel(BaseModel):
    id: str = Field(..., description="고캠핑 고유키 (contentId)")
    name: str = Field(..., description="캠핑장명 (facltNm)")
    addr: Optional[str] = Field(None, description="주소 (addr1)")
    location: LocationModel
    type: List[str] = Field(..., description="캠핑 유형 (induty)")
    amenities: List[str] = Field(..., description="부대시설 목록 (sbrsCl)")
    animalCmgCl: Optional[str] = Field(None, description="반려동물 동반 가능 여부")
    firstImageUrl: Optional[str] = Field(None, description="대표 이미지 URL")
    reservationUrl: Optional[str] = Field(None, description="예약 페이지 링크 (resveUrl)")

class ForecastItemModel(BaseModel):
    dateOffset: int = Field(..., description="오늘 기준 며칠 뒤인지 (4~10일 후)")
    weather: str = Field(..., description="날씨 상태 (예: 맑음, 구름많음)")
    rainProbability: int = Field(..., description="강수확률 (%)")
    minTemp: int = Field(..., description="예상 최저기온 (°C)")
    maxTemp: int = Field(..., description="예상 최고기온 (°C)")

class CombinedCampResponse(BaseModel):
    campground: CampgroundModel
    forecast: List[ForecastItemModel]

class FavoriteRequest(BaseModel):
    user_id: str = Field(..., example="user_123", description="사용자 식별 ID")
    content_id: str = Field(..., example="29", description="찜할 캠핑장 고유키")

class PlanRequest(BaseModel):
    user_id: str = Field(..., example="user_123", description="사용자 식별 ID")
    content_id: str = Field(..., example="29", description="캠핑장 고유키")
    plan_title: str = Field(..., example="가을 단풍 가평 캠핑", description="일정 제목")
    start_date: str = Field(..., example="2026-10-24", description="캠핑 시작일 (YYYY-MM-DD)")
    end_date: str = Field(..., example="2026-10-25", description="캠핑 종료일 (YYYY-MM-DD)")
    memo: Optional[str] = Field("침낭, 화로대 챙기기", description="메모 및 준비물")
    weather_snapshot: List[ForecastItemModel] = Field(default=[], description="확정 당시 날씨 예보 스냅샷")


# ==========================================================
# 2. 도우미 함수: 기상청 발표시각(tmFc) 자동 계산 및 API 호출
# ==========================================================
def get_latest_tmFc() -> str:
    """기상청 중기예보 발표시각(매일 06:00, 18:00) 중 가장 최근 시각을 YYYYMMDDHHMM 형식으로 반환"""
    now = datetime.now()
    if now.hour < 6:
        yesterday = now - timedelta(days=1)
        return yesterday.strftime("%Y%m%d1800")
    elif now.hour < 18:
        return now.strftime("%Y%m%d0600")
    else:
        return now.strftime("%Y%m%d1800")


async def fetch_gocamping_data(lat: float, lng: float, radius: int = 20000, keyword: Optional[str] = None) -> List[dict]:
    """고캠핑 API 호출 (키워드 검색 또는 위치기반 검색). 키가 없거나 실패 시 샘플 데이터 반환."""
    if not GOCAMPING_API_KEY or "여기에" in GOCAMPING_API_KEY:
        return get_mock_camps()

    base_url = "http://apis.data.go.kr/B551011/GoCamping"
    endpoint = f"{base_url}/searchList" if keyword else f"{base_url}/locationBasedList"
    
    params = {
        "serviceKey": GOCAMPING_API_KEY,
        "numOfRows": 15,
        "pageNo": 1,
        "MobileOS": "ETC",
        "MobileApp": "CampingPlanner",
        "_type": "json",
    }
    if keyword:
        params["keyword"] = keyword
    else:
        params["mapX"] = str(lng)
        params["mapY"] = str(lat)
        params["radius"] = str(radius)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(endpoint, params=params)
            data = resp.json()
            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            return items if isinstance(items, list) else ([items] if items else get_mock_camps())
    except Exception as e:
        print(f"[고캠핑 API 호출 실패 - 샘플 데이터로 대체]: {e}")
        return get_mock_camps()


async def fetch_kma_forecast(land_reg_id: str, ta_reg_id: str) -> List[dict]:
    """기상청 중기육상예보(강수/날씨) + 중기기온(최저/최고기온) 호출 후 4~10일 예보 리스트로 결합"""
    if not KMA_API_KEY or "여기에" in KMA_API_KEY:
        return get_mock_forecast()

    tm_fc = get_latest_tmFc()
    land_url = "http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst"
    ta_url = "http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa"

    params_land = {"serviceKey": KMA_API_KEY, "numOfRows": 10, "pageNo": 1, "dataType": "JSON", "regId": land_reg_id, "tmFc": tm_fc}
    params_ta = {"serviceKey": KMA_API_KEY, "numOfRows": 10, "pageNo": 1, "dataType": "JSON", "regId": ta_reg_id, "tmFc": tm_fc}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res_land = await client.get(land_url, params=params_land)
            res_ta = await client.get(ta_url, params=params_ta)
            
            land_item = res_land.json()["response"]["body"]["items"]["item"][0]
            ta_item = res_ta.json()["response"]["body"]["items"]["item"][0]

            forecast_list = []
            for day in range(4, 11):  # 4일 후 ~ 10일 후 중기예보 추출
                # 4~7일은 오전/오후(Am/Pm)로 나뉘고 8~10일은 단일 필드로 제공됨
                wf = land_item.get(f"wf{day}Pm") or land_item.get(f"wf{day}", "맑음")
                rn_st = land_item.get(f"rnSt{day}Pm") or land_item.get(f"rnSt{day}", 20)
                min_t = ta_item.get(f"taMin{day}", 12)
                max_t = ta_item.get(f"taMax{day}", 22)

                forecast_list.append({
                    "dateOffset": day,
                    "weather": str(wf),
                    "rainProbability": int(rn_st),
                    "minTemp": int(min_t),
                    "maxTemp": int(max_t),
                })
            return forecast_list
    except Exception as e:
        print(f"[기상청 API 호출 실패 - 샘플 날씨로 대체]: {e}")
        return get_mock_forecast()


# ==========================================================
# 3. API 키 없을 때 작동할 테스트용 샘플(Mock) 데이터
# ==========================================================
def get_mock_camps() -> List[dict]:
    return [
        {
            "contentId": "29",
            "facltNm": "가평 자라섬 오토캠핑장",
            "addr1": "경기도 가평군 가평읍 자라섬로 60",
            "doNm": "경기도",
            "sigunguNm": "가평군",
            "mapX": "127.5204",
            "mapY": "37.8188",
            "induty": "자동차야영장,카라반",
            "lctCl": "강,호수",
            "sbrsCl": "전기,무선인터넷,온수,산책로,운동시설",
            "animalCmgCl": "불가능",
            "resveUrl": "https://www.gp.go.kr/camping",
            "firstImageUrl": "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600"
        },
        {
            "contentId": "104",
            "facltNm": "춘천 숲속 글램핑 & 캠핑장",
            "addr1": "강원특별자치도 춘천시 남면 가옹개길 52",
            "doNm": "강원특별자치도",
            "sigunguNm": "춘천시",
            "mapX": "127.6012",
            "mapY": "37.7345",
            "induty": "글램핑,일반야영장",
            "lctCl": "산,숲",
            "sbrsCl": "전기,온수,무선인터넷,물놀이장,장작판매",
            "animalCmgCl": "가능(소형견)",
            "resveUrl": "https://gocamping.or.kr",
            "firstImageUrl": "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=600"
        },
        {
            "contentId": "205",
            "facltNm": "태안 해변 솔향기 캠핑장",
            "addr1": "충청남도 태안군 안면읍 해안관광로 120",
            "doNm": "충청남도",
            "sigunguNm": "태안군",
            "mapX": "126.3321",
            "mapY": "36.5123",
            "induty": "자동차야영장,글램핑",
            "lctCl": "해변",
            "sbrsCl": "전기,온수,편의점,산책로",
            "animalCmgCl": "가능",
            "resveUrl": "https://gocamping.or.kr",
            "firstImageUrl": "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600"
        }
    ]

def get_mock_forecast() -> List[dict]:
    return [
        {"dateOffset": 4, "weather": "맑음", "rainProbability": 10, "minTemp": 11, "maxTemp": 21},
        {"dateOffset": 5, "weather": "구름많음", "rainProbability": 30, "minTemp": 13, "maxTemp": 20},
        {"dateOffset": 6, "weather": "맑음", "rainProbability": 10, "minTemp": 10, "maxTemp": 19},
        {"dateOffset": 7, "weather": "흐림", "rainProbability": 40, "minTemp": 12, "maxTemp": 18},
    ]


# ==========================================================
# 4. 주요 API 엔드포인트 (라우터)
# ==========================================================
@app.get("/", summary="서버 상태 확인")
def health_check():
    return {"status": "ok", "message": "Camping Planner API Server is running!"}


@app.get(
    "/api/camps/search",
    response_model=List[CombinedCampResponse],
    summary="캠핑장 검색 + 기상청 중기예보 통합 조회 (핵심 API)",
    description="위치(위도/경도/반경) 또는 키워드로 캠핑장을 검색하고, 각 캠핑장 주소에 매핑되는 기상청 중기예보를 결합하여 정규화된 JSON으로 반환합니다."
)
async def search_camps_with_weather(
    lat: float = Query(37.8188, description="검색 중심 위도 (기본값: 가평)"),
    lng: float = Query(127.5204, description="검색 중심 경도 (기본값: 가평)"),
    radius: int = Query(20000, description="검색 반경(m), 최대 20000"),
    keyword: Optional[str] = Query(None, description="검색 키워드 (예: 가평, 글램핑 등. 입력 시 키워드 검색 우선)")
):
    raw_camps = await fetch_gocamping_data(lat, lng, radius, keyword)
    combined_results = []

    for item in raw_camps:
        do_nm = item.get("doNm") or "경기도"
        sigungu_nm = item.get("sigunguNm") or "가평군"

        # 1) Supabase DB에서 해당 지역의 기상청 regId 조회
        reg_info = get_weather_reg_ids(do_nm, sigungu_nm)
        
        # 2) 캠핑장 정보를 Supabase camp_cache 테이블에 자동 캐싱(Upsert)
        try:
            upsert_camp_cache(item, region_map_id=reg_info.get("id"))
        except Exception as e:
            print(f"[DB 캐시 저장 참고 로그]: {e}")

        # 3) 기상청 예보 조회
        forecast_data = await fetch_kma_forecast(reg_info["land_reg_id"], reg_info["ta_reg_id"])

        # 4) 기획서 3페이지 스펙과 동일한 JSON 형태로 정규화
        induty_list = [x.strip() for x in (item.get("induty") or "일반야영장").split(",") if x.strip()]
        amenities_list = [x.strip() for x in (item.get("sbrsCl") or "").split(",") if x.strip()]

        normalized_item = {
            "campground": {
                "id": str(item.get("contentId")),
                "name": item.get("facltNm", "이름 없음"),
                "addr": item.get("addr1", ""),
                "location": {
                    "lat": float(item.get("mapY", 37.5)),
                    "lng": float(item.get("mapX", 127.0)),
                },
                "type": induty_list,
                "amenities": amenities_list,
                "animalCmgCl": item.get("animalCmgCl", "정보없음"),
                "firstImageUrl": item.get("firstImageUrl", ""),
                "reservationUrl": item.get("resveUrl", ""),
            },
            "forecast": forecast_data,
        }
        combined_results.append(normalized_item)

    return combined_results


@app.get(
    "/api/analytics/summary",
    summary="수집 데이터 기초 분석 및 통계 조회 (발표 필수 페이지용)",
    description="Supabase camp_cache에 수집된 캠핑장 데이터를 바탕으로 지역별 분포, 캠핑 유형 비율, 반려동물 동반 가능 여부 통계를 반환합니다."
)
def get_analytics_summary():
    res = supabase.table("camp_cache").select("*").execute()
    rows = res.data or []

    # 만약 아직 검색 전이라 DB가 비어 있으면 초기 샘플 데이터를 먼저 캐시에 넣음
    if not rows:
        for mock_item in get_mock_camps():
            reg = get_weather_reg_ids(mock_item["doNm"], mock_item["sigunguNm"])
            upsert_camp_cache(mock_item, region_map_id=reg.get("id"))
        rows = supabase.table("camp_cache").select("*").execute().data or []

    region_counts = {}
    type_counts = {}
    animal_counts = {}

    for r in rows:
        # 지역별 집계
        do_nm = r.get("do_nm") or "기타"
        region_counts[do_nm] = region_counts.get(do_nm, 0) + 1

        # 캠핑 유형별 집계
        for t in (r.get("induty") or "기타").split(","):
            t = t.strip()
            if t:
                type_counts[t] = type_counts.get(t, 0) + 1

        # 반려동물 가능 여부 집계
        animal = r.get("animal_cmg_cl") or "미확인"
        animal_counts[animal] = animal_counts.get(animal, 0) + 1

    return {
        "total_cached_camps": len(rows),
        "by_region": region_counts,
        "by_type": type_counts,
        "by_animal_policy": animal_counts,
        "data_sources": [
            {
                "name": "한국관광공사_고캠핑 정보 조회서비스_GW",
                "provider": "한국관광공사",
                "url": "https://www.data.go.kr/data/15101933/openapi.do"
            },
            {
                "name": "기상청_중기예보 조회서비스",
                "provider": "기상청",
                "url": "https://www.data.go.kr/data/15059468/openapi.do"
            }
        ]
    }


@app.post("/api/favorites", summary="캠핑장 찜하기 추가")
def create_favorite_endpoint(req: FavoriteRequest):
    res = add_favorite(req.user_id, req.content_id)
    return {"status": "success", "data": res}


@app.get("/api/favorites/{user_id}", summary="내가 찜한 캠핑장 목록 조회")
def list_favorites_endpoint(user_id: str):
    # camp_cache 테이블과 외래키(FK) 조인하여 캠핑장 상세 정보까지 한 번에 반환
    res = supabase.table("favorites").select("*, camp_cache(*)").eq("user_id", user_id).execute()
    return {"status": "success", "data": res.data}


@app.post("/api/plans", summary="캠핑 일정 계획 저장 (날씨 스냅샷 포함)")
def create_plan_endpoint(req: PlanRequest):
    snapshot_dicts = [item.model_dump() for item in req.weather_snapshot]
    res = create_camp_plan(
        user_id=req.user_id,
        content_id=req.content_id,
        title=req.plan_title,
        start_date=req.start_date,
        end_date=req.end_date,
        weather_snapshot=snapshot_dicts,
        memo=req.memo or "",
    )
    return {"status": "success", "data": res}


@app.get("/api/plans/{user_id}", summary="내 캠핑 일정 목록 조회")
def list_plans_endpoint(user_id: str):
    res = supabase.table("camp_plans").select("*, camp_cache(*)").eq("user_id", user_id).order("start_date").execute()
    return {"status": "success", "data": res.data}