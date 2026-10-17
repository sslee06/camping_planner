import React, { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const DEMO_USER_ID = "team_camper_01";

const REGION_PRESETS = [
  { label: "경기도 가평", lat: 37.8188, lng: 127.5204 },
  { label: "강원도 춘천", lat: 37.7345, lng: 127.6012 },
  { label: "충남 태안", lat: 36.5123, lng: 126.3321 },
  { label: "강원도 강릉", lat: 37.7519, lng: 128.8761 },
  { label: "제주도", lat: 33.4996, lng: 126.5312 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [keyword, setKeyword] = useState("");
  const [coords, setCoords] = useState({ lat: 37.8188, lng: 127.5204, radius: 20000 });
  const [selectedType, setSelectedType] = useState("전체");
  const [selectedDayOffset, setSelectedDayOffset] = useState(5);
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [plans, setPlans] = useState([]);

  const [modalCamp, setModalCamp] = useState(null);
  const [planForm, setPlanForm] = useState({
    plan_title: "",
    start_date: "2026-10-24",
    end_date: "2026-10-25",
    memo: "침낭, 화로대, 우비 챙기기",
  });

  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchCamps();
  }, []);

  useEffect(() => {
    if (activeTab === "plans") {
      fetchFavorites();
      fetchPlans();
    } else if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [activeTab]);

  const fetchCamps = async (customCoords = coords, customKeyword = keyword) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: customCoords.lat,
        lng: customCoords.lng,
        radius: customCoords.radius,
      });
      if (customKeyword.trim()) {
        params.append("keyword", customKeyword.trim());
      }
      const res = await fetch(`${API_BASE_URL}/api/camps/search?${params.toString()}`);
      const data = await res.json();
      setCamps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("캠핑장 검색 실패:", err);
      alert("백엔드 서버 연결을 확인해주세요!");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFavorite = async (contentId, campName) => {
    try {
      await fetch(`${API_BASE_URL}/api/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: DEMO_USER_ID, content_id: contentId }),
      });
      alert(`❤️ [${campName}] 캠핑장을 찜 목록에 저장했습니다!`);
    } catch (err) {
      console.error("찜하기 오류:", err);
    }
  };

  const fetchFavorites = async () => {
    const res = await fetch(`${API_BASE_URL}/api/favorites/${DEMO_USER_ID}`);
    const json = await res.json();
    setFavorites(json.data || []);
  };

  const fetchPlans = async () => {
    const res = await fetch(`${API_BASE_URL}/api/plans/${DEMO_USER_ID}`);
    const json = await res.json();
    setPlans(json.data || []);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!modalCamp) return;

    try {
      await fetch(`${API_BASE_URL}/api/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: DEMO_USER_ID,
          content_id: modalCamp.campground.id,
          plan_title: planForm.plan_title || `${modalCamp.campground.name} 캠핑 일정`,
          start_date: planForm.start_date,
          end_date: planForm.end_date,
          memo: planForm.memo,
          weather_snapshot: modalCamp.forecast,
        }),
      });
      alert("🗓️ 날씨 스냅샷과 함께 캠핑 일정이 저장되었습니다!");
      setModalCamp(null);
      setActiveTab("plans");
    } catch (err) {
      console.error("일정 저장 오류:", err);
    }
  };

  const fetchAnalytics = async () => {
    const res = await fetch(`${API_BASE_URL}/api/analytics/summary`);
    const data = await res.json();
    setAnalytics(data);
  };

  const getWeatherIcon = (weatherStr) => {
    if (!weatherStr) return "🌤️";
    if (weatherStr.includes("비") || weatherStr.includes("소나기")) return "🌧️";
    if (weatherStr.includes("눈")) return "❄️";
    if (weatherStr.includes("흐림")) return "☁️";
    if (weatherStr.includes("구름")) return "⛅";
    return "☀️";
  };

  const filteredCamps = camps.filter((item) => {
    if (selectedType === "전체") return true;
    return item.campground.type.some((t) => t.includes(selectedType));
  });

  return (
    <div style={styles.container}>
      {/* 스마트폰 세로 모드 완벽 대응을 위한 반응형 스타일 시트 */}
      <style>{`
        @media (max-width: 768px) {
          .cp-header { padding: 16px !important; flex-direction: column !important; align-items: stretch !important; }
          .cp-title { font-size: 21px !important; }
          .cp-nav { width: 100% !important; display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }
          .cp-nav button { padding: 10px 4px !important; font-size: 12px !important; text-align: center !important; white-space: nowrap !important; }
          .cp-main { padding: 12px !important; }
          .cp-search-row { flex-direction: column !important; }
          .cp-search-row button { width: 100% !important; padding: 12px !important; }
          .cp-card-header { flex-direction: column !important; gap: 12px !important; }
          .cp-camp-image { width: 100% !important; height: 190px !important; }
          .cp-camp-info { min-width: 100% !important; }
          .cp-weather-highlight { flex-direction: column !important; gap: 6px !important; align-items: flex-start !important; }
          .cp-forecast-strip { display: flex !important; overflow-x: auto !important; padding-bottom: 6px !important; gap: 8px !important; }
          .cp-forecast-day { min-width: 72px !important; flex-shrink: 0 !important; }
          .cp-card-footer { flex-direction: column !important; gap: 8px !important; }
          .cp-card-footer button, .cp-card-footer a { width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
          .cp-analytics-grid { grid-template-columns: 1fr !important; }
          .cp-date-row { flex-direction: column !important; gap: 10px !important; }
          .cp-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
          .cp-select-wrap { width: 100% !important; margin-left: 0 !important; margin-top: 6px !important; }
        }
      `}</style>

      {/* 상단 헤더 & 네비게이션 */}
      <header className="cp-header" style={styles.header}>
        <div>
          <h1 className="cp-title" style={styles.title}>🏕️ CAMPING PLANNER</h1>
          <p style={styles.subtitle}>
            고캠핑 API × 기상청 중기예보 통합 캠핑 계획 도우미
          </p>
        </div>
        <nav className="cp-nav" style={styles.nav}>
          <button
            style={activeTab === "search" ? styles.activeTabBtn : styles.tabBtn}
            onClick={() => setActiveTab("search")}
          >
            🔍 통합 탐색
          </button>
          <button
            style={activeTab === "plans" ? styles.activeTabBtn : styles.tabBtn}
            onClick={() => setActiveTab("plans")}
          >
            🗓️ 일정·찜
          </button>
          <button
            style={activeTab === "analytics" ? styles.activeTabBtn : styles.tabBtn}
            onClick={() => setActiveTab("analytics")}
          >
            📊 데이터 분석
          </button>
        </nav>
      </header>

      {/* ==================== 탭 1: 캠핑장 + 날씨 통합 검색 ==================== */}
      {activeTab === "search" && (
        <main className="cp-main" style={styles.main}>
          <section style={styles.filterPanel}>
            <div className="cp-search-row" style={styles.searchRow}>
              <input
                type="text"
                placeholder="캠핑장 이름 또는 지역 키워드 (예: 가평, 자라섬)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={styles.searchInput}
              />
              <button onClick={() => fetchCamps(coords, keyword)} style={styles.primaryBtn}>
                통합 검색
              </button>
            </div>

            <div style={styles.presetRow}>
              <span style={styles.filterLabel}>📍 빠른 지역 탐색:</span>
              {REGION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  style={styles.chipBtn}
                  onClick={() => {
                    const nextCoords = { ...coords, lat: preset.lat, lng: preset.lng };
                    setCoords(nextCoords);
                    setKeyword("");
                    fetchCamps(nextCoords, "");
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div style={styles.presetRow}>
              <span style={styles.filterLabel}>⛺ 캠핑 유형:</span>
              {["전체", "자동차야영장", "글램핑", "카라반", "일반야영장"].map((type) => (
                <button
                  key={type}
                  style={selectedType === type ? styles.activeChipBtn : styles.chipBtn}
                  onClick={() => setSelectedType(type)}
                >
                  {type}
                </button>
              ))}

              <div className="cp-select-wrap" style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                <span style={styles.filterLabel}>🌤️ 확인 일정:</span>
                <select
                  value={selectedDayOffset}
                  onChange={(e) => setSelectedDayOffset(Number(e.target.value))}
                  style={styles.selectBox}
                >
                  {[4, 5, 6, 7, 8, 9, 10].map((d) => (
                    <option key={d} value={d}>
                      오늘부터 {d}일 후 예보
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {loading ? (
            <div style={styles.emptyBox}>⏳ 고캠핑 정보와 기상청 예보를 결합하는 중입니다...</div>
          ) : filteredCamps.length === 0 ? (
            <div style={styles.emptyBox}>조건에 맞는 캠핑장이 없습니다.</div>
          ) : (
            <div style={styles.cardGrid}>
              {filteredCamps.map((item) => {
                const { campground, forecast } = item;
                const targetWeather =
                  forecast.find((f) => f.dateOffset === selectedDayOffset) || forecast[0];

                return (
                  <div key={campground.id} style={styles.campCard}>
                    <div className="cp-card-header" style={styles.cardHeader}>
                      {campground.firstImageUrl && (
                        <img
                          className="cp-camp-image"
                          src={campground.firstImageUrl}
                          alt={campground.name}
                          style={styles.campImage}
                        />
                      )}
                      <div className="cp-camp-info" style={styles.campInfo}>
                        <div style={styles.badgeRow}>
                          {campground.type.map((t, i) => (
                            <span key={i} style={styles.typeBadge}>
                              {t}
                            </span>
                          ))}
                          <span style={styles.animalBadge}>
                            🐾 반려동물: {campground.animalCmgCl || "미확인"}
                          </span>
                        </div>
                        <h3 style={styles.campTitle}>{campground.name}</h3>
                        <p style={styles.campAddr}>📍 {campground.addr}</p>
                        <div style={styles.amenityRow}>
                          {campground.amenities.map((am, idx) => (
                            <span key={idx} style={styles.amenityTag}>
                              #{am}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={styles.weatherSection}>
                      <div className="cp-weather-highlight" style={styles.weatherHighlight}>
                        <strong>
                          📌 {selectedDayOffset}일 후 예상 날씨:{" "}
                          {getWeatherIcon(targetWeather?.weather)} {targetWeather?.weather}
                        </strong>
                        <span>
                          💧 강수확률 <b>{targetWeather?.rainProbability}%</b> | 🌡️ 최저{" "}
                          <b>{targetWeather?.minTemp}°C</b> / 최고{" "}
                          <b>{targetWeather?.maxTemp}°C</b>
                        </span>
                      </div>

                      <div className="cp-forecast-strip" style={styles.forecastStrip}>
                        {forecast.map((f) => (
                          <div
                            key={f.dateOffset}
                            className="cp-forecast-day"
                            style={
                              f.dateOffset === selectedDayOffset
                                ? styles.forecastDayActive
                                : styles.forecastDay
                            }
                          >
                            <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                              +{f.dateOffset}일
                            </div>
                            <div style={{ fontSize: "20px", margin: "4px 0" }}>
                              {getWeatherIcon(f.weather)}
                            </div>
                            <div style={{ fontSize: "12px", color: "#2563eb" }}>
                              💧{f.rainProbability}%
                            </div>
                            <div style={{ fontSize: "11px", color: "#4b5563" }}>
                              {f.minTemp}°/{f.maxTemp}°
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="cp-card-footer" style={styles.cardFooter}>
                      <button
                        style={styles.outlineBtn}
                        onClick={() => handleAddFavorite(campground.id, campground.name)}
                      >
                        ❤️ 찜하기
                      </button>
                      <button
                        style={styles.primaryBtn}
                        onClick={() => {
                          setModalCamp(item);
                          setPlanForm({
                            ...planForm,
                            plan_title: `${campground.name} 캠핑 일정`,
                          });
                        }}
                      >
                        🗓️ 이 날씨로 계획 확정
                      </button>
                      {campground.reservationUrl && (
                        <a
                          href={campground.reservationUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.linkBtn}
                        >
                          🔗 공식 예약 페이지
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ==================== 탭 2: 내 캠핑 일정 & 찜 목록 ==================== */}
      {activeTab === "plans" && (
        <main className="cp-main" style={styles.main}>
          <section style={styles.sectionBox}>
            <h2 style={{ fontSize: "19px", marginTop: 0 }}>🗓️ 내가 확정한 캠핑 일정 ({plans.length}건)</h2>
            {plans.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "14px" }}>
                아직 저장된 일정이 없습니다. 탐색 탭에서 [이 날씨로 계획 확정]을 눌러보세요!
              </p>
            ) : (
              <div style={styles.cardGrid}>
                {plans.map((p) => (
                  <div key={p.id} style={styles.planCard}>
                    <h3 style={{ margin: "0 0 6px 0", color: "#065f46", fontSize: "17px" }}>
                      {p.plan_title}
                    </h3>
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>
                      📅 <b>일정:</b> {p.start_date} ~ {p.end_date}
                    </p>
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>
                      ⛺ <b>캠핑장:</b> {p.camp_cache?.faclt_nm} ({p.camp_cache?.addr1})
                    </p>
                    <p style={{ margin: "4px 0", fontSize: "14px" }}>
                      📝 <b>메모:</b> {p.memo}
                    </p>
                    {p.weather_snapshot && p.weather_snapshot.length > 0 && (
                      <div style={styles.snapshotBox}>
                        <small>📸 확정 시점 예보 스냅샷: </small>
                        <b>
                          {p.weather_snapshot[0].weather}, 강수{" "}
                          {p.weather_snapshot[0].rainProbability}%, 최저{" "}
                          {p.weather_snapshot[0].minTemp}°C / 최고{" "}
                          {p.weather_snapshot[0].maxTemp}°C
                        </b>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ ...styles.sectionBox, marginTop: "16px" }}>
            <h2 style={{ fontSize: "19px", marginTop: 0 }}>❤️ 내가 찜한 캠핑장 ({favorites.length}건)</h2>
            {favorites.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: "14px" }}>아직 찜한 캠핑장이 없습니다.</p>
            ) : (
              <div style={styles.cardGrid}>
                {favorites.map((fav) => (
                  <div key={fav.id} style={styles.planCard}>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "17px" }}>{fav.camp_cache?.faclt_nm}</h3>
                    <p style={{ margin: "4px 0", fontSize: "14px", color: "#4b5563" }}>
                      📍 {fav.camp_cache?.addr1}
                    </p>
                    <p style={{ margin: "4px 0", fontSize: "13px", color: "#059669", wordBreak: "keep-all" }}>
                      유형: {fav.camp_cache?.induty} | 시설: {fav.camp_cache?.sbrs_cl}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* ==================== 탭 3: 데이터 기초 분석 및 출처 ==================== */}
      {activeTab === "analytics" && (
        <main className="cp-main" style={styles.main}>
          <section style={styles.sectionBox}>
            <h2 style={{ fontSize: "19px", marginTop: 0 }}>📊 수집 데이터 기초 분석 요약</h2>
            <p style={{ color: "#4b5563", marginBottom: "16px", fontSize: "14px" }}>
              Supabase <code>camp_cache</code> 테이블에 수집된 캠핑장 기초 통계 분석 결과입니다. (총 수집:{" "}
              <b>{analytics?.total_cached_camps || 0}개소</b>)
            </p>

            {analytics && (
              <div className="cp-analytics-grid" style={styles.analyticsGrid}>
                <div style={styles.statCard}>
                  <h3 style={{ fontSize: "16px", marginTop: 0 }}>📍 지역별(시/도) 분포</h3>
                  {Object.entries(analytics.by_region).map(([region, count]) => (
                    <div key={region} style={styles.barRow}>
                      <span style={styles.barLabel}>{region}</span>
                      <div style={styles.barTrack}>
                        <div
                          style={{
                            ...styles.barFill,
                            width: `${Math.min(100, (count / analytics.total_cached_camps) * 100)}%`,
                          }}
                        />
                      </div>
                      <span style={styles.barValue}>{count}곳</span>
                    </div>
                  ))}
                </div>

                <div style={styles.statCard}>
                  <h3 style={{ fontSize: "16px", marginTop: 0 }}>⛺ 캠핑 유형 비율</h3>
                  {Object.entries(analytics.by_type).map(([type, count]) => (
                    <div key={type} style={styles.barRow}>
                      <span style={styles.barLabel}>{type}</span>
                      <div style={styles.barTrack}>
                        <div
                          style={{
                            ...styles.barFill,
                            backgroundColor: "#2563eb",
                            width: `${Math.min(100, (count / analytics.total_cached_camps) * 100)}%`,
                          }}
                        />
                      </div>
                      <span style={styles.barValue}>{count}건</span>
                    </div>
                  ))}
                </div>

                <div style={styles.statCard}>
                  <h3 style={{ fontSize: "16px", marginTop: 0 }}>🐾 반려동물 동반 정책</h3>
                  {Object.entries(analytics.by_animal_policy).map(([policy, count]) => (
                    <div key={policy} style={styles.barRow}>
                      <span style={styles.barLabel}>{policy}</span>
                      <div style={styles.barTrack}>
                        <div
                          style={{
                            ...styles.barFill,
                            backgroundColor: "#d97706",
                            width: `${Math.min(100, (count / analytics.total_cached_camps) * 100)}%`,
                          }}
                        />
                      </div>
                      <span style={styles.barValue}>{count}곳</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section style={{ ...styles.sectionBox, marginTop: "16px" }}>
            <h2 style={{ fontSize: "19px", marginTop: 0 }}>📑 활용 오픈 데이터 및 출처 명시</h2>
            <div className="cp-table-wrap">
              <table style={styles.sourceTable}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th style={styles.th}>데이터 / API 명칭</th>
                    <th style={styles.th}>제공 기관</th>
                    <th style={styles.th}>수집 항목</th>
                    <th style={styles.th}>출처</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.td}><b>한국관광공사_고캠핑 정보</b></td>
                    <td style={styles.td}>한국관광공사</td>
                    <td style={styles.td}>캠핑장명, 주소, 좌표, 유형, 시설</td>
                    <td style={styles.td}>
                      <a href="https://www.data.go.kr/data/15101933/openapi.do" target="_blank" rel="noreferrer">
                        바로가기
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style={styles.td}><b>기상청_중기예보 조회</b></td>
                    <td style={styles.td}>기상청</td>
                    <td style={styles.td}>4~10일 후 강수확률, 날씨, 최저/최고기온</td>
                    <td style={styles.td}>
                      <a href="https://www.data.go.kr/data/15059468/openapi.do" target="_blank" rel="noreferrer">
                        바로가기
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* ==================== 모달: 캠핑 일정 확정 ==================== */}
      {modalCamp && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h2 style={{ marginTop: 0, fontSize: "19px" }}>🗓️ 캠핑 계획 확정 및 저장</h2>
            <p style={{ color: "#4b5563", fontSize: "13px" }}>
              <b>{modalCamp.campground.name}</b> 정보와 현재 기상청 예보 스냅샷을 함께 기록합니다.
            </p>
            <form onSubmit={handleSavePlan} style={styles.form}>
              <label style={styles.formLabel}>
                계획 제목
                <input
                  type="text"
                  value={planForm.plan_title}
                  onChange={(e) => setPlanForm({ ...planForm, plan_title: e.target.value })}
                  required
                  style={styles.formInput}
                />
              </label>
              <div className="cp-date-row" style={{ display: "flex", gap: "12px" }}>
                <label style={{ ...styles.formLabel, flex: 1 }}>
                  시작일
                  <input
                    type="date"
                    value={planForm.start_date}
                    onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })}
                    required
                    style={styles.formInput}
                  />
                </label>
                <label style={{ ...styles.formLabel, flex: 1 }}>
                  종료일
                  <input
                    type="date"
                    value={planForm.end_date}
                    onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value })}
                    required
                    style={styles.formInput}
                  />
                </label>
              </div>
              <label style={styles.formLabel}>
                준비물 및 메모
                <textarea
                  rows={3}
                  value={planForm.memo}
                  onChange={(e) => setPlanForm({ ...planForm, memo: e.target.value })}
                  style={styles.formInput}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={() => setModalCamp(null)} style={styles.outlineBtn}>
                  취소
                </button>
                <button type="submit" style={styles.primaryBtn}>
                  일정 저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    color: "#1e293b",
    width: "100%",
  },
  header: {
    backgroundColor: "#064e3b",
    color: "#ffffff",
    padding: "20px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "14px",
  },
  title: { margin: 0, fontSize: "24px", fontWeight: "800" },
  subtitle: { margin: "4px 0 0 0", fontSize: "13px", color: "#a7f3d0" },
  nav: { display: "flex", gap: "8px" },
  tabBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #047857",
    backgroundColor: "#065f46",
    color: "#ecfdf5",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },
  activeTabBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#10b981",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
  },
  main: { maxWidth: "1100px", margin: "0 auto", padding: "24px", width: "100%" },
  filterPanel: {
    backgroundColor: "#ffffff",
    padding: "16px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    marginBottom: "20px",
  },
  searchRow: { display: "flex", gap: "10px", marginBottom: "12px" },
  searchInput: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    width: "100%",
  },
  presetRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
  },
  filterLabel: { fontSize: "13px", fontWeight: "700", color: "#334155", marginRight: "4px" },
  chipBtn: {
    padding: "6px 12px",
    borderRadius: "20px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#f1f5f9",
    cursor: "pointer",
    fontSize: "12px",
    color: "#334155",
  },
  activeChipBtn: {
    padding: "6px 12px",
    borderRadius: "20px",
    border: "1px solid #059669",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px",
  },
  selectBox: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    backgroundColor: "#ffffff",
  },
  cardGrid: { display: "flex", flexDirection: "column", gap: "16px" },
  campCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  cardHeader: { display: "flex", gap: "16px" },
  campImage: {
    width: "220px",
    height: "150px",
    objectFit: "cover",
    borderRadius: "8px",
    flexShrink: 0,
  },
  campInfo: { flex: 1 },
  badgeRow: { display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" },
  typeBadge: {
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
  },
  animalBadge: {
    backgroundColor: "#fef3c7",
    color: "#b45309",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
  },
  campTitle: { margin: "0 0 6px 0", fontSize: "18px", wordBreak: "keep-all" },
  campAddr: { margin: "0 0 10px 0", color: "#64748b", fontSize: "13px", wordBreak: "keep-all" },
  amenityRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  amenityTag: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
  },
  weatherSection: {
    marginTop: "14px",
    backgroundColor: "#f0fdf4",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #bbf7d0",
  },
  weatherHighlight: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: "10px",
    fontSize: "13px",
    color: "#065f46",
    lineHeight: "1.5",
  },
  forecastStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "6px",
  },
  forecastDay: {
    backgroundColor: "#ffffff",
    padding: "8px 4px",
    borderRadius: "8px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  forecastDayActive: {
    backgroundColor: "#dcfce7",
    padding: "8px 4px",
    borderRadius: "8px",
    textAlign: "center",
    border: "2px solid #10b981",
  },
  cardFooter: {
    marginTop: "14px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  primaryBtn: {
    backgroundColor: "#059669",
    color: "#ffffff",
    border: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
  },
  outlineBtn: {
    backgroundColor: "#ffffff",
    color: "#059669",
    border: "1px solid #059669",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  linkBtn: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    textDecoration: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    display: "inline-block",
  },
  sectionBox: {
    backgroundColor: "#ffffff",
    padding: "18px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  planCard: {
    padding: "14px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  snapshotBox: {
    marginTop: "10px",
    padding: "8px 10px",
    backgroundColor: "#e0f2fe",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#0369a1",
    lineHeight: "1.4",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "14px",
  },
  statCard: {
    padding: "14px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    backgroundColor: "#f8fafc",
  },
  barRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  barLabel: { width: "95px", fontSize: "12px", fontWeight: "600", flexShrink: 0 },
  barTrack: {
    flex: 1,
    height: "10px",
    backgroundColor: "#e2e8f0",
    borderRadius: "6px",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#10b981" },
  barValue: { width: "40px", textAlign: "right", fontSize: "12px", fontWeight: "700", flexShrink: 0 },
  sourceTable: { width: "100%", borderCollapse: "collapse", marginTop: "8px", minWidth: "480px" },
  th: { border: "1px solid #cbd5e1", padding: "8px", textAlign: "left", fontSize: "13px" },
  td: { border: "1px solid #cbd5e1", padding: "8px", fontSize: "13px" },
  emptyBox: {
    textAlign: "center",
    padding: "40px 16px",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    color: "#64748b",
    fontSize: "14px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modalBox: {
    backgroundColor: "#ffffff",
    padding: "20px",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "440px",
  },
  form: { display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" },
  formLabel: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: "600" },
  formInput: { padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", width: "100%" },
};