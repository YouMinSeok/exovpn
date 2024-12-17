// scripts/update-duckdns.js
require('dotenv').config(); // 환경 변수 로드
const axios = require('axios');

// DuckDNS 설정
const DUCKDNS_DOMAIN = process.env.DUCKDNS_DOMAIN;
const DUCKDNS_TOKEN = process.env.DUCKDNS_TOKEN;

// DuckDNS IP 업데이트 함수
async function updateDuckDNS() {
    try {
        console.log('DuckDNS IP 업데이트 중...');
        const response = await axios.get(
            `https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=`
        );

        if (response.data === 'OK') {
            console.log(`DuckDNS IP가 성공적으로 업데이트되었습니다: ${DUCKDNS_DOMAIN}`);
        } else {
            console.error('DuckDNS IP 업데이트 실패:', response.data);
        }
    } catch (error) {
        console.error('DuckDNS 업데이트 오류:', error.message);
    }
}

// 스크립트 실행
updateDuckDNS();
