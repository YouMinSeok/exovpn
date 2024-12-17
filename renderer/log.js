// log.js
const logElement = document.getElementById('log');

// 로그 데이터 수신
window.logAPI.receive('vpn-log', (message) => {
    logElement.textContent += message;
    logElement.scrollTop = logElement.scrollHeight; // 자동 스크롤
});
