import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Supabase 클라이언트 초기화
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 1. [weather_region_map] 주소(도, 시군구)로 기상청 regId 조회하기
def get_weather_reg_ids(do_name: str, sigungu_name: str):
    # 정확한 시/군/구 매칭 시도
    res = supabase.table("weather_region_map") \
        .select("*") \
        .eq("do_name", do_name) \
        .eq("sigungu_name", sigungu_name) \
        .execute()
    
    if res.data:
        return res.data[0]
    
    # 시/군/구가 없으면 같은 도(광역)의 첫 번째 대표 코드로 Fallback
    fallback = supabase.table("weather_region_map") \
        .select("*") \
        .ilike("do_name", f"%{do_name[:2]}%") \
        .limit(1) \
        .execute()
    
    return fallback.data[0] if fallback.data else {
        "id": None,
        "land_reg_id": "11B00000", # 기본값: 수도권
        "ta_reg_id": "11B10101"
    }

# 2. [camp_cache] 고캠핑 API 응답 결과를 DB에 캐싱 (Upsert)
def upsert_camp_cache(camp_item: dict, region_map_id: int = None):
    data = {
        "content_id": str(camp_item.get("contentId")),
        "faclt_nm": camp_item.get("facltNm"),
        "addr1": camp_item.get("addr1"),
        "do_nm": camp_item.get("doNm"),
        "sigungu_nm": camp_item.get("sigunguNm"),
        "map_x": float(camp_item.get("mapX", 0)) if camp_item.get("mapX") else None,
        "map_y": float(camp_item.get("mapY", 0)) if camp_item.get("mapY") else None,
        "induty": camp_item.get("induty"),
        "lct_cl": camp_item.get("lctCl"),
        "sbrs_cl": camp_item.get("sbrsCl"),
        "animal_cmg_cl": camp_item.get("animalCmgCl"),
        "resve_url": camp_item.get("resveUrl"),
        "first_image_url": camp_item.get("firstImageUrl"),
        "region_map_id": region_map_id,
        "raw_json": camp_item
    }
    res = supabase.table("camp_cache").upsert(data, on_conflict="content_id").execute()
    return res.data

# 3. [favorites] 캠핑장 찜하기 추가
def add_favorite(user_id: str, content_id: str):
    data = {"user_id": user_id, "content_id": content_id}
    res = supabase.table("favorites").upsert(data, on_conflict="user_id,content_id").execute()
    return res.data

# 4. [camp_plans] 캠핑 일정 저장하기 (날씨 스냅샷 포함)
def create_camp_plan(user_id: str, content_id: str, title: str, start_date: str, end_date: str, weather_snapshot: list, memo: str = ""):
    data = {
        "user_id": user_id,
        "content_id": content_id,
        "plan_title": title,
        "start_date": start_date,
        "end_date": end_date,
        "memo": memo,
        "weather_snapshot": weather_snapshot
    }
    res = supabase.table("camp_plans").insert(data).execute()
    return res.data