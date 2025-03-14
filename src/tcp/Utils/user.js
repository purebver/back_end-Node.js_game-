const db = require("../../db/database.js");

const disqualifiedUsers = new Set();
const activeUsers = new Set();
const lastClickTime = new Map();

// 현재 저장된 세션을 출력하는 함수 확인용
const printAllSessions = () => {
  const sessions = db.prepare("SELECT * FROM sessions").all();
  console.log("현재 DB에 저장된 세션 목록:");
  console.table(sessions);
};

// 세션 확인
const getUserFromSession = (sessionId) => {
  // printAllSessions();
  const session = db
    .prepare("SELECT userId FROM sessions WHERE sessionId = ?")
    .get(sessionId);
  return session;
};

// 유저 실격 처리
const disqualifyUser = (userId, reason) => {
  // 이미 실격 되어있을경우 리턴
  if (disqualifiedUsers.has(userId)) {
    return;
  }

  console.log(`${userId}실격 처리. 이유: ${reason}`);
  disqualifiedUsers.add(userId);
  activeUsers.delete(userId);
  lastClickTime.delete(userId);

  if (process.send) {
    process.send({ type: "Disqualified", userId });
  }
};

// 10초 실격
const checkInactiveUsers = () => {
  const now = Number(process.hrtime.bigint() / 1000n);
  for (const userId of activeUsers) {
    const lastTime = lastClickTime.get(userId);
    if (lastTime && now - lastTime > 10000000) {
      disqualifyUser(userId, "10초 이내 클릭이 없음.");
    }
  }
};

// 우승자 판별
const determineWinner = () => {
  // 쿼리문
  let queryParams = [];
  let query = `
  SELECT A.user_id AS id, COUNT(*) AS click_count, MAX(A.timestamp) AS last_click, B.address
  FROM clicks A 
  JOIN users B ON A.user_id = B.id
`;
  if (disqualifiedUsers.size > 0) {
    const disqualify = [...disqualifiedUsers].map(() => "?").join(",");
    query += ` WHERE A.user_id NOT IN (${disqualify})`;
    queryParams = [...disqualifiedUsers];
  }
  query += `
    GROUP BY A.user_id
    ORDER BY click_count DESC, last_click ASC
    LIMIT 1;
  `;

  // 클릭 개수 내림차순-마지막클릭 오름차순 으로 우승자 판별 + 유저 주소
  const winner = db.prepare(query).get(...queryParams);

  if (winner) {
    console.log(
      `우승자: ${winner.id}, 주소: ${winner.address}, 클릭 횟수: ${winner.click_count}`
    );
  } else {
    console.log("우승자가 없습니다.");
  }
};

module.exports = {
  getUserFromSession,
  disqualifyUser,
  checkInactiveUsers,
  determineWinner,
  disqualifiedUsers,
  activeUsers,
  lastClickTime,
};
