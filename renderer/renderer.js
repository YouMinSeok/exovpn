// renderer/renderer.js
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const serverSelect = document.getElementById('server-select');
const loadingSpinner = document.getElementById('loading-spinner'); // 로딩 스피너 추가

let isVpnConnected = false;

// OVPN 파일 리스트 가져오기 비동기 함수 호출
async function fetchVPNConfigs() {
    try {
        loadingSpinner.style.display = 'block'; // 로딩 시작
        const servers = await window.api.invoke('get-servers');
        console.log('가져온 서버 리스트:', servers);
        populateServerDropdown(servers);
    } catch (error) {
        console.error('VPN 서버 리스트 가져오기 오류:', error);
        alert('서버 목록을 불러오지 못했습니다. 네트워크를 확인하세요.');
    } finally {
        loadingSpinner.style.display = 'none'; // 로딩 종료
    }
}

// 드롭다운에 서버 목록 추가
function populateServerDropdown(servers) {
    serverSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '서버를 선택하세요...';
    serverSelect.appendChild(defaultOption);

    servers.forEach(serverFile => {
        const serverName = serverFile.replace('.ovpn', '');
        const option = document.createElement('option');
        option.value = serverFile;
        option.textContent = serverName;
        serverSelect.appendChild(option);
        console.log(`추가된 서버: ${serverName}`);
    });

    if (servers.length === 0) {
        alert('서버 목록이 비어 있습니다. OVPN 파일을 추가하세요.');
    }
}

// 연결 버튼 클릭 이벤트
connectBtn.addEventListener('click', () => {
    const selectedServer = serverSelect.value;

    if (!selectedServer) {
        alert('먼저 서버를 선택해주세요.');
        return;
    }

    connectBtn.disabled = true;
    disconnectBtn.disabled = true;

    // DuckDNS 업데이트 요청
    window.api.send('update-duckdns');

    // DuckDNS 업데이트 확인 후 VPN 연결 요청
    window.api.receive('duckdns-updated', (message) => {
        console.log(message);

        if (message.startsWith('DuckDNS가 성공적으로')) {
            // VPN 연결 요청
            window.api.send('start-vpn', selectedServer);
        } else {
            connectBtn.disabled = false;
            alert(`DuckDNS 업데이트 실패: ${message}`);
        }
    });
});

// 연결 종료 버튼 클릭 이벤트
disconnectBtn.addEventListener('click', () => {
    window.api.send('disconnect-vpn');
    disconnectBtn.disabled = true;
    connectBtn.disabled = false;
});

// VPN 상태 업데이트
window.api.receive('vpn-status', (message) => {
    console.log(`VPN 상태: ${message}`);
    if (message.includes('Initialization Sequence Completed')) {
        isVpnConnected = true;
        disconnectBtn.disabled = false;
    }
    if (message.includes('VPN 연결 종료')) {
        isVpnConnected = false;
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
    }
});

// 서버 목록 불러오기
fetchVPNConfigs();
